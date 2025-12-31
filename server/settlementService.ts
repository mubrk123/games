import { storage, db } from "./storage";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { cricketApiService } from "./cricketApi";

interface SettlementResult {
  betId: string;
  oddsType: string;
  userId: string;
  status: 'WON' | 'LOST' | 'VOID';
  payout: number;
}

class SettlementService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  async getOpenBets(): Promise<schema.Bet[]> {
    return await db.select()
      .from(schema.bets)
      .where(eq(schema.bets.status, 'OPEN'));
  }

  async getOpenBetsByMatch(matchId: string): Promise<schema.Bet[]> {
    return await db.select()
      .from(schema.bets)
      .where(and(
        eq(schema.bets.matchId, matchId),
        eq(schema.bets.status, 'OPEN')
      ));
  }

  async settleBet(betId: string, status: 'WON' | 'LOST' | 'VOID'): Promise<void> {
    await db.update(schema.bets)
      .set({ 
        status, 
        settledAt: new Date() 
      })
      .where(eq(schema.bets.id, betId));
  }

  private normalizeTeamName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  determineWinner(
    bet: schema.Bet,
    winningTeam: string
  ): 'WON' | 'LOST' | 'VOID' {
    const runnerName = bet.runnerName;
    
    if (!runnerName) {
      console.warn(`Bet ${bet.id} has no runnerName, voiding`);
      return 'VOID';
    }

    const normalizedRunner = this.normalizeTeamName(runnerName);
    const normalizedWinner = this.normalizeTeamName(winningTeam);

    const didWin = normalizedRunner === normalizedWinner;

    const betType = bet.type;
    if (betType === 'BACK') {
      return didWin ? 'WON' : 'LOST';
    } else {
      return didWin ? 'LOST' : 'WON';
    }
  }

  async processSettlement(
    bet: schema.Bet,
    outcome: 'WON' | 'LOST' | 'VOID'
  ): Promise<SettlementResult> {
    const user = await storage.getUser(bet.userId);
    if (!user) {
      throw new Error(`User not found: ${bet.userId}`);
    }

    const stake = parseFloat(bet.stake);
    const potentialProfit = parseFloat(bet.potentialProfit);
    const currentBalance = parseFloat(user.balance);
    
    let payout = 0;
    let transactionType = '';
    let description = '';

    if (outcome === 'WON') {
      if (bet.type === 'BACK') {
        payout = stake + potentialProfit;
        description = `Back bet won: ${bet.runnerName || 'unknown'}`;
      } else {
        payout = stake + stake;
        description = `Lay bet won: ${bet.runnerName || 'unknown'} lost`;
      }
      transactionType = 'BET_WON';
    } else if (outcome === 'LOST') {
      if (bet.type === 'BACK') {
        payout = 0;
        description = `Back bet lost: ${bet.runnerName || 'unknown'}`;
      } else {
        payout = 0;
        description = `Lay bet lost: ${bet.runnerName || 'unknown'} won`;
      }
      transactionType = 'BET_LOST';
    } else {
      payout = stake;
      transactionType = 'BET_VOID';
      description = `Bet voided: stake returned`;
    }

    await this.settleBet(bet.id, outcome);

    if (payout > 0) {
      const newBalance = currentBalance + payout;
      await storage.updateUserBalance(bet.userId, newBalance);
      
      await storage.createWalletTransaction({
        userId: bet.userId,
        amount: String(payout),
        type: transactionType,
        description,
      });
    } else {
      await storage.createWalletTransaction({
        userId: bet.userId,
        amount: '0',
        type: transactionType,
        description,
      });
    }

    console.log(`Settled bet ${bet.id}: ${outcome}, payout: ₹${payout}`);
    
    return {
      betId: bet.id,
      oddsType: bet.type,
      userId: bet.userId,
      status: outcome,
      payout,
    };
  }

  async settleMatchBets(
    matchId: string,
    winningTeam: string
  ): Promise<SettlementResult[]> {
    const openBets = await this.getOpenBetsByMatch(matchId);
    const results: SettlementResult[] = [];

    console.log(`Settling ${openBets.length} bets for match ${matchId}, winner: ${winningTeam}`);

    for (const bet of openBets) {
      try {
        const outcome = this.determineWinner(bet, winningTeam);
        const result = await this.processSettlement(bet, outcome);
        results.push(result);
      } catch (error) {
        console.error(`Failed to settle bet ${bet.id}:`, error);
      }
    }

    return results;
  }

  async checkAndSettleFinishedMatches(): Promise<void> {
    try {
      const openBets = await this.getOpenBets();
      
      if (openBets.length === 0) {
        return;
      }

      const matchIds = Array.from(new Set(openBets.map(b => b.matchId)));
      console.log(`Checking ${matchIds.length} matches with open bets`);
      
      for (const matchId of matchIds) {
        if (matchId.startsWith('cricket-')) {
          const cleanId = matchId.replace('cricket-', '');
          
          try {
            const matchInfo = await cricketApiService.getMatchInfo(cleanId);
            
            if (matchInfo && matchInfo.matchEnded) {
              const winner = this.extractWinner(matchInfo);
              
              if (winner) {
                console.log(`Match ${matchId} ended. Winner: ${winner}`);
                await this.settleMatchBets(matchId, winner);
              } else {
                console.log(`Match ${matchId} ended but no clear winner found`);
              }
            }
          } catch (error) {
            console.error(`Failed to check match ${matchId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Settlement check failed:', error);
    }
  }

  extractWinner(matchInfo: any): string | null {
    if (matchInfo.status) {
      const status = matchInfo.status;
      
      const wonByPattern = /^(.+?)\s+won\s+by/i;
      const wonMatch = status.match(wonByPattern);
      if (wonMatch) {
        return wonMatch[1].trim();
      }
      
      const wonPattern = /^(.+?)\s+won/i;
      const simpleWonMatch = status.match(wonPattern);
      if (simpleWonMatch) {
        return simpleWonMatch[1].trim();
      }
    }
    
    return null;
  }

  start(intervalMs: number = 30000): void {
    if (this.isRunning) {
      console.log('Settlement service already running');
      return;
    }

    this.isRunning = true;
    console.log(`Settlement service started (checking every ${intervalMs / 1000}s)`);

    setTimeout(() => {
      this.checkAndSettleFinishedMatches();
    }, 5000);

    this.intervalId = setInterval(() => {
      this.checkAndSettleFinishedMatches();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Settlement service stopped');
  }
}

export const settlementService = new SettlementService();

import { storage, db, pool } from "./storage";
import { eq, and, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import { cricketApiService } from "./cricketApi";
import { oddsApiService, POPULAR_SPORTS, OddsApiScore } from "./oddsApi";

interface SettlementResult {
  betId: string;
  oddsType: string;
  userId: string;
  status: 'WON' | 'LOST' | 'VOID';
  payout: number;
}

interface SettlementLog {
  matchId: string;
  sport: string;
  winner: string | null;
  betsSettled: number;
  totalPayout: number;
  timestamp: Date;
  errors: string[];
}

class SettlementService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private settlementLogs: SettlementLog[] = [];

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

  private normalizeTeamName(name: string): string {
    return name.toLowerCase().trim()
      .replace(/\s+/g, ' ')
      .replace(/fc$|sc$|cf$|afc$/i, '')
      .replace(/united|city|town|rovers|wanderers/gi, '')
      .trim();
  }

  private teamsMatch(team1: string, team2: string): boolean {
    const norm1 = this.normalizeTeamName(team1);
    const norm2 = this.normalizeTeamName(team2);
    
    if (norm1 === norm2) return true;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
    
    const words1 = norm1.split(' ').filter(w => w.length > 2);
    const words2 = norm2.split(' ').filter(w => w.length > 2);
    const commonWords = words1.filter(w => words2.includes(w));
    
    return commonWords.length > 0;
  }

  determineWinner(
    bet: schema.Bet,
    winningTeam: string,
    isDraw: boolean = false
  ): 'WON' | 'LOST' | 'VOID' {
    const runnerName = bet.runnerName;
    
    if (!runnerName) {
      console.warn(`[Settlement] Bet ${bet.id} has no runnerName, voiding`);
      return 'VOID';
    }

    if (isDraw) {
      const isDrawBet = runnerName.toLowerCase() === 'draw' || 
                        runnerName.toLowerCase() === 'tie';
      if (bet.type === 'BACK') {
        return isDrawBet ? 'WON' : 'LOST';
      } else {
        return isDrawBet ? 'LOST' : 'WON';
      }
    }

    const didWin = this.teamsMatch(runnerName, winningTeam);

    if (bet.type === 'BACK') {
      return didWin ? 'WON' : 'LOST';
    } else {
      return didWin ? 'LOST' : 'WON';
    }
  }

  async processSettlementWithTransaction(
    bet: schema.Bet,
    outcome: 'WON' | 'LOST' | 'VOID'
  ): Promise<SettlementResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT id, balance, exposure FROM users WHERE id = $1 FOR UPDATE',
        [bet.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error(`User not found: ${bet.userId}`);
      }

      const user = userResult.rows[0];
      const stake = parseFloat(bet.stake);
      const potentialProfit = parseFloat(bet.potentialProfit);
      const currentBalance = parseFloat(user.balance);
      const currentExposure = parseFloat(user.exposure);
      
      let payout = 0;
      let transactionType = '';
      let description = '';
      const liability = potentialProfit;

      if (outcome === 'WON') {
        if (bet.type === 'BACK') {
          payout = stake + potentialProfit;
          description = `Back bet won: ${bet.runnerName || 'unknown'} - Stake ₹${stake} + Profit ₹${potentialProfit}`;
        } else {
          payout = stake + liability;
          description = `Lay bet won: ${bet.runnerName || 'unknown'} lost - Stake ₹${stake} + Liability ₹${liability} returned`;
        }
        transactionType = 'BET_WON';
      } else if (outcome === 'LOST') {
        if (bet.type === 'BACK') {
          payout = 0;
          description = `Back bet lost: ${bet.runnerName || 'unknown'} - Lost stake ₹${stake}`;
        } else {
          payout = 0;
          description = `Lay bet lost: ${bet.runnerName || 'unknown'} won - Lost liability ₹${liability}`;
        }
        transactionType = 'BET_LOST';
      } else {
        if (bet.type === 'BACK') {
          payout = stake;
          description = `Back bet voided: stake ₹${stake} returned`;
        } else {
          payout = stake + liability;
          description = `Lay bet voided: stake ₹${stake} + liability ₹${liability} returned`;
        }
        transactionType = 'BET_VOID';
      }

      await client.query(
        `UPDATE bets SET status = $1, settled_at = NOW() WHERE id = $2`,
        [outcome, bet.id]
      );

      const newBalance = currentBalance + payout;
      const newExposure = Math.max(0, currentExposure - stake);

      await client.query(
        'UPDATE users SET balance = $1, exposure = $2 WHERE id = $3',
        [newBalance.toString(), newExposure.toString(), bet.userId]
      );

      await client.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, description, balance)
         VALUES ($1, $2, $3, $4, $5)`,
        [bet.userId, payout.toString(), transactionType, description, newBalance.toString()]
      );

      await client.query('COMMIT');

      console.log(`[Settlement] Settled bet ${bet.id}: ${outcome}, payout: ₹${payout}`);
      
      return {
        betId: bet.id,
        oddsType: bet.type,
        userId: bet.userId,
        status: outcome,
        payout,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async settleMatchBets(
    matchId: string,
    winningTeam: string,
    isDraw: boolean = false
  ): Promise<SettlementResult[]> {
    const openBets = await this.getOpenBetsByMatch(matchId);
    const results: SettlementResult[] = [];
    const errors: string[] = [];

    console.log(`[Settlement] Settling ${openBets.length} bets for match ${matchId}, winner: ${winningTeam}, isDraw: ${isDraw}`);

    for (const bet of openBets) {
      try {
        const outcome = this.determineWinner(bet, winningTeam, isDraw);
        const result = await this.processSettlementWithTransaction(bet, outcome);
        results.push(result);
      } catch (error: any) {
        console.error(`[Settlement] Failed to settle bet ${bet.id}:`, error.message);
        errors.push(`Bet ${bet.id}: ${error.message}`);
      }
    }

    this.settlementLogs.push({
      matchId,
      sport: 'unknown',
      winner: winningTeam,
      betsSettled: results.length,
      totalPayout: results.reduce((sum, r) => sum + r.payout, 0),
      timestamp: new Date(),
      errors,
    });

    if (this.settlementLogs.length > 100) {
      this.settlementLogs = this.settlementLogs.slice(-100);
    }

    return results;
  }

  extractCricketWinner(matchInfo: any): { winner: string | null; isDraw: boolean } {
    if (!matchInfo.status) {
      return { winner: null, isDraw: false };
    }
    
    const status = matchInfo.status;

    if (status.toLowerCase().includes('draw') || status.toLowerCase().includes('drawn')) {
      return { winner: 'Draw', isDraw: true };
    }

    if (status.toLowerCase().includes('tie') || status.toLowerCase().includes('tied')) {
      return { winner: 'Tie', isDraw: true };
    }

    if (status.toLowerCase().includes('no result') || status.toLowerCase().includes('abandoned')) {
      return { winner: null, isDraw: false };
    }

    const wonByPattern = /^(.+?)\s+won\s+by/i;
    const wonMatch = status.match(wonByPattern);
    if (wonMatch) {
      return { winner: wonMatch[1].trim(), isDraw: false };
    }
    
    const wonPattern = /^(.+?)\s+won/i;
    const simpleWonMatch = status.match(wonPattern);
    if (simpleWonMatch) {
      return { winner: simpleWonMatch[1].trim(), isDraw: false };
    }

    const beatPattern = /^(.+?)\s+beat\s+/i;
    const beatMatch = status.match(beatPattern);
    if (beatMatch) {
      return { winner: beatMatch[1].trim(), isDraw: false };
    }

    return { winner: null, isDraw: false };
  }

  extractOddsApiWinner(score: OddsApiScore): { winner: string | null; isDraw: boolean } {
    if (!score.completed || !score.scores || score.scores.length < 2) {
      return { winner: null, isDraw: false };
    }

    const homeScore = parseInt(score.scores.find(s => s.name === score.home_team)?.score || '0');
    const awayScore = parseInt(score.scores.find(s => s.name === score.away_team)?.score || '0');

    if (homeScore === awayScore) {
      return { winner: 'Draw', isDraw: true };
    }

    return { 
      winner: homeScore > awayScore ? score.home_team : score.away_team,
      isDraw: false 
    };
  }

  async checkCricketMatches(matchIds: string[]): Promise<void> {
    const cricketMatchIds = matchIds
      .filter(id => id.startsWith('cricket-'))
      .map(id => ({ original: id, clean: id.replace('cricket-', '') }));

    for (const { original, clean } of cricketMatchIds) {
      try {
        const matchInfo = await cricketApiService.getMatchInfo(clean);
        
        if (matchInfo && matchInfo.matchEnded) {
          const { winner, isDraw } = this.extractCricketWinner(matchInfo);
          
          if (winner || isDraw) {
            console.log(`[Settlement] Cricket match ${original} ended. Winner: ${winner}, Draw: ${isDraw}`);
            await this.settleMatchBets(original, winner || 'Draw', isDraw);
          } else {
            console.log(`[Settlement] Cricket match ${original} ended but no result determined (possibly abandoned)`);
            const openBets = await this.getOpenBetsByMatch(original);
            for (const bet of openBets) {
              try {
                await this.processSettlementWithTransaction(bet, 'VOID');
              } catch (error: any) {
                console.error(`[Settlement] Failed to void bet ${bet.id}:`, error.message);
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`[Settlement] Failed to check cricket match ${original}:`, error.message);
      }
    }
  }

  async checkOddsApiMatches(matchIds: string[]): Promise<void> {
    const oddsApiMatchIds = matchIds.filter(id => !id.startsWith('cricket-'));
    
    if (oddsApiMatchIds.length === 0) return;

    for (const sportKey of POPULAR_SPORTS) {
      try {
        const scores = await oddsApiService.getScores(sportKey, 3);
        
        for (const score of scores) {
          if (oddsApiMatchIds.includes(score.id) && score.completed) {
            const { winner, isDraw } = this.extractOddsApiWinner(score);
            
            if (winner) {
              console.log(`[Settlement] Odds API match ${score.id} (${score.sport_title}) completed. Winner: ${winner}, Draw: ${isDraw}`);
              await this.settleMatchBets(score.id, winner, isDraw);
            }
          }
        }
      } catch (error: any) {
        if (!error.message.includes('quota')) {
          console.error(`[Settlement] Failed to check ${sportKey} scores:`, error.message);
        }
      }
    }
  }

  async checkAndSettleFinishedMatches(): Promise<void> {
    try {
      const openBets = await this.getOpenBets();
      
      if (openBets.length === 0) {
        return;
      }

      const matchIds = Array.from(new Set(openBets.map(b => b.matchId)));
      console.log(`[Settlement] Checking ${matchIds.length} matches with ${openBets.length} open bets`);
      
      await Promise.all([
        this.checkCricketMatches(matchIds),
        this.checkOddsApiMatches(matchIds),
      ]);

    } catch (error: any) {
      console.error('[Settlement] Settlement check failed:', error.message);
    }
  }

  async manualSettlement(
    matchId: string,
    winningTeam: string,
    isDraw: boolean = false
  ): Promise<SettlementResult[]> {
    console.log(`[Settlement] Manual settlement triggered for match ${matchId}, winner: ${winningTeam}`);
    return this.settleMatchBets(matchId, winningTeam, isDraw);
  }

  async voidMatchBets(matchId: string, reason: string): Promise<SettlementResult[]> {
    const openBets = await this.getOpenBetsByMatch(matchId);
    const results: SettlementResult[] = [];

    console.log(`[Settlement] Voiding ${openBets.length} bets for match ${matchId}. Reason: ${reason}`);

    for (const bet of openBets) {
      try {
        const result = await this.processSettlementWithTransaction(bet, 'VOID');
        results.push(result);
      } catch (error: any) {
        console.error(`[Settlement] Failed to void bet ${bet.id}:`, error.message);
      }
    }

    return results;
  }

  getSettlementLogs(): SettlementLog[] {
    return this.settlementLogs;
  }

  getStatus(): { isRunning: boolean; openBetsCount: number; recentSettlements: number } {
    return {
      isRunning: this.isRunning,
      openBetsCount: 0,
      recentSettlements: this.settlementLogs.filter(
        log => Date.now() - log.timestamp.getTime() < 3600000
      ).length,
    };
  }

  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      console.log('[Settlement] Service already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Settlement] Service started (checking every ${intervalMs / 1000}s)`);

    setTimeout(() => {
      this.checkAndSettleFinishedMatches();
    }, 10000);

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
    console.log('[Settlement] Service stopped');
  }
}

export const settlementService = new SettlementService();

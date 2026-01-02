import { storage, db, pool } from "./storage";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { cricketApiService } from "./cricketApi";
import { instanceBettingService, InstanceMarket } from "./instanceBetting";

interface ScoreState {
  matchId: string;
  totalRuns: number;
  totalWickets: number;
  currentOver: number;
  currentBall: number;
  lastBallRuns: number;
  lastBallWicket: boolean;
  boundaries: number;
  sixes: number;
  timestamp: Date;
}

interface InstanceBet {
  betType: 'BACK' | 'LAY';
  oddsValue: number;
  oddsName: string;
  userId: string;
  outcomeId: string;
  marketId: string;
  stake: number;
  potentialProfit: number;
  createdAt: Date;
}

class InstanceSettlementService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scoreStates: Map<string, ScoreState> = new Map();
  private instanceBets: Map<string, InstanceBet[]> = new Map();
  private settlementLogs: any[] = [];

  async getMatchScoreState(matchId: string): Promise<ScoreState | null> {
    try {
      const cleanId = matchId.replace('cricket-', '');
      const matchInfo = await cricketApiService.getMatchInfo(cleanId);
      
      if (!matchInfo || !matchInfo.score || matchInfo.score.length === 0) {
        return null;
      }

      const latestInning = matchInfo.score[matchInfo.score.length - 1];
      const overs = latestInning.o || 0;
      const currentOver = Math.floor(overs);
      const currentBall = Math.round((overs - currentOver) * 10);

      let totalRuns = 0;
      let totalWickets = 0;
      matchInfo.score.forEach((inning: any) => {
        totalRuns += inning.r || 0;
        totalWickets += inning.w || 0;
      });

      return {
        matchId,
        totalRuns,
        totalWickets,
        currentOver,
        currentBall,
        lastBallRuns: 0,
        lastBallWicket: false,
        boundaries: 0,
        sixes: 0,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`[InstanceSettlement] Failed to get score for ${matchId}:`, error);
      return null;
    }
  }

  detectBallOutcome(prevState: ScoreState, newState: ScoreState): {
    runsScored: number;
    isWicket: boolean;
    isBoundary: boolean;
    isSix: boolean;
    isExtra: boolean;
    isNewBall: boolean;
  } {
    const runsDiff = newState.totalRuns - prevState.totalRuns;
    const wicketsDiff = newState.totalWickets - prevState.totalWickets;
    
    const ballAdvanced = 
      newState.currentOver > prevState.currentOver ||
      (newState.currentOver === prevState.currentOver && newState.currentBall > prevState.currentBall);
    
    const runsWithoutBallAdvance = runsDiff > 0 && !ballAdvanced;
    const isExtra = runsWithoutBallAdvance && runsDiff >= 1;

    const isNewBall = ballAdvanced || runsWithoutBallAdvance || wicketsDiff > 0;

    return {
      runsScored: runsDiff,
      isWicket: wicketsDiff > 0,
      isBoundary: runsDiff === 4 && !isExtra,
      isSix: runsDiff === 6 && !isExtra,
      isExtra,
      isNewBall,
    };
  }

  determineWinningOutcome(outcome: {
    runsScored: number;
    isWicket: boolean;
    isBoundary: boolean;
    isSix: boolean;
    isExtra: boolean;
  }): string {
    if (outcome.isWicket) {
      return 'Wicket';
    }
    if (outcome.isExtra) {
      return 'Wide/No Ball';
    }
    if (outcome.isSix) {
      return '6 Runs (Six)';
    }
    if (outcome.isBoundary) {
      return '4 Runs (Boundary)';
    }
    switch (outcome.runsScored) {
      case 0: return '0 (Dot Ball)';
      case 1: return '1 Run';
      case 2: return '2 Runs';
      case 3: return '3 Runs';
      default: return `${outcome.runsScored} Runs`;
    }
  }

  addInstanceBet(marketId: string, bet: InstanceBet): void {
    if (!this.instanceBets.has(marketId)) {
      this.instanceBets.set(marketId, []);
    }
    this.instanceBets.get(marketId)!.push(bet);
    console.log(`[InstanceSettlement] Added bet on market ${marketId}, outcome: ${bet.oddsName}`);
  }

  async settleInstanceMarket(
    market: InstanceMarket,
    winningOutcome: string
  ): Promise<void> {
    const bets = this.instanceBets.get(market.id) || [];
    
    if (bets.length === 0) {
      console.log(`[InstanceSettlement] No bets to settle for market ${market.id}`);
      return;
    }

    console.log(`[InstanceSettlement] Settling ${bets.length} bets for market ${market.id}, winner: ${winningOutcome}`);

    for (const bet of bets) {
      try {
        await this.processInstanceBetSettlement(bet, winningOutcome);
      } catch (error: any) {
        console.error(`[InstanceSettlement] Failed to settle bet:`, error.message);
      }
    }

    this.instanceBets.delete(market.id);
    
    this.settlementLogs.push({
      marketId: market.id,
      marketName: market.name,
      winningOutcome,
      betsSettled: bets.length,
      timestamp: new Date(),
    });

    if (this.settlementLogs.length > 100) {
      this.settlementLogs = this.settlementLogs.slice(-100);
    }
  }

  async processInstanceBetSettlement(
    bet: InstanceBet,
    winningOutcome: string
  ): Promise<void> {
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
      const currentBalance = parseFloat(user.balance);
      
      const betOutcomeNormalized = bet.oddsName.toLowerCase().trim();
      const winningNormalized = winningOutcome.toLowerCase().trim();
      const didWin = betOutcomeNormalized.includes(winningNormalized) || 
                     winningNormalized.includes(betOutcomeNormalized) ||
                     betOutcomeNormalized === winningNormalized;

      let payout = 0;
      let description = '';
      let transactionType = '';

      if (bet.betType === 'BACK') {
        if (didWin) {
          payout = bet.stake + bet.potentialProfit;
          description = `Instance bet won: ${bet.oddsName} - Stake ₹${bet.stake} + Profit ₹${bet.potentialProfit}`;
          transactionType = 'INSTANCE_BET_WON';
        } else {
          payout = 0;
          description = `Instance bet lost: ${bet.oddsName} - Lost ₹${bet.stake}`;
          transactionType = 'INSTANCE_BET_LOST';
        }
      } else {
        if (didWin) {
          payout = 0;
          description = `Instance lay bet lost: ${bet.oddsName} happened - Lost liability`;
          transactionType = 'INSTANCE_BET_LOST';
        } else {
          payout = bet.stake + bet.potentialProfit;
          description = `Instance lay bet won: ${bet.oddsName} didn't happen - Returned ₹${payout}`;
          transactionType = 'INSTANCE_BET_WON';
        }
      }

      const newBalance = currentBalance + payout;

      await client.query(
        'UPDATE users SET balance = $1 WHERE id = $2',
        [newBalance.toString(), bet.userId]
      );

      await client.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, description, balance)
         VALUES ($1, $2, $3, $4, $5)`,
        [bet.userId, payout.toString(), transactionType, description, newBalance.toString()]
      );

      await client.query('COMMIT');

      console.log(`[InstanceSettlement] Settled instance bet: ${didWin ? 'WON' : 'LOST'}, payout: ₹${payout}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkAndSettleLiveMatches(): Promise<void> {
    try {
      const marketsWithBets = Array.from(this.instanceBets.keys());
      if (marketsWithBets.length === 0) return;

      const matchIds = new Set<string>();
      marketsWithBets.forEach(marketId => {
        const bets = this.instanceBets.get(marketId);
        if (bets && bets.length > 0) {
          const marketBet = bets[0];
          const market = instanceBettingService.getAllActiveMarkets().find(m => m.id === marketId);
          if (market) {
            matchIds.add(market.matchId);
          }
        }
      });

      for (const matchId of Array.from(matchIds)) {
        if (!matchId.startsWith('cricket-')) continue;

        const newState = await this.getMatchScoreState(matchId);
        if (!newState) continue;

        const prevState = this.scoreStates.get(matchId);
        
        if (prevState) {
          const outcome = this.detectBallOutcome(prevState, newState);
          
          if (outcome.isNewBall) {
            const winningOutcome = this.determineWinningOutcome(outcome);
            console.log(`[InstanceSettlement] Ball detected! Match ${matchId}: ${winningOutcome}`);

            for (const marketId of marketsWithBets) {
              const bets = this.instanceBets.get(marketId);
              if (!bets || bets.length === 0) continue;
              
              const allMarkets = instanceBettingService.getAllActiveMarkets();
              const market = allMarkets.find(m => m.id === marketId);
              
              if (market && market.matchId === matchId && market.instanceType === 'NEXT_BALL') {
                instanceBettingService.closeMarket(marketId);
                await this.settleInstanceMarket(market, winningOutcome);
              }
            }
          }
        }

        this.scoreStates.set(matchId, newState);
      }
    } catch (error: any) {
      console.error('[InstanceSettlement] Check failed:', error.message);
    }
  }

  async settleExpiredMarkets(): Promise<void> {
    try {
      const now = new Date();
      const allMarkets = instanceBettingService.getAllActiveMarkets();

      for (const market of allMarkets) {
        if (market.closeTime <= now && market.status === 'OPEN') {
          instanceBettingService.closeMarket(market.id);
        }
      }
    } catch (error: any) {
      console.error('[InstanceSettlement] Settle expired failed:', error.message);
    }
  }

  getSettlementLogs(): any[] {
    return this.settlementLogs;
  }

  getActiveInstanceBetsCount(): number {
    let count = 0;
    this.instanceBets.forEach(bets => count += bets.length);
    return count;
  }

  start(intervalMs: number = 10000): void {
    if (this.isRunning) {
      console.log('[InstanceSettlement] Service already running');
      return;
    }

    this.isRunning = true;
    console.log(`[InstanceSettlement] Service started (checking every ${intervalMs / 1000}s)`);

    this.intervalId = setInterval(async () => {
      await this.settleExpiredMarkets();
      await this.checkAndSettleLiveMatches();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[InstanceSettlement] Service stopped');
  }
}

export const instanceSettlementService = new InstanceSettlementService();

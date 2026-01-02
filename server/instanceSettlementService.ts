import { storage, pool } from "./storage";
import { cricketApiService } from "./cricketApi";
import { instanceBettingService, InstanceMarket } from "./instanceBetting";
import type { InstanceBet } from "@shared/schema";

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

class InstanceSettlementService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private scoreStates: Map<string, ScoreState> = new Map();
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

  async settleInstanceMarket(
    market: InstanceMarket,
    winningOutcome: string
  ): Promise<void> {
    const bets = await storage.getOpenInstanceBetsByMarket(market.id);
    
    if (bets.length === 0) {
      console.log(`[InstanceSettlement] No bets to settle for market ${market.id}`);
      return;
    }

    console.log(`[InstanceSettlement] Settling ${bets.length} bets for market ${market.id}, winner: ${winningOutcome}`);

    for (const bet of bets) {
      try {
        await this.processInstanceBetSettlement(bet, winningOutcome);
      } catch (error: any) {
        console.error(`[InstanceSettlement] Failed to settle bet ${bet.id}:`, error.message);
      }
    }
    
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
      const stake = parseFloat(bet.stake);
      const potentialProfit = parseFloat(bet.potentialProfit);
      
      const betOutcomeNormalized = bet.outcomeName.toLowerCase().trim();
      const winningNormalized = winningOutcome.toLowerCase().trim();
      const didWin = betOutcomeNormalized.includes(winningNormalized) || 
                     winningNormalized.includes(betOutcomeNormalized) ||
                     betOutcomeNormalized === winningNormalized;

      let payout = 0;
      let description = '';
      let transactionType = '';
      let betStatus: 'WON' | 'LOST' = 'LOST';

      if (didWin) {
        payout = stake + potentialProfit;
        description = `Instance bet won: ${bet.outcomeName} - Stake ₹${stake} + Profit ₹${potentialProfit}`;
        transactionType = 'INSTANCE_BET_WON';
        betStatus = 'WON';
      } else {
        payout = 0;
        description = `Instance bet lost: ${bet.outcomeName} - Lost ₹${stake}`;
        transactionType = 'INSTANCE_BET_LOST';
        betStatus = 'LOST';
      }

      if (payout > 0) {
        const newBalance = currentBalance + payout;
        await client.query(
          'UPDATE users SET balance = $1 WHERE id = $2',
          [newBalance.toString(), bet.userId]
        );
      }

      await client.query(
        `INSERT INTO wallet_transactions (id, user_id, amount, type, description)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [bet.userId, payout.toString(), transactionType, description]
      );

      await client.query(
        `UPDATE instance_bets SET status = $1, winning_outcome = $2, settled_at = NOW() WHERE id = $3`,
        [betStatus, winningOutcome, bet.id]
      );

      await client.query('COMMIT');

      console.log(`[InstanceSettlement] Settled instance bet ${bet.id}: ${betStatus}, payout: ₹${payout}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkAndSettleLiveMatches(): Promise<void> {
    try {
      const openBets = await storage.getOpenInstanceBets();
      if (openBets.length === 0) return;

      const matchIds = new Set<string>();
      const marketIdsByMatch = new Map<string, Set<string>>();
      
      openBets.forEach(bet => {
        matchIds.add(bet.matchId);
        if (!marketIdsByMatch.has(bet.matchId)) {
          marketIdsByMatch.set(bet.matchId, new Set());
        }
        marketIdsByMatch.get(bet.matchId)!.add(bet.marketId);
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

            const marketIds = marketIdsByMatch.get(matchId) || new Set();
            const allMarkets = instanceBettingService.getAllActiveMarkets();
            
            for (const marketId of Array.from(marketIds)) {
              const market = allMarkets.find(m => m.id === marketId);
              
              if (market && market.instanceType === 'NEXT_BALL') {
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

  async syncMarketsWithLiveState(): Promise<void> {
    try {
      const allMarkets = instanceBettingService.getAllActiveMarkets();
      const matchIds = new Set<string>();
      
      allMarkets.forEach(market => {
        if (market.matchId.startsWith('cricket-')) {
          matchIds.add(market.matchId);
        }
      });

      for (const matchId of Array.from(matchIds)) {
        const newState = await this.getMatchScoreState(matchId);
        if (!newState) continue;

        instanceBettingService.updateMatchState(matchId, newState.currentOver, newState.currentBall);
        
        const existingMarkets = instanceBettingService.getActiveMarketsForMatch(matchId);
        const hasBallMarkets = existingMarkets.some(m => m.instanceType === 'NEXT_BALL');
        
        if (!hasBallMarkets && existingMarkets.length > 0) {
          instanceBettingService.generateSyncedMarkets(matchId, newState.currentOver, newState.currentBall);
          console.log(`[InstanceSettlement] Regenerated markets for ${matchId} at ${newState.currentOver}.${newState.currentBall}`);
        }

        this.scoreStates.set(matchId, newState);
      }
    } catch (error: any) {
      console.error('[InstanceSettlement] Sync markets failed:', error.message);
    }
  }

  getSettlementLogs(): any[] {
    return this.settlementLogs;
  }

  async getActiveInstanceBetsCount(): Promise<number> {
    const openBets = await storage.getOpenInstanceBets();
    return openBets.length;
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

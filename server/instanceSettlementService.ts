import { storage, pool } from "./storage";
import { instanceBettingService, InstanceMarket } from "./instanceBetting";
import { realtimeHub } from "./realtimeHub";
import { liveScoreCoordinator } from "./liveScoreCoordinator";
import type { InstanceBet } from "@shared/schema";
import type { BetSettlement, WalletUpdate } from "@shared/realtime";

interface CompatibleScoreState {
  matchId: string;
  totalRuns: number;
  totalWickets: number;
  currentOver: number;
  currentBall: number;
  lastBallRuns?: number;
  lastBallWicket?: boolean;
  boundaries?: number;
  sixes?: number;
  timestamp?: Date;
}

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
interface ScoreState extends CompatibleScoreState {
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

  /**
   * ✅ CENTRALIZED LIVE STATE
   * ❌ NO API CALL HERE
   */
  async getMatchScoreState(matchId: string): Promise<ScoreState | null> {
  const state = await liveScoreCoordinator.get(matchId);
  if (!state) return null;

  // Convert LiveScoreState to ScoreState
  return {
    matchId,
    totalRuns: state.runs,
    totalWickets: state.wickets,
    currentOver: state.over,
    currentBall: state.ball,
    lastBallRuns: 0,
    lastBallWicket: false,
    boundaries: 0,
    sixes: 0,
    timestamp: new Date(),
  };
}

  detectBallOutcome(prevState: ScoreState, newState: ScoreState) {
    const runsDiff = newState.totalRuns - prevState.totalRuns;
    const wicketsDiff = newState.totalWickets - prevState.totalWickets;

    const prevBall =
      prevState.currentOver * 6 + prevState.currentBall;
    const currBall =
      newState.currentOver * 6 + newState.currentBall;

    const ballAdvanced = currBall > prevBall;
    const isExtra = runsDiff > 0 && !ballAdvanced;

    return {
      runsScored: runsDiff,
      isWicket: wicketsDiff > 0,
      isBoundary: runsDiff === 4 && !isExtra,
      isSix: runsDiff === 6 && !isExtra,
      isExtra,
      isNewBall: ballAdvanced || wicketsDiff > 0,
    };
  }

  determineWinningOutcome(outcome: {
    runsScored: number;
    isWicket: boolean;
    isBoundary: boolean;
    isSix: boolean;
    isExtra: boolean;
  }): string {
    if (outcome.isWicket) return "Wicket";
    if (outcome.isExtra) return "Wide/No Ball";
    if (outcome.isSix) return "6 Runs (Six)";
    if (outcome.isBoundary) return "4 Runs (Boundary)";
    return `${outcome.runsScored} Runs`;
  }

  async settleInstanceMarket(
    market: InstanceMarket,
    winningOutcome: string
  ): Promise<void> {
    const bets = await storage.getOpenInstanceBetsByMarket(market.id);
    if (!bets.length) return;

    for (const bet of bets) {
      await this.processInstanceBetSettlement(bet, winningOutcome);
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
      await client.query("BEGIN");

      const userResult = await client.query(
        "SELECT balance, exposure FROM users WHERE id = $1 FOR UPDATE",
        [bet.userId]
      );

      if (!userResult.rows.length) {
        throw new Error(`User not found: ${bet.userId}`);
      }

      const user = userResult.rows[0];
      const stake = Number(bet.stake);
      const profit = Number(bet.potentialProfit);

      const didWin = bet.outcomeName
        .toLowerCase()
        .includes(winningOutcome.toLowerCase());

      const payout = didWin ? stake + profit : 0;

      if (payout > 0) {
        await client.query(
          "UPDATE users SET balance = balance + $1 WHERE id = $2",
          [payout, bet.userId]
        );
      }

      await client.query(
        `UPDATE instance_bets
         SET status = $1, winning_outcome = $2, settled_at = NOW()
         WHERE id = $3`,
        [didWin ? "WON" : "LOST", winningOutcome, bet.id]
      );

      await client.query("COMMIT");

      const settlement: BetSettlement = {
        betId: bet.id,
        matchId: bet.matchId,
        marketId: bet.marketId,
        userId: bet.userId,
        outcome: bet.outcomeName,
        winningOutcome,
        status: didWin ? "WON" : "LOST",
        stake,
        payout,
        timestamp: Date.now(),
      };

      realtimeHub.emitBetSettlement(settlement);

      const walletUpdate: WalletUpdate = {
        userId: bet.userId,
        balance: user.balance + payout,
        exposure: user.exposure,
        change: payout,
        reason: didWin ? "Instance play won" : "Instance play lost",
        timestamp: Date.now(),
      };

      realtimeHub.emitWalletUpdate(walletUpdate);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // async checkAndSettleLiveMatches(): Promise<void> {
  //   const openBets = await storage.getOpenInstanceBets();
  //   if (!openBets.length) return;

  //  const matchMap = new Map<string, Set<string>>();

  //   for (const bet of openBets) {
      
  //     if (!matchMap.has(bet.matchId)) {
  //       matchMap.set(bet.matchId, new Set());
  //     }
  //     matchMap.get(bet.matchId)!.add(bet.marketId);
  //   }

  //   for (const [matchId, marketIds] of matchMap) {
  //     const newState = await this.getMatchScoreState(matchId);
  //     if (!newState) continue;

  //     const prevState = this.scoreStates.get(matchId);
  //     if (prevState) {
  //       const outcome = this.detectBallOutcome(prevState, newState);
  //       if (outcome.isNewBall) {
  //         const winner = this.determineWinningOutcome(outcome);

  //         for (const marketId of marketIds) {
  //           const market = instanceBettingService
  //             .getAllActiveMarkets()
  //             .find(m => m.id === marketId);

  //           if (market && market.instanceType === "NEXT_BALL") {
  //             instanceBettingService.closeMarket(marketId);
  //             await this.settleInstanceMarket(market, winner);
  //           }
  //         }
  //       }
  //     }

  //     this.scoreStates.set(matchId, newState);
  //   }
  // }
async checkAndSettleLiveMatches(): Promise<void> {
  const openBets = await storage.getOpenInstanceBets();
  if (!openBets.length) return;

  // 1️⃣ Group markets by match
  const matchMap = new Map<string, Set<string>>();

  for (const bet of openBets) {
    if (!matchMap.has(bet.matchId)) {
      matchMap.set(bet.matchId, new Set());
    }
    matchMap.get(bet.matchId)!.add(bet.marketId);
  }

  // 2️⃣ Process match by match
  for (const [matchId, marketIds] of matchMap) {
    // 🔴 HARD GUARD: do NOTHING if match already finished
    const match = await storage.getMatch(matchId);
    if (!match || match.status === "FINISHED") {
      continue;
    }

    const newState = await this.getMatchScoreState(matchId);
    if (!newState) continue;

    const prevState = this.scoreStates.get(matchId);

    if (prevState) {
      const outcome = this.detectBallOutcome(prevState, newState);

      if (outcome.isNewBall) {
        const winner = this.determineWinningOutcome(outcome);

        for (const marketId of marketIds) {
          const market = instanceBettingService
            .getAllActiveMarkets()
            .find(m => m.id === marketId);

          if (market && market.instanceType === "NEXT_BALL") {
            instanceBettingService.closeMarket(marketId);
            await this.settleInstanceMarket(market, winner);
          }
        }
      }
    }

    this.scoreStates.set(matchId, newState);
  }
}

  start(intervalMs: number = 10000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(
      () => this.checkAndSettleLiveMatches(),
      intervalMs
    );

    console.log("[InstanceSettlement] Started");
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    console.log("[InstanceSettlement] Stopped");
  }
}

export const instanceSettlementService = new InstanceSettlementService();

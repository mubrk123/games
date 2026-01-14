// import { cricketApiService } from "./cricketApi";
// import { realtimeHub } from "./realtimeHub";
// import { instanceBettingService } from "./instanceBetting";
// import { instanceSettlementService } from "./instanceSettlementService";
// import type { MatchScoreUpdate, BallResult, MarketUpdate, InstanceMarketType, InstanceMarketStatus } from "@shared/realtime";
// import { liveScoreCoordinator } from "./liveScoreCoordinator";
// interface TrackedMatchState {
//   matchId: string;
//   currentOver: number;
//   currentBall: number;
//   runs: number;
//   wickets: number;
//   lastUpdate: number;
//   marketsGenerated: boolean;
//   currentInning: number;
//   highestBallTotal: number;
// }

// const MARKET_REOPEN_DELAY_MS = 700;

// class LiveMatchTracker {
//   private isRunning = false;
//   private intervalId: NodeJS.Timeout | null = null;
//   private matchStates: Map<string, TrackedMatchState> = new Map();
//   private pollInterval = 2000;
//   private pendingMarketOpens: Map<string, NodeJS.Timeout> = new Map();

//   private ballToTotal(over: number, ball: number): number {
//     return over * 6 + ball;
//   }

//   async pollLiveMatches(): Promise<void> {
//     try {
//       const subscribedMatches = realtimeHub.getActiveMatchSubscriptions();
      
//       if (subscribedMatches.length === 0) {
//         return;
//       }

//       for (const matchId of subscribedMatches) {
//         if (!matchId.startsWith('cricket-')) continue;
        
//         await this.trackMatch(matchId);
//       }
//     } catch (error: any) {
//       console.error('[LiveTracker] Poll error:', error.message);
//     }
//   }

//   private async trackMatch(matchId: string): Promise<void> {
//     try {
//      const state = await liveScoreCoordinator.get(matchId);
// if (!state) return;

// const currentOver = state.over;
// const currentBall = state.ball;
// const runs = state.runs;
// const wickets = state.wickets;
// const currentInningIndex = state.inning;


//       const latestInning = matchInfo.score[currentInningIndex - 1];
      
//       const overs = latestInning.o || 0;
//      // const currentOver = Math.floor(overs);
//       //const currentBall = Math.round((overs - currentOver) * 10);
//       //const runs = latestInning.r || 0;
//       //const wickets = latestInning.w || 0;

//       const prevState = this.matchStates.get(matchId);
//       const currentTotal = this.ballToTotal(currentOver, currentBall);
      
//       const inningChanged = prevState && currentInningIndex !== prevState.currentInning;
      
//       if (inningChanged) {
//         console.log(`[LiveTracker] Innings changed for ${matchId}: ${prevState?.currentInning} -> ${currentInningIndex}`);
//       }
      
//       const prevHighestBallTotal = inningChanged ? 0 : (prevState?.highestBallTotal || 0);
      
//       if (prevState && !inningChanged && currentTotal < prevHighestBallTotal) {
//         console.log(`[LiveTracker] Ignoring backwards data for ${matchId}: ${currentOver}.${currentBall} (total ${currentTotal}) < highest ${prevHighestBallTotal}`);
//         return;
//       }

//       const newState: TrackedMatchState = {
//         matchId,
//         currentOver,
//         currentBall,
//         runs,
//         wickets,
//         lastUpdate: Date.now(),
//         marketsGenerated: (inningChanged ? false : prevState?.marketsGenerated) || false,
//         currentInning: currentInningIndex,
//         highestBallTotal: Math.max(currentTotal, prevHighestBallTotal),
//       };

//       const scoreUpdate: MatchScoreUpdate = {
//         matchId,
//         homeTeam: matchInfo.teamInfo?.[0]?.name || 'Team A',
//         awayTeam: matchInfo.teamInfo?.[1]?.name || 'Team B',
//         status: matchInfo.matchEnded ? 'FINISHED' : (matchInfo.matchStarted ? 'LIVE' : 'UPCOMING'),
//         scoreHome: matchInfo.score?.[0]?.r || 0,
//         scoreAway: matchInfo.score?.[1]?.r || 0,
//         currentOver,
//         currentBall,
//         currentInning: currentInningIndex,
//         battingTeam: latestInning.inning?.split(' ')?.[0] || 'Unknown',
//         runs,
//         wickets,
//         overs: overs.toFixed(1),
//         runRate: runs > 0 && overs > 0 ? (runs / overs).toFixed(2) : '0.00',
//         timestamp: Date.now(),
//       };

//       realtimeHub.emitMatchScore(scoreUpdate);

//       // ALWAYS update match state and close past markets (unconditional)
//       instanceBettingService.updateMatchState(matchId, currentOver, currentBall);

//       if (prevState && !inningChanged) {
//         const ballAdvanced = currentTotal > prevState.highestBallTotal;
        
//         const runsDiff = runs - prevState.runs;
//         const wicketsDiff = wickets - prevState.wickets;

//         // Ball completion = ball advanced OR wicket fell
//         // Wide/No-ball (runs without ball advance) should NOT trigger settlement/reopen
//         const isLegalBallCompleted = ballAdvanced || wicketsDiff > 0;

//         if (isLegalBallCompleted) {
//           const ballResult = this.determineBallResult(
//             matchId,
//             prevState,
//             newState,
//             runsDiff,
//             wicketsDiff > 0
//           );

//           console.log(`[LiveTracker] Ball detected for ${matchId}: ${currentOver}.${currentBall} - ${ballResult.outcome}`);
          
//           await this.handleBallCompleted(matchId, ballResult, currentOver, currentBall, matchInfo.matchEnded);
//         }
//       }
      
//       // Handle innings change: close all markets, cancel pending timeouts
//       if (inningChanged) {
//         const pendingTimeout = this.pendingMarketOpens.get(matchId);
//         if (pendingTimeout) {
//           clearTimeout(pendingTimeout);
//           this.pendingMarketOpens.delete(matchId);
//         }
//         instanceBettingService.closeAllMarketsForMatch(matchId, 'Innings changed');
//         this.emitMarketUpdate(matchId);
//       }
      
//       // Handle match end: close all markets, cancel pending timeouts
//       if (matchInfo.matchEnded) {
//         const pendingTimeout = this.pendingMarketOpens.get(matchId);
//         if (pendingTimeout) {
//           clearTimeout(pendingTimeout);
//           this.pendingMarketOpens.delete(matchId);
//         }
//         instanceBettingService.closeAllMarketsForMatch(matchId, 'Match ended');
//         this.emitMarketUpdate(matchId);
//       }

//       // INITIAL MARKET GENERATION ONLY - when no markets exist at all
//       // handleBallCompleted() is the SOLE owner of market generation during live play
//       if (matchInfo.matchStarted && !matchInfo.matchEnded) {
//         const pendingOpen = this.pendingMarketOpens.get(matchId);
//         const existingMarkets = instanceBettingService.getActiveMarketsForMatch(matchId);
        
//         // Only generate if: no pending timeout, no existing markets, and not already generated
//         if (!pendingOpen && existingMarkets.length === 0 && !newState.marketsGenerated) {
//           console.log(`[LiveTracker] Initial market generation for ${matchId} (no existing markets)`);
//           instanceBettingService.generateSyncedMarkets(matchId, currentOver, currentBall);
//           newState.marketsGenerated = true;
//           this.emitMarketUpdate(matchId);
//         }
        
//         // On innings change, reset flag but let next ball event trigger generation
//         if (inningChanged) {
//           newState.marketsGenerated = false;
//         }
//       }

//       this.matchStates.set(matchId, newState);

//     } catch (error: any) {
//       console.error(`[LiveTracker] Track match ${matchId} error:`, error.message);
//     }
//   }

//   private determineBallResult(
//     matchId: string,
//     prevState: TrackedMatchState,
//     newState: TrackedMatchState,
//     runsDiff: number,
//     isWicket: boolean
//   ): BallResult {
//     const isBoundary = runsDiff === 4 && !isWicket;
//     const isSix = runsDiff === 6 && !isWicket;
//     const isExtra = runsDiff > 0 && 
//       newState.currentOver === prevState.currentOver && 
//       newState.currentBall === prevState.currentBall;

//     let outcome = '';
//     if (isWicket) {
//       outcome = 'Wicket';
//     } else if (isExtra) {
//       outcome = 'Wide/No Ball';
//     } else if (isSix) {
//       outcome = '6 Runs (Six)';
//     } else if (isBoundary) {
//       outcome = '4 Runs (Boundary)';
//     } else {
//       switch (runsDiff) {
//         case 0: outcome = '0 (Dot Ball)'; break;
//         case 1: outcome = '1 Run'; break;
//         case 2: outcome = '2 Runs'; break;
//         case 3: outcome = '3 Runs'; break;
//         default: outcome = `${runsDiff} Runs`; break;
//       }
//     }

//     return {
//       matchId,
//       over: prevState.currentOver,
//       ball: prevState.currentBall,
//       runsScored: runsDiff,
//       isWicket,
//       isBoundary,
//       isSix,
//       isExtra,
//       outcome,
//       timestamp: Date.now(),
//     };
//   }

//   private async handleBallCompleted(
//     matchId: string,
//     ballResult: BallResult,
//     currentOver: number,
//     currentBall: number,
//     matchEnded: boolean = false
//   ): Promise<void> {
//     try {
//       const existingTimeout = this.pendingMarketOpens.get(matchId);
//       if (existingTimeout) {
//         clearTimeout(existingTimeout);
//         this.pendingMarketOpens.delete(matchId);
//       }

//       const suspendedCount = instanceBettingService.suspendAllMarketsForMatch(matchId, 'Ball completed - processing');
//       console.log(`[LiveTracker] SUSPENDED ${suspendedCount} markets for ${matchId} (ball ${ballResult.over}.${ballResult.ball})`);
      
//       this.emitMarketUpdate(matchId);

//       realtimeHub.emitBallResult(ballResult);

//       const currentTotal = this.ballToTotal(currentOver, currentBall);
//       const markets = instanceBettingService.getActiveMarketsForMatch(matchId);
      
//       for (const market of markets) {
//         if (market.instanceType === 'NEXT_BALL' && market.status === 'SUSPENDED') {
//           const marketTotal = this.ballToTotal(market.overNumber, market.ballNumber);
          
//           if (marketTotal <= currentTotal) {
//             console.log(`[LiveTracker] Settling market ${market.id}: Ball ${market.overNumber}.${market.ballNumber}`);
//             instanceBettingService.closeMarket(market.id);
//             await instanceSettlementService.settleInstanceMarket(market, ballResult.outcome);
//           }
//         }
//       }

//       // Do NOT schedule reopen if match ended
//       if (matchEnded) {
//         console.log(`[LiveTracker] Match ended - skipping market generation for ${matchId}`);
//         return;
//       }

//       const timeout = setTimeout(() => {
//         this.pendingMarketOpens.delete(matchId);
        
//         // Close any stale markets first
//         instanceBettingService.closeMarketsForPastEvents(matchId, currentOver, currentBall);
        
//         // Generate new markets - these are created as OPEN by default
//         const newMarkets = instanceBettingService.generateSyncedMarkets(matchId, currentOver, currentBall);
//         console.log(`[LiveTracker] Generated ${newMarkets.length} new OPEN markets for ${matchId} after ${MARKET_REOPEN_DELAY_MS}ms delay`);
        
//         this.emitMarketUpdate(matchId);
        
//       }, MARKET_REOPEN_DELAY_MS);

//       this.pendingMarketOpens.set(matchId, timeout);

//     } catch (error: any) {
//       console.error(`[LiveTracker] Handle ball error:`, error.message);
//     }
//   }

//   private emitMarketUpdate(matchId: string): void {
//     const activeMarkets = instanceBettingService.getActiveMarketsForMatch(matchId);
    
//     const marketUpdate: MarketUpdate = {
//       matchId,
//       markets: activeMarkets.map(m => ({
//         id: m.id,
//         name: m.name,
//         type: m.instanceType as InstanceMarketType,
//         status: m.status as InstanceMarketStatus,
//         closeTime: m.closeTime.getTime(),
//         overNumber: m.overNumber,
//         ballNumber: m.ballNumber,
//         outcomes: m.outcomes.map(o => ({
//           id: o.id,
//           name: o.name,
//           odds: o.odds,
//         })),
//       })),
//       timestamp: Date.now(),
//     };

//     realtimeHub.emitMarketUpdate(marketUpdate);
//   }

//   start(): void {
//     if (this.isRunning) {
//       console.log('[LiveTracker] Already running');
//       return;
//     }

//     this.isRunning = true;
//     console.log(`[LiveTracker] Started (polling every ${this.pollInterval}ms)`);

//     this.intervalId = setInterval(() => {
//       this.pollLiveMatches();
//     }, this.pollInterval);
//   }

//   stop(): void {
//     if (this.intervalId) {
//       clearInterval(this.intervalId);
//       this.intervalId = null;
//     }
    
//     this.pendingMarketOpens.forEach(timeout => clearTimeout(timeout));
//     this.pendingMarketOpens.clear();
    
//     this.isRunning = false;
//     console.log('[LiveTracker] Stopped');
//   }

//   getTrackedMatches(): string[] {
//     return Array.from(this.matchStates.keys());
//   }
// }

// export const liveMatchTracker = new LiveMatchTracker();

import { realtimeHub } from "./realtimeHub";
import { instanceBettingService } from "./instanceBetting";
import { instanceSettlementService } from "./instanceSettlementService";
import { liveScoreCoordinator } from "./liveScoreCoordinator";
import { storage } from "./storage";

import type {
  MatchScoreUpdate,
  BallResult,
  MarketUpdate,
  InstanceMarketType,
  InstanceMarketStatus,
} from "@shared/realtime";

interface TrackedMatchState {
  matchId: string;
  currentOver: number;
  currentBall: number;
  runs: number;
  wickets: number;
  lastUpdate: number;
  marketsGenerated: boolean;
  currentInning: number;
  highestBallTotal: number;
}

const MARKET_REOPEN_DELAY_MS = 700;

class LiveMatchTracker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private matchStates: Map<string, TrackedMatchState> = new Map();
  private pollInterval = 2000;
  private pendingMarketOpens: Map<string, NodeJS.Timeout> = new Map();

  private ballToTotal(over: number, ball: number): number {
    return over * 6 + ball;
  }

  async pollLiveMatches(): Promise<void> {
    try {
      const subscribedMatches = realtimeHub.getActiveMatchSubscriptions();
      if (subscribedMatches.length === 0) return;

      for (const matchId of subscribedMatches) {
        if (!matchId.startsWith("cricket-")) continue;
        await this.trackMatch(matchId);
      }
    } catch (error: any) {
      console.error("[LiveTracker] Poll error:", error.message);
    }
  }

 private async trackMatch(matchId: string): Promise<void> {
  try {
    const state = await liveScoreCoordinator.get(matchId);
    if (!state) return;

    /**
     * 🔴 HARD MATCH END HANDLING (MUST BE FIRST)
     */
    if (state.status === "FINISHED") {
     await storage.updateMatchStatus(matchId, "FINISHED");

      instanceBettingService.closeAllMarketsForMatch(
        matchId,
        "Match finished"
      );

      this.emitMarketUpdate(matchId);
      return; // ⛔ NOTHING ELSE RUNS AFTER THIS
    }

    const currentOver = state.over;
    const currentBall = state.ball;
    const runs = state.runs;
    const wickets = state.wickets;
    const currentInningIndex = state.inning;

    const prevState = this.matchStates.get(matchId);
    const currentTotal = this.ballToTotal(currentOver, currentBall);

    const inningChanged =
      prevState && currentInningIndex !== prevState.currentInning;

    const prevHighestBallTotal = inningChanged
      ? 0
      : prevState?.highestBallTotal || 0;

    if (
      prevState &&
      !inningChanged &&
      currentTotal < prevHighestBallTotal
    ) {
      return;
    }

    const newState: TrackedMatchState = {
      matchId,
      currentOver,
      currentBall,
      runs,
      wickets,
      lastUpdate: Date.now(),
      marketsGenerated:
        (inningChanged ? false : prevState?.marketsGenerated) || false,
      currentInning: currentInningIndex,
      highestBallTotal: Math.max(currentTotal, prevHighestBallTotal),
    };

    const scoreUpdate: MatchScoreUpdate = {
      matchId,
      homeTeam: "Team A",
      awayTeam: "Team B",
      status: "LIVE",
      scoreHome: runs,
      scoreAway: 0,
      currentOver,
      currentBall,
      currentInning: currentInningIndex,
      battingTeam: "Unknown",
      runs,
      wickets,
      overs: `${currentOver}.${currentBall}`,
      runRate:
        currentOver > 0
          ? (runs / (currentOver + currentBall / 6)).toFixed(2)
          : "0.00",
      timestamp: Date.now(),
    };

    realtimeHub.emitMatchScore(scoreUpdate);

    instanceBettingService.updateMatchState(
      matchId,
      currentOver,
      currentBall
    );

    if (prevState && !inningChanged) {
      const ballAdvanced =
        currentTotal > prevState.highestBallTotal;
      const runsDiff = runs - prevState.runs;
      const wicketsDiff = wickets - prevState.wickets;

      if (ballAdvanced || wicketsDiff > 0) {
        const ballResult = this.determineBallResult(
          matchId,
          prevState,
          newState,
          runsDiff,
          wicketsDiff > 0
        );

        await this.handleBallCompleted(
          matchId,
          ballResult,
          currentOver,
          currentBall,
          false
        );
      }
    }

    if (inningChanged) {
      const pendingTimeout =
        this.pendingMarketOpens.get(matchId);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        this.pendingMarketOpens.delete(matchId);
      }

      instanceBettingService.closeAllMarketsForMatch(
        matchId,
        "Innings changed"
      );
      this.emitMarketUpdate(matchId);
    }

    if (!newState.marketsGenerated) {
      const existingMarkets =
        instanceBettingService.getActiveMarketsForMatch(matchId);

      if (existingMarkets.length === 0) {
        instanceBettingService.generateSyncedMarkets(
          matchId,
          currentOver,
          currentBall
        );
        newState.marketsGenerated = true;
        this.emitMarketUpdate(matchId);
      }
    }

    this.matchStates.set(matchId, newState);
  } catch (error: any) {
    console.error(
      `[LiveTracker] Track match ${matchId} error:`,
      error.message
    );
  }
}

  private determineBallResult(
    matchId: string,
    prevState: TrackedMatchState,
    newState: TrackedMatchState,
    runsDiff: number,
    isWicket: boolean
  ): BallResult {
    const isBoundary = runsDiff === 4 && !isWicket;
    const isSix = runsDiff === 6 && !isWicket;
    const isExtra =
      runsDiff > 0 &&
      newState.currentOver === prevState.currentOver &&
      newState.currentBall === prevState.currentBall;

    let outcome = "";
    if (isWicket) outcome = "Wicket";
    else if (isExtra) outcome = "Wide/No Ball";
    else if (isSix) outcome = "6 Runs (Six)";
    else if (isBoundary) outcome = "4 Runs (Boundary)";
    else outcome = `${runsDiff} Run(s)`;

    return {
      matchId,
      over: prevState.currentOver,
      ball: prevState.currentBall,
      runsScored: runsDiff,
      isWicket,
      isBoundary,
      isSix,
      isExtra,
      outcome,
      timestamp: Date.now(),
    };
  }

  private async handleBallCompleted(
    matchId: string,
    ballResult: BallResult,
    currentOver: number,
    currentBall: number,
    matchEnded: boolean
  ): Promise<void> {
    try {
      const timeout = this.pendingMarketOpens.get(matchId);
      if (timeout) clearTimeout(timeout);

      instanceBettingService.suspendAllMarketsForMatch(
        matchId,
        "Ball completed"
      );

      realtimeHub.emitBallResult(ballResult);
      this.emitMarketUpdate(matchId);

      const currentTotal = this.ballToTotal(
        currentOver,
        currentBall
      );
      const markets =
        instanceBettingService.getActiveMarketsForMatch(matchId);

      for (const market of markets) {
        if (
          market.instanceType === "NEXT_BALL" &&
          market.status === "SUSPENDED"
        ) {
          const marketTotal = this.ballToTotal(
            market.overNumber,
            market.ballNumber
          );
          if (marketTotal <= currentTotal) {
            instanceBettingService.closeMarket(market.id);
            await instanceSettlementService.settleInstanceMarket(
              market,
              ballResult.outcome
            );
          }
        }
      }

      if (matchEnded) return;

      const reopenTimeout = setTimeout(() => {
        instanceBettingService.closeMarketsForPastEvents(
          matchId,
          currentOver,
          currentBall
        );
        instanceBettingService.generateSyncedMarkets(
          matchId,
          currentOver,
          currentBall
        );
        this.emitMarketUpdate(matchId);
      }, MARKET_REOPEN_DELAY_MS);

      this.pendingMarketOpens.set(matchId, reopenTimeout);
    } catch (error: any) {
      console.error("[LiveTracker] Handle ball error:", error.message);
    }
  }

  private emitMarketUpdate(matchId: string): void {
    const activeMarkets =
      instanceBettingService.getActiveMarketsForMatch(matchId);

    const marketUpdate: MarketUpdate = {
      matchId,
      markets: activeMarkets.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.instanceType as InstanceMarketType,
        status: m.status as InstanceMarketStatus,
        closeTime: m.closeTime.getTime(),
        overNumber: m.overNumber,
        ballNumber: m.ballNumber,
        outcomes: m.outcomes.map((o) => ({
          id: o.id,
          name: o.name,
          odds: o.odds,
        })),
      })),
      timestamp: Date.now(),
    };

    realtimeHub.emitMarketUpdate(marketUpdate);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(
      () => this.pollLiveMatches(),
      this.pollInterval
    );
    console.log("[LiveTracker] Started");
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.pendingMarketOpens.forEach(clearTimeout);
    this.pendingMarketOpens.clear();
    this.isRunning = false;
    console.log("[LiveTracker] Stopped");
  }

  getTrackedMatches(): string[] {
    return Array.from(this.matchStates.keys());
  }
}

export const liveMatchTracker = new LiveMatchTracker();

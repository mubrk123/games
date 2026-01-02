import { cricketApiService } from "./cricketApi";
import { realtimeHub } from "./realtimeHub";
import { instanceBettingService } from "./instanceBetting";
import { instanceSettlementService } from "./instanceSettlementService";
import type { MatchScoreUpdate, BallResult, MarketUpdate, InstanceMarketType, InstanceMarketStatus } from "@shared/realtime";

interface TrackedMatchState {
  matchId: string;
  currentOver: number;
  currentBall: number;
  runs: number;
  wickets: number;
  lastUpdate: number;
  marketsGenerated: boolean;
}

class LiveMatchTracker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private matchStates: Map<string, TrackedMatchState> = new Map();
  private pollInterval = 2000;

  async pollLiveMatches(): Promise<void> {
    try {
      const subscribedMatches = realtimeHub.getActiveMatchSubscriptions();
      
      if (subscribedMatches.length === 0) {
        return;
      }

      for (const matchId of subscribedMatches) {
        if (!matchId.startsWith('cricket-')) continue;
        
        await this.trackMatch(matchId);
      }
    } catch (error: any) {
      console.error('[LiveTracker] Poll error:', error.message);
    }
  }

  private async trackMatch(matchId: string): Promise<void> {
    try {
      const cleanId = matchId.replace('cricket-', '');
      const matchInfo = await cricketApiService.getMatchInfo(cleanId);
      
      if (!matchInfo || !matchInfo.score || matchInfo.score.length === 0) {
        return;
      }

      const latestInning = matchInfo.score[matchInfo.score.length - 1];
      const overs = latestInning.o || 0;
      const currentOver = Math.floor(overs);
      const currentBall = Math.round((overs - currentOver) * 10);
      const runs = latestInning.r || 0;
      const wickets = latestInning.w || 0;

      const prevState = this.matchStates.get(matchId);
      const newState: TrackedMatchState = {
        matchId,
        currentOver,
        currentBall,
        runs,
        wickets,
        lastUpdate: Date.now(),
        marketsGenerated: prevState?.marketsGenerated || false,
      };

      const scoreUpdate: MatchScoreUpdate = {
        matchId,
        homeTeam: matchInfo.teamInfo?.[0]?.name || 'Team A',
        awayTeam: matchInfo.teamInfo?.[1]?.name || 'Team B',
        status: matchInfo.matchEnded ? 'FINISHED' : (matchInfo.matchStarted ? 'LIVE' : 'UPCOMING'),
        scoreHome: matchInfo.score?.[0]?.r || 0,
        scoreAway: matchInfo.score?.[1]?.r || 0,
        currentOver,
        currentBall,
        currentInning: matchInfo.score.length,
        battingTeam: latestInning.inning?.split(' ')?.[0] || 'Unknown',
        runs,
        wickets,
        overs: overs.toFixed(1),
        runRate: runs > 0 && overs > 0 ? (runs / overs).toFixed(2) : '0.00',
        timestamp: Date.now(),
      };

      realtimeHub.emitMatchScore(scoreUpdate);

      if (prevState) {
        const ballAdvanced = 
          currentOver > prevState.currentOver ||
          (currentOver === prevState.currentOver && currentBall > prevState.currentBall);
        
        const runsDiff = runs - prevState.runs;
        const wicketsDiff = wickets - prevState.wickets;

        if (ballAdvanced || runsDiff > 0 || wicketsDiff > 0) {
          const ballResult = this.determineBallResult(
            matchId,
            prevState,
            newState,
            runsDiff,
            wicketsDiff > 0
          );

          console.log(`[LiveTracker] Ball detected for ${matchId}: ${ballResult.outcome}`);
          
          realtimeHub.emitBallResult(ballResult);

          await this.handleBallCompleted(matchId, ballResult, currentOver, currentBall);
        }
      }

      instanceBettingService.updateMatchState(matchId, currentOver, currentBall);

      if (matchInfo.matchStarted && !matchInfo.matchEnded) {
        const markets = instanceBettingService.getActiveMarketsForMatch(matchId);
        
        if (markets.length === 0 && !newState.marketsGenerated) {
          instanceBettingService.generateSyncedMarkets(matchId, currentOver, currentBall);
          newState.marketsGenerated = true;
        }

        const activeMarkets = instanceBettingService.getActiveMarketsForMatch(matchId);
        if (activeMarkets.length > 0) {
          const marketUpdate: MarketUpdate = {
            matchId,
            markets: activeMarkets.map(m => ({
              id: m.id,
              name: m.name,
              type: m.instanceType as InstanceMarketType,
              status: m.status as InstanceMarketStatus,
              closeTime: m.closeTime.getTime(),
              outcomes: m.outcomes.map(o => ({
                id: o.id,
                name: o.name,
                odds: o.odds,
              })),
            })),
            timestamp: Date.now(),
          };

          realtimeHub.emitMarketUpdate(marketUpdate);
        }
      }

      this.matchStates.set(matchId, newState);

    } catch (error: any) {
      console.error(`[LiveTracker] Track match ${matchId} error:`, error.message);
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
    const isExtra = runsDiff > 0 && 
      newState.currentOver === prevState.currentOver && 
      newState.currentBall === prevState.currentBall;

    let outcome = '';
    if (isWicket) {
      outcome = 'Wicket';
    } else if (isExtra) {
      outcome = 'Wide/No Ball';
    } else if (isSix) {
      outcome = '6 Runs (Six)';
    } else if (isBoundary) {
      outcome = '4 Runs (Boundary)';
    } else {
      switch (runsDiff) {
        case 0: outcome = '0 (Dot Ball)'; break;
        case 1: outcome = '1 Run'; break;
        case 2: outcome = '2 Runs'; break;
        case 3: outcome = '3 Runs'; break;
        default: outcome = `${runsDiff} Runs`; break;
      }
    }

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
    currentBall: number
  ): Promise<void> {
    try {
      const markets = instanceBettingService.getActiveMarketsForMatch(matchId);
      
      for (const market of markets) {
        if (market.instanceType === 'NEXT_BALL' && market.status === 'OPEN') {
          const marketOver = parseInt(market.name.match(/Over (\d+)/)?.[1] || '0');
          const marketBall = parseInt(market.name.match(/Ball (\d+)/)?.[1] || '0');
          
          const ballPassed = 
            currentOver > marketOver ||
            (currentOver === marketOver && currentBall > marketBall);

          if (ballPassed) {
            console.log(`[LiveTracker] Settling market ${market.id}: ${market.name}`);
            instanceBettingService.closeMarket(market.id);
            await instanceSettlementService.settleInstanceMarket(market, ballResult.outcome);
          }
        }
      }

      instanceBettingService.generateSyncedMarkets(matchId, currentOver, currentBall);

    } catch (error: any) {
      console.error(`[LiveTracker] Handle ball error:`, error.message);
    }
  }

  start(): void {
    if (this.isRunning) {
      console.log('[LiveTracker] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[LiveTracker] Started (polling every ${this.pollInterval}ms)`);

    this.intervalId = setInterval(() => {
      this.pollLiveMatches();
    }, this.pollInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[LiveTracker] Stopped');
  }

  getTrackedMatches(): string[] {
    return Array.from(this.matchStates.keys());
  }
}

export const liveMatchTracker = new LiveMatchTracker();

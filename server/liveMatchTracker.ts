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
  currentInning: number;
  highestBallTotal: number;
}

class LiveMatchTracker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private matchStates: Map<string, TrackedMatchState> = new Map();
  private pollInterval = 2000;

  private ballToTotal(over: number, ball: number): number {
    return over * 6 + ball;
  }

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

      const currentInningIndex = matchInfo.score.length;
      const latestInning = matchInfo.score[currentInningIndex - 1];
      
      const overs = latestInning.o || 0;
      const currentOver = Math.floor(overs);
      const currentBall = Math.round((overs - currentOver) * 10);
      const runs = latestInning.r || 0;
      const wickets = latestInning.w || 0;

      const prevState = this.matchStates.get(matchId);
      const currentTotal = this.ballToTotal(currentOver, currentBall);
      
      const inningChanged = prevState && currentInningIndex !== prevState.currentInning;
      
      if (inningChanged) {
        console.log(`[LiveTracker] Innings changed for ${matchId}: ${prevState?.currentInning} -> ${currentInningIndex}`);
      }
      
      const prevHighestBallTotal = inningChanged ? 0 : (prevState?.highestBallTotal || 0);
      
      if (prevState && !inningChanged && currentTotal < prevHighestBallTotal) {
        console.log(`[LiveTracker] Ignoring backwards data for ${matchId}: ${currentOver}.${currentBall} (total ${currentTotal}) < highest ${prevHighestBallTotal}`);
        return;
      }

      const newState: TrackedMatchState = {
        matchId,
        currentOver,
        currentBall,
        runs,
        wickets,
        lastUpdate: Date.now(),
        marketsGenerated: (inningChanged ? false : prevState?.marketsGenerated) || false,
        currentInning: currentInningIndex,
        highestBallTotal: Math.max(currentTotal, prevHighestBallTotal),
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
        currentInning: currentInningIndex,
        battingTeam: latestInning.inning?.split(' ')?.[0] || 'Unknown',
        runs,
        wickets,
        overs: overs.toFixed(1),
        runRate: runs > 0 && overs > 0 ? (runs / overs).toFixed(2) : '0.00',
        timestamp: Date.now(),
      };

      realtimeHub.emitMatchScore(scoreUpdate);

      if (prevState && !inningChanged) {
        const ballAdvanced = currentTotal > prevState.highestBallTotal;
        
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

          console.log(`[LiveTracker] Ball detected for ${matchId}: ${currentOver}.${currentBall} - ${ballResult.outcome}`);
          
          realtimeHub.emitBallResult(ballResult);

          await this.handleBallCompleted(matchId, ballResult, currentOver, currentBall);
        }
      }

      instanceBettingService.updateMatchState(matchId, currentOver, currentBall);

      if (matchInfo.matchStarted && !matchInfo.matchEnded) {
        const markets = instanceBettingService.getActiveMarketsForMatch(matchId);
        
        if (markets.length === 0 || !newState.marketsGenerated || inningChanged) {
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
              overNumber: m.overNumber,
              ballNumber: m.ballNumber,
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
      const currentTotal = this.ballToTotal(currentOver, currentBall);
      const markets = instanceBettingService.getActiveMarketsForMatch(matchId);
      
      for (const market of markets) {
        if (market.instanceType === 'NEXT_BALL' && market.status === 'OPEN') {
          const marketTotal = this.ballToTotal(market.overNumber, market.ballNumber);
          
          if (marketTotal <= currentTotal) {
            console.log(`[LiveTracker] Settling market ${market.id}: Ball ${market.overNumber}.${market.ballNumber} (market total ${marketTotal} <= current ${currentTotal})`);
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

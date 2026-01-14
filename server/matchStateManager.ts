// matchStateManager.ts
import { cricketApiService } from "./cricketApi";
import { redis } from "./redisClient";

interface MatchState {
  matchId: string;
  externalId: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  currentOver: number;
  currentBall: number;
  totalRuns: number;
  totalWickets: number;
  currentInning: number;
  innings: Array<{
    number: number;
    runs: number;
    wickets: number;
    overs: number;
    balls: number;
    battingTeam: string;
  }>;
  lastBall: {
    runs: number;
    isWicket: boolean;
    isBoundary: boolean;
    isSix: boolean;
    isExtra: boolean;
    timestamp: number;
  } | null;
  lastUpdated: number;
  metadata: {
    homeTeam: string;
    awayTeam: string;
    matchType: string;
    startTime: Date;
  };
}

// Define interface for the inning data from API
interface ApiInning {
  o?: number;
  r?: number;
  w?: number;
  inning?: string;
}

class MatchStateManager {
  private matchStates: Map<string, MatchState> = new Map();
  private updateLocks: Map<string, boolean> = new Map();
  private readonly STATE_TTL = 30000; // 30 seconds

  async getOrInitialize(matchId: string): Promise<MatchState | null> {
    // Check memory cache first
    if (this.matchStates.has(matchId)) {
      const state = this.matchStates.get(matchId)!;
      if (Date.now() - state.lastUpdated < this.STATE_TTL) {
        return state;
      }
    }

    // Check Redis cache
    const redisKey = `match:state:${matchId}`;
    const cached = await redis.get(redisKey);
    if (cached) {
      const state = JSON.parse(cached) as MatchState;
      this.matchStates.set(matchId, state);
      return state;
    }

    // Initialize from API
    try {
      const cleanId = matchId.replace('cricket-', '');
      const matchInfo = await cricketApiService.getMatchInfo(cleanId);
      
      if (!matchInfo) return null;

      const state: MatchState = {
        matchId,
        externalId: cleanId,
        status: matchInfo.matchEnded ? 'FINISHED' : 
                matchInfo.matchStarted ? 'LIVE' : 'UPCOMING',
        currentOver: 0,
        currentBall: 0,
        totalRuns: 0,
        totalWickets: 0,
        currentInning: 1,
        innings: [],
        lastBall: null,
        lastUpdated: Date.now(),
        metadata: {
          homeTeam: matchInfo.teams?.[0] || 'Team A',
          awayTeam: matchInfo.teams?.[1] || 'Team B',
          matchType: matchInfo.matchType,
          startTime: new Date(matchInfo.dateTimeGMT)
        }
      };

      // Initialize innings from score
      if (matchInfo.score && matchInfo.score.length > 0) {
        // FIXED: Added explicit types for inning and index parameters
        matchInfo.score.forEach((inning: ApiInning, index: number) => {
          const overs = inning.o || 0;
          state.innings.push({
            number: index + 1,
            runs: inning.r || 0,
            wickets: inning.w || 0,
            overs: Math.floor(overs),
            balls: Math.round((overs - Math.floor(overs)) * 10),
            battingTeam: inning.inning || `Inning ${index + 1}`
          });
        });

        const currentInning = state.innings[state.innings.length - 1];
        state.currentOver = currentInning.overs;
        state.currentBall = currentInning.balls;
        state.totalRuns = currentInning.runs;
        state.totalWickets = currentInning.wickets;
        state.currentInning = state.innings.length;
      }

      await this.saveState(matchId, state);
      return state;
    } catch (error) {
      console.error(`[MatchState] Failed to initialize ${matchId}:`, error);
      return null;
    }
  }

  async updateFromLiveData(matchId: string): Promise<boolean> {
    // Prevent concurrent updates
    if (this.updateLocks.get(matchId)) return false;
    this.updateLocks.set(matchId, true);

    try {
      const currentState = await this.getOrInitialize(matchId);
      if (!currentState) return false;

      // Skip if match finished
      if (currentState.status === 'FINISHED') return false;

      const cleanId = matchId.replace('cricket-', '');
      
      // Try ball-by-ball data first (most accurate)
      const bbbData = await cricketApiService.getFantasyBallByBall(cleanId);
      
      if (bbbData?.bpidata?.length) {
        const updated = this.updateFromBBB(currentState, bbbData);
        if (updated) {
          await this.saveState(matchId, currentState);
          return true;
        }
      }

      // Fallback to match info
      const matchInfo = await cricketApiService.getMatchInfo(cleanId);
      if (matchInfo?.score?.length) {
        const updated = this.updateFromScorecard(currentState, matchInfo);
        if (updated) {
          await this.saveState(matchId, currentState);
          return true;
        }
      }

      return false;
    } finally {
      this.updateLocks.delete(matchId);
    }
  }

  private updateFromBBB(state: MatchState, bbbData: any): boolean {
    const innings = bbbData.bpidata;
    const currentInning = innings[innings.length - 1];
    
    if (!currentInning || !currentInning.bowls) return false;

    const bowls = currentInning.bowls;
    const lastBowl = bowls[bowls.length - 1];
    
    if (!lastBowl) return false;

    // Parse over.ball format (e.g., "5.3")
    const [overStr, ballStr] = lastBowl.over?.toString().split('.') || ['0', '0'];
    const newOver = parseInt(overStr) || 0;
    const newBall = parseInt(ballStr) || 0;

    // Check if there's actual change
    if (newOver === state.currentOver && newBall === state.currentBall) {
      return false;
    }

    // Update last ball info
    const runs = lastBowl.runs || 0;
    const isWicket = lastBowl.wicket === true;
    const isBoundary = runs === 4;
    const isSix = runs === 6;
    const isExtra = lastBowl.extra === true;

    state.lastBall = {
      runs,
      isWicket,
      isBoundary,
      isSix,
      isExtra,
      timestamp: Date.now()
    };

    // Update state
    state.currentOver = newOver;
    state.currentBall = newBall;
    state.totalRuns = currentInning.runs || 0;
    state.totalWickets = currentInning.wickets || 0;
    state.currentInning = innings.length;
    state.lastUpdated = Date.now();

    // Update innings array
    if (state.innings.length < innings.length) {
      state.innings.push({
        number: innings.length,
        runs: currentInning.runs || 0,
        wickets: currentInning.wickets || 0,
        overs: newOver,
        balls: newBall,
        battingTeam: `Inning ${innings.length}`
      });
    } else {
      const inning = state.innings[state.innings.length - 1];
      inning.runs = currentInning.runs || 0;
      inning.wickets = currentInning.wickets || 0;
      inning.overs = newOver;
      inning.balls = newBall;
    }

    // Update status
    state.status = 'LIVE';
    
    return true;
  }

  private updateFromScorecard(state: MatchState, matchInfo: any): boolean {
    const latestInning = matchInfo.score[matchInfo.score.length - 1];
    const overs = latestInning.o || 0;
    const newOver = Math.floor(overs);
    const newBall = Math.round((overs - newOver) * 10);

    // Check if there's actual change
    if (newOver === state.currentOver && newBall === state.currentBall) {
      return false;
    }

    // Update state
    state.currentOver = newOver;
    state.currentBall = newBall;
    state.totalRuns = latestInning.r || 0;
    state.totalWickets = latestInning.w || 0;
    state.currentInning = matchInfo.score.length;
    state.lastUpdated = Date.now();

    // Update innings
    if (state.innings.length < matchInfo.score.length) {
      state.innings.push({
        number: matchInfo.score.length,
        runs: latestInning.r || 0,
        wickets: latestInning.w || 0,
        overs: newOver,
        balls: newBall,
        battingTeam: latestInning.inning || `Inning ${matchInfo.score.length}`
      });
    } else {
      const inning = state.innings[state.innings.length - 1];
      inning.runs = latestInning.r || 0;
      inning.wickets = latestInning.w || 0;
      inning.overs = newOver;
      inning.balls = newBall;
    }

    // Update status
    state.status = matchInfo.matchEnded ? 'FINISHED' : 
                   matchInfo.matchStarted ? 'LIVE' : 'UPCOMING';

    return true;
  }

  async saveState(matchId: string, state: MatchState): Promise<void> {
    state.lastUpdated = Date.now();
    this.matchStates.set(matchId, state);
    
    // Save to Redis with expiration
    const redisKey = `match:state:${matchId}`;
    await redis.setex(redisKey, 60, JSON.stringify(state)); // 60 seconds
  }

  getState(matchId: string): MatchState | undefined {
    return this.matchStates.get(matchId);
  }

  hasChanged(prevState: MatchState | undefined, newState: MatchState): boolean {
    if (!prevState) return true;
    
    return prevState.currentOver !== newState.currentOver ||
           prevState.currentBall !== newState.currentBall ||
           prevState.totalRuns !== newState.totalRuns ||
           prevState.totalWickets !== newState.totalWickets ||
           prevState.currentInning !== newState.currentInning;
  }

  clearStaleStates(): void {
    const now = Date.now();
    const staleMatches: string[] = [];
    
    this.matchStates.forEach((state, matchId) => {
      if (now - state.lastUpdated > this.STATE_TTL * 2) {
        staleMatches.push(matchId);
      }
    });
    
    staleMatches.forEach(matchId => {
      this.matchStates.delete(matchId);
    });
  }

  async getBatchUpdates(matchIds: string[]): Promise<Map<string, MatchState>> {
    const updates = new Map<string, MatchState>();
    
    await Promise.all(
      matchIds.map(async (matchId) => {
        try {
          const updated = await this.updateFromLiveData(matchId);
          if (updated) {
            const state = this.getState(matchId);
            if (state) {
              updates.set(matchId, state);
            }
          }
        } catch (error) {
          console.error(`[MatchState] Batch update failed for ${matchId}:`, error);
        }
      })
    );
    
    return updates;
  }
}

export const matchStateManager = new MatchStateManager();
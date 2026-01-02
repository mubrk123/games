// Cricket Data API Service (cricketdata.org / cricapi.com)
// Provides comprehensive cricket coverage including IPL, Test, ODI, T20, and domestic leagues
// Paid plan features: Fantasy Ball-by-Ball, Fantasy Scorecard, Fantasy Match Points

const CRICKET_API_BASE = 'https://api.cricapi.com/v1';

interface CricketApiResponse<T> {
  status: string;
  data: T;
  info?: {
    hitsToday: number;
    hitsLimit: number;
    totalRows?: number;
  };
}

interface CricketSeries {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  odi: number;
  t20: number;
  test: number;
  matches: number;
}

interface CricketMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo?: Array<{
    name: string;
    shortname: string;
    img: string;
  }>;
  score?: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
  series_id: string;
  fantasyEnabled: boolean;
  matchStarted?: boolean;
  matchEnded?: boolean;
  bbbEnabled?: boolean;
}

interface BallByBallData {
  id: string;
  matchId: string;
  inning: number;
  over: number;
  ball: number;
  batsman: string;
  bowler: string;
  runs: number;
  extras: number;
  wicket: boolean;
  wicketType?: string;
  commentary?: string;
  timestamp: string;
}

interface FantasyScorecard {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
  scorecard: Array<{
    batting: Array<{
      batsman: {
        id: string;
        name: string;
      };
      r: number;
      b: number;
      '4s': number;
      '6s': number;
      sr: number;
      dismissal?: string;
    }>;
    bowling: Array<{
      bowler: {
        id: string;
        name: string;
      };
      o: number;
      m: number;
      r: number;
      w: number;
      eco: number;
    }>;
    inning: string;
  }>;
  currentBatsmen?: Array<{
    id: string;
    name: string;
    r: number;
    b: number;
  }>;
  currentBowler?: {
    id: string;
    name: string;
    o: number;
    r: number;
    w: number;
  };
}

interface LiveBallUpdate {
  over: number;
  ball: number;
  runs: number;
  extras: number;
  isWicket: boolean;
  isBoundary: boolean;
  isSix: boolean;
  batsman: string;
  bowler: string;
  commentary: string;
  totalScore: number;
  totalWickets: number;
  currentRunRate: number;
}

class CricketApiService {
  private apiKey: string | undefined;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_TTL = 30000; // 30 seconds cache

  constructor() {
    this.apiKey = process.env.CRICKET_API_KEY;
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = process.env.CRICKET_API_KEY;
    }
    if (!this.apiKey) {
      throw new Error('CRICKET_API_KEY is not configured. Please add your CricketData.org API key.');
    }
    return this.apiKey;
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getSeries(offset: number = 0): Promise<CricketSeries[]> {
    const cacheKey = `series-${offset}`;
    const cached = this.getCached<CricketSeries[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${CRICKET_API_BASE}/series?apikey=${this.getApiKey()}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketSeries[]> = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch cricket series');
    }

    this.setCache(cacheKey, data.data || []);
    return data.data || [];
  }

  async searchSeries(search: string): Promise<CricketSeries[]> {
    const response = await fetch(`${CRICKET_API_BASE}/series?apikey=${this.getApiKey()}&search=${encodeURIComponent(search)}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketSeries[]> = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to search cricket series');
    }

    return data.data || [];
  }

  async getCurrentMatches(): Promise<CricketMatch[]> {
    const cacheKey = 'current-matches';
    const cached = this.getCached<CricketMatch[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${CRICKET_API_BASE}/currentMatches?apikey=${this.getApiKey()}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketMatch[]> = await response.json();
    
    if (data.status !== 'success') {
      console.error('[CricketAPI] Failed to fetch current matches:', data);
      throw new Error('Failed to fetch current cricket matches');
    }

    console.log(`[CricketAPI] Fetched ${data.data?.length || 0} current matches. Hits today: ${data.info?.hitsToday}`);
    this.setCache(cacheKey, data.data || []);
    return data.data || [];
  }

  async getAllMatches(offset: number = 0): Promise<CricketMatch[]> {
    const cacheKey = `all-matches-${offset}`;
    const cached = this.getCached<CricketMatch[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${CRICKET_API_BASE}/matches?apikey=${this.getApiKey()}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketMatch[]> = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch cricket matches');
    }

    this.setCache(cacheKey, data.data || []);
    return data.data || [];
  }

  async getMatchInfo(matchId: string): Promise<any> {
    const cacheKey = `match-info-${matchId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${CRICKET_API_BASE}/match_info?apikey=${this.getApiKey()}&id=${matchId}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch match info');
    }

    this.setCache(cacheKey, data.data);
    return data.data;
  }

  // Fantasy Scorecard API - Detailed live scorecard (Premium)
  async getFantasyScorecard(matchId: string): Promise<FantasyScorecard | null> {
    const cacheKey = `fantasy-scorecard-${matchId}`;
    const cached = this.getCached<FantasyScorecard>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${CRICKET_API_BASE}/match_scorecard?apikey=${this.getApiKey()}&id=${matchId}`);
      
      if (!response.ok) {
        console.error(`[CricketAPI] Fantasy Scorecard API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 'success') {
        console.error('[CricketAPI] Fantasy Scorecard failed:', data);
        return null;
      }

      console.log(`[CricketAPI] Fetched fantasy scorecard for match ${matchId}`);
      this.setCache(cacheKey, data.data);
      return data.data;
    } catch (error) {
      console.error('[CricketAPI] Fantasy Scorecard error:', error);
      return null;
    }
  }

  // Fantasy Ball-by-Ball API - Real-time ball data (Premium)
  async getFantasyBallByBall(matchId: string): Promise<any | null> {
    const cacheKey = `fantasy-bbb-${matchId}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${CRICKET_API_BASE}/match_bbb?apikey=${this.getApiKey()}&id=${matchId}`);
      
      if (!response.ok) {
        console.error(`[CricketAPI] Ball-by-Ball API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 'success') {
        console.error('[CricketAPI] Ball-by-Ball failed:', data);
        return null;
      }

      console.log(`[CricketAPI] Fetched ball-by-ball for match ${matchId}`);
      this.setCache(cacheKey, data.data);
      return data.data;
    } catch (error) {
      console.error('[CricketAPI] Ball-by-Ball error:', error);
      return null;
    }
  }

  // eCricScore API - Quick live scores
  async getCricScore(matchId: string): Promise<any | null> {
    try {
      const response = await fetch(`${CRICKET_API_BASE}/cricScore?apikey=${this.getApiKey()}&id=${matchId}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data.status !== 'success') {
        return null;
      }

      return data.data;
    } catch (error) {
      console.error('[CricketAPI] CricScore error:', error);
      return null;
    }
  }

  // Get live match state for instance betting
  async getLiveMatchState(matchId: string): Promise<{
    currentOver: number;
    currentBall: number;
    totalScore: number;
    totalWickets: number;
    currentRunRate: number;
    currentBatsmen: string[];
    currentBowler: string;
    lastBalls: Array<{ runs: number; isWicket: boolean; isBoundary: boolean }>;
    recentOvers: Array<{ over: number; runs: number; wickets: number }>;
  } | null> {
    try {
      // Try to get ball-by-ball data first
      const bbbData = await this.getFantasyBallByBall(matchId);
      
      if (bbbData && bbbData.bpidata) {
        const innings = bbbData.bpidata;
        const lastInning = innings[innings.length - 1];
        
        if (lastInning && lastInning.bowls) {
          const bowls = lastInning.bowls;
          const lastBowl = bowls[bowls.length - 1];
          
          // Parse over.ball format
          const overBall = lastBowl?.over?.toString().split('.') || ['0', '0'];
          const currentOver = parseInt(overBall[0]) || 0;
          const currentBall = parseInt(overBall[1]) || 0;
          
          // Get last 6 balls
          const lastBalls = bowls.slice(-6).map((b: any) => ({
            runs: b.runs || 0,
            isWicket: b.wicket === true,
            isBoundary: b.runs === 4,
            isSix: b.runs === 6
          }));
          
          return {
            currentOver,
            currentBall,
            totalScore: lastInning.runs || 0,
            totalWickets: lastInning.wickets || 0,
            currentRunRate: lastInning.runs / Math.max(currentOver + (currentBall / 6), 1),
            currentBatsmen: [lastBowl?.batsman?.name || 'Unknown'],
            currentBowler: lastBowl?.bowler?.name || 'Unknown',
            lastBalls,
            recentOvers: []
          };
        }
      }
      
      // Fallback to match info if BBB not available
      const matchInfo = await this.getMatchInfo(matchId);
      if (matchInfo && matchInfo.score && matchInfo.score.length > 0) {
        const currentInning = matchInfo.score[matchInfo.score.length - 1];
        const oversPlayed = currentInning.o || 0;
        const overParts = oversPlayed.toString().split('.');
        
        return {
          currentOver: parseInt(overParts[0]) || 0,
          currentBall: parseInt(overParts[1]) || 0,
          totalScore: currentInning.r || 0,
          totalWickets: currentInning.w || 0,
          currentRunRate: currentInning.r / Math.max(oversPlayed, 1),
          currentBatsmen: [],
          currentBowler: '',
          lastBalls: [],
          recentOvers: []
        };
      }
      
      return null;
    } catch (error) {
      console.error('[CricketAPI] getLiveMatchState error:', error);
      return null;
    }
  }

  async getSeriesInfo(seriesId: string): Promise<any> {
    const response = await fetch(`${CRICKET_API_BASE}/series_info?apikey=${this.getApiKey()}&id=${seriesId}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch series info');
    }

    return data.data;
  }

  // Get API usage stats
  async getApiUsage(): Promise<{ hitsToday: number; hitsLimit: number } | null> {
    try {
      const response = await fetch(`${CRICKET_API_BASE}/currentMatches?apikey=${this.getApiKey()}`);
      const data = await response.json();
      return data.info || null;
    } catch {
      return null;
    }
  }

  // Convert cricket match to our internal match format
  convertToMatch(match: CricketMatch) {
    const now = new Date();
    const matchTime = new Date(match.dateTimeGMT);
    const minutesUntilStart = (matchTime.getTime() - now.getTime()) / (1000 * 60);
    
    // Determine match status
    let status: 'LIVE' | 'UPCOMING' | 'FINISHED' = 'UPCOMING';
    if (match.matchEnded) {
      status = 'FINISHED';
    } else if (match.matchStarted) {
      status = 'LIVE';
    } else if (minutesUntilStart <= 0) {
      status = 'LIVE';
    }

    // Build score string
    let scoreHome: string | null = null;
    let scoreAway: string | null = null;
    let scoreDetails: string | null = null;

    if (match.score && match.score.length > 0) {
      scoreDetails = match.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o})`).join(' | ');
      if (match.score[0]) {
        scoreHome = `${match.score[0].r}/${match.score[0].w}`;
      }
      if (match.score[1]) {
        scoreAway = `${match.score[1].r}/${match.score[1].w}`;
      }
    }

    // Generate odds (simulated since CricketData doesn't provide odds)
    const homeOdds = (1.5 + Math.random() * 2).toFixed(2);
    const awayOdds = (1.5 + Math.random() * 2).toFixed(2);
    const drawOdds = match.matchType === 'test' ? (3 + Math.random() * 2).toFixed(2) : null;

    const marketId = `cricket-${match.id}-market`;
    const runners: any[] = [];

    if (match.teams && match.teams.length >= 2) {
      runners.push({
        id: `cricket-${match.id}-runner-0`,
        marketId: marketId,
        name: match.teams[0],
        backOdds: homeOdds,
        layOdds: (parseFloat(homeOdds) * 1.02).toFixed(2),
        volume: Math.floor(Math.random() * 500000) + 100000,
      });
      runners.push({
        id: `cricket-${match.id}-runner-1`,
        marketId: marketId,
        name: match.teams[1],
        backOdds: awayOdds,
        layOdds: (parseFloat(awayOdds) * 1.02).toFixed(2),
        volume: Math.floor(Math.random() * 500000) + 100000,
      });
      
      // Add draw option for Test matches
      if (drawOdds) {
        runners.push({
          id: `cricket-${match.id}-runner-2`,
          marketId: marketId,
          name: 'Draw',
          backOdds: drawOdds,
          layOdds: (parseFloat(drawOdds) * 1.02).toFixed(2),
          volume: Math.floor(Math.random() * 200000) + 50000,
        });
      }
    }

    // Determine league name
    let league = match.matchType.toUpperCase();
    if (match.name.includes('IPL') || match.name.includes('Premier League')) {
      league = 'IPL';
    } else if (match.name.includes('Big Bash') || match.name.includes('BBL')) {
      league = 'Big Bash';
    } else if (match.name.includes('PSL')) {
      league = 'PSL';
    } else if (match.name.includes('CPL')) {
      league = 'CPL';
    } else if (match.matchType === 'test') {
      league = 'Test Match';
    } else if (match.matchType === 'odi') {
      league = 'ODI';
    } else if (match.matchType === 't20') {
      league = 'T20';
    }

    return {
      id: `cricket-${match.id}`,
      externalId: match.id,
      sport: 'cricket',
      league: league,
      homeTeam: match.teams?.[0] || 'Team A',
      awayTeam: match.teams?.[1] || 'Team B',
      startTime: match.dateTimeGMT,
      status: status,
      scoreHome: scoreHome,
      scoreAway: scoreAway,
      scoreDetails: match.status || scoreDetails,
      fantasyEnabled: match.fantasyEnabled,
      bbbEnabled: match.bbbEnabled,
      markets: [{
        id: marketId,
        matchId: `cricket-${match.id}`,
        name: 'Match Winner',
        status: status === 'FINISHED' ? 'CLOSED' : 'OPEN',
        runners: runners
      }]
    };
  }
}

export const cricketApiService = new CricketApiService();

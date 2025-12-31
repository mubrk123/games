// Cricket Data API Service (cricketdata.org / cricapi.com)
// Provides comprehensive cricket coverage including IPL, Test, ODI, T20, and domestic leagues

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
}

class CricketApiService {
  private apiKey: string | undefined;

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

  async getSeries(offset: number = 0): Promise<CricketSeries[]> {
    const response = await fetch(`${CRICKET_API_BASE}/series?apikey=${this.getApiKey()}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketSeries[]> = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch cricket series');
    }

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
    const response = await fetch(`${CRICKET_API_BASE}/currentMatches?apikey=${this.getApiKey()}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketMatch[]> = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch current cricket matches');
    }

    return data.data || [];
  }

  async getAllMatches(offset: number = 0): Promise<CricketMatch[]> {
    const response = await fetch(`${CRICKET_API_BASE}/matches?apikey=${this.getApiKey()}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data: CricketApiResponse<CricketMatch[]> = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch cricket matches');
    }

    return data.data || [];
  }

  async getMatchInfo(matchId: string): Promise<any> {
    const response = await fetch(`${CRICKET_API_BASE}/match_info?apikey=${this.getApiKey()}&id=${matchId}`);
    
    if (!response.ok) {
      throw new Error(`Cricket API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch match info');
    }

    return data.data;
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
    // In a real scenario, you'd get odds from a betting API
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
      sport: 'cricket',
      league: league,
      homeTeam: match.teams?.[0] || 'Team A',
      awayTeam: match.teams?.[1] || 'Team B',
      startTime: match.dateTimeGMT,
      status: status,
      scoreHome: scoreHome,
      scoreAway: scoreAway,
      scoreDetails: match.status || scoreDetails,
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

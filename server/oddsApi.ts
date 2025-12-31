// The Odds API Integration
// Documentation: https://the-odds-api.com/

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

export interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface OddsApiOutcome {
  name: string;
  price: number;
}

export interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface OddsApiScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
}

class OddsApiService {
  private async fetch<T>(endpoint: string): Promise<T> {
    if (!ODDS_API_KEY) {
      throw new Error('ODDS_API_KEY is not configured');
    }

    const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${ODDS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Odds API error: ${response.status} - ${text}`);
    }

    return response.json();
  }

  // Get all available sports
  async getSports(): Promise<OddsApiSport[]> {
    return this.fetch<OddsApiSport[]>('/sports');
  }

  // Get live and upcoming events with odds for a specific sport
  async getOdds(sportKey: string, markets: string = 'h2h'): Promise<OddsApiEvent[]> {
    return this.fetch<OddsApiEvent[]>(
      `/sports/${sportKey}/odds?regions=us,uk,eu&markets=${markets}&oddsFormat=decimal`
    );
  }

  // Get live scores for a sport
  async getScores(sportKey: string, daysFrom: number = 1): Promise<OddsApiScore[]> {
    return this.fetch<OddsApiScore[]>(
      `/sports/${sportKey}/scores?daysFrom=${daysFrom}`
    );
  }

  // Get all live events across multiple sports
  async getAllLiveEvents(sportKeys: string[]): Promise<OddsApiEvent[]> {
    const allEvents: OddsApiEvent[] = [];
    
    for (const sportKey of sportKeys) {
      try {
        const events = await this.getOdds(sportKey);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to fetch odds for ${sportKey}:`, error);
      }
    }

    return allEvents;
  }

  // Convert API event to our match format
  convertToMatch(event: OddsApiEvent) {
    // Get the first bookmaker's odds (usually the most reliable)
    const bookmaker = event.bookmakers[0];
    const h2hMarket = bookmaker?.markets.find(m => m.key === 'h2h');
    
    // Determine if event is live or upcoming
    // The Odds API returns events that are about to start or in progress
    // We consider a match "LIVE" if it has started (commence_time is in the past)
    // and not finished yet (within reasonable game duration ~4 hours)
    const now = new Date();
    const commenceTime = new Date(event.commence_time);
    const minutesUntilStart = (commenceTime.getTime() - now.getTime()) / (1000 * 60);
    
    // Match is LIVE if it started (negative minutes) but within 4 hours of start
    const isLive = minutesUntilStart <= 0 && minutesUntilStart > -240;
    // Match is UPCOMING if it starts within 24 hours
    const isUpcoming = minutesUntilStart > 0;

    const marketId = `${event.id}-market`;

    // Build runners from outcomes - convert odds to strings to match database schema
    const runners = h2hMarket?.outcomes?.map((outcome, idx) => ({
      id: `${event.id}-runner-${idx}`,
      marketId: marketId,
      name: outcome.name,
      backOdds: String(outcome.price.toFixed(2)),
      layOdds: String((outcome.price * 1.02).toFixed(2)), // Simulate lay odds (2% higher)
      volume: Math.floor(Math.random() * 100000) + 50000, // Simulated volume
    })) || [];

    return {
      id: event.id,
      sport: this.mapSportKey(event.sport_key),
      league: event.sport_title,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startTime: event.commence_time,
      status: isLive ? 'LIVE' : isUpcoming ? 'UPCOMING' : 'FINISHED',
      scoreHome: null,
      scoreAway: null,
      scoreDetails: null,
      markets: [{
        id: marketId,
        matchId: event.id,
        name: 'Match Winner',
        status: 'OPEN',
        runners
      }]
    };
  }

  private mapSportKey(sportKey: string): string {
    // Map The Odds API sport keys to our sport types
    if (sportKey.includes('cricket')) return 'cricket';
    if (sportKey.includes('soccer')) return 'football';
    if (sportKey.includes('tennis')) return 'tennis';
    if (sportKey.includes('basketball')) return 'basketball';
    if (sportKey.includes('americanfootball')) return 'football';
    if (sportKey.includes('icehockey')) return 'football';
    if (sportKey.includes('boxing') || sportKey.includes('mma')) return 'football';
    if (sportKey.includes('rugby')) return 'football';
    return 'football'; // Default
  }
}

export const oddsApiService = new OddsApiService();

// Popular sports to fetch (The Odds API sport keys)
export const POPULAR_SPORTS = [
  // Cricket (available leagues)
  'cricket_big_bash',     // Big Bash League (Australia T20)
  
  // Football/Soccer
  'soccer_epl',           // English Premier League
  'soccer_spain_la_liga', // La Liga
  'soccer_germany_bundesliga', // Bundesliga
  'soccer_italy_serie_a', // Serie A
  'soccer_france_ligue_one', // Ligue 1
  'soccer_argentina_primera_division', // Argentine Primera
  'soccer_australia_aleague', // A-League
  
  // Basketball
  'basketball_nba',       // NBA
  'basketball_ncaab',     // College Basketball
  'basketball_euroleague', // Euroleague
  'basketball_nbl',       // AU National Basketball League
  
  // Tennis (when tournaments are active)
  'tennis_atp_aus_open',  // Australian Open
  
  // American Football
  'americanfootball_nfl', // NFL
  'americanfootball_ncaaf', // College Football
  
  // Other popular sports
  'icehockey_nhl',        // NHL
  'boxing_boxing',        // Boxing
  'mma_mixed_martial_arts', // MMA/UFC
  'rugbyleague_nrl',      // NRL (Rugby League)
];

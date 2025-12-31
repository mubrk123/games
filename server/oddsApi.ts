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
    
    // Determine if event is live (within 2 hours of commence time)
    const now = new Date();
    const commenceTime = new Date(event.commence_time);
    const hoursUntilStart = (commenceTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLive = hoursUntilStart <= 0 && hoursUntilStart > -3; // Within 3 hours after start
    const isUpcoming = hoursUntilStart > 0;

    const marketId = `${event.id}-market`;

    // Build runners from outcomes - convert odds to strings to match database schema
    const runners = h2hMarket?.outcomes.map((outcome, idx) => ({
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
    if (sportKey.includes('soccer') || sportKey.includes('football')) return 'football';
    if (sportKey.includes('tennis')) return 'tennis';
    if (sportKey.includes('basketball')) return 'basketball';
    return 'football'; // Default
  }
}

export const oddsApiService = new OddsApiService();

// Popular sports to fetch (The Odds API sport keys)
export const POPULAR_SPORTS = [
  'soccer_epl',           // English Premier League
  'soccer_spain_la_liga', // La Liga
  'soccer_germany_bundesliga', // Bundesliga
  'soccer_italy_serie_a', // Serie A
  'basketball_nba',       // NBA
  'basketball_euroleague', // Euroleague
  'tennis_atp_french_open', // ATP Tennis
  'americanfootball_nfl', // NFL
  'cricket_ipl',          // IPL Cricket
  'cricket_test_match',   // Test Cricket
];

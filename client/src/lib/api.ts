// API Client for ProBetX Backend

export interface ApiUser {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN' | 'AGENT';
  balance: string;
  exposure: string;
  currency: string;
  createdAt: string;
  totalBets?: number;
  wonBets?: number;
  lostBets?: number;
}

export interface ApiMatch {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: 'LIVE' | 'UPCOMING' | 'FINISHED';
  scoreHome?: string;
  scoreAway?: string;
  scoreDetails?: string;
  markets: ApiMarket[];
}

export interface ApiMarket {
  id: string;
  matchId?: string;
  name: string;
  status: 'OPEN' | 'SUSPENDED' | 'CLOSED';
  runners: ApiRunner[];
}

export interface ApiRunner {
  id: string;
  marketId?: string;
  name: string;
  backOdds: string | number;
  layOdds: string | number;
  volume: number;
}

export interface ApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface ApiBet {
  id: string;
  userId: string;
  matchId: string;
  marketId: string;
  runnerId: string;
  type: 'BACK' | 'LAY';
  odds: string;
  stake: string;
  potentialProfit: string;
  status: 'OPEN' | 'WON' | 'LOST' | 'VOID';
  createdAt: string;
  settledAt?: string;
}

class ApiClient {
  private baseUrl = '/api';

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include', // Important for session cookies
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // Authentication
  // ============================================
  
  async login(username: string, password: string): Promise<{ user: ApiUser }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async getCurrentUser(): Promise<{ user: ApiUser }> {
    return this.request('/auth/me');
  }

  // ============================================
  // Admin - User Management
  // ============================================
  
  async getAllUsers(): Promise<{ users: ApiUser[] }> {
    return this.request('/admin/users');
  }

  async createUser(data: {
    username: string;
    password: string;
    role: 'USER' | 'ADMIN' | 'AGENT';
    balance?: string;
  }): Promise<{ user: ApiUser }> {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addCredit(userId: string, amount: number): Promise<{ user: ApiUser }> {
    return this.request(`/admin/users/${userId}/credit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async removeCredit(userId: string, amount: number): Promise<{ user: ApiUser }> {
    return this.request(`/admin/users/${userId}/debit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getAllBets(): Promise<{ bets: ApiBet[] }> {
    return this.request('/admin/bets');
  }

  // ============================================
  // Matches (Database)
  // ============================================
  
  async getMatches(): Promise<{ matches: ApiMatch[] }> {
    return this.request('/matches');
  }

  // ============================================
  // Live Odds (The Odds API)
  // ============================================
  
  async getLiveSports(): Promise<{ sports: ApiSport[] }> {
    return this.request('/live/sports');
  }

  async getLiveOdds(sportKey: string): Promise<{ matches: ApiMatch[] }> {
    return this.request(`/live/odds/${sportKey}`);
  }

  async getAllLiveEvents(): Promise<{ matches: ApiMatch[] }> {
    return this.request('/live/all');
  }

  async getLiveScores(sportKey: string): Promise<{ scores: any[] }> {
    return this.request(`/live/scores/${sportKey}`);
  }

  // ============================================
  // Cricket (CricketData.org API)
  // ============================================
  
  async getCurrentCricketMatches(): Promise<{ matches: ApiMatch[] }> {
    return this.request('/cricket/current');
  }

  async getAllCricketMatches(offset: number = 0): Promise<{ matches: ApiMatch[] }> {
    return this.request(`/cricket/matches?offset=${offset}`);
  }

  async getCricketSeries(search?: string): Promise<{ series: any[] }> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/cricket/series${params}`);
  }

  async getCricketMatchInfo(matchId: string): Promise<{ match: any }> {
    return this.request(`/cricket/match/${matchId}`);
  }

  // ============================================
  // Betting
  // ============================================
  
  async placeBet(data: {
    matchId: string;
    marketId: string;
    runnerId: string;
    runnerName?: string;
    type: 'BACK' | 'LAY';
    odds: string;
    stake: string;
  }): Promise<{ bet: ApiBet }> {
    return this.request('/bets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUserBets(): Promise<{ bets: ApiBet[] }> {
    return this.request('/bets/me');
  }

  async getWalletTransactions(): Promise<{ transactions: any[] }> {
    return this.request('/wallet/transactions');
  }

  // ============================================
  // Instance Betting
  // ============================================

  async getInstanceMarkets(matchId: string, sport?: string, homeTeam?: string, awayTeam?: string): Promise<{ markets: InstanceMarket[] }> {
    let params = `?sport=${sport || 'cricket'}`;
    if (homeTeam) params += `&homeTeam=${encodeURIComponent(homeTeam)}`;
    if (awayTeam) params += `&awayTeam=${encodeURIComponent(awayTeam)}`;
    return this.request(`/instance/markets/${matchId}${params}`);
  }

  async getAllInstanceMarkets(): Promise<{ markets: InstanceMarket[] }> {
    return this.request('/instance/markets');
  }

  async placeInstanceBet(data: {
    marketId: string;
    outcomeId: string;
    stake: string;
  }): Promise<{ bet: ApiBet; message: string; market: string }> {
    return this.request('/instance/bet', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRealtimeUpdate(matchId: string): Promise<RealtimeUpdate> {
    return this.request(`/live/realtime/${matchId}`);
  }

  // ============================================
  // Casino
  // ============================================

  async getCasinoGames(): Promise<{ games: CasinoGame[] }> {
    return this.request('/casino/games');
  }

  async getCasinoHistory(): Promise<{ history: CasinoBet[] }> {
    return this.request('/casino/history');
  }

  async playSlots(betAmount: number, clientSeed?: string): Promise<SlotsResult> {
    return this.request('/casino/slots/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, clientSeed }),
    });
  }

  async playCrash(betAmount: number, cashoutMultiplier: number, clientSeed?: string): Promise<CrashResult> {
    return this.request('/casino/crash/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, cashoutMultiplier, clientSeed }),
    });
  }

  async playDice(betAmount: number, prediction: 'high' | 'low', target: number, clientSeed?: string): Promise<DiceResult> {
    return this.request('/casino/dice/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, prediction, target, clientSeed }),
    });
  }

  async playAndarBahar(betAmount: number, choice: 'andar' | 'bahar', clientSeed?: string): Promise<AndarBaharResult> {
    return this.request('/casino/andar-bahar/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, choice, clientSeed }),
    });
  }

  async playTeenPatti(betAmount: number, clientSeed?: string): Promise<TeenPattiResult> {
    return this.request('/casino/teen-patti/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, clientSeed }),
    });
  }

  async playLucky7(betAmount: number, bet: 'low' | 'seven' | 'high', clientSeed?: string): Promise<Lucky7Result> {
    return this.request('/casino/lucky-7/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, bet, clientSeed }),
    });
  }

  async playRoulette(betAmount: number, betType: string, betValue: string, clientSeed?: string): Promise<RouletteResult> {
    return this.request('/casino/roulette/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, betType, betValue, clientSeed }),
    });
  }

  async verifyFairness(roundId: string): Promise<FairnessVerification> {
    return this.request(`/casino/verify/${roundId}`);
  }
}

export interface InstanceMarket {
  id: string;
  matchId: string;
  instanceType: string;
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
  status: 'PENDING' | 'OPEN' | 'SUSPENDED' | 'CLOSED' | 'SETTLED';
  eventReference: string;
  outcomes: InstanceOutcome[];
}

export interface InstanceOutcome {
  id: string;
  marketId: string;
  name: string;
  odds: number;
  probability: number;
}

export interface RealtimeUpdate {
  matchId: string;
  scoreHome?: string;
  scoreAway?: string;
  scoreDetails?: string;
  currentOver?: number;
  currentBall?: number;
  status: string;
  timestamp: string;
}

export interface CasinoGame {
  id: string;
  name: string;
  slug: string;
  type: 'slots' | 'crash' | 'dice' | 'roulette' | 'blackjack' | 'andar_bahar' | 'teen_patti' | 'lucky_7';
  description: string | null;
  minBet: string;
  maxBet: string;
  houseEdge: string;
  isActive: boolean;
}

export interface CasinoBet {
  id: string;
  userId: string;
  roundId: string;
  gameId: string;
  betAmount: string;
  betChoice: string | null;
  payout: string | null;
  profit: string | null;
  isWin: boolean | null;
  createdAt: string;
}

export interface SlotsResult {
  roundId: string;
  result: {
    reels: number[][];
    symbols: string[][];
    multiplier: number;
    isWin: boolean;
  };
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface CrashResult {
  roundId: string;
  crashPoint: number;
  cashoutMultiplier: number;
  isWin: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface DiceResult {
  roundId: string;
  roll: number;
  prediction: 'high' | 'low';
  target: number;
  isWin: boolean;
  multiplier: number;
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface AndarBaharResult {
  roundId: string;
  jokerCard: string;
  andarCards: string[];
  baharCards: string[];
  winningSide: 'andar' | 'bahar';
  cardCount: number;
  choice: 'andar' | 'bahar';
  isWin: boolean;
  multiplier: number;
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface TeenPattiResult {
  roundId: string;
  playerCards: string[];
  dealerCards: string[];
  playerHandRank: string;
  dealerHandRank: string;
  winner: 'player' | 'dealer' | 'tie';
  multiplier: number;
  isWin: boolean;
  isTie: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface Lucky7Result {
  roundId: string;
  card: string;
  cardValue: number;
  outcome: 'low' | 'seven' | 'high';
  bet: 'low' | 'seven' | 'high';
  multiplier: number;
  isWin: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface RouletteResult {
  roundId: string;
  number: number;
  color: 'red' | 'black' | 'green';
  betType: string;
  betValue: string;
  multiplier: number;
  isWin: boolean;
  betAmount: number;
  payout: number;
  profit: number;
  newBalance: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface FairnessVerification {
  roundId: string;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  isValid: boolean;
  result: any;
}

export const api = new ApiClient();

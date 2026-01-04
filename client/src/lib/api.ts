// API Client for ProBetX Backend

export interface ApiUser {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN' | 'AGENT' | 'SUPER_ADMIN';
  balance: string;
  exposure: string;
  currency: string;
  createdById?: string;
  createdAt: string;
  totalBets?: number;
  wonBets?: number;
  lostBets?: number;
  usersCreated?: number;
  totalDistributed?: number;
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

  async getUserActivity(userId: string): Promise<{
    summary: {
      totalBets: number;
      betsWon: number;
      betsLost: number;
      totalBetAmount: number;
      totalWinnings: number;
      totalCasinoBets: number;
      casinoWon: number;
      casinoLost: number;
      totalCasinoWagered: number;
      totalCasinoWinnings: number;
    };
    bets: any[];
    instanceBets: any[];
    casinoBets: any[];
    transactions: any[];
  }> {
    return this.request(`/admin/users/${userId}/activity`);
  }

  // ============================================
  // Super Admin - Admin Management
  // ============================================

  async getAdmins(): Promise<{ admins: ApiUser[] }> {
    return this.request('/super-admin/admins');
  }

  async createAdmin(data: {
    username: string;
    password: string;
    balance?: string;
  }): Promise<{ admin: ApiUser }> {
    return this.request('/super-admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addBalanceToAdmin(adminId: string, amount: number): Promise<{ admin: ApiUser }> {
    return this.request(`/super-admin/admins/${adminId}/add-balance`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // ============================================
  // Admin - Balance Distribution
  // ============================================

  async getMyUsers(): Promise<{ users: ApiUser[] }> {
    return this.request('/admin/my-users');
  }

  async createUserWithBalance(data: {
    username: string;
    password: string;
    balance?: string;
  }): Promise<{ user: ApiUser }> {
    return this.request('/admin/create-user', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async distributeBalance(userId: string, amount: number): Promise<{ success: boolean; user: { id: string; balance: string }; adminBalance: string }> {
    return this.request('/admin/distribute-balance', {
      method: 'POST',
      body: JSON.stringify({ userId, amount }),
    });
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

  async getUserInstanceBets(): Promise<{ bets: any[] }> {
    return this.request('/instance/bets/me');
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

  async playBlackjack(betAmount: number, clientSeed?: string): Promise<BlackjackResult> {
    return this.request('/casino/blackjack/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, clientSeed }),
    });
  }

  async playHiLo(betAmount: number, guess: 'higher' | 'lower', clientSeed?: string): Promise<HiLoResult> {
    return this.request('/casino/hi-lo/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, guess, clientSeed }),
    });
  }

  async playDragonTiger(betAmount: number, bet: 'dragon' | 'tiger' | 'tie', clientSeed?: string): Promise<DragonTigerResult> {
    return this.request('/casino/dragon-tiger/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, bet, clientSeed }),
    });
  }

  async playPlinko(betAmount: number, risk: 'low' | 'medium' | 'high', rows?: number, clientSeed?: string): Promise<PlinkoResult> {
    return this.request('/casino/plinko/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, risk, rows: rows || 16, clientSeed }),
    });
  }

  async playWheelOfFortune(betAmount: number, clientSeed?: string): Promise<WheelResult> {
    return this.request('/casino/wheel/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, clientSeed }),
    });
  }

  async playMines(betAmount: number, mineCount: number, tilesToReveal: number = 3, clientSeed?: string): Promise<MinesResult> {
    return this.request('/casino/mines/play', {
      method: 'POST',
      body: JSON.stringify({ betAmount, mineCount, tilesToReveal, clientSeed }),
    });
  }

  // Mines Manual Mode
  async minesStart(betAmount: number, mineCount: number, clientSeed?: string): Promise<MinesStartResult> {
    return this.request('/casino/mines/start', {
      method: 'POST',
      body: JSON.stringify({ betAmount, mineCount, clientSeed }),
    });
  }

  async minesReveal(gameId: string, tileIndex: number): Promise<MinesRevealResult> {
    return this.request('/casino/mines/reveal', {
      method: 'POST',
      body: JSON.stringify({ gameId, tileIndex }),
    });
  }

  async minesCashout(gameId: string): Promise<MinesCashoutResult> {
    return this.request('/casino/mines/cashout', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  }

  async minesGetActive(): Promise<MinesActiveResult> {
    return this.request('/casino/mines/active');
  }

  // ============================================
  // Deposit Requests
  // ============================================

  async requestDeposit(amount: number): Promise<{ request: any; message: string }> {
    return this.request('/deposits/request', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getMyDepositRequests(): Promise<{ requests: any[] }> {
    return this.request('/deposits/me');
  }

  async getPendingDepositRequests(): Promise<{ requests: any[] }> {
    return this.request('/admin/deposits/pending');
  }

  async approveDepositRequest(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/admin/deposits/${id}/approve`, {
      method: 'POST',
    });
  }

  async rejectDepositRequest(id: string, notes?: string): Promise<{ request: any; message: string }> {
    return this.request(`/admin/deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
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
  overNumber: number;
  ballNumber: number;
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

export interface BlackjackResult {
  playerCards: string[];
  dealerCards: string[];
  playerValue: number;
  dealerValue: number;
  isWin: boolean;
  isPush: boolean;
  payout: number;
  profit: number;
  newBalance: number;
}

export interface HiLoResult {
  firstCard: string;
  nextCard: string;
  guess: 'higher' | 'lower';
  isWin: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  newBalance: number;
}

export interface DragonTigerResult {
  dragonCard: string;
  tigerCard: string;
  winner: 'dragon' | 'tiger' | 'tie';
  bet: 'dragon' | 'tiger' | 'tie';
  isWin: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  newBalance: number;
}

export interface PlinkoResult {
  path: string[];
  slot: number;
  multiplier: number;
  isWin: boolean;
  payout: number;
  profit: number;
  newBalance: number;
}

export interface WheelResult {
  segment: number;
  label: string;
  multiplier: number;
  isWin: boolean;
  payout: number;
  profit: number;
  newBalance: number;
}

export interface MinesResult {
  minePositions: number[];
  revealedTiles: number[];
  hitMine: boolean;
  multiplier: number;
  isWin: boolean;
  payout: number;
  profit: number;
  newBalance: number;
}

export interface MinesStartResult {
  gameId: string;
  serverSeedHash: string;
  mineCount: number;
  gridSize: number;
  currentMultiplier: number;
  potentialCashout: number;
  newBalance: number;
  multiplierTable: { tiles: number; multiplier: number }[];
}

export interface MinesRevealResult {
  tileIndex: number;
  isMine: boolean;
  gameOver: boolean;
  isWin?: boolean;
  currentMultiplier?: number;
  nextMultiplier?: number;
  potentialCashout?: number;
  revealedTiles: number[];
  safeRevealed?: number;
  tilesRemaining?: number;
  minePositions?: number[];
  payout?: number;
  serverSeed?: string;
}

export interface MinesCashoutResult {
  gameOver: boolean;
  isWin: boolean;
  isMine: boolean;
  multiplier: number;
  payout: number;
  profit: number;
  newBalance: number;
  minePositions: number[];
  revealedTiles: number[];
  serverSeed: string;
}

export interface MinesActiveResult {
  active: boolean;
  gameId?: string;
  mineCount?: number;
  betAmount?: number;
  currentMultiplier?: number;
  potentialCashout?: number;
  revealedTiles?: number[];
  safeRevealed?: number;
  serverSeedHash?: string;
}

export const api = new ApiClient();
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
  matchId: string;
  name: string;
  status: 'OPEN' | 'SUSPENDED' | 'CLOSED';
  runners: ApiRunner[];
}

export interface ApiRunner {
  id: string;
  marketId: string;
  name: string;
  backOdds: string;
  layOdds: string;
  volume: number;
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
  // Matches
  // ============================================
  
  async getMatches(): Promise<{ matches: ApiMatch[] }> {
    return this.request('/matches');
  }

  // ============================================
  // Betting
  // ============================================
  
  async placeBet(data: {
    matchId: string;
    marketId: string;
    runnerId: string;
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
}

export const api = new ApiClient();

import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN' | 'AGENT';
  balance: number;
  exposure: number;
  currency: string;
}

export interface Match {
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
  markets: Market[];
}

export interface Market {
  id: string;
  matchId?: string;
  name: string;
  status: 'OPEN' | 'SUSPENDED' | 'CLOSED';
  runners: Runner[];
}

export interface Runner {
  id: string;
  marketId?: string;
  name: string;
  backOdds: number;
  layOdds: number;
  volume: number;
}

export interface Bet {
  id: string;
  matchId: string;
  marketId: string;
  runnerId: string;
  type: 'BACK' | 'LAY';
  odds: number;
  stake: number;
  potentialProfit: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'VOID';
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  matches: Match[];
  bets: Bet[];
  
  // Actions
  setCurrentUser: (user: User | null) => void;
  setMatches: (matches: Match[]) => void;
  setBets: (bets: Bet[]) => void;
  updateMatchOdds: (matchId: string, marketId: string, runnerId: string, backOdds: number, layOdds: number) => void;
  logout: () => void;
}

export const useStore = create<AppState>()((set) => ({
  currentUser: null,
  matches: [],
  bets: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  
  setMatches: (matches) => set({ matches }),
  
  setBets: (bets) => set({ bets }),
  
  updateMatchOdds: (matchId, marketId, runnerId, backOdds, layOdds) => {
    set((state) => ({
      matches: state.matches.map((m) => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          markets: m.markets.map((mk) => {
            if (mk.id !== marketId) return mk;
            return {
              ...mk,
              runners: mk.runners.map((r) => {
                if (r.id !== runnerId) return r;
                return { ...r, backOdds, layOdds };
              }),
            };
          }),
        };
      }),
    }));
  },

  logout: () => set({ currentUser: null, matches: [], bets: [] }),
}));

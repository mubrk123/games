import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN' | 'AGENT' | 'SUPER_ADMIN';
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

export interface Notification {
  id: string;
  type: 'bet_won' | 'bet_lost' | 'deposit_approved' | 'deposit_rejected' | 'withdrawal_approved' | 'withdrawal_rejected' | 'balance_update' | 'info';
  title: string;
  message: string;
  amount?: number;
  read: boolean;
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  matches: Match[];
  bets: Bet[];
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  setCurrentUser: (user: User | null) => void;
  setMatches: (matches: Match[]) => void;
  setBets: (bets: Bet[]) => void;
  updateMatchOdds: (matchId: string, marketId: string, runnerId: string, backOdds: number, layOdds: number) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  logout: () => void;
}

export const useStore = create<AppState>()((set) => ({
  currentUser: null,
  matches: [],
  bets: [],
  notifications: [],
  unreadCount: 0,

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

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markNotificationRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.read) {
        return state;
      }
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  logout: () => set({ currentUser: null, matches: [], bets: [], notifications: [], unreadCount: 0 }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { Match, Market, Runner, User, MOCK_MATCHES, socketService } from './mockData';
import { Bet } from './types';

// Extended Types
export interface AppState {
  currentUser: User | null;
  users: User[];
  matches: Match[];
  bets: Bet[];
  
  // Actions
  login: (username: string, role: 'USER' | 'ADMIN') => boolean;
  logout: () => void;
  registerUser: (username: string, initialBalance: number) => void;
  addFunds: (userId: string, amount: number) => void;
  placeBet: (userId: string, betDetails: Omit<Bet, 'id' | 'timestamp' | 'status'>) => void;
  settleBet: (betId: string, status: 'WON' | 'LOST', winnings?: number) => void;
  updateMatchOdds: (matchId: string, marketId: string, runnerId: string, back: number, lay: number) => void;
}

// Store creation
export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      
      // Initialize Socket Listener
      socketService.on('odds_update', (data: any) => {
        get().updateMatchOdds(data.matchId, data.marketId, data.runnerId, data.newBack, data.newLay);
      });

      return {
        currentUser: null,
        
        // Initialize with our mock admin and a demo user
        users: [
          { id: 'admin-1', username: 'admin', role: 'ADMIN', balance: 0, exposure: 0, currency: 'INR' },
          { id: 'user-1', username: 'demo', role: 'USER', balance: 10000, exposure: 0, currency: 'INR' },
        ],
        
        matches: MOCK_MATCHES,
        bets: [],

        login: (username, role) => {
          const user = get().users.find(u => u.username === username && u.role === role);
          if (user) {
            set({ currentUser: user });
            return true;
          }
          return false;
        },

        logout: () => set({ currentUser: null }),

        registerUser: (username, initialBalance) => {
          const newUser: User = {
            id: nanoid(),
            username,
            role: 'USER',
            balance: initialBalance,
            exposure: 0,
            currency: 'INR'
          };
          set(state => ({ users: [...state.users, newUser] }));
        },

        addFunds: (userId, amount) => {
          set(state => ({
            users: state.users.map(u => 
              u.id === userId ? { ...u, balance: u.balance + amount } : u
            ),
            // Also update current user if it's them
            currentUser: state.currentUser?.id === userId 
              ? { ...state.currentUser, balance: state.currentUser.balance + amount }
              : state.currentUser
          }));
        },

        placeBet: (userId, betDetails) => {
          const newBet: Bet = {
            id: nanoid(),
            ...betDetails,
            status: 'OPEN',
            timestamp: new Date()
          };

          set(state => {
            // Calculate liability/deduction
            // For BACK bet: deduct stake
            // For LAY bet: deduct liability (stake * (odds - 1))
            
            const deduction = betDetails.type === 'BACK' 
              ? betDetails.stake 
              : (betDetails.stake * (betDetails.odds - 1));

            const updatedUsers = state.users.map(u => {
              if (u.id === userId) {
                return {
                  ...u,
                  balance: u.balance - deduction, // Deduct from balance immediately (simplified) or move to exposure
                  exposure: u.exposure + deduction
                };
              }
              return u;
            });

            return {
              bets: [newBet, ...state.bets],
              users: updatedUsers,
              currentUser: state.currentUser?.id === userId 
                ? updatedUsers.find(u => u.id === userId) || state.currentUser 
                : state.currentUser
            };
          });
        },

        settleBet: (betId, status, winnings = 0) => {
          set(state => {
            const bet = state.bets.find(b => b.id === betId);
            if (!bet) return state;

            const updatedBets = state.bets.map(b => 
              b.id === betId ? { ...b, status } : b
            );

            // Release exposure and add winnings if won
            const userId = 'TODO_LINK_BET_TO_USER_ID'; // Need to add userId to Bet interface
            // For this mock, we'll implement settlement logic later if needed
            return { bets: updatedBets };
          });
        },

        updateMatchOdds: (matchId, marketId, runnerId, back, lay) => {
          set(state => ({
            matches: state.matches.map(m => {
              if (m.id !== matchId) return m;
              return {
                ...m,
                markets: m.markets.map(mk => {
                  if (mk.id !== marketId) return mk;
                  return {
                    ...mk,
                    runners: mk.runners.map(r => {
                      if (r.id !== runnerId) return r;
                      return { ...r, backOdds: back, layOdds: lay };
                    })
                  };
                })
              };
            })
          }));
        }
      };
    },
    {
      name: 'probet-storage', // unique name
      partialize: (state) => ({ 
        users: state.users, 
        bets: state.bets 
        // We don't persist matches so they reset to "Live" state on reload
      }),
    }
  )
);

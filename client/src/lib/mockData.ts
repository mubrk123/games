// Mock Data and Types for the Betting Application

import { Bet } from './types';

export type Sport = 'cricket' | 'football' | 'tennis' | 'basketball';

export interface Market {
  id: string;
  name: string; // e.g., "Match Winner", "Total Goals"
  status: 'OPEN' | 'SUSPENDED' | 'CLOSED';
  runners: Runner[];
}

export interface Runner {
  id: string;
  name: string; // e.g., "India", "Draw", "England"
  backOdds: number; // The odds to back (win)
  layOdds: number;  // The odds to lay (lose) - Exchange feature
  volume: number;   // Simulated volume
}

export interface Match {
  id: string;
  sport: Sport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  status: 'LIVE' | 'UPCOMING' | 'FINISHED';
  score?: {
    home: string;
    away: string;
    details?: string; // e.g., "1st Innings, 15.4 Overs"
  };
  markets: Market[];
}

export interface User {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN' | 'AGENT';
  balance: number;
  exposure: number;
  currency: string;
}

export { type Bet };

// Initial Mock State
export const MOCK_USER: User = {
  id: 'u1',
  username: 'demo_user',
  role: 'USER', // Can switch to ADMIN to show panel
  balance: 10000,
  exposure: 0,
  currency: 'INR'
};

export const MOCK_ADMIN: User = {
  id: 'a1',
  username: 'admin_master',
  role: 'ADMIN',
  balance: 0,
  exposure: 0,
  currency: 'INR'
};

export const MOCK_MATCHES: Match[] = [
  {
    id: 'm1',
    sport: 'cricket',
    league: 'IPL 2025',
    homeTeam: 'Mumbai Indians',
    awayTeam: 'Chennai Super Kings',
    startTime: new Date(), // Live now
    status: 'LIVE',
    score: {
      home: '145/3',
      away: 'Yet to Bat',
      details: '15.4 Overs'
    },
    markets: [
      {
        id: 'mk1',
        name: 'Match Winner',
        status: 'OPEN',
        runners: [
          { id: 'r1', name: 'Mumbai Indians', backOdds: 1.75, layOdds: 1.77, volume: 540000 },
          { id: 'r2', name: 'Chennai Super Kings', backOdds: 2.10, layOdds: 2.14, volume: 420000 }
        ]
      }
    ]
  },
  {
    id: 'm2',
    sport: 'football',
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Liverpool',
    startTime: new Date(Date.now() + 3600000), // In 1 hour
    status: 'UPCOMING',
    score: { home: '0', away: '0' },
    markets: [
      {
        id: 'mk2',
        name: 'Match Result',
        status: 'OPEN',
        runners: [
          { id: 'r3', name: 'Arsenal', backOdds: 2.40, layOdds: 2.45, volume: 120000 },
          { id: 'r4', name: 'Liverpool', backOdds: 2.80, layOdds: 2.86, volume: 110000 },
          { id: 'r5', name: 'Draw', backOdds: 3.50, layOdds: 3.60, volume: 50000 }
        ]
      }
    ]
  },
  {
    id: 'm3',
    sport: 'tennis',
    league: 'Wimbledon Final',
    homeTeam: 'Alcaraz C.',
    awayTeam: 'Djokovic N.',
    startTime: new Date(),
    status: 'LIVE',
    score: { home: '2', away: '1', details: 'Set 4: 3-3' },
    markets: [
      {
        id: 'mk3',
        name: 'Match Winner',
        status: 'OPEN',
        runners: [
          { id: 'r6', name: 'Alcaraz C.', backOdds: 1.45, layOdds: 1.48, volume: 890000 },
          { id: 'r7', name: 'Djokovic N.', backOdds: 3.10, layOdds: 3.20, volume: 210000 }
        ]
      }
    ]
  }
];

export const MOCK_BETS: Bet[] = [
  {
    id: 'b1',
    userId: 'u1',
    userName: 'demo_user',
    matchId: 'm1',
    matchName: 'MI vs CSK',
    marketName: 'Match Winner',
    selectionName: 'Mumbai Indians',
    type: 'BACK',
    odds: 1.80,
    stake: 500,
    potentialProfit: 400,
    status: 'OPEN',
    timestamp: new Date(Date.now() - 1800000)
  },
  {
    id: 'b2',
    userId: 'u1',
    userName: 'demo_user',
    matchId: 'm3',
    matchName: 'Alcaraz vs Djokovic',
    marketName: 'Match Winner',
    selectionName: 'Djokovic N.',
    type: 'BACK',
    odds: 3.00,
    stake: 200,
    potentialProfit: 400,
    status: 'LOST',
    timestamp: new Date(Date.now() - 3600000)
  }
];

// Simple Event Emitter for Real-time Simulation
export class MockSocketService {
  private listeners: Record<string, Function[]> = {};

  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // Simulate random odds changes
  startSimulation() {
    setInterval(() => {
      const matchIndex = Math.floor(Math.random() * MOCK_MATCHES.length);
      const match = MOCK_MATCHES[matchIndex];
      if (match.status !== 'FINISHED') {
        const market = match.markets[0];
        const runnerIndex = Math.floor(Math.random() * market.runners.length);
        const runner = market.runners[runnerIndex];
        
        // Randomly drift odds
        const drift = (Math.random() - 0.5) * 0.05;
        const newBack = Math.max(1.01, Number((runner.backOdds + drift).toFixed(2)));
        const newLay = Number((newBack + 0.02).toFixed(2));
        
        this.emit('odds_update', {
          matchId: match.id,
          marketId: market.id,
          runnerId: runner.id,
          newBack,
          newLay
        });
      }
    }, 2000);
  }
}

export const socketService = new MockSocketService();
socketService.startSimulation();

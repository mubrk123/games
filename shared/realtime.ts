export interface MatchScoreUpdate {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  scoreHome: number;
  scoreAway: number;
  currentOver: number;
  currentBall: number;
  currentInning: number;
  battingTeam: string;
  runs: number;
  wickets: number;
  overs: string;
  runRate: string;
  timestamp: number;
}

export interface BallResult {
  matchId: string;
  over: number;
  ball: number;
  runsScored: number;
  isWicket: boolean;
  isBoundary: boolean;
  isSix: boolean;
  isExtra: boolean;
  outcome: string;
  timestamp: number;
}

export type InstanceMarketType = 
  | 'NEXT_BALL'
  | 'CURRENT_OVER'
  | 'NEXT_OVER'
  | 'SESSION'
  | 'NEXT_GOAL';

export type InstanceMarketStatus = 
  | 'PENDING'
  | 'OPEN'
  | 'SUSPENDED'
  | 'CLOSED'
  | 'SETTLED';

export interface MarketUpdate {
  matchId: string;
  markets: {
    id: string;
    name: string;
    type: InstanceMarketType;
    status: InstanceMarketStatus;
    closeTime: number;
    outcomes: {
      id: string;
      name: string;
      odds: number;
    }[];
  }[];
  timestamp: number;
}

export interface BetSettlement {
  betId: string;
  matchId: string;
  marketId: string;
  userId: string;
  outcome: string;
  winningOutcome: string;
  status: 'WON' | 'LOST' | 'VOID';
  stake: number;
  payout: number;
  timestamp: number;
}

export interface WalletUpdate {
  userId: string;
  balance: number;
  exposure: number;
  change: number;
  reason: string;
  timestamp: number;
}

export type RealtimeEventType = 
  | 'match:score'
  | 'match:ball'
  | 'markets:update'
  | 'bet:settled'
  | 'wallet:update'
  | 'connection:status';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  data: T;
  timestamp: number;
}

export interface Bet {
  id: string;
  userId: string; // Added userId to track who placed it
  userName: string; // Added for easier display
  matchId: string;
  matchName: string;
  marketName: string;
  selectionName: string;
  type: 'BACK' | 'LAY';
  odds: number;
  stake: number;
  potentialProfit: number;
  status: 'OPEN' | 'WON' | 'LOST' | 'VOID';
  timestamp: Date;
}

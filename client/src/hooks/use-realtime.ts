import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/lib/store';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface MatchScoreUpdate {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
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

interface BallResult {
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

interface MarketUpdate {
  matchId: string;
  markets: {
    id: string;
    name: string;
    type: string;
    status: string;
    closeTime: number;
    overNumber: number;
    ballNumber: number;
    outcomes: {
      id: string;
      name: string;
      odds: number;
    }[];
  }[];
  timestamp: number;
}

interface BetSettlement {
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

interface WalletUpdate {
  userId: string;
  balance: number;
  exposure: number;
  change: number;
  reason: string;
  timestamp: number;
}

interface RealtimeCallbacks {
  onScoreUpdate?: (data: MatchScoreUpdate) => void;
  onBallResult?: (data: BallResult) => void;
  onMarketUpdate?: (data: MarketUpdate) => void;
  onBetSettled?: (data: BetSettlement) => void;
  onWalletUpdate?: (data: WalletUpdate) => void;
}

export function useRealtime(matchId?: string, callbacks?: RealtimeCallbacks) {
  const socketRef = useRef<Socket | null>(null);
  const { currentUser, setCurrentUser } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    socketRef.current = io(`${window.location.protocol}//${host}`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[Realtime] Connected to WebSocket');
      
      if (matchId) {
        socket.emit('subscribe:match', matchId);
      }
      
      if (currentUser) {
        socket.emit('subscribe:user');
      }
    });

    socket.on('disconnect', () => {
      console.log('[Realtime] Disconnected from WebSocket');
    });

    socket.on('connection:status', (data: { connected: boolean; userId?: string }) => {
      console.log('[Realtime] Connection status:', data);
    });

    socket.on('match:score', (data: MatchScoreUpdate) => {
      console.log('[Realtime] Score update:', data);
      callbacks?.onScoreUpdate?.(data);
    });

    socket.on('match:ball', (data: BallResult) => {
      console.log('[Realtime] Ball result:', data);
      callbacks?.onBallResult?.(data);
    });

    socket.on('markets:update', (data: MarketUpdate) => {
      console.log('[Realtime] Markets update:', data.markets.length, 'markets');
      callbacks?.onMarketUpdate?.(data);
      
      queryClient.invalidateQueries({ queryKey: ['instance-markets', matchId] });
    });

    socket.on('bet:settled', (data: BetSettlement) => {
      console.log('[Realtime] Bet settled:', data);
      callbacks?.onBetSettled?.(data);
      
      queryClient.invalidateQueries({ queryKey: ['my-instance-bets'] });
      queryClient.invalidateQueries({ queryKey: ['my-bets'] });
      
      const isWin = data.status === 'WON';
      toast({
        title: isWin ? '🎉 Bet Won!' : 'Bet Settled',
        description: isWin 
          ? `You won ₹${data.payout.toFixed(0)} on ${data.outcome}!`
          : `${data.outcome} - Result: ${data.winningOutcome}`,
        variant: isWin ? 'default' : 'destructive',
      });
    });

    socket.on('wallet:update', (data: WalletUpdate) => {
      console.log('[Realtime] Wallet update:', data);
      callbacks?.onWalletUpdate?.(data);
      
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          balance: data.balance,
          exposure: data.exposure,
        });
      }
    });

    return socket;
  }, [matchId, currentUser, callbacks, queryClient, toast, setCurrentUser]);

  useEffect(() => {
    const socket = connect();

    return () => {
      if (socketRef.current) {
        if (matchId) {
          socketRef.current.emit('unsubscribe:match', matchId);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, matchId]);

  useEffect(() => {
    if (socketRef.current?.connected && matchId) {
      socketRef.current.emit('subscribe:match', matchId);
    }
  }, [matchId]);

  useEffect(() => {
    if (socketRef.current?.connected && currentUser) {
      socketRef.current.emit('subscribe:user');
    }
  }, [currentUser]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
  };
}

export function useRealtimeMarkets(matchId: string) {
  const queryClient = useQueryClient();
  
  const handleMarketUpdate = useCallback((data: MarketUpdate) => {
    queryClient.setQueryData(['instance-markets', matchId], (old: any) => {
      if (!old) return { markets: data.markets };
      return { markets: data.markets };
    });
  }, [matchId, queryClient]);

  useRealtime(matchId, {
    onMarketUpdate: handleMarketUpdate,
  });
}

export function useRealtimeBets() {
  const queryClient = useQueryClient();
  const { currentUser, setCurrentUser } = useStore();

  const handleBetSettled = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['my-instance-bets'] });
    queryClient.invalidateQueries({ queryKey: ['my-bets'] });
  }, [queryClient]);

  const handleWalletUpdate = useCallback((data: WalletUpdate) => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        balance: data.balance,
        exposure: data.exposure,
      });
    }
  }, [currentUser, setCurrentUser]);

  useRealtime(undefined, {
    onBetSettled: handleBetSettled,
    onWalletUpdate: handleWalletUpdate,
  });
}

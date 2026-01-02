import { io, Socket } from 'socket.io-client';
import type {
  MatchScoreUpdate,
  BallResult,
  MarketUpdate,
  BetSettlement,
  WalletUpdate,
} from '@shared/realtime';

type EventCallback<T> = (data: T) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private subscribedMatches: Set<string> = new Set();
  private eventListeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  connect(): void {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.socket = io({
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.isConnected = true;
      this.isConnecting = false;
      
      this.subscribedMatches.forEach(matchId => {
        this.socket?.emit('subscribe:match', matchId);
      });
      
      this.socket?.emit('subscribe:user');
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      this.isConnected = false;
    });

    this.socket.on('connection:status', (data: { connected: boolean; userId?: string }) => {
      console.log('[WebSocket] Connection status:', data);
    });

    this.socket.on('match:score', (data: MatchScoreUpdate) => {
      this.emit('match:score', data);
    });

    this.socket.on('match:ball', (data: BallResult) => {
      this.emit('match:ball', data);
    });

    this.socket.on('match:ball:global', (data: BallResult) => {
      this.emit('match:ball:global', data);
    });

    this.socket.on('markets:update', (data: MarketUpdate) => {
      this.emit('markets:update', data);
    });

    this.socket.on('bet:settled', (data: BetSettlement) => {
      this.emit('bet:settled', data);
    });

    this.socket.on('wallet:update', (data: WalletUpdate) => {
      this.emit('wallet:update', data);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  subscribeToMatch(matchId: string): void {
    this.subscribedMatches.add(matchId);
    if (this.socket?.connected) {
      this.socket.emit('subscribe:match', matchId);
    }
  }

  unsubscribeFromMatch(matchId: string): void {
    this.subscribedMatches.delete(matchId);
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:match', matchId);
    }
  }

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback<unknown>);

    return () => {
      this.eventListeners.get(event)?.delete(callback as EventCallback<unknown>);
    };
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const wsClient = new WebSocketClient();

export function useWebSocket() {
  return wsClient;
}

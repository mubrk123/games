import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import type { Express, RequestHandler } from "express";
import type {
  MatchScoreUpdate,
  BallResult,
  MarketUpdate,
  BetSettlement,
  WalletUpdate,
} from "@shared/realtime";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

class RealtimeHub {
  private io: SocketServer | null = null;
  private subscribedMatches: Map<string, Set<string>> = new Map();

  initialize(httpServer: HttpServer, sessionMiddleware: RequestHandler): void {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    this.io.use((socket: AuthenticatedSocket, next) => {
      sessionMiddleware(socket.request as any, {} as any, () => {
        const session = (socket.request as any).session;
        if (session?.passport?.user) {
          socket.userId = session.passport.user;
          next();
        } else {
          socket.userId = undefined;
          next();
        }
      });
    });

    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}, user: ${socket.userId || 'anonymous'}`);

      socket.on("subscribe:match", (matchId: string) => {
        socket.join(`match:${matchId}`);
        
        if (!this.subscribedMatches.has(matchId)) {
          this.subscribedMatches.set(matchId, new Set());
        }
        this.subscribedMatches.get(matchId)!.add(socket.id);
        
        console.log(`[WebSocket] ${socket.id} subscribed to match: ${matchId}`);
      });

      socket.on("unsubscribe:match", (matchId: string) => {
        socket.leave(`match:${matchId}`);
        this.subscribedMatches.get(matchId)?.delete(socket.id);
        console.log(`[WebSocket] ${socket.id} unsubscribed from match: ${matchId}`);
      });

      socket.on("subscribe:user", () => {
        if (socket.userId) {
          socket.join(`user:${socket.userId}`);
          console.log(`[WebSocket] ${socket.id} subscribed to user updates: ${socket.userId}`);
        }
      });

      socket.on("disconnect", () => {
        this.subscribedMatches.forEach((sockets, matchId) => {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.subscribedMatches.delete(matchId);
          }
        });
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      });

      socket.emit("connection:status", { connected: true, userId: socket.userId });
    });

    console.log("[WebSocket] RealtimeHub initialized");
  }

  getActiveMatchSubscriptions(): string[] {
    return Array.from(this.subscribedMatches.keys());
  }

  hasSubscribers(matchId: string): boolean {
    const subs = this.subscribedMatches.get(matchId);
    return subs ? subs.size > 0 : false;
  }

  emitMatchScore(update: MatchScoreUpdate): void {
    if (!this.io) return;
    this.io.to(`match:${update.matchId}`).emit("match:score", update);
  }

  emitBallResult(result: BallResult): void {
    if (!this.io) return;
    this.io.to(`match:${result.matchId}`).emit("match:ball", result);
    this.io.emit("match:ball:global", result);
  }

  emitMarketUpdate(update: MarketUpdate): void {
    if (!this.io) return;
    this.io.to(`match:${update.matchId}`).emit("markets:update", update);
  }

  emitBetSettlement(settlement: BetSettlement): void {
    if (!this.io) return;
    this.io.to(`user:${settlement.userId}`).emit("bet:settled", settlement);
  }

  emitWalletUpdate(update: WalletUpdate): void {
    if (!this.io) return;
    this.io.to(`user:${update.userId}`).emit("wallet:update", update);
  }

  broadcastToAll(event: string, data: unknown): void {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }
}

export const realtimeHub = new RealtimeHub();

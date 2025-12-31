import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  Match,
  InsertMatch,
  Market,
  InsertMarket,
  Runner,
  InsertRunner,
  Bet,
  CreateBet,
  InsertWalletTransaction,
  WalletTransaction
} from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export interface IStorage {
  // User Operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserBalance(userId: string, amount: number): Promise<User | undefined>;
  
  // Match Operations
  getAllMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatchScore(matchId: string, scoreHome: string, scoreAway: string, scoreDetails?: string): Promise<Match | undefined>;
  
  // Market Operations
  getMarketsByMatch(matchId: string): Promise<Market[]>;
  createMarket(market: InsertMarket): Promise<Market>;
  
  // Runner Operations
  getRunnersByMarket(marketId: string): Promise<Runner[]>;
  createRunner(runner: InsertRunner): Promise<Runner>;
  updateRunnerOdds(runnerId: string, backOdds: number, layOdds: number): Promise<Runner | undefined>;
  
  // Bet Operations
  createBet(bet: CreateBet): Promise<Bet>;
  getUserBets(userId: string): Promise<Bet[]>;
  getAllBets(): Promise<Bet[]>;
  getBetsByMatch(matchId: string): Promise<Bet[]>;
  
  // Wallet Transaction Operations
  createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction>;
  getUserTransactions(userId: string): Promise<WalletTransaction[]>;
}

export class DatabaseStorage implements IStorage {
  // User Operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  async updateUserBalance(userId: string, amount: number): Promise<User | undefined> {
    const result = await db
      .update(schema.users)
      .set({ 
        balance: String(amount) 
      })
      .where(eq(schema.users.id, userId))
      .returning();
    return result[0];
  }

  // Match Operations
  async getAllMatches(): Promise<Match[]> {
    return await db.select().from(schema.matches).orderBy(desc(schema.matches.startTime));
  }

  async getMatch(id: string): Promise<Match | undefined> {
    const result = await db.select().from(schema.matches).where(eq(schema.matches.id, id));
    return result[0];
  }

  async createMatch(match: InsertMatch): Promise<Match> {
    const result = await db.insert(schema.matches).values(match).returning();
    return result[0];
  }

  async updateMatchScore(matchId: string, scoreHome: string, scoreAway: string, scoreDetails?: string): Promise<Match | undefined> {
    const result = await db
      .update(schema.matches)
      .set({ scoreHome, scoreAway, scoreDetails })
      .where(eq(schema.matches.id, matchId))
      .returning();
    return result[0];
  }

  // Market Operations
  async getMarketsByMatch(matchId: string): Promise<Market[]> {
    return await db.select().from(schema.markets).where(eq(schema.markets.matchId, matchId));
  }

  async createMarket(market: InsertMarket): Promise<Market> {
    const result = await db.insert(schema.markets).values(market).returning();
    return result[0];
  }

  // Runner Operations
  async getRunnersByMarket(marketId: string): Promise<Runner[]> {
    return await db.select().from(schema.runners).where(eq(schema.runners.marketId, marketId));
  }

  async createRunner(runner: InsertRunner): Promise<Runner> {
    const result = await db.insert(schema.runners).values(runner).returning();
    return result[0];
  }

  async updateRunnerOdds(runnerId: string, backOdds: number, layOdds: number): Promise<Runner | undefined> {
    const result = await db
      .update(schema.runners)
      .set({ backOdds: String(backOdds), layOdds: String(layOdds) })
      .where(eq(schema.runners.id, runnerId))
      .returning();
    return result[0];
  }

  // Bet Operations
  async createBet(bet: CreateBet): Promise<Bet> {
    const result = await db.insert(schema.bets).values(bet).returning();
    return result[0];
  }

  async getUserBets(userId: string): Promise<Bet[]> {
    return await db.select().from(schema.bets).where(eq(schema.bets.userId, userId)).orderBy(desc(schema.bets.createdAt));
  }

  async getAllBets(): Promise<Bet[]> {
    return await db.select().from(schema.bets).orderBy(desc(schema.bets.createdAt));
  }

  async getBetsByMatch(matchId: string): Promise<Bet[]> {
    return await db.select().from(schema.bets).where(eq(schema.bets.matchId, matchId));
  }

  // Wallet Transaction Operations
  async createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction> {
    const result = await db.insert(schema.walletTransactions).values(transaction).returning();
    return result[0];
  }

  async getUserTransactions(userId: string): Promise<WalletTransaction[]> {
    return await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.userId, userId)).orderBy(desc(schema.walletTransactions.createdAt));
  }
}

export const storage = new DatabaseStorage();

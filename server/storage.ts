import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and, desc, or, inArray } from "drizzle-orm";
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
  WalletTransaction,
  InsertInstanceBet,
  InstanceBet,
  InsertWithdrawalRequest,
  WithdrawalRequest
} from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export interface IStorage {
  // User Operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByCreatedBy(createdById: string): Promise<User[]>;
  getUsersByRole(role: 'USER' | 'ADMIN' | 'AGENT' | 'SUPER_ADMIN'): Promise<User[]>;
  updateUserBalance(userId: string, amount: number): Promise<User | undefined>;
  transferBalance(fromUserId: string, toUserId: string, amount: number, description: string): Promise<{ success: boolean; error?: string }>;
  
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
  getBetsByStatus(status: 'OPEN' | 'WON' | 'LOST' | 'VOID'): Promise<Bet[]>;
  
  // Wallet Transaction Operations
  createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction>;
  getUserTransactions(userId: string): Promise<WalletTransaction[]>;
  
  // Instance Bet Operations
  createInstanceBet(bet: InsertInstanceBet): Promise<InstanceBet>;
  getOpenInstanceBets(): Promise<InstanceBet[]>;
  getOpenInstanceBetsByMarket(marketId: string): Promise<InstanceBet[]>;
  getUserInstanceBets(userId: string): Promise<InstanceBet[]>;
  settleInstanceBet(betId: string, status: 'WON' | 'LOST' | 'VOID', winningOutcome: string): Promise<InstanceBet | undefined>;
  
  // Withdrawal Request Operations
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]>;
  getAdminWithdrawalRequests(adminId: string): Promise<WithdrawalRequest[]>;
  getPendingWithdrawalRequests(adminId: string): Promise<WithdrawalRequest[]>;
  approveWithdrawalRequest(requestId: string): Promise<{ success: boolean; error?: string }>;
  rejectWithdrawalRequest(requestId: string, notes?: string): Promise<WithdrawalRequest | undefined>;
  getUserWinnings(userId: string): Promise<number>;
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

  async getUsersByCreatedBy(createdById: string): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.createdById, createdById)).orderBy(desc(schema.users.createdAt));
  }

  async getUsersByRole(role: 'USER' | 'ADMIN' | 'AGENT' | 'SUPER_ADMIN'): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.role, role)).orderBy(desc(schema.users.createdAt));
  }

  async transferBalance(fromUserId: string, toUserId: string, amount: number, description: string): Promise<{ success: boolean; error?: string }> {
    if (amount <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }
    if (!Number.isFinite(amount)) {
      return { success: false, error: 'Invalid amount' };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fromUserResult = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [fromUserId]
      );
      const toUserResult = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [toUserId]
      );

      if (fromUserResult.rows.length === 0 || toUserResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'User not found' };
      }

      const fromBalance = parseFloat(fromUserResult.rows[0].balance);
      const toBalance = parseFloat(toUserResult.rows[0].balance);

      if (fromBalance < amount) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Insufficient balance' };
      }

      const newFromBalance = (fromBalance - amount).toFixed(2);
      const newToBalance = (toBalance + amount).toFixed(2);

      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newFromBalance, fromUserId]);
      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newToBalance, toUserId]);

      await client.query(
        'INSERT INTO wallet_transactions (id, user_id, amount, type, description, source_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [fromUserId, (-amount).toFixed(2), 'TRANSFER_OUT', description, toUserId]
      );

      await client.query(
        'INSERT INTO wallet_transactions (id, user_id, amount, type, description, source_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [toUserId, amount.toFixed(2), 'TRANSFER_IN', description, fromUserId]
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      await client.query('ROLLBACK');
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
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

  async getBetsByStatus(status: 'OPEN' | 'WON' | 'LOST' | 'VOID'): Promise<Bet[]> {
    return await db.select().from(schema.bets).where(eq(schema.bets.status, status)).orderBy(desc(schema.bets.createdAt));
  }

  // Wallet Transaction Operations
  async createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction> {
    const result = await db.insert(schema.walletTransactions).values(transaction).returning();
    return result[0];
  }

  async getUserTransactions(userId: string): Promise<WalletTransaction[]> {
    return await db.select().from(schema.walletTransactions).where(eq(schema.walletTransactions.userId, userId)).orderBy(desc(schema.walletTransactions.createdAt));
  }

  // Instance Bet Operations
  async createInstanceBet(bet: InsertInstanceBet): Promise<InstanceBet> {
    const result = await db.insert(schema.instanceBets).values(bet).returning();
    return result[0];
  }

  async getOpenInstanceBets(): Promise<InstanceBet[]> {
    return await db.select().from(schema.instanceBets).where(eq(schema.instanceBets.status, 'OPEN')).orderBy(desc(schema.instanceBets.createdAt));
  }

  async getOpenInstanceBetsByMarket(marketId: string): Promise<InstanceBet[]> {
    return await db.select().from(schema.instanceBets).where(
      and(
        eq(schema.instanceBets.marketId, marketId),
        eq(schema.instanceBets.status, 'OPEN')
      )
    ).orderBy(desc(schema.instanceBets.createdAt));
  }

  async getUserInstanceBets(userId: string): Promise<InstanceBet[]> {
    return await db.select().from(schema.instanceBets).where(eq(schema.instanceBets.userId, userId)).orderBy(desc(schema.instanceBets.createdAt));
  }

  async settleInstanceBet(betId: string, status: 'WON' | 'LOST' | 'VOID', winningOutcome: string): Promise<InstanceBet | undefined> {
    const result = await db
      .update(schema.instanceBets)
      .set({ 
        status,
        winningOutcome,
        settledAt: new Date()
      })
      .where(eq(schema.instanceBets.id, betId))
      .returning();
    return result[0];
  }

  // Withdrawal Request Operations
  async createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const result = await db.insert(schema.withdrawalRequests).values(request).returning();
    return result[0];
  }

  async getUserWithdrawalRequests(userId: string): Promise<WithdrawalRequest[]> {
    return await db.select().from(schema.withdrawalRequests)
      .where(eq(schema.withdrawalRequests.userId, userId))
      .orderBy(desc(schema.withdrawalRequests.createdAt));
  }

  async getAdminWithdrawalRequests(adminId: string): Promise<WithdrawalRequest[]> {
    return await db.select().from(schema.withdrawalRequests)
      .where(eq(schema.withdrawalRequests.adminId, adminId))
      .orderBy(desc(schema.withdrawalRequests.createdAt));
  }

  async getPendingWithdrawalRequests(adminId: string): Promise<WithdrawalRequest[]> {
    return await db.select().from(schema.withdrawalRequests)
      .where(and(
        eq(schema.withdrawalRequests.adminId, adminId),
        eq(schema.withdrawalRequests.status, 'REQUESTED')
      ))
      .orderBy(desc(schema.withdrawalRequests.createdAt));
  }

  async approveWithdrawalRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const requestResult = await client.query(
        'SELECT id, user_id, admin_id, amount, status FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Withdrawal request not found' };
      }

      const request = requestResult.rows[0];
      if (request.status !== 'REQUESTED') {
        await client.query('ROLLBACK');
        return { success: false, error: 'Request already processed' };
      }

      const amount = parseFloat(request.amount);

      const userResult = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [request.user_id]
      );
      const adminResult = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [request.admin_id]
      );

      if (userResult.rows.length === 0 || adminResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'User or admin not found' };
      }

      const userBalance = parseFloat(userResult.rows[0].balance);
      const adminBalance = parseFloat(adminResult.rows[0].balance);

      if (userBalance < amount) {
        await client.query('ROLLBACK');
        return { success: false, error: 'User has insufficient balance' };
      }

      const newUserBalance = (userBalance - amount).toFixed(2);
      const newAdminBalance = (adminBalance + amount).toFixed(2);

      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newUserBalance, request.user_id]);
      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newAdminBalance, request.admin_id]);

      await client.query(
        'INSERT INTO wallet_transactions (id, user_id, amount, type, description, source_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [request.user_id, (-amount).toFixed(2), 'WITHDRAWAL', `Withdrawal approved by admin`, request.admin_id]
      );
      await client.query(
        'INSERT INTO wallet_transactions (id, user_id, amount, type, description, source_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [request.admin_id, amount.toFixed(2), 'WITHDRAWAL_RECEIVED', `Withdrawal from user`, request.user_id]
      );

      await client.query(
        'UPDATE withdrawal_requests SET status = $1, resolved_at = NOW() WHERE id = $2',
        ['APPROVED', requestId]
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      await client.query('ROLLBACK');
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async rejectWithdrawalRequest(requestId: string, notes?: string): Promise<WithdrawalRequest | undefined> {
    const result = await db
      .update(schema.withdrawalRequests)
      .set({ 
        status: 'REJECTED',
        notes: notes || 'Request rejected by admin',
        resolvedAt: new Date()
      })
      .where(eq(schema.withdrawalRequests.id, requestId))
      .returning();
    return result[0];
  }

  async getUserWinnings(userId: string): Promise<number> {
    const transactions = await db.select().from(schema.walletTransactions)
      .where(and(
        eq(schema.walletTransactions.userId, userId),
        or(
          eq(schema.walletTransactions.type, 'BET_WON'),
          eq(schema.walletTransactions.type, 'CASINO_WIN'),
          eq(schema.walletTransactions.type, 'INSTANCE_BET_WON')
        )
      ));
    
    let totalWinnings = 0;
    for (const tx of transactions) {
      totalWinnings += parseFloat(tx.amount);
    }

    const withdrawalRequests = await db.select().from(schema.withdrawalRequests)
      .where(and(
        eq(schema.withdrawalRequests.userId, userId),
        eq(schema.withdrawalRequests.status, 'APPROVED')
      ));
    
    let totalWithdrawn = 0;
    for (const req of withdrawalRequests) {
      totalWithdrawn += parseFloat(req.amount);
    }

    return Math.max(0, totalWinnings - totalWithdrawn);
  }

  // Deposit Request Operations (user requests funds from admin)
  async createDepositRequest(request: schema.InsertDepositRequest): Promise<schema.DepositRequest> {
    const result = await db.insert(schema.depositRequests).values(request).returning();
    return result[0];
  }

  async getUserDepositRequests(userId: string): Promise<schema.DepositRequest[]> {
    return await db.select().from(schema.depositRequests)
      .where(eq(schema.depositRequests.userId, userId))
      .orderBy(desc(schema.depositRequests.createdAt));
  }

  async getPendingDepositRequests(adminId: string): Promise<schema.DepositRequest[]> {
    return await db.select().from(schema.depositRequests)
      .where(and(
        eq(schema.depositRequests.adminId, adminId),
        eq(schema.depositRequests.status, 'REQUESTED')
      ))
      .orderBy(desc(schema.depositRequests.createdAt));
  }

  async approveDepositRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const requestResult = await client.query(
        'SELECT id, user_id, admin_id, amount, status FROM deposit_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Deposit request not found' };
      }

      const request = requestResult.rows[0];
      if (request.status !== 'REQUESTED') {
        await client.query('ROLLBACK');
        return { success: false, error: 'Request already processed' };
      }

      const amount = parseFloat(request.amount);

      const userResult = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [request.user_id]
      );
      const adminResult = await client.query(
        'SELECT id, balance FROM users WHERE id = $1 FOR UPDATE',
        [request.admin_id]
      );

      if (userResult.rows.length === 0 || adminResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'User or admin not found' };
      }

      const userBalance = parseFloat(userResult.rows[0].balance);
      const adminBalance = parseFloat(adminResult.rows[0].balance);

      if (adminBalance < amount) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Admin has insufficient balance' };
      }

      // Transfer: Admin balance decreases, User balance increases
      const newUserBalance = (userBalance + amount).toFixed(2);
      const newAdminBalance = (adminBalance - amount).toFixed(2);

      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newUserBalance, request.user_id]);
      await client.query('UPDATE users SET balance = $1 WHERE id = $2', [newAdminBalance, request.admin_id]);

      await client.query(
        'INSERT INTO wallet_transactions (id, user_id, amount, type, description, source_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [request.user_id, amount.toFixed(2), 'DEPOSIT', `Deposit approved by admin`, request.admin_id]
      );
      await client.query(
        'INSERT INTO wallet_transactions (id, user_id, amount, type, description, source_user_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
        [request.admin_id, (-amount).toFixed(2), 'DEPOSIT_SENT', `Deposit to user`, request.user_id]
      );

      await client.query(
        'UPDATE deposit_requests SET status = $1, resolved_at = NOW() WHERE id = $2',
        ['APPROVED', requestId]
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (error: any) {
      await client.query('ROLLBACK');
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async rejectDepositRequest(requestId: string, notes?: string): Promise<schema.DepositRequest | undefined> {
    const result = await db
      .update(schema.depositRequests)
      .set({ 
        status: 'REJECTED',
        notes: notes || 'Request rejected by admin',
        resolvedAt: new Date()
      })
      .where(eq(schema.depositRequests.id, requestId))
      .returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();

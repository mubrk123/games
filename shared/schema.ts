import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN', 'AGENT']);
export const betTypeEnum = pgEnum('bet_type', ['BACK', 'LAY']);
export const betStatusEnum = pgEnum('bet_status', ['OPEN', 'WON', 'LOST', 'VOID']);
export const matchStatusEnum = pgEnum('match_status', ['LIVE', 'UPCOMING', 'FINISHED']);
export const marketStatusEnum = pgEnum('market_status', ['OPEN', 'SUSPENDED', 'CLOSED']);
export const sportEnum = pgEnum('sport', ['cricket', 'football', 'tennis', 'basketball']);

// Users Table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default('USER'),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default('0'),
  exposure: decimal("exposure", { precision: 10, scale: 2 }).notNull().default('0'),
  currency: text("currency").notNull().default('INR'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Matches Table
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sport: sportEnum("sport").notNull(),
  league: text("league").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  startTime: timestamp("start_time").notNull(),
  status: matchStatusEnum("status").notNull().default('UPCOMING'),
  scoreHome: text("score_home"),
  scoreAway: text("score_away"),
  scoreDetails: text("score_details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Markets Table
export const markets = pgTable("markets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => matches.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  status: marketStatusEnum("status").notNull().default('OPEN'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Runners Table (selections within a market)
export const runners = pgTable("runners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: varchar("market_id").notNull().references(() => markets.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  backOdds: decimal("back_odds", { precision: 10, scale: 2 }).notNull(),
  layOdds: decimal("lay_odds", { precision: 10, scale: 2 }).notNull(),
  volume: integer("volume").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bets Table
export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: varchar("match_id").notNull().references(() => matches.id),
  marketId: varchar("market_id").notNull().references(() => markets.id),
  runnerId: varchar("runner_id").notNull().references(() => runners.id),
  type: betTypeEnum("type").notNull(),
  odds: decimal("odds", { precision: 10, scale: 2 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  potentialProfit: decimal("potential_profit", { precision: 10, scale: 2 }).notNull(),
  status: betStatusEnum("status").notNull().default('OPEN'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
});

// Wallet Transactions Table (Audit Trail)
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'CREDIT', 'DEBIT', 'BET_PLACED', 'BET_WON', 'BET_LOST'
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  balance: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
});

export const insertMarketSchema = createInsertSchema(markets).omit({
  id: true,
  createdAt: true,
});

export const insertRunnerSchema = createInsertSchema(runners).omit({
  id: true,
  createdAt: true,
});

// Schema for API request body validation (excludes server-computed fields)
export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  userId: true,
  potentialProfit: true,
  createdAt: true,
  settledAt: true,
});

// Schema for creating bet in storage (includes all required fields)
export const createBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
  settledAt: true,
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;

export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof markets.$inferSelect;

export type InsertRunner = z.infer<typeof insertRunnerSchema>;
export type Runner = typeof runners.$inferSelect;

export type InsertBet = z.infer<typeof insertBetSchema>;
export type CreateBet = z.infer<typeof createBetSchema>;
export type Bet = typeof bets.$inferSelect;

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, decimal, timestamp, boolean, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN', 'AGENT', 'SUPER_ADMIN']);
export const betTypeEnum = pgEnum('bet_type', ['BACK', 'LAY']);
export const betStatusEnum = pgEnum('bet_status', ['OPEN', 'WON', 'LOST', 'VOID']);
export const matchStatusEnum = pgEnum('match_status', ['LIVE', 'UPCOMING', 'FINISHED']);
export const marketStatusEnum = pgEnum('market_status', ['OPEN', 'SUSPENDED', 'CLOSED']);
export const sportEnum = pgEnum('sport', ['cricket', 'football', 'tennis', 'basketball']);
export const casinoGameTypeEnum = pgEnum('casino_game_type', ['slots', 'crash', 'dice', 'roulette', 'blackjack', 'andar_bahar', 'teen_patti', 'lucky_7', 'hi_lo', 'dragon_tiger', 'plinko', 'wheel', 'mines']);
export const casinoRoundStatusEnum = pgEnum('casino_round_status', ['PENDING', 'ACTIVE', 'COMPLETED']);
export const instanceBetStatusEnum = pgEnum('instance_bet_status', ['OPEN', 'WON', 'LOST', 'VOID']);
export const instanceMarketTypeEnum = pgEnum('instance_market_type', ['NEXT_BALL', 'NEXT_OVER', 'SESSION']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['REQUESTED', 'APPROVED', 'REJECTED']);
export const depositStatusEnum = pgEnum('deposit_status', ['REQUESTED', 'APPROVED', 'REJECTED']);

// Session Table (managed by connect-pg-simple, defined here to prevent Drizzle from deleting it)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Users Table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default('USER'),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default('0'),
  exposure: decimal("exposure", { precision: 10, scale: 2 }).notNull().default('0'),
  currency: text("currency").notNull().default('INR'),
  createdById: varchar("created_by_id"), // Admin who created this user, or Super Admin who created this admin
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
   updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  matchId: varchar("match_id").notNull(), // No FK - allows API-sourced matches
  marketId: varchar("market_id").notNull(), // No FK - allows API-sourced markets
  runnerId: varchar("runner_id").notNull(), // No FK - allows API-sourced runners
  runnerName: text("runner_name"), // Store team/selection name for settlement
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
  type: text("type").notNull(), // 'CREDIT', 'DEBIT', 'BET_PLACED', 'BET_WON', 'BET_LOST', 'CASINO_BET', 'CASINO_WIN', 'TRANSFER_IN', 'TRANSFER_OUT'
  description: text("description"),
  sourceUserId: varchar("source_user_id"), // For transfers: who sent/received the balance
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Casino Games Table (game metadata)
export const casinoGames = pgTable("casino_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: casinoGameTypeEnum("type").notNull(),
  description: text("description"),
  minBet: decimal("min_bet", { precision: 10, scale: 2 }).notNull().default('10'),
  maxBet: decimal("max_bet", { precision: 10, scale: 2 }).notNull().default('10000'),
  houseEdge: decimal("house_edge", { precision: 5, scale: 4 }).notNull().default('0.02'),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Casino Rounds Table (game sessions/rounds)
export const casinoRounds = pgTable("casino_rounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => casinoGames.id, { onDelete: 'cascade' }),
  serverSeed: text("server_seed").notNull(),
  serverSeedHash: text("server_seed_hash").notNull(),
  clientSeed: text("client_seed"),
  nonce: bigint("nonce", { mode: "number" }).notNull().default(0),
  result: text("result"), // JSON string of game result
  multiplier: decimal("multiplier", { precision: 10, scale: 4 }),
  status: casinoRoundStatusEnum("status").notNull().default('PENDING'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Casino Bets Table (player bets on rounds)
export const casinoBets = pgTable("casino_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  roundId: varchar("round_id").notNull().references(() => casinoRounds.id, { onDelete: 'cascade' }),
  gameId: varchar("game_id").notNull().references(() => casinoGames.id, { onDelete: 'cascade' }),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).notNull(),
  betChoice: text("bet_choice"), // e.g., "high", "red", specific number, etc.
  payout: decimal("payout", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  isWin: boolean("is_win"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Instance Bets Table (ball-by-ball, over-by-over micro-betting)
export const instanceBets = pgTable("instance_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: varchar("match_id").notNull(),
  marketId: varchar("market_id").notNull(),
  marketType: instanceMarketTypeEnum("market_type").notNull(),
  marketName: text("market_name").notNull(),
  outcomeId: varchar("outcome_id").notNull(),
  outcomeName: text("outcome_name").notNull(),
  odds: decimal("odds", { precision: 10, scale: 2 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  potentialProfit: decimal("potential_profit", { precision: 10, scale: 2 }).notNull(),
  status: instanceBetStatusEnum("status").notNull().default('OPEN'),
  winningOutcome: text("winning_outcome"),
  // Ball/Over tracking for settlement even if in-memory market is lost
  overNumber: integer("over_number"),
  ballNumber: integer("ball_number"),
  inningNumber: integer("inning_number").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  settledAt: timestamp("settled_at"),
});

// Withdrawal Requests Table
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: withdrawalStatusEnum("status").notNull().default('REQUESTED'),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Deposit Requests Table (user requests funds from admin)
export const depositRequests = pgTable("deposit_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  adminId: varchar("admin_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: depositStatusEnum("status").notNull().default('REQUESTED'),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  balance: true,
  createdById: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
   updatedAt: true,
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

export const insertCasinoGameSchema = createInsertSchema(casinoGames).omit({
  id: true,
  createdAt: true,
});

export const insertCasinoRoundSchema = createInsertSchema(casinoRounds).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertCasinoBetSchema = createInsertSchema(casinoBets).omit({
  id: true,
  createdAt: true,
});

export const insertInstanceBetSchema = createInsertSchema(instanceBets).omit({
  id: true,
  createdAt: true,
  settledAt: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export const insertDepositRequestSchema = createInsertSchema(depositRequests).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
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

export type InsertCasinoGame = z.infer<typeof insertCasinoGameSchema>;
export type CasinoGame = typeof casinoGames.$inferSelect;

export type InsertCasinoRound = z.infer<typeof insertCasinoRoundSchema>;
export type CasinoRound = typeof casinoRounds.$inferSelect;

export type InsertCasinoBet = z.infer<typeof insertCasinoBetSchema>;
export type CasinoBet = typeof casinoBets.$inferSelect;

export type InsertInstanceBet = z.infer<typeof insertInstanceBetSchema>;
export type InstanceBet = typeof instanceBets.$inferSelect;

export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;

export type InsertDepositRequest = z.infer<typeof insertDepositRequestSchema>;
export type DepositRequest = typeof depositRequests.$inferSelect;

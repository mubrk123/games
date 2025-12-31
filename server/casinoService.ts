import crypto from 'crypto';
import { db } from './storage';
import { casinoGames, casinoRounds, casinoBets, walletTransactions, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Provably fair RNG using server seed + client seed + nonce
function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

function generateResult(serverSeed: string, clientSeed: string, nonce: number): number {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  const decimal = parseInt(hash.substring(0, 8), 16);
  return decimal / 0xFFFFFFFF;
}

// Slots game logic
interface SlotResult {
  reels: number[][];
  symbols: string[][];
  multiplier: number;
  isWin: boolean;
}

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '7️⃣', '💎'];

function generateSlotResult(serverSeed: string, clientSeed: string, nonce: number): SlotResult {
  const reels: number[][] = [];
  const symbols: string[][] = [];
  
  for (let row = 0; row < 3; row++) {
    const rowReels: number[] = [];
    const rowSymbols: string[] = [];
    for (let col = 0; col < 3; col++) {
      const result = generateResult(serverSeed, clientSeed, nonce + row * 3 + col);
      const index = Math.floor(result * SLOT_SYMBOLS.length);
      rowReels.push(index);
      rowSymbols.push(SLOT_SYMBOLS[index]);
    }
    reels.push(rowReels);
    symbols.push(rowSymbols);
  }
  
  // Check wins on middle row
  const middleRow = symbols[1];
  let multiplier = 0;
  let isWin = false;
  
  if (middleRow[0] === middleRow[1] && middleRow[1] === middleRow[2]) {
    isWin = true;
    const symbol = middleRow[0];
    if (symbol === '💎') multiplier = 50;
    else if (symbol === '7️⃣') multiplier = 25;
    else if (symbol === '⭐') multiplier = 10;
    else multiplier = 5;
  } else if (middleRow[0] === middleRow[1] || middleRow[1] === middleRow[2]) {
    isWin = true;
    multiplier = 2;
  }
  
  return { reels, symbols, multiplier, isWin };
}

// Crash game logic
function generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  const result = generateResult(serverSeed, clientSeed, nonce);
  const houseEdge = 0.03;
  const crashPoint = (1 - houseEdge) / (1 - result);
  return Math.max(1.00, Math.min(100, Math.floor(crashPoint * 100) / 100));
}

// Dice game logic
interface DiceResult {
  roll: number;
  isWin: boolean;
  multiplier: number;
}

function generateDiceResult(serverSeed: string, clientSeed: string, nonce: number, prediction: 'high' | 'low', target: number): DiceResult {
  const result = generateResult(serverSeed, clientSeed, nonce);
  const roll = Math.floor(result * 100) + 1;
  
  let isWin = false;
  if (prediction === 'high' && roll > target) isWin = true;
  if (prediction === 'low' && roll < target) isWin = true;
  
  const winChance = prediction === 'high' ? (100 - target) / 100 : (target - 1) / 100;
  const multiplier = isWin ? Math.floor((0.97 / winChance) * 100) / 100 : 0;
  
  return { roll, isWin, multiplier };
}

export class CasinoService {
  async getGames() {
    return db.select().from(casinoGames).where(eq(casinoGames.isActive, true));
  }
  
  async getGameBySlug(slug: string) {
    const [game] = await db.select().from(casinoGames).where(eq(casinoGames.slug, slug));
    return game;
  }
  
  async getUserHistory(userId: string, limit = 20) {
    return db.select()
      .from(casinoBets)
      .where(eq(casinoBets.userId, userId))
      .orderBy(desc(casinoBets.createdAt))
      .limit(limit);
  }

  async playSlots(userId: string, betAmount: number, clientSeed?: string) {
    const game = await this.getGameBySlug('classic-slots');
    if (!game) throw new Error('Game not found');
    
    const minBet = parseFloat(game.minBet);
    const maxBet = parseFloat(game.maxBet);
    if (betAmount < minBet || betAmount > maxBet) {
      throw new Error(`Bet must be between ${minBet} and ${maxBet}`);
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');
    
    const balance = parseFloat(user.balance);
    if (balance < betAmount) throw new Error('Insufficient balance');
    
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const playerClientSeed = clientSeed || crypto.randomBytes(8).toString('hex');
    const nonce = Date.now();
    
    const result = generateSlotResult(serverSeed, playerClientSeed, nonce);
    const payout = result.isWin ? betAmount * result.multiplier : 0;
    const profit = payout - betAmount;
    
    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify(result),
      multiplier: result.multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();
    
    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      payout: payout.toString(),
      profit: profit.toString(),
      isWin: result.isWin,
    });
    
    const newBalance = balance + profit;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));
    
    await db.insert(walletTransactions).values({
      userId,
      amount: profit.toString(),
      type: result.isWin ? 'CASINO_WIN' : 'CASINO_BET',
      description: `Slots: ${result.isWin ? 'Won' : 'Lost'} ${Math.abs(profit).toFixed(2)}`,
    });
    
    return {
      roundId: round.id,
      result,
      betAmount,
      payout,
      profit,
      newBalance,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
    };
  }

  async playCrash(userId: string, betAmount: number, cashoutMultiplier: number, clientSeed?: string) {
    const game = await this.getGameBySlug('crash');
    if (!game) throw new Error('Game not found');
    
    const minBet = parseFloat(game.minBet);
    const maxBet = parseFloat(game.maxBet);
    if (betAmount < minBet || betAmount > maxBet) {
      throw new Error(`Bet must be between ${minBet} and ${maxBet}`);
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');
    
    const balance = parseFloat(user.balance);
    if (balance < betAmount) throw new Error('Insufficient balance');
    
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const playerClientSeed = clientSeed || crypto.randomBytes(8).toString('hex');
    const nonce = Date.now();
    
    const crashPoint = generateCrashPoint(serverSeed, playerClientSeed, nonce);
    const isWin = cashoutMultiplier <= crashPoint;
    const payout = isWin ? betAmount * cashoutMultiplier : 0;
    const profit = payout - betAmount;
    
    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ crashPoint, cashoutMultiplier, isWin }),
      multiplier: crashPoint.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();
    
    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: cashoutMultiplier.toString(),
      payout: payout.toString(),
      profit: profit.toString(),
      isWin,
    });
    
    const newBalance = balance + profit;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));
    
    await db.insert(walletTransactions).values({
      userId,
      amount: profit.toString(),
      type: isWin ? 'CASINO_WIN' : 'CASINO_BET',
      description: `Crash: ${isWin ? 'Cashed out' : 'Crashed'} at ${crashPoint}x`,
    });
    
    return {
      roundId: round.id,
      crashPoint,
      cashoutMultiplier,
      isWin,
      betAmount,
      payout,
      profit,
      newBalance,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
    };
  }

  async playDice(userId: string, betAmount: number, prediction: 'high' | 'low', target: number, clientSeed?: string) {
    const game = await this.getGameBySlug('dice');
    if (!game) throw new Error('Game not found');
    
    const minBet = parseFloat(game.minBet);
    const maxBet = parseFloat(game.maxBet);
    if (betAmount < minBet || betAmount > maxBet) {
      throw new Error(`Bet must be between ${minBet} and ${maxBet}`);
    }
    
    if (target < 2 || target > 99) {
      throw new Error('Target must be between 2 and 99');
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');
    
    const balance = parseFloat(user.balance);
    if (balance < betAmount) throw new Error('Insufficient balance');
    
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const playerClientSeed = clientSeed || crypto.randomBytes(8).toString('hex');
    const nonce = Date.now();
    
    const result = generateDiceResult(serverSeed, playerClientSeed, nonce, prediction, target);
    const payout = result.isWin ? betAmount * result.multiplier : 0;
    const profit = payout - betAmount;
    
    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ ...result, prediction, target }),
      multiplier: result.multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();
    
    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: `${prediction}:${target}`,
      payout: payout.toString(),
      profit: profit.toString(),
      isWin: result.isWin,
    });
    
    const newBalance = balance + profit;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));
    
    await db.insert(walletTransactions).values({
      userId,
      amount: profit.toString(),
      type: result.isWin ? 'CASINO_WIN' : 'CASINO_BET',
      description: `Dice: Rolled ${result.roll}, ${result.isWin ? 'Won' : 'Lost'}`,
    });
    
    return {
      roundId: round.id,
      roll: result.roll,
      prediction,
      target,
      isWin: result.isWin,
      multiplier: result.multiplier,
      betAmount,
      payout,
      profit,
      newBalance,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
    };
  }

  async verifyFairness(roundId: string) {
    const [round] = await db.select().from(casinoRounds).where(eq(casinoRounds.id, roundId));
    if (!round) throw new Error('Round not found');
    
    const calculatedHash = hashServerSeed(round.serverSeed);
    const isValid = calculatedHash === round.serverSeedHash;
    
    return {
      roundId: round.id,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      isValid,
      result: round.result ? JSON.parse(round.result) : null,
    };
  }
}

export const casinoService = new CasinoService();

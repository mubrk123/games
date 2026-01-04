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

// Andar Bahar game logic
const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];

interface AndarBaharResult {
  jokerCard: string;
  andarCards: string[];
  baharCards: string[];
  winningSide: 'andar' | 'bahar';
  cardCount: number;
}

function generateAndarBaharResult(serverSeed: string, clientSeed: string, nonce: number): AndarBaharResult {
  const getCard = (offset: number): string => {
    const result = generateResult(serverSeed, clientSeed, nonce + offset);
    const valueIndex = Math.floor(result * 13);
    const suitIndex = Math.floor((result * 100) % 4);
    return `${CARD_VALUES[valueIndex]}${CARD_SUITS[suitIndex]}`;
  };
  
  const jokerCard = getCard(0);
  const jokerValue = jokerCard.slice(0, -1);
  
  const andarCards: string[] = [];
  const baharCards: string[] = [];
  let offset = 1;
  let winningSide: 'andar' | 'bahar' = 'andar';
  
  // Randomly decide which side gets the first card (true 50/50)
  const firstSideResult = generateResult(serverSeed, clientSeed, nonce + 100);
  const andarFirst = firstSideResult < 0.5;
  
  while (offset < 52) {
    const card = getCard(offset);
    const cardValue = card.slice(0, -1);
    
    // Alternate sides, but starting side is random
    const isAndarTurn = andarFirst ? (offset % 2 === 1) : (offset % 2 === 0);
    
    if (isAndarTurn) {
      andarCards.push(card);
      if (cardValue === jokerValue) {
        winningSide = 'andar';
        break;
      }
    } else {
      baharCards.push(card);
      if (cardValue === jokerValue) {
        winningSide = 'bahar';
        break;
      }
    }
    offset++;
  }
  
  return {
    jokerCard,
    andarCards,
    baharCards,
    winningSide,
    cardCount: andarCards.length + baharCards.length,
  };
}

// Teen Patti game logic
interface TeenPattiResult {
  playerCards: string[];
  dealerCards: string[];
  playerHandRank: string;
  dealerHandRank: string;
  winner: 'player' | 'dealer' | 'tie';
  multiplier: number;
}

function getHandRank(cards: string[]): { rank: number; name: string } {
  const values = cards.map(c => {
    const v = c.slice(0, -1);
    if (v === 'A') return 14;
    if (v === 'K') return 13;
    if (v === 'Q') return 12;
    if (v === 'J') return 11;
    return parseInt(v);
  }).sort((a, b) => b - a);
  
  const suits = cards.map(c => c.slice(-1));
  const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
  const isSequence = values[0] - values[1] === 1 && values[1] - values[2] === 1;
  const isTriple = values[0] === values[1] && values[1] === values[2];
  const isPair = values[0] === values[1] || values[1] === values[2];
  
  if (isTriple) return { rank: 6, name: 'Trail' };
  if (isSequence && isFlush) return { rank: 5, name: 'Pure Sequence' };
  if (isSequence) return { rank: 4, name: 'Sequence' };
  if (isFlush) return { rank: 3, name: 'Color' };
  if (isPair) return { rank: 2, name: 'Pair' };
  return { rank: 1, name: 'High Card' };
}

function generateTeenPattiResult(serverSeed: string, clientSeed: string, nonce: number): TeenPattiResult {
  const getCard = (offset: number): string => {
    const result = generateResult(serverSeed, clientSeed, nonce + offset);
    const valueIndex = Math.floor(result * 13);
    const suitIndex = Math.floor((result * 100) % 4);
    return `${CARD_VALUES[valueIndex]}${CARD_SUITS[suitIndex]}`;
  };
  
  const playerCards = [getCard(0), getCard(1), getCard(2)];
  const dealerCards = [getCard(3), getCard(4), getCard(5)];
  
  const playerHand = getHandRank(playerCards);
  const dealerHand = getHandRank(dealerCards);
  
  let winner: 'player' | 'dealer' | 'tie';
  let multiplier = 0;
  
  if (playerHand.rank > dealerHand.rank) {
    winner = 'player';
    multiplier = playerHand.rank >= 5 ? 3 : 2;
  } else if (dealerHand.rank > playerHand.rank) {
    winner = 'dealer';
  } else {
    winner = 'tie';
    multiplier = 1;
  }
  
  return {
    playerCards,
    dealerCards,
    playerHandRank: playerHand.name,
    dealerHandRank: dealerHand.name,
    winner,
    multiplier,
  };
}

// Lucky 7 game logic
interface Lucky7Result {
  card: string;
  cardValue: number;
  outcome: 'low' | 'seven' | 'high';
  multiplier: number;
}

function generateLucky7Result(serverSeed: string, clientSeed: string, nonce: number, bet: 'low' | 'seven' | 'high'): Lucky7Result {
  const result = generateResult(serverSeed, clientSeed, nonce);
  const cardIndex = Math.floor(result * 13);
  const suitIndex = Math.floor((result * 100) % 4);
  const card = `${CARD_VALUES[cardIndex]}${CARD_SUITS[suitIndex]}`;
  
  let cardValue: number;
  if (CARD_VALUES[cardIndex] === 'A') cardValue = 1;
  else if (['J', 'Q', 'K'].includes(CARD_VALUES[cardIndex])) cardValue = 10 + ['J', 'Q', 'K'].indexOf(CARD_VALUES[cardIndex]) + 1;
  else cardValue = parseInt(CARD_VALUES[cardIndex]);
  
  let outcome: 'low' | 'seven' | 'high';
  if (cardValue < 7) outcome = 'low';
  else if (cardValue === 7) outcome = 'seven';
  else outcome = 'high';
  
  let multiplier = 0;
  if (bet === outcome) {
    if (outcome === 'seven') multiplier = 5;
    else multiplier = 2;
  }
  
  return { card, cardValue, outcome, multiplier };
}

// Roulette game logic
interface RouletteResult {
  number: number;
  color: 'red' | 'black' | 'green';
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function generateRouletteResult(serverSeed: string, clientSeed: string, nonce: number): RouletteResult {
  const result = generateResult(serverSeed, clientSeed, nonce);
  const number = Math.floor(result * 37); // 0-36
  
  let color: 'red' | 'black' | 'green';
  if (number === 0) color = 'green';
  else if (RED_NUMBERS.includes(number)) color = 'red';
  else color = 'black';
  
  return { number, color };
}

function calculateRoulettePayout(result: RouletteResult, betType: string, betValue: string): number {
  const num = result.number;
  const col = result.color;
  
  switch (betType) {
    case 'straight': return num === parseInt(betValue) ? 35 : 0;
    case 'color': return col === betValue ? 2 : 0;
    case 'oddeven': 
      if (num === 0) return 0;
      if (betValue === 'odd' && num % 2 === 1) return 2;
      if (betValue === 'even' && num % 2 === 0) return 2;
      return 0;
    case 'highlow':
      if (num === 0) return 0;
      if (betValue === 'low' && num >= 1 && num <= 18) return 2;
      if (betValue === 'high' && num >= 19 && num <= 36) return 2;
      return 0;
    case 'dozen':
      if (betValue === '1st' && num >= 1 && num <= 12) return 3;
      if (betValue === '2nd' && num >= 13 && num <= 24) return 3;
      if (betValue === '3rd' && num >= 25 && num <= 36) return 3;
      return 0;
    default: return 0;
  }
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

  async playAndarBahar(userId: string, betAmount: number, choice: 'andar' | 'bahar', clientSeed?: string) {
    const game = await this.getGameBySlug('andar-bahar');
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
    
    const result = generateAndarBaharResult(serverSeed, playerClientSeed, nonce);
    const isWin = result.winningSide === choice;
    const multiplier = isWin ? 1.9 : 0;
    const payout = isWin ? betAmount * multiplier : 0;
    const profit = payout - betAmount;
    
    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify(result),
      multiplier: multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();
    
    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: choice,
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
      description: `Andar Bahar: Bet ${choice}, Won ${result.winningSide}`,
    });
    
    return {
      roundId: round.id,
      ...result,
      choice,
      isWin,
      multiplier,
      betAmount,
      payout,
      profit,
      newBalance,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
    };
  }

  async playTeenPatti(userId: string, betAmount: number, clientSeed?: string) {
    const game = await this.getGameBySlug('teen-patti');
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
    
    const result = generateTeenPattiResult(serverSeed, playerClientSeed, nonce);
    const isWin = result.winner === 'player';
    const isTie = result.winner === 'tie';
    const payout = isWin ? betAmount * result.multiplier : (isTie ? betAmount : 0);
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
      betChoice: 'player',
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
      description: `Teen Patti: ${result.playerHandRank} vs ${result.dealerHandRank}`,
    });
    
    return {
      roundId: round.id,
      ...result,
      isWin,
      isTie,
      betAmount,
      payout,
      profit,
      newBalance,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
    };
  }

  async playLucky7(userId: string, betAmount: number, bet: 'low' | 'seven' | 'high', clientSeed?: string) {
    const game = await this.getGameBySlug('lucky-7');
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
    
    const result = generateLucky7Result(serverSeed, playerClientSeed, nonce, bet);
    const isWin = result.multiplier > 0;
    const payout = betAmount * result.multiplier;
    const profit = payout - betAmount;
    
    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ ...result, bet }),
      multiplier: result.multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();
    
    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: bet,
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
      description: `Lucky 7: Card ${result.card}, Bet ${bet}`,
    });
    
    return {
      roundId: round.id,
      ...result,
      bet,
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

  async playRoulette(userId: string, betAmount: number, betType: string, betValue: string, clientSeed?: string) {
    const game = await this.getGameBySlug('roulette');
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
    
    const result = generateRouletteResult(serverSeed, playerClientSeed, nonce);
    const multiplier = calculateRoulettePayout(result, betType, betValue);
    const isWin = multiplier > 0;
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;
    
    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ ...result, betType, betValue }),
      multiplier: multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();
    
    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: `${betType}:${betValue}`,
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
      description: `Roulette: ${result.number} ${result.color}`,
    });
    
    return {
      roundId: round.id,
      ...result,
      betType,
      betValue,
      multiplier,
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

  // Blackjack - simplified single-round version (auto-play)
  async playBlackjack(userId: string, betAmount: number, clientSeed?: string) {
    const game = await this.getGameBySlug('blackjack');
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

    const getCard = (offset: number): string => {
      const result = generateResult(serverSeed, playerClientSeed, nonce + offset);
      const valueIndex = Math.floor(result * 13);
      const suitIndex = Math.floor((result * 100) % 4);
      return `${CARD_VALUES[valueIndex]}${CARD_SUITS[suitIndex]}`;
    };

    const getHandValue = (hand: string[]): number => {
      let value = 0;
      let aces = 0;
      for (const card of hand) {
        const v = card.slice(0, -1);
        if (v === 'A') { value += 11; aces++; }
        else if (['K', 'Q', 'J'].includes(v)) value += 10;
        else value += parseInt(v);
      }
      while (value > 21 && aces > 0) { value -= 10; aces--; }
      return value;
    };

    // Generate all cards server-side (no client state)
    let cardOffset = 0;
    const playerCards = [getCard(cardOffset++), getCard(cardOffset++)];
    const dealerCards = [getCard(cardOffset++), getCard(cardOffset++)];

    // Auto-play: player hits until 17+
    while (getHandValue(playerCards) < 17) {
      playerCards.push(getCard(cardOffset++));
    }

    // Dealer hits until 17+
    while (getHandValue(dealerCards) < 17) {
      dealerCards.push(getCard(cardOffset++));
    }

    const playerValue = getHandValue(playerCards);
    const dealerValue = getHandValue(dealerCards);

    let isWin = false;
    let isPush = false;

    if (playerValue > 21) {
      isWin = false;
    } else if (dealerValue > 21) {
      isWin = true;
    } else if (playerValue > dealerValue) {
      isWin = true;
    } else if (playerValue === dealerValue) {
      isPush = true;
    }

    const multiplier = isWin ? 2 : (isPush ? 1 : 0);
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ playerCards, dealerCards, playerValue, dealerValue }),
      multiplier: multiplier.toString(),
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
      isWin,
    });

    const newBalance = balance + profit;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));

    await db.insert(walletTransactions).values({
      userId,
      amount: profit.toString(),
      type: isWin ? 'CASINO_WIN' : 'CASINO_BET',
      description: `Blackjack: ${isWin ? 'Won' : isPush ? 'Push' : 'Lost'}`,
    });

    return {
      playerCards,
      dealerCards,
      playerValue,
      dealerValue,
      isWin,
      isPush,
      payout,
      profit,
      newBalance,
    };
  }

  // Hi-Lo Card Game - both cards generated server-side
  async playHiLo(userId: string, betAmount: number, guess: 'higher' | 'lower', clientSeed?: string) {
    const game = await this.getGameBySlug('hi-lo');
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

    const getCard = (offset: number): string => {
      const result = generateResult(serverSeed, playerClientSeed, nonce + offset);
      const valueIndex = Math.floor(result * 13);
      const suitIndex = Math.floor((result * 100) % 4);
      return `${CARD_VALUES[valueIndex]}${CARD_SUITS[suitIndex]}`;
    };

    const getCardValue = (card: string): number => {
      const v = card.slice(0, -1);
      if (v === 'A') return 1;
      if (v === 'K') return 13;
      if (v === 'Q') return 12;
      if (v === 'J') return 11;
      return parseInt(v);
    };

    // Both cards generated server-side
    const firstCard = getCard(0);
    const nextCard = getCard(1);
    const firstValue = getCardValue(firstCard);
    const nextValue = getCardValue(nextCard);

    let isWin = false;
    if (guess === 'higher' && nextValue > firstValue) isWin = true;
    if (guess === 'lower' && nextValue < firstValue) isWin = true;

    const multiplier = isWin ? 1.9 : 0;
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ firstCard, nextCard, guess }),
      multiplier: multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();

    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: guess,
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
      description: `Hi-Lo: ${firstCard} -> ${nextCard}, Guessed ${guess}`,
    });

    return {
      firstCard,
      nextCard,
      guess,
      isWin,
      multiplier,
      payout,
      profit,
      newBalance,
    };
  }

  // Dragon Tiger
  async playDragonTiger(userId: string, betAmount: number, bet: 'dragon' | 'tiger' | 'tie', clientSeed?: string) {
    const game = await this.getGameBySlug('dragon-tiger');
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

    const getCard = (offset: number): string => {
      const result = generateResult(serverSeed, playerClientSeed, nonce + offset);
      const valueIndex = Math.floor(result * 13);
      const suitIndex = Math.floor((result * 100) % 4);
      return `${CARD_VALUES[valueIndex]}${CARD_SUITS[suitIndex]}`;
    };

    const getCardValue = (card: string): number => {
      const v = card.slice(0, -1);
      if (v === 'A') return 1;
      if (v === 'K') return 13;
      if (v === 'Q') return 12;
      if (v === 'J') return 11;
      return parseInt(v);
    };

    const dragonCard = getCard(0);
    const tigerCard = getCard(1);
    const dragonValue = getCardValue(dragonCard);
    const tigerValue = getCardValue(tigerCard);

    let outcome: 'dragon' | 'tiger' | 'tie';
    if (dragonValue > tigerValue) outcome = 'dragon';
    else if (tigerValue > dragonValue) outcome = 'tiger';
    else outcome = 'tie';

    let multiplier = 0;
    if (bet === outcome) {
      if (outcome === 'tie') multiplier = 8;
      else multiplier = 1.9;
    } else if (outcome === 'tie' && bet !== 'tie') {
      // Return half on tie if betting dragon/tiger
      multiplier = 0.5;
    }

    const isWin = multiplier >= 1;
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ dragonCard, tigerCard, outcome }),
      multiplier: multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();

    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: bet,
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
      description: `Dragon Tiger: ${outcome} wins`,
    });

    return {
      dragonCard,
      tigerCard,
      dragonValue,
      tigerValue,
      outcome,
      bet,
      isWin,
      multiplier,
      payout,
      profit,
      newBalance,
    };
  }

  // Plinko
  async playPlinko(userId: string, betAmount: number, risk: 'low' | 'medium' | 'high', rows: number = 16, clientSeed?: string) {
    const game = await this.getGameBySlug('plinko');
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

    // Generate path
    const path: ('L' | 'R')[] = [];
    let position = 0;

    for (let i = 0; i < rows; i++) {
      const result = generateResult(serverSeed, playerClientSeed, nonce + i);
      if (result < 0.5) {
        path.push('L');
        position--;
      } else {
        path.push('R');
        position++;
      }
    }

    // Multipliers based on risk and position
    const multipliers: Record<string, number[]> = {
      low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
      medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
      high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    };

    const bucketIndex = Math.floor((position + rows) / 2);
    const riskMultipliers = multipliers[risk] || multipliers.medium;
    const multiplier = riskMultipliers[Math.min(Math.max(bucketIndex, 0), riskMultipliers.length - 1)] || 0.5;

    const isWin = multiplier >= 1;
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ path, position, bucketIndex, risk }),
      multiplier: multiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();

    await db.insert(casinoBets).values({
      userId,
      roundId: round.id,
      gameId: game.id,
      betAmount: betAmount.toString(),
      betChoice: risk,
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
      description: `Plinko: ${multiplier}x multiplier`,
    });

    return {
      path,
      position,
      bucketIndex,
      multiplier,
      isWin,
      payout,
      profit,
      newBalance,
    };
  }

  // Wheel of Fortune
  async playWheelOfFortune(userId: string, betAmount: number, clientSeed?: string) {
    const game = await this.getGameBySlug('wheel-of-fortune');
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

    // Wheel segments with multipliers and colors
    const segments = [
      { multiplier: 0, color: 'gray', label: '0x' },
      { multiplier: 1.2, color: 'green', label: '1.2x' },
      { multiplier: 0, color: 'gray', label: '0x' },
      { multiplier: 1.5, color: 'blue', label: '1.5x' },
      { multiplier: 0, color: 'gray', label: '0x' },
      { multiplier: 2, color: 'purple', label: '2x' },
      { multiplier: 0.5, color: 'orange', label: '0.5x' },
      { multiplier: 3, color: 'pink', label: '3x' },
      { multiplier: 0, color: 'gray', label: '0x' },
      { multiplier: 5, color: 'gold', label: '5x' },
      { multiplier: 0, color: 'gray', label: '0x' },
      { multiplier: 10, color: 'red', label: '10x' },
    ];

    const result = generateResult(serverSeed, playerClientSeed, nonce);
    const segmentIndex = Math.floor(result * segments.length);
    const segment = segments[segmentIndex];
    const rotation = 360 * 5 + (segmentIndex * (360 / segments.length));

    const multiplier = segment.multiplier;
    const isWin = multiplier > 0;
    const payout = betAmount * multiplier;
    const profit = payout - betAmount;

    const [round] = await db.insert(casinoRounds).values({
      gameId: game.id,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      result: JSON.stringify({ segmentIndex, segment, rotation }),
      multiplier: multiplier.toString(),
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
      isWin,
    });

    const newBalance = balance + profit;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));

    await db.insert(walletTransactions).values({
      userId,
      amount: profit.toString(),
      type: isWin ? 'CASINO_WIN' : 'CASINO_BET',
      description: `Wheel of Fortune: ${segment.label}`,
    });

    return {
      segmentIndex,
      segment,
      rotation,
      multiplier,
      isWin,
      payout,
      profit,
      newBalance,
    };
  }

  // ============================================
  // MINES GAME - Manual + Auto modes
  // ============================================
  
  private minesGames: Map<string, {
    oddsGameStateId: string;
    oddsUserId: string;
    betAmount: number;
    mineCount: number;
    minePositions: number[];
    revealedTiles: number[];
    currentMultiplier: number;
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    casinoGameId: string;
    createdAt: number;
  }> = new Map();

  private readonly GRID_SIZE = 25;
  private readonly HOUSE_EDGE = 0.02; // 2% house edge

  // Calculate multiplier for revealing next safe tile
  private calculateNextMultiplier(mineCount: number, revealedSafe: number): number {
    const safeTiles = this.GRID_SIZE - mineCount;
    const remainingTiles = this.GRID_SIZE - revealedSafe;
    const remainingSafe = safeTiles - revealedSafe;
    
    // Probability of next tile being safe
    const survivalChance = remainingSafe / remainingTiles;
    
    // Fair multiplier is inverse of survival chance, minus house edge
    const tileMultiplier = (1 / survivalChance) * (1 - this.HOUSE_EDGE);
    
    return Math.round(tileMultiplier * 10000) / 10000;
  }

  // Calculate cumulative multiplier for N safe tiles revealed
  private calculateCumulativeMultiplier(mineCount: number, revealedSafe: number): number {
    let multiplier = 1;
    for (let i = 0; i < revealedSafe; i++) {
      multiplier *= this.calculateNextMultiplier(mineCount, i);
    }
    return Math.round(multiplier * 100) / 100;
  }

  // Start a new Mines game (manual mode)
  async minesStart(userId: string, betAmount: number, mineCount: number, clientSeed?: string) {
    const game = await this.getGameBySlug('mines');
    if (!game) throw new Error('Game not found');

    const minBet = parseFloat(game.minBet);
    const maxBet = parseFloat(game.maxBet);
    if (betAmount < minBet || betAmount > maxBet) {
      throw new Error(`Bet must be between ${minBet} and ${maxBet}`);
    }

    if (mineCount < 1 || mineCount > 24) {
      throw new Error('Mine count must be between 1 and 24');
    }

    // Check if user has an active game
    const existingGame = Array.from(this.minesGames.values()).find(g => g.oddsUserId === userId);
    if (existingGame) {
      throw new Error('You have an active Mines game. Please finish or cashout first.');
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');

    const balance = parseFloat(user.balance);
    if (balance < betAmount) throw new Error('Insufficient balance');

    // Deduct bet from balance
    const newBalance = balance - betAmount;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));

    await db.insert(walletTransactions).values({
      userId,
      amount: (-betAmount).toString(),
      type: 'CASINO_BET',
      description: `Mines game started: ${mineCount} mines`,
    });

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const playerClientSeed = clientSeed || crypto.randomBytes(8).toString('hex');
    const nonce = Date.now();

    // Generate mine positions server-side
    const minePositions: number[] = [];
    let offset = 0;
    while (minePositions.length < mineCount) {
      const result = generateResult(serverSeed, playerClientSeed, nonce + offset);
      const pos = Math.floor(result * this.GRID_SIZE);
      if (!minePositions.includes(pos)) {
        minePositions.push(pos);
      }
      offset++;
    }

    const gameStateId = `mines-${userId}-${Date.now()}`;
    
    this.minesGames.set(gameStateId, {
      oddsGameStateId: gameStateId,
      oddsUserId: userId,
      betAmount,
      mineCount,
      minePositions,
      revealedTiles: [],
      currentMultiplier: 1,
      serverSeed,
      serverSeedHash,
      clientSeed: playerClientSeed,
      nonce,
      casinoGameId: game.id,
      createdAt: Date.now(),
    });

    // Calculate potential multipliers for display
    const multiplierTable = [];
    for (let i = 1; i <= this.GRID_SIZE - mineCount; i++) {
      multiplierTable.push({
        tiles: i,
        multiplier: this.calculateCumulativeMultiplier(mineCount, i),
      });
    }

    return {
      gameId: gameStateId,
      serverSeedHash,
      mineCount,
      gridSize: this.GRID_SIZE,
      currentMultiplier: 1,
      potentialCashout: betAmount,
      newBalance,
      multiplierTable: multiplierTable.slice(0, 10), // First 10 for display
    };
  }

  // Reveal a single tile (manual mode)
  async minesReveal(userId: string, gameId: string, tileIndex: number) {
    const gameState = this.minesGames.get(gameId);
    if (!gameState) throw new Error('Game not found or expired');
    if (gameState.oddsUserId !== userId) throw new Error('This is not your game');

    if (tileIndex < 0 || tileIndex >= this.GRID_SIZE) {
      throw new Error('Invalid tile index');
    }

    if (gameState.revealedTiles.includes(tileIndex)) {
      throw new Error('Tile already revealed');
    }

    const isMine = gameState.minePositions.includes(tileIndex);
    gameState.revealedTiles.push(tileIndex);

    if (isMine) {
      // Game over - player loses
      const [round] = await db.insert(casinoRounds).values({
        gameId: gameState.casinoGameId,
        serverSeed: gameState.serverSeed,
        serverSeedHash: gameState.serverSeedHash,
        clientSeed: gameState.clientSeed,
        nonce: gameState.nonce,
        result: JSON.stringify({ 
          minePositions: gameState.minePositions, 
          revealedTiles: gameState.revealedTiles, 
          hitMine: true 
        }),
        multiplier: '0',
        status: 'COMPLETED',
        completedAt: new Date(),
      }).returning();

      await db.insert(casinoBets).values({
        userId: userId,
        roundId: round.id,
        gameId: gameState.casinoGameId,
        betAmount: gameState.betAmount.toString(),
        betChoice: `mines:${gameState.mineCount}`,
        payout: '0',
        profit: (-gameState.betAmount).toString(),
        isWin: false,
      });

      this.minesGames.delete(gameId);

      return {
        tileIndex,
        isMine: true,
        gameOver: true,
        isWin: false,
        minePositions: gameState.minePositions,
        revealedTiles: gameState.revealedTiles,
        payout: 0,
        serverSeed: gameState.serverSeed,
      };
    }

    // Safe tile - update multiplier
    const safeRevealed = gameState.revealedTiles.filter(t => !gameState.minePositions.includes(t)).length;
    gameState.currentMultiplier = this.calculateCumulativeMultiplier(gameState.mineCount, safeRevealed);
    const potentialCashout = Math.floor(gameState.betAmount * gameState.currentMultiplier * 100) / 100;

    // Check if all safe tiles revealed (auto-win)
    const maxSafe = this.GRID_SIZE - gameState.mineCount;
    if (safeRevealed >= maxSafe) {
      return this.minesCashout(userId, gameId);
    }

    // Calculate next tile multiplier
    const nextMultiplier = this.calculateCumulativeMultiplier(gameState.mineCount, safeRevealed + 1);

    return {
      tileIndex,
      isMine: false,
      gameOver: false,
      currentMultiplier: gameState.currentMultiplier,
      nextMultiplier,
      potentialCashout,
      revealedTiles: gameState.revealedTiles,
      safeRevealed,
      tilesRemaining: this.GRID_SIZE - gameState.revealedTiles.length,
    };
  }

  // Cashout current winnings
  async minesCashout(userId: string, gameId: string) {
    const gameState = this.minesGames.get(gameId);
    if (!gameState) throw new Error('Game not found or expired');
    if (gameState.oddsUserId !== userId) throw new Error('This is not your game');

    const safeRevealed = gameState.revealedTiles.filter(t => !gameState.minePositions.includes(t)).length;
    
    if (safeRevealed === 0) {
      throw new Error('You must reveal at least one tile before cashing out');
    }

    const payout = Math.floor(gameState.betAmount * gameState.currentMultiplier * 100) / 100;
    const profit = payout - gameState.betAmount;

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');

    const balance = parseFloat(user.balance);
    const newBalance = balance + payout;
    await db.update(users).set({ balance: newBalance.toString() }).where(eq(users.id, userId));

    await db.insert(walletTransactions).values({
      userId,
      amount: payout.toString(),
      type: 'CASINO_WIN',
      description: `Mines cashout: ${safeRevealed} safe tiles, ${gameState.currentMultiplier}x`,
    });

    const [round] = await db.insert(casinoRounds).values({
      gameId: gameState.casinoGameId,
      serverSeed: gameState.serverSeed,
      serverSeedHash: gameState.serverSeedHash,
      clientSeed: gameState.clientSeed,
      nonce: gameState.nonce,
      result: JSON.stringify({ 
        minePositions: gameState.minePositions, 
        revealedTiles: gameState.revealedTiles, 
        hitMine: false,
        cashedOut: true,
      }),
      multiplier: gameState.currentMultiplier.toString(),
      status: 'COMPLETED',
      completedAt: new Date(),
    }).returning();

    await db.insert(casinoBets).values({
      userId: userId,
      roundId: round.id,
      gameId: gameState.casinoGameId,
      betAmount: gameState.betAmount.toString(),
      betChoice: `mines:${gameState.mineCount}`,
      payout: payout.toString(),
      profit: profit.toString(),
      isWin: true,
    });

    this.minesGames.delete(gameId);

    return {
      gameOver: true,
      isWin: true,
      isMine: false,
      multiplier: gameState.currentMultiplier,
      payout,
      profit,
      newBalance,
      minePositions: gameState.minePositions,
      revealedTiles: gameState.revealedTiles,
      serverSeed: gameState.serverSeed,
    };
  }

  // Auto mode - reveal N tiles automatically
  async minesAuto(userId: string, betAmount: number, mineCount: number, tilesToReveal: number, clientSeed?: string) {
    // Start the game
    const startResult = await this.minesStart(userId, betAmount, mineCount, clientSeed);
    const gameId = startResult.gameId;

    const gameState = this.minesGames.get(gameId);
    if (!gameState) throw new Error('Failed to start game');

    const revealResults: { tileIndex: number; isMine: boolean }[] = [];
    
    // Reveal tiles one by one
    for (let i = 0; i < tilesToReveal; i++) {
      // Pick a random unrevealed safe tile
      const availableTiles = [];
      for (let t = 0; t < this.GRID_SIZE; t++) {
        if (!gameState.revealedTiles.includes(t)) {
          availableTiles.push(t);
        }
      }
      
      if (availableTiles.length === 0) break;
      
      // Random selection weighted by server seed
      const result = generateResult(gameState.serverSeed, gameState.clientSeed, gameState.nonce + 1000 + i);
      const tileIndex = availableTiles[Math.floor(result * availableTiles.length)];
      
      const revealResult = await this.minesReveal(userId, gameId, tileIndex);
      revealResults.push({ tileIndex, isMine: revealResult.isMine });
      
      if (revealResult.gameOver) {
        return {
          ...revealResult,
          revealSequence: revealResults,
          mode: 'auto',
        };
      }
    }

    // Auto-cashout after revealing all requested tiles
    const cashoutResult = await this.minesCashout(userId, gameId);
    return {
      ...cashoutResult,
      revealSequence: revealResults,
      mode: 'auto',
    };
  }

  // Legacy method for backward compatibility
  async playMines(userId: string, betAmount: number, mineCount: number, tilesToReveal: number = 3, clientSeed?: string) {
    return this.minesAuto(userId, betAmount, mineCount, tilesToReveal, clientSeed);
  }

  // Get active game state (for reconnection)
  getActiveMinesGame(userId: string) {
    const game = Array.from(this.minesGames.values()).find(g => g.oddsUserId === userId);
    if (!game) return null;

    const safeRevealed = game.revealedTiles.filter(t => !game.minePositions.includes(t)).length;
    
    return {
      gameId: game.oddsGameStateId,
      mineCount: game.mineCount,
      betAmount: game.betAmount,
      currentMultiplier: game.currentMultiplier,
      potentialCashout: Math.floor(game.betAmount * game.currentMultiplier * 100) / 100,
      revealedTiles: game.revealedTiles,
      safeRevealed,
      serverSeedHash: game.serverSeedHash,
    };
  }
}

export const casinoService = new CasinoService();

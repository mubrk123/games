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
}

export const casinoService = new CasinoService();

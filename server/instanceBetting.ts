// Instance-Based Betting System
// Creates micro-markets for specific in-game events like next ball, next over, next goal

export type InstanceType = 
  | 'NEXT_BALL'
  | 'CURRENT_OVER'
  | 'SESSION'
  | 'NEXT_GOAL'
  | 'NEXT_POINT'
  | 'NEXT_WICKET'
  | 'BOUNDARY';

export interface InstanceMarket {
  id: string;
  matchId: string;
  instanceType: InstanceType;
  name: string;
  description: string;
  openTime: Date;
  closeTime: Date;
  status: 'PENDING' | 'OPEN' | 'SUSPENDED' | 'CLOSED' | 'SETTLED';
  eventReference: string;
  outcomes: InstanceOutcome[];
}

export interface InstanceOutcome {
  id: string;
  marketId: string;
  name: string;
  odds: number;
  probability: number;
}

const CRICKET_BALL_OUTCOMES: { name: string; baseOdds: number }[] = [
  { name: '0 (Dot Ball)', baseOdds: 1.45 },
  { name: '1 Run', baseOdds: 2.10 },
  { name: '2 Runs', baseOdds: 3.50 },
  { name: '3 Runs', baseOdds: 8.00 },
  { name: '4 Runs (Boundary)', baseOdds: 4.50 },
  { name: '6 Runs (Six)', baseOdds: 8.50 },
  { name: 'Wicket', baseOdds: 6.00 },
  { name: 'Wide/No Ball', baseOdds: 5.50 },
];

const CRICKET_OVER_OUTCOMES: { name: string; baseOdds: number }[] = [
  { name: '0-5 Runs', baseOdds: 3.20 },
  { name: '6-9 Runs', baseOdds: 2.40 },
  { name: '10-12 Runs', baseOdds: 2.80 },
  { name: '13+ Runs', baseOdds: 4.50 },
  { name: 'Wicket in Over', baseOdds: 2.20 },
  { name: 'No Boundary', baseOdds: 2.50 },
  { name: '1+ Boundary', baseOdds: 1.65 },
  { name: '2+ Boundaries', baseOdds: 3.80 },
];

const FOOTBALL_NEXT_GOAL_OUTCOMES: { name: string; baseOdds: number }[] = [
  { name: 'Home Team', baseOdds: 2.20 },
  { name: 'Away Team', baseOdds: 2.40 },
  { name: 'No Goal (10 min)', baseOdds: 1.90 },
];

class InstanceBettingService {
  private activeMarkets: Map<string, InstanceMarket> = new Map();
  private marketCounter = 0;
  private lastGeneratedForMatch: Map<string, number> = new Map();

  generateMarketId(): string {
    this.marketCounter++;
    return `inst-${Date.now()}-${this.marketCounter}`;
  }

  private shouldGenerateNewMarkets(matchId: string): boolean {
    const lastGenerated = this.lastGeneratedForMatch.get(matchId);
    if (!lastGenerated) return true;
    const activeForMatch = this.getActiveMarketsForMatch(matchId);
    if (activeForMatch.length === 0) return true;
    return false;
  }

  createCricketBallMarket(matchId: string, overNumber: number, ballNumber: number): InstanceMarket {
    const now = new Date();
    const closeTime = new Date(now.getTime() + 30000); // 30 seconds to prevent exploitation

    const market: InstanceMarket = {
      id: this.generateMarketId(),
      matchId,
      instanceType: 'NEXT_BALL',
      name: `Ball ${overNumber}.${ballNumber} Prediction`,
      description: `Predict the outcome of ball ${ballNumber} in over ${overNumber}`,
      openTime: now,
      closeTime,
      status: 'OPEN',
      eventReference: `${overNumber}.${ballNumber}`,
      outcomes: CRICKET_BALL_OUTCOMES.map((outcome, idx) => ({
        id: `${this.generateMarketId()}-${idx}`,
        marketId: '',
        name: outcome.name,
        odds: this.applyOddsVariation(outcome.baseOdds),
        probability: 1 / outcome.baseOdds,
      })),
    };

    market.outcomes.forEach(o => o.marketId = market.id);
    this.activeMarkets.set(market.id, market);
    return market;
  }

  createCricketOverMarket(matchId: string, overNumber: number): InstanceMarket {
    const now = new Date();
    const closeTime = new Date(now.getTime() + 30000); // 30 seconds to prevent exploitation

    const market: InstanceMarket = {
      id: this.generateMarketId(),
      matchId,
      instanceType: 'CURRENT_OVER',
      name: `Over ${overNumber} Markets`,
      description: `Predict outcomes for over ${overNumber}`,
      openTime: now,
      closeTime,
      status: 'OPEN',
      eventReference: `over-${overNumber}`,
      outcomes: CRICKET_OVER_OUTCOMES.map((outcome, idx) => ({
        id: `${this.generateMarketId()}-${idx}`,
        marketId: '',
        name: outcome.name,
        odds: this.applyOddsVariation(outcome.baseOdds),
        probability: 1 / outcome.baseOdds,
      })),
    };

    market.outcomes.forEach(o => o.marketId = market.id);
    this.activeMarkets.set(market.id, market);
    return market;
  }

  createFootballNextGoalMarket(matchId: string, homeTeam: string, awayTeam: string): InstanceMarket {
    const now = new Date();
    const closeTime = new Date(now.getTime() + 30000); // 30 seconds to prevent exploitation

    const outcomes = [
      { name: homeTeam, baseOdds: 2.20 },
      { name: awayTeam, baseOdds: 2.40 },
      { name: 'No Goal (Next 10 min)', baseOdds: 1.90 },
    ];

    const market: InstanceMarket = {
      id: this.generateMarketId(),
      matchId,
      instanceType: 'NEXT_GOAL',
      name: 'Next Goal',
      description: 'Which team will score the next goal?',
      openTime: now,
      closeTime,
      status: 'OPEN',
      eventReference: 'next-goal',
      outcomes: outcomes.map((outcome, idx) => ({
        id: `${this.generateMarketId()}-${idx}`,
        marketId: '',
        name: outcome.name,
        odds: this.applyOddsVariation(outcome.baseOdds),
        probability: 1 / outcome.baseOdds,
      })),
    };

    market.outcomes.forEach(o => o.marketId = market.id);
    this.activeMarkets.set(market.id, market);
    return market;
  }

  createSessionMarkets(matchId: string, sessionType: string): InstanceMarket {
    const now = new Date();
    const closeTime = new Date(now.getTime() + 300000);

    const sessionOutcomes = [
      { name: 'Under 45 Runs', baseOdds: 2.80 },
      { name: '45-55 Runs', baseOdds: 2.20 },
      { name: '55-65 Runs', baseOdds: 2.50 },
      { name: 'Over 65 Runs', baseOdds: 3.00 },
      { name: '0-1 Wickets', baseOdds: 2.00 },
      { name: '2+ Wickets', baseOdds: 1.85 },
    ];

    const market: InstanceMarket = {
      id: this.generateMarketId(),
      matchId,
      instanceType: 'SESSION',
      name: `${sessionType} Session`,
      description: `Predict ${sessionType} session outcomes`,
      openTime: now,
      closeTime,
      status: 'OPEN',
      eventReference: sessionType,
      outcomes: sessionOutcomes.map((outcome, idx) => ({
        id: `${this.generateMarketId()}-${idx}`,
        marketId: '',
        name: outcome.name,
        odds: this.applyOddsVariation(outcome.baseOdds),
        probability: 1 / outcome.baseOdds,
      })),
    };

    market.outcomes.forEach(o => o.marketId = market.id);
    this.activeMarkets.set(market.id, market);
    return market;
  }

  getActiveMarketsForMatch(matchId: string): InstanceMarket[] {
    const now = new Date();
    const markets: InstanceMarket[] = [];

    this.activeMarkets.forEach(market => {
      if (market.matchId === matchId) {
        if (market.closeTime <= now && market.status === 'OPEN') {
          market.status = 'CLOSED';
        }
        if (market.status === 'OPEN' || market.status === 'SUSPENDED') {
          markets.push(market);
        }
      }
    });

    return markets;
  }

  getAllActiveMarkets(): InstanceMarket[] {
    const now = new Date();
    const markets: InstanceMarket[] = [];

    this.activeMarkets.forEach(market => {
      if (market.closeTime <= now && market.status === 'OPEN') {
        market.status = 'CLOSED';
      }
      if (market.status === 'OPEN') {
        markets.push(market);
      }
    });

    return markets;
  }

  closeMarket(marketId: string): void {
    const market = this.activeMarkets.get(marketId);
    if (market) {
      market.status = 'CLOSED';
    }
  }

  suspendMarket(marketId: string): void {
    const market = this.activeMarkets.get(marketId);
    if (market) {
      market.status = 'SUSPENDED';
    }
  }

  suspendAllMarketsForMatch(matchId: string, reason: string): number {
    let suspended = 0;
    this.activeMarkets.forEach(market => {
      if (market.matchId === matchId && market.status === 'OPEN') {
        market.status = 'SUSPENDED';
        suspended++;
        console.log(`Market ${market.id} suspended: ${reason}`);
      }
    });
    return suspended;
  }

  resumeAllMarketsForMatch(matchId: string): number {
    let resumed = 0;
    this.activeMarkets.forEach(market => {
      if (market.matchId === matchId && market.status === 'SUSPENDED') {
        const now = new Date();
        if (market.closeTime > now) {
          market.status = 'OPEN';
          resumed++;
        }
      }
    });
    return resumed;
  }

  checkCriticalMoments(
    matchId: string,
    currentOver: number,
    currentBall: number,
    wicketsInOver: number,
    totalOvers: number,
    lastBallResult?: string
  ): { isCritical: boolean; reason: string | null } {
    const isLastOver = currentOver >= totalOvers - 1;
    const isLastTwoBalls = currentBall >= 5;
    const isWicketJustFallen = wicketsInOver > 0 || lastBallResult?.toLowerCase().includes('wicket');
    const isPowerplayEnd = currentOver === 5 && currentBall === 6;
    const isDeathOvers = currentOver >= totalOvers - 5;

    if (isWicketJustFallen) {
      return { isCritical: true, reason: 'Wicket just fallen - markets suspended' };
    }
    
    if (isLastOver && isLastTwoBalls) {
      return { isCritical: true, reason: 'Critical last balls - markets suspended' };
    }

    if (isPowerplayEnd) {
      return { isCritical: true, reason: 'Powerplay ending - markets suspended' };
    }

    return { isCritical: false, reason: null };
  }

  private applyOddsVariation(baseOdds: number): number {
    const variation = (Math.random() - 0.5) * 0.1;
    return Math.round((baseOdds + variation) * 100) / 100;
  }

  checkAndCloseExpiredMarkets(): void {
    const now = new Date();
    this.activeMarkets.forEach(market => {
      if (market.closeTime <= now && market.status === 'OPEN') {
        market.status = 'CLOSED';
      }
    });
  }

  generateLiveInstanceMarkets(matchId: string, sport: string, homeTeam?: string, awayTeam?: string, currentOver?: number, currentBall?: number): InstanceMarket[] {
    if (!this.shouldGenerateNewMarkets(matchId)) {
      return this.getActiveMarketsForMatch(matchId);
    }

    this.lastGeneratedForMatch.set(matchId, Date.now());

    const markets: InstanceMarket[] = [];

    if (sport === 'cricket') {
      const over = currentOver ?? Math.floor(Math.random() * 15) + 5;
      const ball = currentBall ?? Math.floor(Math.random() * 6) + 1;

      markets.push(this.createCricketBallMarket(matchId, over, ball));
      markets.push(this.createCricketOverMarket(matchId, over));
      markets.push(this.createSessionMarkets(matchId, 'Powerplay'));
    } else if (sport === 'football' || sport === 'soccer') {
      if (homeTeam && awayTeam) {
        markets.push(this.createFootballNextGoalMarket(matchId, homeTeam, awayTeam));
      }
    }

    return markets;
  }

  clearExpiredMarketsForMatch(matchId: string): void {
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    this.activeMarkets.forEach((market, key) => {
      if (market.matchId === matchId && new Date(market.closeTime).getTime() <= now) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => this.activeMarkets.delete(key));
    
    if (keysToRemove.length > 0) {
      this.lastGeneratedForMatch.delete(matchId);
    }
  }
}

export const instanceBettingService = new InstanceBettingService();

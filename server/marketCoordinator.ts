// marketCoordinator.ts
import { instanceBettingService, InstanceMarket } from "./instanceBetting";
import { matchStateManager } from "./matchStateManager";
import { realtimeHub } from "./realtimeHub";
import type { MarketUpdate, InstanceMarketType, InstanceMarketStatus } from "@shared/realtime";

interface MarketLifecycle {
  matchId: string;
  currentBall: number;
  currentOver: number;
  activeMarkets: Set<string>;
  pendingSettlement: Set<string>;
  lastBallTime: number;
  nextMarketGeneration: number;
}

class MarketCoordinator {
  private lifecycles: Map<string, MarketLifecycle> = new Map();
  private readonly MARKET_GAP = 3; // 3 balls ahead
  private readonly SETTLEMENT_DELAY = 1000; // 1 second after ball
  private readonly GENERATION_DELAY = 500; // 0.5 seconds after settlement

  async processMatch(matchId: string): Promise<void> {
    const state = await matchStateManager.getOrInitialize(matchId);
    if (!state || state.status !== 'LIVE') return;

    let lifecycle = this.lifecycles.get(matchId);
    if (!lifecycle) {
      lifecycle = {
        matchId,
        currentBall: -1,
        currentOver: -1,
        activeMarkets: new Set(),
        pendingSettlement: new Set(),
        lastBallTime: 0,
        nextMarketGeneration: 0
      };
      this.lifecycles.set(matchId, lifecycle);
    }

    // Check if ball has changed
    if (state.currentOver !== lifecycle.currentOver || 
        state.currentBall !== lifecycle.currentBall) {
      
      await this.handleBallChange(matchId, state, lifecycle);
      return;
    }

    // Check for pending settlements
    if (lifecycle.pendingSettlement.size > 0 && 
        Date.now() - lifecycle.lastBallTime > this.SETTLEMENT_DELAY) {
      await this.processSettlements(matchId, lifecycle);
    }

    // Check for market generation
    if (Date.now() > lifecycle.nextMarketGeneration) {
      await this.generateMarkets(matchId, state);
    }

    // Clean up old markets
    this.cleanupOldMarkets(matchId, state);
  }

  private async handleBallChange(
    matchId: string,
    state: any,
    lifecycle: MarketLifecycle
  ): Promise<void> {
    console.log(`[MarketCoordinator] Ball changed: ${matchId} - ${state.currentOver}.${state.currentBall}`);

    // Update lifecycle
    lifecycle.currentOver = state.currentOver;
    lifecycle.currentBall = state.currentBall;
    lifecycle.lastBallTime = Date.now();
    lifecycle.nextMarketGeneration = Date.now() + this.SETTLEMENT_DELAY + this.GENERATION_DELAY;

    // Suspend all markets
    instanceBettingService.suspendAllMarketsForMatch(matchId, 'Ball in progress');

    // Close and settle markets for completed ball
    const completedMarkets = this.findCompletedMarkets(matchId, state);
    for (const marketId of completedMarkets) {
      lifecycle.pendingSettlement.add(marketId);
      lifecycle.activeMarkets.delete(marketId);
    }

    // Emit immediate update
    this.emitMarketUpdate(matchId);

    // Schedule settlement
    setTimeout(() => {
      this.processSettlements(matchId, lifecycle);
    }, this.SETTLEMENT_DELAY);
  }

  private findCompletedMarkets(matchId: string, state: any): string[] {
    const completed: string[] = [];
    const markets = instanceBettingService.getAllActiveMarkets();
    
    const currentTotal = state.currentOver * 6 + state.currentBall;
    
    markets.forEach(market => {
      if (market.matchId !== matchId) return;
      if (market.status !== 'OPEN' && market.status !== 'SUSPENDED') return;
      
      if (market.instanceType === 'NEXT_BALL') {
        const marketTotal = market.overNumber * 6 + market.ballNumber;
        if (marketTotal <= currentTotal) {
          completed.push(market.id);
        }
      }
    });
    
    return completed;
  }

  private async processSettlements(matchId: string, lifecycle: MarketLifecycle): Promise<void> {
    if (lifecycle.pendingSettlement.size === 0) return;

    const state = matchStateManager.getState(matchId);
    if (!state) return;

    // Import settlement service here to avoid circular dependency
    const { instanceSettlementService } = await import("./instanceSettlementService");
    
    for (const marketId of Array.from(lifecycle.pendingSettlement)) {
      const market = instanceBettingService.getMarketById(marketId);
      if (!market) continue;

      // Determine outcome based on state
      const outcome = this.determineOutcome(state, market);
      if (outcome) {
        // Close market first
        instanceBettingService.closeMarket(marketId);
        
        // Then settle
        await instanceSettlementService.settleInstanceMarket(market, outcome);
      }
    }

    lifecycle.pendingSettlement.clear();
    this.emitMarketUpdate(matchId);
  }

  private determineOutcome(state: any, market: InstanceMarket): string | null {
    if (market.instanceType !== 'NEXT_BALL') return null;
    if (!state.lastBall) return null;

    const lastBall = state.lastBall;
    
    if (lastBall.isWicket) return 'Wicket';
    if (lastBall.isSix) return '6 Runs (Six)';
    if (lastBall.isBoundary) return '4 Runs (Boundary)';
    if (lastBall.isExtra) return 'Wide/No Ball';
    
    switch (lastBall.runs) {
      case 0: return '0 (Dot Ball)';
      case 1: return '1 Run';
      case 2: return '2 Runs';
      case 3: return '3 Runs';
      default: return `${lastBall.runs} Runs`;
    }
  }

  private async generateMarkets(matchId: string, state: any): Promise<void> {
    const lifecycle = this.lifecycles.get(matchId);
    if (!lifecycle) return;

    // Clear old markets
    this.cleanupOldMarkets(matchId, state);

    // Generate new markets
    const markets = instanceBettingService.generateSyncedMarkets(
      matchId,
      state.currentOver,
      state.currentBall
    );

    // Track active markets
    markets.forEach(market => {
      lifecycle.activeMarkets.add(market.id);
    });

    lifecycle.nextMarketGeneration = Date.now() + 5000; // Next check in 5 seconds
    this.emitMarketUpdate(matchId);
  }

  private cleanupOldMarkets(matchId: string, state: any): void {
    const currentTotal = state.currentOver * 6 + state.currentBall;
    const minOpenBall = currentTotal + this.MARKET_GAP;
    
    const markets = instanceBettingService.getAllActiveMarkets();
    
    markets.forEach(market => {
      if (market.matchId !== matchId) return;
      if (market.status !== 'OPEN') return;
      
      if (market.instanceType === 'NEXT_BALL') {
        const marketTotal = market.overNumber * 6 + market.ballNumber;
        if (marketTotal < minOpenBall) {
          instanceBettingService.closeMarket(market.id);
        }
      }
    });
  }

  private emitMarketUpdate(matchId: string): void {
    const activeMarkets = instanceBettingService.getActiveMarketsForMatch(matchId);
    
    const marketUpdate: MarketUpdate = {
      matchId,
      markets: activeMarkets.map(m => ({
        id: m.id,
        name: m.name,
        type: m.instanceType as InstanceMarketType,
        status: m.status as InstanceMarketStatus,
        closeTime: m.closeTime.getTime(),
        overNumber: m.overNumber,
        ballNumber: m.ballNumber,
        outcomes: m.outcomes.map(o => ({
          id: o.id,
          name: o.name,
          odds: o.odds,
        })),
      })),
      timestamp: Date.now(),
    };

    realtimeHub.emitMarketUpdate(marketUpdate);
  }

  async start(): Promise<void> {
    console.log('[MarketCoordinator] Started');
    
    // Run every 2 seconds
    setInterval(async () => {
      const activeMatches = realtimeHub.getActiveMatchSubscriptions();
      
      await Promise.all(
        activeMatches.map(async (matchId) => {
          if (!matchId.startsWith('cricket-')) return;
          
          try {
            await this.processMatch(matchId);
          } catch (error) {
            console.error(`[MarketCoordinator] Error processing ${matchId}:`, error);
          }
        })
      );
    }, 2000);
  }

  getLifecycle(matchId: string): MarketLifecycle | undefined {
    return this.lifecycles.get(matchId);
  }

  clearLifecycle(matchId: string): void {
    this.lifecycles.delete(matchId);
  }
}

export const marketCoordinator = new MarketCoordinator();
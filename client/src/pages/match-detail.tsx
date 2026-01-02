import { AppShell } from "@/components/layout/AppShell";
import { useStore, Match, Runner } from "@/lib/store";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MobileBetSlip } from "@/components/betting/MobileBetSlip";
import { ArrowLeft, Zap, Target, TrendingUp, Activity, Clock, AlertCircle, RefreshCw, Wifi } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, InstanceMarket, InstanceOutcome } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { wsClient } from "@/lib/websocket";
import type { MatchScoreUpdate, BallResult, MarketUpdate, BetSettlement } from "@shared/realtime";

export default function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const storeMatch = useStore(state => state.matches.find(m => m.id === params?.id));
  const setMatches = useStore(state => state.setMatches);
  const matches = useStore(state => state.matches);
  const { currentUser, setCurrentUser } = useStore();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [selectedBet, setSelectedBet] = useState<{
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<{
    market: InstanceMarket;
    outcome: InstanceOutcome;
  } | null>(null);
  const [instanceStake, setInstanceStake] = useState('100');
  const [isPlacingBet, setIsPlacingBet] = useState(false);

  const queryClient = useQueryClient();
  const [liveScore, setLiveScore] = useState<MatchScoreUpdate | null>(null);
  const [lastBall, setLastBall] = useState<BallResult | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const clearBet = () => setSelectedBet(null);
  const clearInstanceBet = () => setSelectedInstance(null);

  useEffect(() => {
    wsClient.connect();
    
    const checkConnection = setInterval(() => {
      setWsConnected(wsClient.getConnectionStatus());
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  useEffect(() => {
    if (!params?.id) return;

    wsClient.subscribeToMatch(params.id);

    const unsubScore = wsClient.on<MatchScoreUpdate>('match:score', (data) => {
      if (data.matchId === params.id) {
        setLiveScore(data);
      }
    });

    const unsubBall = wsClient.on<BallResult>('match:ball', (data) => {
      if (data.matchId === params.id) {
        setLastBall(data);
        queryClient.invalidateQueries({ queryKey: ['instance-markets', params.id] });
      }
    });

    const unsubMarkets = wsClient.on<MarketUpdate>('markets:update', (data) => {
      if (data.matchId === params.id) {
        queryClient.invalidateQueries({ queryKey: ['instance-markets', params.id] });
      }
    });

    const unsubSettlement = wsClient.on<BetSettlement>('bet:settled', (data) => {
      toast({
        title: data.status === 'WON' ? '🎉 You Won!' : 'Play Settled',
        description: `${data.outcome}: ${data.status} - ₹${data.payout.toFixed(2)}`,
        variant: data.status === 'WON' ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['instance-bets'] });
    });

    return () => {
      wsClient.unsubscribeFromMatch(params.id!);
      unsubScore();
      unsubBall();
      unsubMarkets();
      unsubSettlement();
    };
  }, [params?.id, queryClient, toast]);

  // Fetch match from API if not in store
  const { data: fetchedMatch, isLoading: isLoadingMatch } = useQuery({
    queryKey: ['match', params?.id],
    queryFn: async () => {
      if (!params?.id) return null;
      try {
        // Fetch all cricket matches and find the one we need
        const result = await api.getCurrentCricketMatches();
        const found = result.matches.find(m => m.id === params.id);
        if (!found) return null;
        // Convert API match to store format (odds as numbers)
        const converted: Match = {
          ...found,
          markets: found.markets.map(market => ({
            ...market,
            runners: market.runners.map(runner => ({
              ...runner,
              backOdds: typeof runner.backOdds === 'string' ? parseFloat(runner.backOdds) : runner.backOdds,
              layOdds: typeof runner.layOdds === 'string' ? parseFloat(runner.layOdds) : runner.layOdds,
            }))
          }))
        };
        return converted;
      } catch {
        return null;
      }
    },
    enabled: !!params?.id && !storeMatch,
    staleTime: 10000,
  });

  // Use store match or fetched match
  const match = storeMatch || fetchedMatch;

  // Update store with fetched match
  useEffect(() => {
    if (fetchedMatch && !storeMatch) {
      setMatches([...matches, fetchedMatch]);
    }
  }, [fetchedMatch, storeMatch, matches, setMatches]);

  const { data: realtimeData, refetch: refetchRealtime } = useQuery({
    queryKey: ['realtime', params?.id],
    queryFn: async () => {
      if (!params?.id) return null;
      try {
        return await api.getRealtimeUpdate(params.id);
      } catch {
        return null;
      }
    },
    refetchInterval: 5000,
    staleTime: 3000,
    enabled: !!params?.id && match?.status === 'LIVE',
  });

  const { data: instanceMarketsData, refetch: refetchMarkets } = useQuery({
    queryKey: ['instance-markets', params?.id],
    queryFn: async () => {
      if (!params?.id || !match) return { markets: [] };
      return api.getInstanceMarkets(params.id, match.sport, match.homeTeam, match.awayTeam);
    },
    refetchInterval: 3000,
    staleTime: 2000,
    enabled: !!params?.id && !!match && match.status === 'LIVE',
  });

  const instanceMarkets = instanceMarketsData?.markets || [];

  const handlePlaceInstanceBet = async () => {
    if (!selectedInstance || !currentUser) return;

    setIsPlacingBet(true);
    try {
      const result = await api.placeInstanceBet({
        marketId: selectedInstance.market.id,
        outcomeId: selectedInstance.outcome.id,
        stake: instanceStake,
      });

      toast({
        title: "Bet Placed!",
        description: result.message,
      });

      const { user } = await api.getCurrentUser();
      setCurrentUser({
        id: user.id,
        username: user.username,
        role: user.role,
        balance: parseFloat(user.balance),
        exposure: parseFloat(user.exposure),
        currency: user.currency,
      });

      clearInstanceBet();
      refetchMarkets();
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPlacingBet(false);
    }
  };

  const getTimeRemaining = (closeTime: string) => {
    const remaining = new Date(closeTime).getTime() - Date.now();
    if (remaining <= 0) return 'Closed';
    const seconds = Math.floor(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  if (!match && isLoadingMatch) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading match...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!match) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Match not found</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isCricket = match.sport === 'cricket';
  const mainMarket = match.markets[0];
  const displayScore = liveScore?.runs !== undefined 
    ? `${liveScore.runs}/${liveScore.wickets}` 
    : (realtimeData?.scoreHome || match.scoreHome);
  const displayDetails = realtimeData?.scoreDetails || match.scoreDetails;
  const currentOver = liveScore?.currentOver ?? realtimeData?.currentOver;
  const currentBall = liveScore?.currentBall ?? realtimeData?.currentBall;

  return (
    <AppShell>
      <div className="space-y-4 pb-20">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {match.status === 'LIVE' && (
                <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
              )}
              {wsConnected && (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <Wifi className="h-3 w-3 mr-1" /> Live
                </Badge>
              )}
              <span className="text-xs text-muted-foreground uppercase">{match.league}</span>
            </div>
            <h1 className="text-lg font-bold mt-0.5">{match.homeTeam} vs {match.awayTeam}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { refetchRealtime(); refetchMarkets(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {lastBall && (
          <Card className="bg-green-500/10 border-green-500/20 animate-pulse">
            <CardContent className="p-3 text-center">
              <p className="text-sm font-bold text-green-500">
                Ball {lastBall.over}.{lastBall.ball}: {lastBall.outcome}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-bold text-lg">{liveScore?.battingTeam || match.homeTeam}</p>
                {displayScore && (
                  <p className="text-2xl font-mono font-bold text-primary">{displayScore}</p>
                )}
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">VS</span>
                {currentOver !== undefined && (
                  <p className="text-xs text-primary mt-1">Over {currentOver}.{currentBall}</p>
                )}
                {liveScore?.runRate && (
                  <p className="text-xs text-muted-foreground">RR: {liveScore.runRate}</p>
                )}
              </div>
              <div>
                <p className="font-bold text-lg">{match.awayTeam}</p>
                {(liveScore?.scoreAway || realtimeData?.scoreAway) && (
                  <p className="text-2xl font-mono font-bold text-primary">{liveScore?.scoreAway || realtimeData?.scoreAway}</p>
                )}
              </div>
            </div>
            {displayDetails && (
              <p className="text-xs text-center text-muted-foreground mt-2">{displayDetails}</p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue={isCricket && match.status === 'LIVE' ? 'instance' : 'match-winner'} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-auto p-1">
            <TabsTrigger value="match-winner" className="text-[11px] py-2">
              <Target className="h-3 w-3 mr-1" /> Winner
            </TabsTrigger>
            <TabsTrigger value="instance" className="text-[11px] py-2">
              <Zap className="h-3 w-3 mr-1" /> Instance
            </TabsTrigger>
            <TabsTrigger value="session" className="text-[11px] py-2">
              <TrendingUp className="h-3 w-3 mr-1" /> Session
            </TabsTrigger>
          </TabsList>

          <TabsContent value="match-winner" className="mt-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Match Winner
            </h3>
            {mainMarket?.runners.map(runner => (
              <div key={runner.id} className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border/50">
                <span className="flex-1 font-medium">{runner.name}</span>
                <Button 
                  className="h-12 w-20 flex-col bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30"
                  variant="outline"
                  onClick={() => setSelectedBet({
                    match,
                    runner,
                    type: 'BACK',
                    odds: runner.backOdds,
                  })}
                  data-testid={`back-${runner.id}`}
                >
                  <span className="font-bold">{runner.backOdds.toFixed(2)}</span>
                  <span className="text-[10px] opacity-70">Back</span>
                </Button>
                <Button 
                  className="h-12 w-20 flex-col bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-pink-500/30"
                  variant="outline"
                  onClick={() => setSelectedBet({
                    match,
                    runner,
                    type: 'LAY',
                    odds: runner.layOdds,
                  })}
                  data-testid={`lay-${runner.id}`}
                >
                  <span className="font-bold">{runner.layOdds.toFixed(2)}</span>
                  <span className="text-[10px] opacity-70">Lay</span>
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="instance" className="mt-4 space-y-4">
            {match.status !== 'LIVE' ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Instance betting available only for live matches</p>
              </div>
            ) : instanceMarkets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
                <p>Loading instance markets...</p>
              </div>
            ) : (
              <>
                {/* Ball-by-Ball Section - Always Visible */}
                {instanceMarkets.filter(m => m.instanceType === 'NEXT_BALL').length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-yellow-500">
                      <Zap className="h-4 w-4" /> Ball-by-Ball Betting
                    </h3>
                    <p className="text-xs text-muted-foreground">Predict the outcome of each ball (3-ball delay from current)</p>
                    
                    <div className="space-y-3">
                      {instanceMarkets
                        .filter(m => m.instanceType === 'NEXT_BALL')
                        .sort((a, b) => (a.overNumber * 6 + a.ballNumber) - (b.overNumber * 6 + b.ballNumber))
                        .map(market => (
                          <div key={market.id} className="p-3 rounded-xl bg-card border border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-primary">{market.name}</span>
                              <Badge 
                                variant={market.status === 'OPEN' ? 'default' : 'secondary'}
                                className={cn(
                                  "text-[10px]",
                                  market.status === 'OPEN' && "bg-green-500/20 text-green-400"
                                )}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {getTimeRemaining(market.closeTime)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                              {market.outcomes.slice(0, 8).map((outcome) => (
                                <Button
                                  key={outcome.id}
                                  variant="outline"
                                  size="sm"
                                  disabled={market.status !== 'OPEN'}
                                  className={cn(
                                    "h-12 flex-col gap-0 text-center p-1",
                                    market.status !== 'OPEN' && "opacity-50",
                                    selectedInstance?.outcome.id === outcome.id && "ring-2 ring-primary"
                                  )}
                                  onClick={() => setSelectedInstance({ market, outcome })}
                                  data-testid={`ball-${outcome.id}`}
                                >
                                  <span className="text-[9px] font-medium leading-tight truncate w-full">{outcome.name.split(' ')[0]}</span>
                                  <span className="font-bold text-xs text-primary">{outcome.odds.toFixed(2)}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Next Over Section */}
                {instanceMarkets.filter(m => m.instanceType === 'NEXT_OVER').length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-blue-500">
                      <TrendingUp className="h-4 w-4" /> Next Over Prediction
                    </h3>
                    <p className="text-xs text-muted-foreground">Closes when 6th ball of current over is bowled</p>
                    
                    {instanceMarkets
                      .filter(m => m.instanceType === 'NEXT_OVER')
                      .map(market => (
                        <div key={market.id} className="p-3 rounded-xl bg-card border border-blue-500/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold">{market.name}</span>
                            <Badge 
                              variant={market.status === 'OPEN' ? 'default' : 'secondary'}
                              className={cn(
                                "text-[10px]",
                                market.status === 'OPEN' && "bg-blue-500/20 text-blue-400"
                              )}
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {getTimeRemaining(market.closeTime)}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {market.outcomes.map((outcome) => (
                              <Button
                                key={outcome.id}
                                variant="outline"
                                disabled={market.status !== 'OPEN'}
                                className={cn(
                                  "h-14 flex-col gap-1 text-center",
                                  market.status !== 'OPEN' && "opacity-50",
                                  selectedInstance?.outcome.id === outcome.id && "ring-2 ring-primary"
                                )}
                                onClick={() => setSelectedInstance({ market, outcome })}
                                data-testid={`over-${outcome.id}`}
                              >
                                <span className="text-[9px] font-medium leading-tight">{outcome.name}</span>
                                <span className="font-bold text-sm text-primary">{outcome.odds.toFixed(2)}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Session Markets */}
                {instanceMarkets.filter(m => m.instanceType === 'SESSION').map(market => (
                  <div key={market.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" /> {market.name}
                      </h3>
                      <Badge 
                        variant={market.status === 'OPEN' ? 'default' : 'secondary'}
                        className={cn(
                          "text-[10px]",
                          market.status === 'OPEN' && "bg-green-500/20 text-green-400"
                        )}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {getTimeRemaining(market.closeTime)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{market.description}</p>

                    <div className="grid grid-cols-4 gap-2">
                      {market.outcomes.map((outcome) => (
                        <Button
                          key={outcome.id}
                          variant="outline"
                          disabled={market.status !== 'OPEN'}
                          className={cn(
                            "h-16 flex-col gap-1 text-center",
                            market.status !== 'OPEN' && "opacity-50",
                            selectedInstance?.outcome.id === outcome.id && "ring-2 ring-primary"
                          )}
                          onClick={() => setSelectedInstance({ market, outcome })}
                          data-testid={`session-${outcome.id}`}
                        >
                          <span className="text-[10px] font-medium leading-tight">{outcome.name}</span>
                          <span className="font-bold text-sm text-primary">{outcome.odds.toFixed(2)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {selectedInstance && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedInstance.outcome.name}</span>
                  <span className="font-bold text-primary">@{selectedInstance.outcome.odds.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={instanceStake}
                    onChange={(e) => setInstanceStake(e.target.value)}
                    placeholder="Stake"
                    className="flex-1"
                  />
                  <Button
                    onClick={handlePlaceInstanceBet}
                    disabled={isPlacingBet || !currentUser}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isPlacingBet ? 'Placing...' : 'Place Bet'}
                  </Button>
                  <Button variant="ghost" onClick={clearInstanceBet}>Cancel</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Potential Win: {currentUser?.currency || '₹'} {(parseFloat(instanceStake || '0') * (selectedInstance.outcome.odds - 1)).toFixed(2)}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="session" className="mt-4 space-y-4">
            {instanceMarkets.filter(m => m.instanceType === 'SESSION').length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Session markets coming soon...</p>
              </div>
            ) : (
              instanceMarkets
                .filter(m => m.instanceType === 'SESSION')
                .map(market => (
                  <div key={market.id} className="space-y-2">
                    <h4 className="text-sm font-bold">{market.name}</h4>
                    {market.outcomes.map(outcome => (
                      <div 
                        key={outcome.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50"
                      >
                        <span className="text-sm">{outcome.name}</span>
                        <Button
                          size="sm"
                          className="h-9 px-4 bg-primary/20 hover:bg-primary/30 text-primary font-bold"
                          onClick={() => setSelectedInstance({ market, outcome })}
                          disabled={market.status !== 'OPEN'}
                        >
                          {outcome.odds.toFixed(2)}
                        </Button>
                      </div>
                    ))}
                  </div>
                ))
            )}
          </TabsContent>
        </Tabs>

        <Sheet open={!!selectedBet && isMobile} onOpenChange={(open) => !open && clearBet()}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
            <MobileBetSlip selectedBet={selectedBet} onClear={clearBet} />
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

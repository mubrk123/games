import { AppShell } from "@/components/layout/AppShell";
import { useStore, Match, Runner } from "@/lib/store";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MobileBetSlip } from "@/components/betting/MobileBetSlip";
import { ArrowLeft, Zap, Target, TrendingUp, Activity, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { api, InstanceMarket, InstanceOutcome } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const match = useStore(state => state.matches.find(m => m.id === params?.id));
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

  const clearBet = () => setSelectedBet(null);
  const clearInstanceBet = () => setSelectedInstance(null);

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
    refetchInterval: 15000,
    staleTime: 10000,
    enabled: !!params?.id && match?.status === 'LIVE',
  });

  const { data: instanceMarketsData, refetch: refetchMarkets } = useQuery({
    queryKey: ['instance-markets', params?.id],
    queryFn: async () => {
      if (!params?.id || !match) return { markets: [] };
      return api.getInstanceMarkets(params.id, match.sport, match.homeTeam, match.awayTeam);
    },
    refetchInterval: 20000,
    staleTime: 15000,
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
  const displayScore = realtimeData?.scoreHome || match.scoreHome;
  const displayDetails = realtimeData?.scoreDetails || match.scoreDetails;

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
              <span className="text-xs text-muted-foreground uppercase">{match.league}</span>
            </div>
            <h1 className="text-lg font-bold mt-0.5">{match.homeTeam} vs {match.awayTeam}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { refetchRealtime(); refetchMarkets(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-bold text-lg">{match.homeTeam}</p>
                {displayScore && (
                  <p className="text-2xl font-mono font-bold text-primary">{displayScore}</p>
                )}
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">VS</span>
                {realtimeData?.currentOver !== undefined && (
                  <p className="text-xs text-primary mt-1">Over {realtimeData.currentOver}.{realtimeData.currentBall}</p>
                )}
              </div>
              <div>
                <p className="font-bold text-lg">{match.awayTeam}</p>
                {realtimeData?.scoreAway && (
                  <p className="text-2xl font-mono font-bold text-primary">{realtimeData.scoreAway}</p>
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
              instanceMarkets.map(market => (
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
                        data-testid={`instance-${outcome.id}`}
                      >
                        <span className="text-[10px] font-medium leading-tight">{outcome.name}</span>
                        <span className="font-bold text-sm text-primary">{outcome.odds.toFixed(2)}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))
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

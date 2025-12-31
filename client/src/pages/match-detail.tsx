import { AppShell } from "@/components/layout/AppShell";
import { useStore, Match, Runner } from "@/lib/store";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MobileBetSlip } from "@/components/betting/MobileBetSlip";
import { ArrowLeft, Zap, Target, Clock, TrendingUp, Activity } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const BALL_OUTCOMES = [
  { name: "Dot Ball", odds: 1.45, color: "bg-gray-500/20 text-gray-400" },
  { name: "1 Run", odds: 2.10, color: "bg-blue-500/20 text-blue-400" },
  { name: "2 Runs", odds: 3.50, color: "bg-blue-500/20 text-blue-400" },
  { name: "3 Runs", odds: 8.00, color: "bg-blue-500/20 text-blue-400" },
  { name: "4 Runs", odds: 4.50, color: "bg-green-500/20 text-green-400" },
  { name: "6 Runs", odds: 8.50, color: "bg-purple-500/20 text-purple-400" },
  { name: "Wicket", odds: 6.00, color: "bg-red-500/20 text-red-400" },
  { name: "Wide/No Ball", odds: 5.50, color: "bg-yellow-500/20 text-yellow-400" },
];

const OVER_MARKETS = [
  { name: "Over 0-5 Runs", odds: 3.20 },
  { name: "Over 6-9 Runs", odds: 2.40 },
  { name: "Over 10-12 Runs", odds: 2.80 },
  { name: "Over 13+ Runs", odds: 4.50 },
  { name: "Wicket in Over", odds: 2.20 },
  { name: "Boundary in Over", odds: 1.35 },
];

const SESSION_MARKETS = [
  { name: "1st 6 Overs: 40-50 Runs", odds: 2.50, type: "runs" },
  { name: "1st 6 Overs: 50-60 Runs", odds: 2.00, type: "runs" },
  { name: "1st 6 Overs: 60+ Runs", odds: 3.00, type: "runs" },
  { name: "Powerplay Wickets: 0-1", odds: 2.80, type: "wickets" },
  { name: "Powerplay Wickets: 2-3", odds: 2.20, type: "wickets" },
  { name: "Powerplay Wickets: 4+", odds: 5.00, type: "wickets" },
  { name: "1st Innings Total: 150-170", odds: 3.50, type: "total" },
  { name: "1st Innings Total: 170-190", odds: 2.50, type: "total" },
  { name: "1st Innings Total: 190+", odds: 2.80, type: "total" },
];

export default function MatchDetail() {
  const [, params] = useRoute("/match/:id");
  const match = useStore(state => state.matches.find(m => m.id === params?.id));
  const isMobile = useIsMobile();
  const [selectedBet, setSelectedBet] = useState<{
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null>(null);

  const clearBet = () => setSelectedBet(null);

  const handleQuickBet = (marketName: string, odds: number) => {
    if (!match) return;
    const syntheticRunner: Runner = {
      id: `quick-${marketName.replace(/\s/g, '-').toLowerCase()}`,
      name: marketName,
      backOdds: odds,
      layOdds: odds * 1.02,
      volume: Math.floor(Math.random() * 500000) + 100000,
    };
    setSelectedBet({
      match,
      runner: syntheticRunner,
      type: 'BACK',
      odds,
    });
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

  return (
    <AppShell>
      <div className="space-y-4">
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
        </div>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-bold text-lg">{match.homeTeam}</p>
                {match.scoreHome && (
                  <p className="text-2xl font-mono font-bold text-primary">{match.scoreHome}</p>
                )}
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">VS</span>
                {match.scoreDetails && (
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">{match.scoreDetails}</p>
                )}
              </div>
              <div>
                <p className="font-bold text-lg">{match.awayTeam}</p>
                {match.scoreAway && (
                  <p className="text-2xl font-mono font-bold text-primary">{match.scoreAway}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="match-winner" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1">
            <TabsTrigger value="match-winner" className="text-[11px] py-2">
              <Target className="h-3 w-3 mr-1" /> Winner
            </TabsTrigger>
            {isCricket && (
              <>
                <TabsTrigger value="ball-by-ball" className="text-[11px] py-2">
                  <Zap className="h-3 w-3 mr-1" /> Ball
                </TabsTrigger>
                <TabsTrigger value="over" className="text-[11px] py-2">
                  <Activity className="h-3 w-3 mr-1" /> Over
                </TabsTrigger>
                <TabsTrigger value="session" className="text-[11px] py-2">
                  <TrendingUp className="h-3 w-3 mr-1" /> Session
                </TabsTrigger>
              </>
            )}
            {!isCricket && (
              <>
                <TabsTrigger value="halftime" className="text-[11px] py-2">1st Half</TabsTrigger>
                <TabsTrigger value="fulltime" className="text-[11px] py-2">Full Time</TabsTrigger>
                <TabsTrigger value="specials" className="text-[11px] py-2">Specials</TabsTrigger>
              </>
            )}
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

          {isCricket && (
            <>
              <TabsContent value="ball-by-ball" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" /> Next Ball Prediction
                  </h3>
                  <Badge variant="outline" className="text-[10px]">Ball 4.3</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Predict the outcome of the next delivery</p>
                
                <div className="grid grid-cols-4 gap-2">
                  {BALL_OUTCOMES.map((outcome) => (
                    <Button
                      key={outcome.name}
                      variant="outline"
                      className={cn("h-16 flex-col gap-1 text-center", outcome.color)}
                      onClick={() => handleQuickBet(`Next Ball: ${outcome.name}`, outcome.odds)}
                      data-testid={`ball-${outcome.name.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span className="text-[10px] font-medium leading-tight">{outcome.name}</span>
                      <span className="font-bold text-sm">{outcome.odds.toFixed(2)}</span>
                    </Button>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Quick Bets</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="h-10 bg-green-500/10 hover:bg-green-500/20 text-green-400"
                      onClick={() => handleQuickBet("Boundary (4 or 6)", 2.20)}
                    >
                      Boundary @2.20
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400"
                      onClick={() => handleQuickBet("No Boundary", 1.65)}
                    >
                      No Boundary @1.65
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="over" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" /> This Over Markets
                  </h3>
                  <Badge variant="outline" className="text-[10px]">Over 5</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {OVER_MARKETS.map((market) => (
                    <Button
                      key={market.name}
                      variant="outline"
                      className="h-14 flex-col gap-0.5 bg-card hover:bg-accent"
                      onClick={() => handleQuickBet(market.name, market.odds)}
                      data-testid={`over-${market.name.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span className="text-[11px] font-medium">{market.name}</span>
                      <span className="font-bold text-primary">{market.odds.toFixed(2)}</span>
                    </Button>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-primary/20">
                  <p className="text-xs font-medium mb-2">Over/Under Runs</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      className="h-12 flex-col bg-blue-500/20 text-blue-400"
                      variant="outline"
                      onClick={() => handleQuickBet("Over 8.5 Runs", 1.85)}
                    >
                      <span className="text-xs">Over 8.5</span>
                      <span className="font-bold">1.85</span>
                    </Button>
                    <Button 
                      className="h-12 flex-col bg-pink-500/20 text-pink-400"
                      variant="outline"
                      onClick={() => handleQuickBet("Under 8.5 Runs", 1.95)}
                    >
                      <span className="text-xs">Under 8.5</span>
                      <span className="font-bold">1.95</span>
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="session" className="mt-4 space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" /> Session Markets
                </h3>
                
                <div className="space-y-2">
                  {SESSION_MARKETS.map((market) => (
                    <div 
                      key={market.name} 
                      className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{market.type}</Badge>
                        <span className="text-sm font-medium">{market.name}</span>
                      </div>
                      <Button 
                        size="sm"
                        className="h-9 px-4 bg-primary/20 hover:bg-primary/30 text-primary font-bold"
                        onClick={() => handleQuickBet(market.name, market.odds)}
                        data-testid={`session-${market.name.toLowerCase().replace(/\s/g, '-')}`}
                      >
                        {market.odds.toFixed(2)}
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </>
          )}

          {!isCricket && (
            <>
              <TabsContent value="halftime" className="mt-4 space-y-3">
                <h3 className="text-sm font-bold">1st Half Result</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-14 flex-col" onClick={() => handleQuickBet("1st Half: Home Win", 3.50)}>
                    <span className="text-xs">Home</span>
                    <span className="font-bold">3.50</span>
                  </Button>
                  <Button variant="outline" className="h-14 flex-col" onClick={() => handleQuickBet("1st Half: Draw", 2.10)}>
                    <span className="text-xs">Draw</span>
                    <span className="font-bold">2.10</span>
                  </Button>
                  <Button variant="outline" className="h-14 flex-col" onClick={() => handleQuickBet("1st Half: Away Win", 4.20)}>
                    <span className="text-xs">Away</span>
                    <span className="font-bold">4.20</span>
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="fulltime" className="mt-4">
                <p className="text-muted-foreground">Full time markets</p>
              </TabsContent>
              <TabsContent value="specials" className="mt-4">
                <p className="text-muted-foreground">Special markets</p>
              </TabsContent>
            </>
          )}
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

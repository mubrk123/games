import { AppShell } from "@/components/layout/AppShell";
import { OddsCard } from "@/components/betting/OddsCard";
import { MobileOddsCard } from "@/components/betting/MobileOddsCard";
import { BetSlip } from "@/components/betting/BetSlip";
import { MobileBetSlip } from "@/components/betting/MobileBetSlip";
import { Match, Runner } from "@/lib/store";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, ApiSport } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { matches, setMatches, currentUser } = useStore();
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedBet, setSelectedBet] = useState<{
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null>(null);
  const isMobile = useIsMobile();

  // Fetch available sports (public - no auth required)
  const { data: sportsData } = useQuery({
    queryKey: ['live-sports'],
    queryFn: async () => {
      const result = await api.getLiveSports();
      return result.sports;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch current cricket matches (live/upcoming only)
  const { data: cricketData } = useQuery({
    queryKey: ['cricket-current'],
    queryFn: async () => {
      try {
        const result = await api.getCurrentCricketMatches();
        return result.matches || [];
      } catch (error) {
        console.error('Cricket API not configured:', error);
        return [];
      }
    },
    staleTime: 60000,
    retry: 1,
  });

  // Fetch live events based on selected sport (public - no auth required)
  const { data: matchesData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['live-matches', selectedSport],
    queryFn: async () => {
      // For cricket, use the dedicated cricket API (current matches for live/upcoming)
      if (selectedSport === 'cricket' || selectedSport === 'cricket_all') {
        const result = await api.getCurrentCricketMatches();
        return result.matches || [];
      } else if (selectedSport === 'all') {
        // Combine general sports with cricket (current matches)
        const [sportsResult, cricketResult] = await Promise.all([
          api.getAllLiveEvents(),
          api.getCurrentCricketMatches().catch(() => ({ matches: [] }))
        ]);
        return [...(sportsResult.matches || []), ...(cricketResult.matches || [])];
      } else {
        const result = await api.getLiveOdds(selectedSport);
        return result.matches || [];
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
    retry: 2,
  });

  // Update store when matches change
  useEffect(() => {
    if (matchesData) {
      const formattedMatches = matchesData.map(m => ({
        ...m,
        markets: m.markets.map(market => ({
          ...market,
          runners: market.runners.map(r => ({
            ...r,
            backOdds: typeof r.backOdds === 'string' ? parseFloat(r.backOdds) : r.backOdds,
            layOdds: typeof r.layOdds === 'string' ? parseFloat(r.layOdds) : r.layOdds,
          }))
        }))
      }));
      setMatches(formattedMatches);
    }
  }, [matchesData, setMatches]);

  const handleBetSelect = (match: Match, runner: Runner, type: 'BACK' | 'LAY', odds: number) => {
    setSelectedBet({ match, runner, type, odds });
  };

  const clearBet = () => setSelectedBet(null);

  // Group sports by category
  const popularSports = sportsData?.filter(s => 
    s.key.includes('soccer') || 
    s.key.includes('basketball') || 
    s.key.includes('football') ||
    s.key.includes('cricket') ||
    s.key.includes('tennis')
  ).slice(0, 10) || [];

  return (
    <AppShell>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        {/* Main Content - Matches */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6 overflow-y-auto pr-2 pb-20">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
              <span className="w-2 h-8 bg-primary rounded-sm inline-block"></span>
              Live Sports Betting
            </h2>
            <div className="flex items-center gap-2">
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="w-[200px]" data-testid="select-sport">
                  <SelectValue placeholder="Select Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="cricket_all">All Cricket (IPL, Test, T20, ODI)</SelectItem>
                  <SelectItem value="cricket_big_bash">Cricket - Big Bash</SelectItem>
                  <SelectItem value="soccer_epl">Premier League</SelectItem>
                  <SelectItem value="soccer_spain_la_liga">La Liga</SelectItem>
                  <SelectItem value="soccer_italy_serie_a">Serie A</SelectItem>
                  <SelectItem value="basketball_nba">NBA</SelectItem>
                  <SelectItem value="basketball_ncaab">College Basketball</SelectItem>
                  <SelectItem value="americanfootball_nfl">NFL</SelectItem>
                  <SelectItem value="americanfootball_ncaaf">College Football</SelectItem>
                  <SelectItem value="icehockey_nhl">NHL</SelectItem>
                  <SelectItem value="boxing_boxing">Boxing</SelectItem>
                  <SelectItem value="mma_mixed_martial_arts">MMA/UFC</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Sport Filter Badges */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Badge 
              variant="outline" 
              className={`cursor-pointer whitespace-nowrap ${selectedSport === 'all' ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-accent'}`}
              onClick={() => setSelectedSport('all')}
            >
              All
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer whitespace-nowrap ${selectedSport === 'cricket_all' || selectedSport === 'cricket' ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-accent'}`}
              onClick={() => setSelectedSport('cricket_all')}
            >
              Cricket
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer whitespace-nowrap ${selectedSport === 'soccer_epl' ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-accent'}`}
              onClick={() => setSelectedSport('soccer_epl')}
            >
              Football
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer whitespace-nowrap ${selectedSport === 'basketball_nba' ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-accent'}`}
              onClick={() => setSelectedSport('basketball_nba')}
            >
              Basketball
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer whitespace-nowrap ${selectedSport === 'icehockey_nhl' ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-accent'}`}
              onClick={() => setSelectedSport('icehockey_nhl')}
            >
              Hockey
            </Badge>
            <Badge 
              variant="outline" 
              className={`cursor-pointer whitespace-nowrap ${selectedSport === 'americanfootball_nfl' ? 'bg-primary/20 text-primary border-primary' : 'hover:bg-accent'}`}
              onClick={() => setSelectedSport('americanfootball_nfl')}
            >
              NFL
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Loading live matches...</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue={matches.filter(m => m.status === 'LIVE').length > 0 ? "in-play" : matches.filter(m => m.status === 'FINISHED').length > 0 ? "recent" : "in-play"} className="w-full">
              <TabsList className="bg-card/50 border border-border/50 w-full justify-start overflow-x-auto">
                <TabsTrigger value="in-play" className="flex-1 sm:flex-none" data-testid="tab-inplay">
                  In-Play ({matches.filter(m => m.status === 'LIVE').length})
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="flex-1 sm:flex-none" data-testid="tab-upcoming">
                  Upcoming ({matches.filter(m => m.status === 'UPCOMING').length})
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex-1 sm:flex-none" data-testid="tab-recent">
                  Recent ({matches.filter(m => m.status === 'FINISHED').length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="in-play" className="space-y-3 mt-4">
                {matches.filter(m => m.status === 'LIVE').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                    <p className="text-lg font-medium">No live matches at the moment</p>
                    <p className="text-sm mt-2">Check the Recent tab to see finished matches</p>
                  </div>
                ) : (
                  matches.filter(m => m.status === 'LIVE').map(match => (
                    isMobile 
                      ? <MobileOddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                      : <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                  ))
                )}
              </TabsContent>
              
              <TabsContent value="upcoming" className="space-y-3 mt-4">
                {matches.filter(m => m.status === 'UPCOMING').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                    <p className="text-lg font-medium">No upcoming matches</p>
                    <p className="text-sm mt-2">Try selecting a different sport</p>
                  </div>
                ) : (
                  matches.filter(m => m.status === 'UPCOMING').map(match => (
                    isMobile 
                      ? <MobileOddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                      : <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="recent" className="space-y-3 mt-4">
                {matches.filter(m => m.status === 'FINISHED').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                    <p className="text-lg font-medium">No recent matches</p>
                    <p className="text-sm mt-2">Check back later for results</p>
                  </div>
                ) : (
                  matches.filter(m => m.status === 'FINISHED').map(match => (
                    isMobile 
                      ? <MobileOddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                      : <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Quick Casino Access */}
          <div className="mt-8">
             <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-purple-500 rounded-sm inline-block"></span>
              Top Games
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {['Teen Patti', 'Andar Bahar', 'Lucky 7', 'Roulette'].map((game, i) => (
                 <div key={i} className="aspect-video rounded-lg bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-white/10 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer group relative overflow-hidden">
                   <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors" />
                   <span className="relative z-10 font-heading text-lg font-bold tracking-widest text-shadow">{game}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Bet Slip (Desktop) */}
        <div className="hidden lg:block col-span-3">
          <div className="sticky top-24">
            <BetSlip selectedBet={selectedBet} onClear={clearBet} />
          </div>
        </div>

        {/* Mobile Bet Slip (Drawer) */}
        <Sheet open={!!selectedBet && isMobile} onOpenChange={(open) => !open && clearBet()}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
            <MobileBetSlip selectedBet={selectedBet} onClear={clearBet} />
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

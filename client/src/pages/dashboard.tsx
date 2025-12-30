import { AppShell } from "@/components/layout/AppShell";
import { OddsCard } from "@/components/betting/OddsCard";
import { BetSlip } from "@/components/betting/BetSlip";
import { Match, Runner } from "@/lib/store";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { matches, setMatches } = useStore();
  const currentUser = useStore(state => state.currentUser);
  const [selectedBet, setSelectedBet] = useState<{
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null>(null);
  const isMobile = useIsMobile();

  // Fetch matches from API
  const { data: matchesData, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const result = await api.getMatches();
      return result.matches;
    },
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
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
            backOdds: parseFloat(r.backOdds),
            layOdds: parseFloat(r.layOdds),
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

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading matches...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        {/* Main Content - Matches */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6 overflow-y-auto pr-2 pb-20">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
              <span className="w-2 h-8 bg-primary rounded-sm inline-block"></span>
              Live Highlights
            </h2>
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer whitespace-nowrap">Cricket</Badge>
              <Badge variant="outline" className="hover:bg-accent cursor-pointer whitespace-nowrap">Football</Badge>
              <Badge variant="outline" className="hover:bg-accent cursor-pointer whitespace-nowrap">Tennis</Badge>
            </div>
          </div>

          <Tabs defaultValue="in-play" className="w-full">
            <TabsList className="bg-card/50 border border-border/50 w-full justify-start overflow-x-auto">
              <TabsTrigger value="in-play" className="flex-1 sm:flex-none">In-Play</TabsTrigger>
              <TabsTrigger value="upcoming" className="flex-1 sm:flex-none">Upcoming</TabsTrigger>
              <TabsTrigger value="popular" className="flex-1 sm:flex-none">Popular</TabsTrigger>
            </TabsList>
            
            <TabsContent value="in-play" className="space-y-4 mt-4">
              {matches.filter(m => m.status === 'LIVE').length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No live matches at the moment
                </div>
              ) : (
                matches.filter(m => m.status === 'LIVE').map(match => (
                  <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {matches.filter(m => m.status === 'UPCOMING').length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No upcoming matches
                </div>
              ) : (
                matches.filter(m => m.status === 'UPCOMING').map(match => (
                  <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
                ))
              )}
            </TabsContent>
          </Tabs>

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
          <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
             <div className="h-full pt-6">
                <BetSlip selectedBet={selectedBet} onClear={clearBet} />
             </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}

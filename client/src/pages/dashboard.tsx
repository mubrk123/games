import { AppShell } from "@/components/layout/AppShell";
import { OddsCard } from "@/components/betting/OddsCard";
import { BetSlip } from "@/components/betting/BetSlip";
import { Match, Runner } from "@/lib/mockData";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export default function Dashboard() {
  const matches = useStore(state => state.matches);
  const [selectedBet, setSelectedBet] = useState<{
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null>(null);

  const handleBetSelect = (match: Match, runner: Runner, type: 'BACK' | 'LAY', odds: number) => {
    setSelectedBet({ match, runner, type, odds });
  };

  return (
    <AppShell>
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-8rem)]">
        {/* Main Content - Matches */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6 overflow-y-auto pr-2 pb-20">
          
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-heading font-bold flex items-center gap-2">
              <span className="w-2 h-8 bg-primary rounded-sm inline-block"></span>
              Live Highlights
            </h2>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 cursor-pointer">Cricket</Badge>
              <Badge variant="outline" className="hover:bg-accent cursor-pointer">Football</Badge>
              <Badge variant="outline" className="hover:bg-accent cursor-pointer">Tennis</Badge>
            </div>
          </div>

          <Tabs defaultValue="in-play" className="w-full">
            <TabsList className="bg-card/50 border border-border/50">
              <TabsTrigger value="in-play">In-Play</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
            </TabsList>
            
            <TabsContent value="in-play" className="space-y-4 mt-4">
              {matches.filter(m => m.status === 'LIVE').map(match => (
                <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
              ))}
            </TabsContent>
            
            <TabsContent value="upcoming" className="space-y-4 mt-4">
              {matches.filter(m => m.status === 'UPCOMING').map(match => (
                <OddsCard key={match.id} matchId={match.id} onBetSelect={handleBetSelect} />
              ))}
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

        {/* Right Sidebar - Bet Slip */}
        <div className="hidden lg:block col-span-3">
          <div className="sticky top-24">
            <BetSlip selectedBet={selectedBet} onClear={() => setSelectedBet(null)} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

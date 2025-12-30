import { Match, Runner } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { Clock, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { socketService } from "@/lib/mockData";

interface OddsCardProps {
  match: Match;
  onBetSelect: (match: Match, runner: Runner, type: 'BACK' | 'LAY', odds: number) => void;
}

export function OddsCard({ match, onBetSelect }: OddsCardProps) {
  const [currentMatch, setCurrentMatch] = useState(match);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to simulated odds updates
    const unsubscribe = socketService.on('odds_update', (data: any) => {
      if (data.matchId === match.id) {
        setCurrentMatch(prev => ({
          ...prev,
          markets: prev.markets.map(m => {
            if (m.id === data.marketId) {
              return {
                ...m,
                runners: m.runners.map(r => {
                  if (r.id === data.runnerId) {
                    return { ...r, backOdds: data.newBack, layOdds: data.newLay };
                  }
                  return r;
                })
              };
            }
            return m;
          })
        }));
        setLastUpdate(data.runnerId);
        setTimeout(() => setLastUpdate(null), 500);
      }
    });
    return unsubscribe;
  }, [match.id]);

  const mainMarket = currentMatch.markets[0];

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden hover:border-primary/20 transition-colors shadow-sm">
      <div className="p-3 bg-muted/30 border-b flex justify-between items-center text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {match.status === 'LIVE' ? (
            <span className="flex items-center gap-1.5 text-primary font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(match.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          )}
          <span className="w-px h-3 bg-border mx-1" />
          <span className="uppercase tracking-wider">{match.league}</span>
        </div>
        {match.status === 'LIVE' && <Tv className="w-4 h-4 text-muted-foreground/50" />}
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* Teams Section */}
        <div className="col-span-12 md:col-span-6 p-4 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border/50">
          <div className="flex justify-between items-center mb-2">
            <span className="font-heading text-lg font-medium">{match.homeTeam}</span>
            {match.score && <span className="font-mono font-bold text-primary">{match.score.home}</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="font-heading text-lg font-medium">{match.awayTeam}</span>
            {match.score && <span className="font-mono font-bold text-primary">{match.score.away}</span>}
          </div>
          {match.score?.details && (
            <div className="mt-2 text-xs text-muted-foreground font-mono">{match.score.details}</div>
          )}
        </div>

        {/* Odds Section */}
        <div className="col-span-12 md:col-span-6 p-2 bg-card/50 flex items-center">
          <div className="w-full grid grid-rows-3 gap-1">
            {/* Headers */}
            <div className="grid grid-cols-3 text-center text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 px-1">
              <div className="text-left pl-2">Selection</div>
              <div className="text-blue-400">Back</div>
              <div className="text-pink-400">Lay</div>
            </div>
            
            {/* Runners */}
            {mainMarket.runners.map(runner => (
              <div key={runner.id} className="grid grid-cols-3 gap-1 items-center">
                <div className="text-sm font-medium truncate px-2">{runner.name}</div>
                
                <Button 
                  variant="ghost" 
                  className={cn(
                    "h-10 rounded-sm flex flex-col items-center justify-center gap-0.5 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 hover:border-blue-500/50 transition-all p-0",
                    lastUpdate === runner.id && "bg-blue-500/40 ring-1 ring-blue-500"
                  )}
                  onClick={() => onBetSelect(currentMatch, runner, 'BACK', runner.backOdds)}
                >
                  <span className="font-bold text-blue-400 text-sm">{runner.backOdds.toFixed(2)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{(runner.volume / 1000).toFixed(1)}k</span>
                </Button>

                <Button 
                  variant="ghost" 
                  className={cn(
                    "h-10 rounded-sm flex flex-col items-center justify-center gap-0.5 bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 hover:border-pink-500/50 transition-all p-0",
                    lastUpdate === runner.id && "bg-pink-500/40 ring-1 ring-pink-500"
                  )}
                  onClick={() => onBetSelect(currentMatch, runner, 'LAY', runner.layOdds)}
                >
                  <span className="font-bold text-pink-400 text-sm">{runner.layOdds.toFixed(2)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{(runner.volume / 1200).toFixed(1)}k</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

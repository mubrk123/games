import { Match, Runner } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Clock, ChevronRight, Zap, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, InstanceMarket, InstanceOutcome } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface MobileOddsCardProps {
  matchId: string;
  onBetSelect: (match: Match, runner: Runner, type: 'BACK' | 'LAY', odds: number) => void;
  onInstanceBetSelect?: (market: InstanceMarket, outcome: InstanceOutcome, matchId: string) => void;
}

export function MobileOddsCard({ matchId, onBetSelect, onInstanceBetSelect }: MobileOddsCardProps) {
  const match = useStore(state => state.matches.find(m => m.id === matchId));
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const { data: instanceData } = useQuery({
    queryKey: ['instance-markets', matchId],
    queryFn: () => api.getInstanceMarkets(matchId, match?.sport || 'cricket', match?.homeTeam, match?.awayTeam),
    refetchInterval: 30000,
    staleTime: 20000,
    enabled: !!match && match.status === 'LIVE' && match.sport === 'cricket',
  });

  const instanceMarkets = instanceData?.markets || [];

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      const prevMatch = prevState.matches.find(m => m.id === matchId);
      const currMatch = state.matches.find(m => m.id === matchId);
      
      if (prevMatch && currMatch && currMatch.markets[0]) {
        currMatch.markets[0].runners.forEach((runner, idx) => {
          const prevRunner = prevMatch.markets[0]?.runners[idx];
          if (prevRunner && (runner.backOdds !== prevRunner.backOdds || runner.layOdds !== prevRunner.layOdds)) {
            setLastUpdate(runner.id);
            setTimeout(() => setLastUpdate(null), 500);
          }
        });
      }
    });
    return unsubscribe;
  }, [matchId]);

  const getTimeRemaining = (closeTime: string) => {
    const remaining = new Date(closeTime).getTime() - Date.now();
    if (remaining <= 0) return 'Closed';
    const seconds = Math.floor(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  if (!match) return null;

  const mainMarket = match.markets[0];
  if (!mainMarket) return null;

  const score = match.scoreHome && match.scoreAway ? {
    home: match.scoreHome,
    away: match.scoreAway,
    details: match.scoreDetails
  } : undefined;

  const isCricket = match.sport === 'cricket';

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-sm active:scale-[0.99] transition-transform">
        <CollapsibleTrigger className="w-full text-left">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {match.status === 'LIVE' ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" /> 
                    {new Date(match.startTime).toLocaleDateString([], {month: 'short', day: 'numeric'})} 
                    {' '}
                    {new Date(match.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  {match.league}
                </span>
              </div>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{match.homeTeam}</span>
                {score && <span className="font-mono font-bold text-primary text-sm">{score.home}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{match.awayTeam}</span>
                {score && <span className="font-mono font-bold text-primary text-sm">{score.away}</span>}
              </div>
              {score?.details && (
                <p className="text-[11px] text-muted-foreground mt-1">{score.details}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 px-2 pb-2">
            {mainMarket.runners.slice(0, 2).map(runner => (
              <div key={runner.id} className="grid grid-cols-2 gap-1">
                <Button 
                  data-testid={`button-back-${runner.id}`}
                  variant="ghost" 
                  className={cn(
                    "h-12 rounded-lg flex flex-col items-center justify-center gap-0 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 p-1",
                    lastUpdate === runner.id && "ring-2 ring-blue-500 bg-blue-500/30"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBetSelect(match, runner, 'BACK', runner.backOdds);
                  }}
                >
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">{runner.name.split(' ')[0]}</span>
                  <span className="font-bold text-blue-400 text-base">{runner.backOdds.toFixed(2)}</span>
                </Button>

                <Button 
                  data-testid={`button-lay-${runner.id}`}
                  variant="ghost" 
                  className={cn(
                    "h-12 rounded-lg flex flex-col items-center justify-center gap-0 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 p-1",
                    lastUpdate === runner.id && "ring-2 ring-pink-500 bg-pink-500/30"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBetSelect(match, runner, 'LAY', runner.layOdds);
                  }}
                >
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">{runner.name.split(' ')[0]}</span>
                  <span className="font-bold text-pink-400 text-base">{runner.layOdds.toFixed(2)}</span>
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 p-3 space-y-3 bg-muted/20">
            {isCricket && match.status === 'LIVE' && instanceMarkets.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-yellow-500" /> Quick Instance Betting
                </h4>
                {instanceMarkets.slice(0, 2).map((market) => (
                  <div key={market.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{market.name}</span>
                      <Badge variant="outline" className="text-[9px] bg-green-500/20 text-green-400 border-green-500/30">
                        {getTimeRemaining(market.closeTime)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {market.outcomes.slice(0, 4).map((outcome) => (
                        <Button 
                          key={outcome.id}
                          variant="ghost" 
                          size="sm"
                          disabled={market.status !== 'OPEN'}
                          className="h-12 text-[10px] font-bold bg-gradient-to-b from-primary/20 to-primary/5 border border-primary/20 flex flex-col gap-0.5"
                          data-testid={`quick-instance-${outcome.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/match/${match.id}`);
                          }}
                        >
                          <span className="truncate w-full">{outcome.name}</span>
                          <span className="text-primary font-bold">{outcome.odds.toFixed(2)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {isCricket && match.status === 'LIVE' && instanceMarkets.length === 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-yellow-500" /> Quick Instance Betting
                </h4>
                <div className="text-center py-3 text-xs text-muted-foreground">
                  Loading instance markets...
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> All Selections
              </h4>
              <div className="space-y-1">
                {mainMarket.runners.map(runner => (
                  <div key={runner.id} className="flex items-center gap-2 p-2 rounded-lg bg-card">
                    <span className="flex-1 text-sm font-medium truncate">{runner.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold"
                      onClick={() => onBetSelect(match, runner, 'BACK', runner.backOdds)}
                    >
                      {runner.backOdds.toFixed(2)}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 px-3 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 font-bold"
                      onClick={() => onBetSelect(match, runner, 'LAY', runner.layOdds)}
                    >
                      {runner.layOdds.toFixed(2)}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Link href={`/match/${match.id}`}>
              <Button 
                variant="outline" 
                className="w-full h-10 text-xs font-medium gap-2"
                data-testid={`view-all-markets-${match.id}`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View All Markets
              </Button>
            </Link>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

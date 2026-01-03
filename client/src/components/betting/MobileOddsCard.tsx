import { Match, Runner } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Clock, ChevronRight, Zap, TrendingUp, ExternalLink, AlertTriangle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api, InstanceMarket, InstanceOutcome } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { wsClient } from "@/lib/websocket";
import { motion, AnimatePresence } from "framer-motion";

interface MobileOddsCardProps {
  matchId: string;
  onBetSelect: (match: Match, runner: Runner, type: 'BACK' | 'LAY', odds: number) => void;
  onInstanceBetSelect?: (market: InstanceMarket, outcome: InstanceOutcome, matchId: string) => void;
}

export function MobileOddsCard({ matchId, onBetSelect, onInstanceBetSelect }: MobileOddsCardProps) {
  const match = useStore(state => state.matches.find(m => m.id === matchId));
  const [isExpanded, setIsExpanded] = useState(false);
  const [blinkingOdds, setBlinkingOdds] = useState<Record<string, 'up' | 'down' | null>>({});
  const [marketSuspended, setMarketSuspended] = useState(false);
  const [liveScore, setLiveScore] = useState<{ home?: string; away?: string; details?: string } | null>(null);
  const prevOddsRef = useRef<Record<string, { back: number; lay: number }>>({});
  const [, navigate] = useLocation();

  const { data: instanceData, refetch: refetchInstance } = useQuery({
    queryKey: ['instance-markets', matchId],
    queryFn: () => api.getInstanceMarkets(matchId, match?.sport || 'cricket', match?.homeTeam, match?.awayTeam),
    refetchInterval: 15000,
    staleTime: 10000,
    enabled: !!match && match.status === 'LIVE' && match.sport === 'cricket',
  });

  const instanceMarkets = instanceData?.markets || [];

  useEffect(() => {
    if (match?.status === 'LIVE') {
      wsClient.connect();
      wsClient.subscribeToMatch(matchId);

      const unsubScore = wsClient.on('match:score', (data: any) => {
        if (data.matchId === matchId) {
          setLiveScore({ home: data.scoreHome, away: data.scoreAway, details: data.scoreDetails });
          if (data.marketsSuspended !== undefined) {
            setMarketSuspended(data.marketsSuspended);
          }
        }
      });

      const unsubMarket = wsClient.on('markets:update', (data: any) => {
        if (data.matchId === matchId) {
          setMarketSuspended(data.status === 'SUSPENDED');
          if (data.status === 'OPEN') {
            refetchInstance();
          }
        }
      });

      return () => {
        unsubScore();
        unsubMarket();
        wsClient.unsubscribeFromMatch(matchId);
      };
    }
  }, [matchId, match?.status, refetchInstance]);

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      const currMatch = state.matches.find(m => m.id === matchId);
      
      if (currMatch && currMatch.markets[0]) {
        const newBlinking: Record<string, 'up' | 'down' | null> = {};
        
        currMatch.markets[0].runners.forEach((runner) => {
          const prevOdds = prevOddsRef.current[runner.id];
          if (prevOdds) {
            if (runner.backOdds > prevOdds.back || runner.layOdds > prevOdds.lay) {
              newBlinking[runner.id] = 'up';
            } else if (runner.backOdds < prevOdds.back || runner.layOdds < prevOdds.lay) {
              newBlinking[runner.id] = 'down';
            }
          }
          prevOddsRef.current[runner.id] = { back: runner.backOdds, lay: runner.layOdds };
        });
        
        if (Object.keys(newBlinking).length > 0) {
          setBlinkingOdds(newBlinking);
          setTimeout(() => setBlinkingOdds({}), 800);
        }
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

  const displayScore = liveScore || (match.scoreHome && match.scoreAway ? {
    home: match.scoreHome,
    away: match.scoreAway,
    details: match.scoreDetails
  } : undefined);
  
  const isMarketOpen = mainMarket?.status === 'OPEN' && !marketSuspended;

  const isCricket = match.sport === 'cricket';

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <CollapsibleTrigger asChild>
          <div className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {match.status === 'LIVE' ? (
                  <motion.span 
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold"
                    animate={{ boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 8px 2px rgba(239,68,68,0.5)', '0 0 0 0 rgba(239,68,68,0)'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Activity className="w-3 h-3 animate-pulse" /> LIVE
                  </motion.span>
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
                {displayScore?.home && (
                  <motion.span 
                    key={displayScore.home}
                    initial={{ scale: 1.2, color: '#22c55e' }}
                    animate={{ scale: 1, color: 'var(--primary)' }}
                    className="font-mono font-bold text-primary text-sm"
                  >
                    {displayScore.home}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{match.awayTeam}</span>
                {displayScore?.away && (
                  <motion.span 
                    key={displayScore.away}
                    initial={{ scale: 1.2, color: '#22c55e' }}
                    animate={{ scale: 1, color: 'var(--primary)' }}
                    className="font-mono font-bold text-primary text-sm"
                  >
                    {displayScore.away}
                  </motion.span>
                )}
              </div>
              {displayScore?.details && (
                <motion.p 
                  key={displayScore.details}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-muted-foreground mt-1"
                >
                  {displayScore.details}
                </motion.p>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {marketSuspended && (
          <div className="mx-2 mb-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
            <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />
            <span className="text-xs font-bold text-yellow-500">MARKET SUSPENDED</span>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          {mainMarket.runners.slice(0, 2).map(runner => {
            const blinkState = blinkingOdds[runner.id];
            return (
              <div key={runner.id} className="grid grid-cols-2 gap-1">
                <motion.div
                  animate={blinkState === 'up' ? { scale: [1, 1.05, 1], backgroundColor: ['rgba(59,130,246,0.1)', 'rgba(34,197,94,0.4)', 'rgba(59,130,246,0.1)'] } : 
                           blinkState === 'down' ? { scale: [1, 1.05, 1], backgroundColor: ['rgba(59,130,246,0.1)', 'rgba(239,68,68,0.4)', 'rgba(59,130,246,0.1)'] } : {}}
                  transition={{ duration: 0.6 }}
                >
                  <Button 
                    data-testid={`button-back-${runner.id}`}
                    variant="ghost" 
                    disabled={!isMarketOpen}
                    className={cn(
                      "h-12 w-full rounded-lg flex flex-col items-center justify-center gap-0 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 p-1 transition-all",
                      blinkState === 'up' && "ring-2 ring-green-500 shadow-green-500/50 shadow-lg",
                      blinkState === 'down' && "ring-2 ring-red-500 shadow-red-500/50 shadow-lg",
                      !isMarketOpen && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMarketOpen) onBetSelect(match, runner, 'BACK', runner.backOdds);
                    }}
                  >
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{runner.name.split(' ')[0]}</span>
                    <motion.span 
                      key={runner.backOdds}
                      initial={blinkState ? { scale: 1.3 } : false}
                      animate={{ scale: 1 }}
                      className={cn(
                        "font-bold text-base transition-colors",
                        blinkState === 'up' ? "text-green-400" : blinkState === 'down' ? "text-red-400" : "text-blue-400"
                      )}
                    >
                      {runner.backOdds.toFixed(2)}
                    </motion.span>
                  </Button>
                </motion.div>

                <motion.div
                  animate={blinkState === 'up' ? { scale: [1, 1.05, 1], backgroundColor: ['rgba(236,72,153,0.1)', 'rgba(34,197,94,0.4)', 'rgba(236,72,153,0.1)'] } : 
                           blinkState === 'down' ? { scale: [1, 1.05, 1], backgroundColor: ['rgba(236,72,153,0.1)', 'rgba(239,68,68,0.4)', 'rgba(236,72,153,0.1)'] } : {}}
                  transition={{ duration: 0.6 }}
                >
                  <Button 
                    data-testid={`button-lay-${runner.id}`}
                    variant="ghost" 
                    disabled={!isMarketOpen}
                    className={cn(
                      "h-12 w-full rounded-lg flex flex-col items-center justify-center gap-0 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 p-1 transition-all",
                      blinkState === 'up' && "ring-2 ring-green-500 shadow-green-500/50 shadow-lg",
                      blinkState === 'down' && "ring-2 ring-red-500 shadow-red-500/50 shadow-lg",
                      !isMarketOpen && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMarketOpen) onBetSelect(match, runner, 'LAY', runner.layOdds);
                    }}
                  >
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{runner.name.split(' ')[0]}</span>
                    <motion.span 
                      key={runner.layOdds}
                      initial={blinkState ? { scale: 1.3 } : false}
                      animate={{ scale: 1 }}
                      className={cn(
                        "font-bold text-base transition-colors",
                        blinkState === 'up' ? "text-green-400" : blinkState === 'down' ? "text-red-400" : "text-pink-400"
                      )}
                    >
                      {runner.layOdds.toFixed(2)}
                    </motion.span>
                  </Button>
                </motion.div>
              </div>
            );
          })}
        </div>

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

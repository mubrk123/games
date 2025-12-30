import { useState, useEffect } from "react";
import { Match, Runner, Bet } from "@/lib/store";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface BetSlipProps {
  selectedBet: {
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null;
  onClear: () => void;
}

export function BetSlip({ selectedBet, onClear }: BetSlipProps) {
  const [stake, setStake] = useState<string>('');
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's bets
  const { data: betsData } = useQuery({
    queryKey: ['user-bets'],
    queryFn: async () => {
      const result = await api.getUserBets();
      return result.bets;
    },
    refetchInterval: 5000, // Refetch every 5 seconds
    enabled: !!currentUser,
  });

  const userBets: Bet[] = betsData ? betsData.map(b => ({
    ...b,
    odds: parseFloat(b.odds),
    stake: parseFloat(b.stake),
    potentialProfit: parseFloat(b.potentialProfit)
  })) : [];

  // Place bet mutation
  const placeBetMutation = useMutation({
    mutationFn: async (data: { matchId: string, marketId: string, runnerId: string, type: 'BACK' | 'LAY', odds: string, stake: string }) => {
      return await api.placeBet(data);
    },
    onSuccess: async () => {
      // Refetch user data to update balance
      const { user } = await api.getCurrentUser();
      setCurrentUser({
        id: user.id,
        username: user.username,
        role: user.role,
        balance: parseFloat(user.balance),
        exposure: parseFloat(user.exposure),
        currency: user.currency
      });
      
      // Refetch bets
      queryClient.invalidateQueries({ queryKey: ['user-bets'] });
      
      onClear();
      
      toast({
        title: "Bet Placed Successfully",
        description: `Matched at ${selectedBet?.odds}`,
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Bet Failed",
        description: error.message || "Failed to place bet",
        variant: "destructive"
      });
    }
  });

  // Reset stake when selection changes
  useEffect(() => {
    if (selectedBet) {
      setStake('');
    }
  }, [selectedBet]);

  const handlePlaceBet = () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please login to place bets", variant: "destructive" });
      return;
    }
    if (!selectedBet || !stake) return;
    
    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) return;

    // Check balance
    // For BACK: stake must be <= balance
    // For LAY: liability (stake * (odds - 1)) must be <= balance (simplified)
    const liability = selectedBet.type === 'LAY' ? (stakeAmount * (selectedBet.odds - 1)) : 0;
    const requiredAmount = selectedBet.type === 'BACK' ? stakeAmount : liability;

    if (requiredAmount > currentUser.balance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${currentUser.currency} ${requiredAmount.toFixed(2)}`,
        variant: "destructive"
      });
      return;
    }

    placeBetMutation.mutate({
      matchId: selectedBet.match.id,
      marketId: selectedBet.match.markets[0].id,
      runnerId: selectedBet.runner.id,
      type: selectedBet.type,
      odds: selectedBet.odds.toString(),
      stake: stakeAmount.toString()
    });
  };

  const potentialProfit = selectedBet && stake ? ((parseFloat(stake) * selectedBet.odds) - parseFloat(stake)) : 0;
  const liability = selectedBet?.type === 'LAY' && stake ? (parseFloat(stake) * (selectedBet.odds - 1)) : 0;

  return (
    <Card className="h-full border-none shadow-none bg-transparent flex flex-col">
      <Tabs defaultValue="slip" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="slip" data-testid="tab-betslip">Bet Slip {selectedBet && <span className="ml-2 w-2 h-2 rounded-full bg-primary animate-pulse" />}</TabsTrigger>
          <TabsTrigger value="open" data-testid="tab-mybets">My Bets ({userBets.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="slip" className="flex-1 flex flex-col gap-4 mt-4">
          {selectedBet ? (
            <div className={cn(
              "rounded-lg border p-4 shadow-lg animate-in fade-in slide-in-from-right-4 duration-300",
              selectedBet.type === 'BACK' ? "bg-blue-500/5 border-blue-500/20" : "bg-pink-500/5 border-pink-500/20"
            )}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className={cn("text-xs font-bold px-1.5 py-0.5 rounded inline-block mb-1", 
                    selectedBet.type === 'BACK' ? "bg-blue-500 text-white" : "bg-pink-500 text-white"
                  )}>
                    {selectedBet.type}
                  </div>
                  <h3 className="font-heading text-lg leading-tight">{selectedBet.runner.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{selectedBet.match.markets[0].name}</p>
                  <p className="text-xs text-muted-foreground">{selectedBet.match.homeTeam} vs {selectedBet.match.awayTeam}</p>
                </div>
                <Button data-testid="button-clear-bet" variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Odds</label>
                    <div className="h-10 flex items-center justify-center bg-card rounded border border-input font-mono font-bold text-lg" data-testid="text-odds">
                      {selectedBet.odds.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Stake</label>
                    <Input 
                      data-testid="input-stake"
                      type="number" 
                      placeholder="Amount" 
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      className="font-mono text-lg font-bold"
                    />
                  </div>
                </div>

                <div className="bg-card/50 rounded p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit:</span>
                    <span className="font-mono font-bold text-primary" data-testid="text-profit">{potentialProfit > 0 ? potentialProfit.toFixed(2) : '--'}</span>
                  </div>
                  {selectedBet.type === 'LAY' && (
                     <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Liability:</span>
                     <span className="font-mono font-bold text-destructive" data-testid="text-liability">{liability > 0 ? liability.toFixed(2) : '--'}</span>
                   </div>
                  )}
                </div>

                <Button 
                  data-testid="button-place-bet"
                  className="w-full font-bold uppercase tracking-wider h-12 text-md" 
                  onClick={handlePlaceBet} 
                  disabled={!currentUser || placeBetMutation.isPending}
                >
                  {placeBetMutation.isPending ? 'Placing...' : currentUser ? 'Place Bet' : 'Login to Bet'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 border-2 border-dashed border-border rounded-lg m-1">
              <ArrowRight className="h-8 w-8 mb-2" />
              <p className="text-sm font-medium">Click on odds to add selection</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="open" className="flex-1 mt-4 overflow-auto">
          {userBets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No open bets</div>
          ) : (
            <div className="space-y-3">
              {userBets.map(bet => (
                <div key={bet.id} className="bg-card border border-border rounded p-3 text-sm" data-testid={`bet-${bet.id}`}>
                  <div className="flex justify-between mb-1">
                    <span className={cn("font-bold text-xs px-1.5 py-0.5 rounded", bet.type === 'BACK' ? "bg-blue-500 text-white" : "bg-pink-500 text-white")}>
                      {bet.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(bet.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="font-medium mb-2">Odds: {bet.odds.toFixed(2)}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Stake: {bet.stake.toFixed(2)}</span>
                    <span className="text-primary">Profit: {bet.potentialProfit.toFixed(2)}</span>
                  </div>
                  <div className={cn("text-xs mt-2 px-2 py-1 rounded text-center", 
                    bet.status === 'WON' ? "bg-green-500/20 text-green-500" : 
                    bet.status === 'LOST' ? "bg-red-500/20 text-red-500" : "bg-yellow-500/20 text-yellow-500"
                  )}>
                    {bet.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

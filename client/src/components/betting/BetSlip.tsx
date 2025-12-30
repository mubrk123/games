import { useState, useEffect } from "react";
import { Match, Runner, Bet } from "@/lib/mockData";
import { useUser } from "@/lib/userContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [bets, setBets] = useState<Bet[]>([]);
  const { toast } = useToast();
  const { user, updateBalance } = useUser();

  // Reset stake when selection changes
  useEffect(() => {
    if (selectedBet) {
      setStake('');
    }
  }, [selectedBet]);

  const handlePlaceBet = () => {
    if (!selectedBet || !stake) return;
    
    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount <= 0) return;

    if (stakeAmount > user.balance) {
      toast({
        title: "Insufficient Balance",
        description: "Please add funds to your wallet.",
        variant: "destructive"
      });
      return;
    }

    const profit = selectedBet.type === 'BACK' 
      ? (stakeAmount * selectedBet.odds) - stakeAmount 
      : stakeAmount; // Simplified Lay calc for demo

    const newBet: Bet = {
      id: Math.random().toString(),
      matchId: selectedBet.match.id,
      matchName: `${selectedBet.match.homeTeam} v ${selectedBet.match.awayTeam}`,
      marketName: selectedBet.match.markets[0].name,
      selectionName: selectedBet.runner.name,
      type: selectedBet.type,
      odds: selectedBet.odds,
      stake: stakeAmount,
      potentialProfit: profit,
      status: 'OPEN',
      timestamp: new Date()
    };

    setBets([newBet, ...bets]);
    updateBalance(-stakeAmount); // Deduct from wallet immediately for demo
    onClear();
    
    toast({
      title: "Bet Placed Successfully",
      description: `Matched at ${selectedBet.odds}`,
      className: "bg-green-600 text-white border-none"
    });
  };

  const potentialProfit = selectedBet && stake ? ((parseFloat(stake) * selectedBet.odds) - parseFloat(stake)) : 0;
  const liability = selectedBet?.type === 'LAY' && stake ? (parseFloat(stake) * (selectedBet.odds - 1)) : 0;

  return (
    <Card className="h-full border-none shadow-none bg-transparent flex flex-col">
      <Tabs defaultValue="slip" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="slip">Bet Slip {selectedBet && <span className="ml-2 w-2 h-2 rounded-full bg-primary animate-pulse" />}</TabsTrigger>
          <TabsTrigger value="open">Open Bets ({bets.length})</TabsTrigger>
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
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Odds</label>
                    <div className="h-10 flex items-center justify-center bg-card rounded border border-input font-mono font-bold text-lg">
                      {selectedBet.odds.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[10px] uppercase text-muted-foreground font-bold">Stake</label>
                    <Input 
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
                    <span className="font-mono font-bold text-primary">{potentialProfit > 0 ? potentialProfit.toFixed(2) : '--'}</span>
                  </div>
                  {selectedBet.type === 'LAY' && (
                     <div className="flex justify-between text-sm">
                     <span className="text-muted-foreground">Liability:</span>
                     <span className="font-mono font-bold text-destructive">{liability > 0 ? liability.toFixed(2) : '--'}</span>
                   </div>
                  )}
                </div>

                <Button className="w-full font-bold uppercase tracking-wider h-12 text-md" onClick={handlePlaceBet}>
                  Place Bet
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
          {bets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No open bets</div>
          ) : (
            <div className="space-y-3">
              {bets.map(bet => (
                <div key={bet.id} className="bg-card border border-border rounded p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold">{bet.selectionName}</span>
                    <span className={cn("text-xs font-bold px-1 rounded", bet.type === 'BACK' ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400")}>{bet.type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{bet.matchName}</div>
                  <div className="flex justify-between items-center bg-background/50 p-2 rounded">
                    <div className="text-xs">
                      <div>Odds: <span className="font-mono font-bold">{bet.odds}</span></div>
                      <div>Stake: <span className="font-mono">{bet.stake}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Profit</div>
                      <div className="font-mono font-bold text-primary">{bet.potentialProfit.toFixed(2)}</div>
                    </div>
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

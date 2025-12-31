import { Match, Runner, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Minus, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface MobileBetSlipProps {
  selectedBet: {
    match: Match;
    runner: Runner;
    type: 'BACK' | 'LAY';
    odds: number;
  } | null;
  onClear: () => void;
}

const QUICK_STAKES = [100, 500, 1000, 2000, 5000];

export function MobileBetSlip({ selectedBet, onClear }: MobileBetSlipProps) {
  const [stake, setStake] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();

  if (!selectedBet) return null;

  const stakeNum = parseFloat(stake) || 0;
  const potentialProfit = selectedBet.type === 'BACK' 
    ? stakeNum * (selectedBet.odds - 1)
    : stakeNum;
  const liability = selectedBet.type === 'LAY' 
    ? stakeNum * (selectedBet.odds - 1)
    : stakeNum;

  const adjustStake = (amount: number) => {
    const newStake = Math.max(0, stakeNum + amount);
    setStake(newStake.toString());
  };

  const isSyntheticRunner = selectedBet.runner.id.startsWith('quick-');

  const handlePlaceBet = async () => {
    if (!currentUser) {
      toast({ title: "Please login", description: "You need to login to place bets", variant: "destructive" });
      return;
    }

    if (stakeNum <= 0) {
      toast({ title: "Invalid stake", description: "Please enter a valid stake amount", variant: "destructive" });
      return;
    }

    if (isSyntheticRunner) {
      toast({ 
        title: "Quick Bet Placed!", 
        description: `${selectedBet.type} ${selectedBet.runner.name} @ ${selectedBet.odds.toFixed(2)} - This is a simulation. Live quick bets coming soon!`,
      });
      onClear();
      return;
    }

    setIsSubmitting(true);
    try {
      await api.placeBet({
        matchId: selectedBet.match.id,
        marketId: selectedBet.match.markets[0].id,
        runnerId: selectedBet.runner.id,
        type: selectedBet.type,
        odds: selectedBet.odds.toString(),
        stake: stake,
      });

      toast({ 
        title: "Bet Placed!", 
        description: `${selectedBet.type} ${selectedBet.runner.name} @ ${selectedBet.odds.toFixed(2)}`,
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
      onClear();
    } catch (error: any) {
      toast({ title: "Failed to place bet", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-bold text-lg">Bet Slip</h3>
        <Button variant="ghost" size="icon" onClick={onClear}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className={cn(
          "p-4 rounded-xl border-2",
          selectedBet.type === 'BACK' ? "bg-blue-500/10 border-blue-500/30" : "bg-pink-500/10 border-pink-500/30"
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className={cn(
              "text-xs font-bold uppercase px-2 py-0.5 rounded",
              selectedBet.type === 'BACK' ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"
            )}>
              {selectedBet.type}
            </span>
            <span className="font-mono font-bold text-lg">
              @{selectedBet.odds.toFixed(2)}
            </span>
          </div>
          <p className="font-medium">{selectedBet.runner.name}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedBet.match.homeTeam} vs {selectedBet.match.awayTeam}
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Stake Amount</label>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="h-12 w-12 rounded-xl"
              onClick={() => adjustStake(-100)}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="h-12 text-center text-xl font-bold rounded-xl"
              data-testid="input-stake"
            />
            <Button 
              variant="outline" 
              size="icon"
              className="h-12 w-12 rounded-xl"
              onClick={() => adjustStake(100)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {QUICK_STAKES.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                className="flex-1 min-w-[60px] h-10 rounded-lg font-bold"
                onClick={() => setStake(amount.toString())}
                data-testid={`quick-stake-${amount}`}
              >
                {amount >= 1000 ? `${amount/1000}K` : amount}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 p-4 rounded-xl bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stake</span>
            <span className="font-mono font-medium">{currentUser?.currency || '₹'} {stakeNum.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {selectedBet.type === 'BACK' ? 'Potential Profit' : 'Liability'}
            </span>
            <span className={cn(
              "font-mono font-bold",
              selectedBet.type === 'BACK' ? "text-green-500" : "text-red-500"
            )}>
              {selectedBet.type === 'BACK' ? '+' : '-'}{currentUser?.currency || '₹'} {potentialProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border bg-card">
        <Button 
          className={cn(
            "w-full h-14 text-lg font-bold rounded-xl",
            selectedBet.type === 'BACK' 
              ? "bg-blue-600 hover:bg-blue-700" 
              : "bg-pink-600 hover:bg-pink-700"
          )}
          onClick={handlePlaceBet}
          disabled={isSubmitting || stakeNum <= 0}
          data-testid="button-place-bet"
        >
          <Zap className="h-5 w-5 mr-2" />
          {isSubmitting ? 'Placing Bet...' : `Place ${selectedBet.type} Bet`}
        </Button>
      </div>
    </div>
  );
}

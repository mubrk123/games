import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUICK_BETS = [10, 50, 100, 500, 1000];

export default function Lucky7Game() {
  const [betAmount, setBetAmount] = useState('100');
  const [bet, setBet] = useState<'low' | 'seven' | 'high'>('high');
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<{
    card: string;
    cardValue: number;
    outcome: 'low' | 'seven' | 'high';
    isWin: boolean;
    payout: number;
  } | null>(null);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const playMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playLucky7(amount, bet);
    },
    onMutate: () => {
      setIsPlaying(true);
      setResult(null);
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setIsPlaying(false);
        setResult({
          card: data.card,
          cardValue: data.cardValue,
          outcome: data.outcome,
          isWin: data.isWin,
          payout: data.payout,
        });
        
        if (data.isWin) {
          toast({
            title: `${data.card} - You Win!`,
            description: `+₹${data.payout.toFixed(2)}`,
            className: "bg-green-600 text-white border-none"
          });
        } else {
          toast({
            title: `${data.card} - ${data.outcome.toUpperCase()}`,
            description: `Lost ₹${data.betAmount.toFixed(2)}`,
            variant: "destructive"
          });
        }
        
        setCurrentUser({
          ...currentUser!,
          balance: data.newBalance
        });
        
        queryClient.invalidateQueries({ queryKey: ['casino-history'] });
      }, 1000);
    },
    onError: (error: any) => {
      setIsPlaying(false);
      toast({
        title: "Game Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePlay = () => {
    if (!currentUser) {
      toast({ title: "Please login", variant: "destructive" });
      return;
    }
    playMutation.mutate();
  };

  const getMultiplier = () => bet === 'seven' ? 5 : 2;
  const potentialWin = parseFloat(betAmount) * getMultiplier();

  return (
    <AppShell>
      <div className="flex flex-col gap-6 pb-20 md:pb-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/casino">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              <span className="text-2xl">7️⃣</span>
              Lucky 7
            </h1>
            <p className="text-sm text-muted-foreground">Predict if the card is below, equal to, or above 7</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border-yellow-500/30">
          <div className="flex items-center justify-center py-8 mb-4">
            <div className={cn(
              "w-28 h-40 rounded-xl flex items-center justify-center text-5xl font-bold border-4 transition-all",
              isPlaying ? "border-yellow-500 bg-yellow-500/10 animate-pulse" : "",
              result?.isWin ? "border-green-500 bg-green-500/10" : "",
              result && !result.isWin ? "border-red-500 bg-red-500/10" : "",
              !isPlaying && !result ? "border-border bg-card" : ""
            )}>
              {result?.card || '?'}
            </div>
          </div>

          <div className="text-center text-lg font-mono mb-4">
            <span className={result?.outcome === 'low' ? 'text-blue-400' : ''}>Low (A-6)</span>
            {' | '}
            <span className={result?.outcome === 'seven' ? 'text-yellow-400' : ''}>7</span>
            {' | '}
            <span className={result?.outcome === 'high' ? 'text-red-400' : ''}>High (8-K)</span>
          </div>

          {result && (
            <div className={cn(
              "text-center py-3 rounded-lg",
              result.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {result.isWin ? `🎉 You Won ₹${result.payout.toFixed(2)}!` : `Card was ${result.outcome.toUpperCase()}`}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Bet</label>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={bet === 'low' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 flex flex-col",
                    bet === 'low' ? 'bg-blue-600 hover:bg-blue-700' : ''
                  )}
                  onClick={() => setBet('low')}
                  disabled={isPlaying}
                  data-testid="btn-low"
                >
                  <span className="text-lg font-bold">LOW</span>
                  <span className="text-xs opacity-80">2x</span>
                </Button>
                <Button
                  variant={bet === 'seven' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 flex flex-col",
                    bet === 'seven' ? 'bg-yellow-600 hover:bg-yellow-700' : ''
                  )}
                  onClick={() => setBet('seven')}
                  disabled={isPlaying}
                  data-testid="btn-seven"
                >
                  <span className="text-lg font-bold">7</span>
                  <span className="text-xs opacity-80">5x</span>
                </Button>
                <Button
                  variant={bet === 'high' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 flex flex-col",
                    bet === 'high' ? 'bg-red-600 hover:bg-red-700' : ''
                  )}
                  onClick={() => setBet('high')}
                  disabled={isPlaying}
                  data-testid="btn-high"
                >
                  <span className="text-lg font-bold">HIGH</span>
                  <span className="text-xs opacity-80">2x</span>
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Bet Amount</label>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isPlaying}
                data-testid="input-bet-amount"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {QUICK_BETS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(amount.toString())}
                    disabled={isPlaying}
                    data-testid={`btn-quick-bet-${amount}`}
                  >
                    ₹{amount}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payout: {getMultiplier()}x</span>
              <span>Potential Win: ₹{potentialWin.toFixed(2)}</span>
            </div>

            <Button
              className="w-full h-14 text-lg bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700"
              onClick={handlePlay}
              disabled={isPlaying || !betAmount}
              data-testid="btn-play"
            >
              {isPlaying ? 'Drawing...' : `Draw Card (₹${betAmount})`}
            </Button>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-primary/5 border-primary/20">
          <Shield className="w-5 h-5 text-primary" />
          <div className="text-sm">
            <p className="font-medium text-primary">Provably Fair</p>
            <p className="text-muted-foreground">Every result can be verified</p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

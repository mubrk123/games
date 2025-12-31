import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cherry, RefreshCw, Shield } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUICK_BETS = [10, 50, 100, 500, 1000];

export default function SlotsGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [result, setResult] = useState<string[][] | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<{ amount: number; multiplier: number } | null>(null);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const spinMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playSlots(amount);
    },
    onMutate: () => {
      setIsSpinning(true);
      setLastWin(null);
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setResult(data.result.symbols);
        setIsSpinning(false);
        
        if (data.result.isWin) {
          setLastWin({ amount: data.payout, multiplier: data.result.multiplier });
          toast({
            title: `You Won! 🎉`,
            description: `₹${data.payout.toFixed(2)} (${data.result.multiplier}x)`,
            className: "bg-green-600 text-white border-none"
          });
        }
        
        setCurrentUser({
          ...currentUser!,
          balance: data.newBalance
        });
        
        queryClient.invalidateQueries({ queryKey: ['casino-history'] });
      }, 1500);
    },
    onError: (error: any) => {
      setIsSpinning(false);
      toast({
        title: "Spin Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSpin = () => {
    if (!currentUser) {
      toast({ title: "Please login", variant: "destructive" });
      return;
    }
    spinMutation.mutate();
  };

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
              <Cherry className="w-6 h-6 text-pink-500" />
              Classic Slots
            </h1>
            <p className="text-sm text-muted-foreground">Match symbols to win</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30">
          <div className="grid grid-cols-3 gap-2 p-4 bg-black/50 rounded-xl mb-6">
            {(result || [['❓', '❓', '❓'], ['❓', '❓', '❓'], ['❓', '❓', '❓']]).map((row, i) => (
              <div key={i} className="contents">
                {row.map((symbol, j) => (
                  <div 
                    key={`${i}-${j}`}
                    className={cn(
                      "aspect-square flex items-center justify-center text-4xl md:text-5xl rounded-lg bg-gray-800/80 border-2",
                      isSpinning ? "animate-pulse border-primary" : "border-gray-700",
                      i === 1 && lastWin ? "border-yellow-500 shadow-lg shadow-yellow-500/30" : ""
                    )}
                    data-testid={`slot-${i}-${j}`}
                  >
                    {isSpinning ? (
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      symbol
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {lastWin && (
            <div className="text-center mb-6 p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
              <p className="text-2xl font-bold text-yellow-400">
                WIN! {lastWin.multiplier}x
              </p>
              <p className="text-lg text-yellow-300">
                +₹{lastWin.amount.toFixed(2)}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Bet Amount</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="text-lg font-mono"
                  min="10"
                  data-testid="slots-bet-input"
                />
                <Button 
                  variant="outline" 
                  onClick={() => setBetAmount((parseFloat(betAmount) / 2).toString())}
                >
                  ½
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())}
                >
                  2x
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_BETS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount.toString())}
                  className={betAmount === amount.toString() ? 'border-primary' : ''}
                >
                  ₹{amount}
                </Button>
              ))}
            </div>

            <Button 
              className="w-full h-14 text-lg gap-2"
              onClick={handleSpin}
              disabled={isSpinning || !currentUser}
              data-testid="slots-spin-button"
            >
              {isSpinning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Spinning...
                </>
              ) : (
                <>
                  <Cherry className="w-5 h-5" />
                  Spin (₹{parseFloat(betAmount).toFixed(0)})
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Payouts</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 rounded bg-card/50">
              <span>💎💎💎</span><span className="text-green-400">50x</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-card/50">
              <span>7️⃣7️⃣7️⃣</span><span className="text-green-400">25x</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-card/50">
              <span>⭐⭐⭐</span><span className="text-green-400">10x</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-card/50">
              <span>Any 3 match</span><span className="text-green-400">5x</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-card/50 col-span-2">
              <span>Any 2 adjacent match</span><span className="text-green-400">2x</span>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

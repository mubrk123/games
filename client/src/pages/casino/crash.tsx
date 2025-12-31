import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Rocket, TrendingUp, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUICK_BETS = [10, 50, 100, 500, 1000];
const QUICK_MULTIPLIERS = [1.5, 2, 3, 5, 10];

export default function CrashGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [cashoutMultiplier, setCashoutMultiplier] = useState('2.00');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [lastResult, setLastResult] = useState<{ crashPoint: number; won: boolean; payout: number } | null>(null);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const playMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      const multiplier = parseFloat(cashoutMultiplier);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      if (isNaN(multiplier) || multiplier < 1.01) throw new Error('Multiplier must be at least 1.01');
      return await api.playCrash(amount, multiplier);
    },
    onMutate: () => {
      setIsPlaying(true);
      setCurrentMultiplier(1.00);
      setLastResult(null);
    },
    onSuccess: (data) => {
      const targetMultiplier = Math.min(data.crashPoint, parseFloat(cashoutMultiplier));
      const duration = Math.min(targetMultiplier * 500, 3000);
      const steps = 50;
      const stepDuration = duration / steps;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        const currentVal = 1 + (targetMultiplier - 1) * progress;
        setCurrentMultiplier(Math.round(currentVal * 100) / 100);
        
        if (step >= steps) {
          clearInterval(interval);
          setTimeout(() => {
            setIsPlaying(false);
            setLastResult({
              crashPoint: data.crashPoint,
              won: data.isWin,
              payout: data.payout
            });
            
            if (data.isWin) {
              toast({
                title: `Cashed out at ${data.cashoutMultiplier}x! 🚀`,
                description: `Won ₹${data.payout.toFixed(2)}`,
                className: "bg-green-600 text-white border-none"
              });
            } else {
              toast({
                title: `Crashed at ${data.crashPoint}x 💥`,
                description: `Lost ₹${data.betAmount.toFixed(2)}`,
                variant: "destructive"
              });
            }
            
            setCurrentUser({
              ...currentUser!,
              balance: data.newBalance
            });
            
            queryClient.invalidateQueries({ queryKey: ['casino-history'] });
          }, 500);
        }
      }, stepDuration);
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
              <Rocket className="w-6 h-6 text-orange-500" />
              Crash
            </h1>
            <p className="text-sm text-muted-foreground">Cash out before it crashes!</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-orange-900/50 to-red-900/50 border-orange-500/30">
          <div className="aspect-video flex items-center justify-center bg-black/50 rounded-xl mb-6 relative overflow-hidden">
            <div className={cn(
              "absolute inset-0 flex items-center justify-center",
              lastResult && !lastResult.won ? "bg-red-900/50" : "",
              lastResult && lastResult.won ? "bg-green-900/50" : ""
            )}>
              <div className="text-center">
                <div className={cn(
                  "text-6xl md:text-8xl font-bold font-mono transition-all",
                  isPlaying ? "text-yellow-400 animate-pulse" : "",
                  lastResult?.won ? "text-green-400" : "",
                  lastResult && !lastResult.won ? "text-red-400" : "",
                  !isPlaying && !lastResult ? "text-white" : ""
                )}>
                  {currentMultiplier.toFixed(2)}x
                </div>
                
                {isPlaying && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-yellow-400">
                    <TrendingUp className="w-5 h-5 animate-bounce" />
                    <span>Going up...</span>
                  </div>
                )}
                
                {lastResult && (
                  <div className="mt-4 text-lg">
                    {lastResult.won ? (
                      <span className="text-green-400">
                        Won ₹{lastResult.payout.toFixed(2)}!
                      </span>
                    ) : (
                      <span className="text-red-400">
                        Crashed at {lastResult.crashPoint.toFixed(2)}x
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {isPlaying && (
              <Rocket className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 text-orange-500 animate-bounce" />
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Bet Amount</label>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="text-lg font-mono"
                min="10"
                disabled={isPlaying}
                data-testid="crash-bet-input"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {QUICK_BETS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(amount.toString())}
                    disabled={isPlaying}
                    className="text-xs"
                  >
                    ₹{amount}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Auto Cashout At</label>
              <Input
                type="number"
                value={cashoutMultiplier}
                onChange={(e) => setCashoutMultiplier(e.target.value)}
                className="text-lg font-mono"
                min="1.01"
                step="0.01"
                disabled={isPlaying}
                data-testid="crash-multiplier-input"
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {QUICK_MULTIPLIERS.map((mult) => (
                  <Button
                    key={mult}
                    variant="outline"
                    size="sm"
                    onClick={() => setCashoutMultiplier(mult.toFixed(2))}
                    disabled={isPlaying}
                    className="text-xs"
                  >
                    {mult}x
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/30 mb-4 text-center">
            <span className="text-sm text-muted-foreground">Potential Win: </span>
            <span className="text-lg font-bold text-green-400">
              ₹{(parseFloat(betAmount) * parseFloat(cashoutMultiplier) || 0).toFixed(2)}
            </span>
          </div>

          <Button 
            className="w-full h-14 text-lg gap-2"
            onClick={handlePlay}
            disabled={isPlaying || !currentUser}
            data-testid="crash-play-button"
          >
            {isPlaying ? (
              <>
                <Rocket className="w-5 h-5 animate-bounce" />
                Flying...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Launch (₹{parseFloat(betAmount).toFixed(0)})
              </>
            )}
          </Button>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">How to Play</span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Set your bet amount and target cashout multiplier</li>
            <li>• The multiplier starts at 1.00x and increases</li>
            <li>• If you cash out before crash, you win bet × multiplier</li>
            <li>• If it crashes before your target, you lose your bet</li>
            <li>• Higher multipliers = higher risk, higher reward</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

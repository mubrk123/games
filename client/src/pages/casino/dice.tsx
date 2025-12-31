import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Dices, ArrowUp, ArrowDown, Shield } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUICK_BETS = [10, 50, 100, 500, 1000];

export default function DiceGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [target, setTarget] = useState(50);
  const [prediction, setPrediction] = useState<'high' | 'low'>('high');
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ won: boolean; payout: number } | null>(null);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const winChance = prediction === 'high' ? (100 - target) : (target - 1);
  const multiplier = winChance > 0 ? Math.floor((97 / winChance) * 100) / 100 : 0;
  const potentialWin = parseFloat(betAmount) * multiplier;

  const rollMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playDice(amount, prediction, target);
    },
    onMutate: () => {
      setIsRolling(true);
      setLastResult(null);
    },
    onSuccess: (data) => {
      let animatedRoll = 0;
      const interval = setInterval(() => {
        animatedRoll = Math.floor(Math.random() * 100) + 1;
        setLastRoll(animatedRoll);
      }, 50);
      
      setTimeout(() => {
        clearInterval(interval);
        setLastRoll(data.roll);
        setIsRolling(false);
        setLastResult({ won: data.isWin, payout: data.payout });
        
        if (data.isWin) {
          toast({
            title: `Rolled ${data.roll}! You Win! 🎲`,
            description: `+₹${data.payout.toFixed(2)}`,
            className: "bg-green-600 text-white border-none"
          });
        } else {
          toast({
            title: `Rolled ${data.roll}`,
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
      setIsRolling(false);
      toast({
        title: "Roll Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleRoll = () => {
    if (!currentUser) {
      toast({ title: "Please login", variant: "destructive" });
      return;
    }
    rollMutation.mutate();
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
              <Dices className="w-6 h-6 text-blue-500" />
              Dice
            </h1>
            <p className="text-sm text-muted-foreground">Roll higher or lower than target</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-500/30">
          <div className="flex items-center justify-center py-8 mb-6">
            <div className={cn(
              "w-32 h-32 rounded-2xl flex items-center justify-center text-5xl font-bold font-mono border-4",
              isRolling ? "border-yellow-500 bg-yellow-500/10 animate-pulse" : "",
              lastResult?.won ? "border-green-500 bg-green-500/10" : "",
              lastResult && !lastResult.won ? "border-red-500 bg-red-500/10" : "",
              !isRolling && !lastResult ? "border-border bg-card" : ""
            )}>
              {lastRoll !== null ? lastRoll : '?'}
            </div>
          </div>

          {lastResult && (
            <div className={cn(
              "text-center mb-6 p-4 rounded-xl",
              lastResult.won ? "bg-green-500/20 border border-green-500/30" : "bg-red-500/20 border border-red-500/30"
            )}>
              <p className={cn("text-xl font-bold", lastResult.won ? "text-green-400" : "text-red-400")}>
                {lastResult.won ? `WIN! +₹${lastResult.payout.toFixed(2)}` : 'LOST'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button
              variant={prediction === 'low' ? 'default' : 'outline'}
              className={cn("h-16 text-lg gap-2", prediction === 'low' ? 'bg-red-600 hover:bg-red-700' : '')}
              onClick={() => setPrediction('low')}
              disabled={isRolling}
            >
              <ArrowDown className="w-5 h-5" />
              Roll Under {target}
            </Button>
            <Button
              variant={prediction === 'high' ? 'default' : 'outline'}
              className={cn("h-16 text-lg gap-2", prediction === 'high' ? 'bg-green-600 hover:bg-green-700' : '')}
              onClick={() => setPrediction('high')}
              disabled={isRolling}
            >
              <ArrowUp className="w-5 h-5" />
              Roll Over {target}
            </Button>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Target: {target}</span>
              <span className="text-muted-foreground">
                {prediction === 'high' ? `Win if > ${target}` : `Win if < ${target}`}
              </span>
            </div>
            <Slider
              value={[target]}
              onValueChange={([val]) => setTarget(val)}
              min={2}
              max={99}
              step={1}
              disabled={isRolling}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2</span>
              <span>50</span>
              <span>99</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-black/30">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Win Chance</p>
              <p className="text-lg font-bold text-primary">{winChance.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Multiplier</p>
              <p className="text-lg font-bold text-yellow-400">{multiplier.toFixed(2)}x</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Potential Win</p>
              <p className="text-lg font-bold text-green-400">₹{potentialWin.toFixed(2)}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">Bet Amount</label>
            <Input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="text-lg font-mono mb-2"
              min="10"
              disabled={isRolling}
              data-testid="dice-bet-input"
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_BETS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount.toString())}
                  disabled={isRolling}
                >
                  ₹{amount}
                </Button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg gap-2"
            onClick={handleRoll}
            disabled={isRolling || !currentUser}
            data-testid="dice-roll-button"
          >
            {isRolling ? (
              <>
                <Dices className="w-5 h-5 animate-spin" />
                Rolling...
              </>
            ) : (
              <>
                <Dices className="w-5 h-5" />
                Roll Dice (₹{parseFloat(betAmount).toFixed(0)})
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
            <li>• Set a target number (2-99)</li>
            <li>• Predict if the roll will be higher or lower than target</li>
            <li>• Lower win chance = higher multiplier</li>
            <li>• The dice rolls a number from 1-100</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

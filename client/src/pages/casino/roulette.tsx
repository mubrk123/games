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

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

type BetType = { type: string; value: string; label: string; payout: number };

const BET_OPTIONS: BetType[] = [
  { type: 'color', value: 'red', label: 'Red', payout: 2 },
  { type: 'color', value: 'black', label: 'Black', payout: 2 },
  { type: 'oddeven', value: 'odd', label: 'Odd', payout: 2 },
  { type: 'oddeven', value: 'even', label: 'Even', payout: 2 },
  { type: 'highlow', value: 'low', label: '1-18', payout: 2 },
  { type: 'highlow', value: 'high', label: '19-36', payout: 2 },
  { type: 'dozen', value: '1st', label: '1st 12', payout: 3 },
  { type: 'dozen', value: '2nd', label: '2nd 12', payout: 3 },
  { type: 'dozen', value: '3rd', label: '3rd 12', payout: 3 },
];

export default function RouletteGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [selectedBet, setSelectedBet] = useState<BetType>(BET_OPTIONS[0]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<{
    number: number;
    color: 'red' | 'black' | 'green';
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
      return await api.playRoulette(amount, selectedBet.type, selectedBet.value);
    },
    onMutate: () => {
      setIsSpinning(true);
      setResult(null);
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setIsSpinning(false);
        setResult({
          number: data.number,
          color: data.color,
          isWin: data.isWin,
          payout: data.payout,
        });
        
        if (data.isWin) {
          toast({
            title: `${data.number} ${data.color.toUpperCase()} - You Win!`,
            description: `+₹${data.payout.toFixed(2)}`,
            className: "bg-green-600 text-white border-none"
          });
        } else {
          toast({
            title: `${data.number} ${data.color.toUpperCase()}`,
            description: `Lost ₹${data.betAmount.toFixed(2)}`,
            variant: "destructive"
          });
        }
        
        setCurrentUser({
          ...currentUser!,
          balance: data.newBalance
        });
        
        queryClient.invalidateQueries({ queryKey: ['casino-history'] });
      }, 2000);
    },
    onError: (error: any) => {
      setIsSpinning(false);
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

  const potentialWin = parseFloat(betAmount) * selectedBet.payout;

  const getNumberColor = (num: number) => {
    if (num === 0) return 'bg-green-600';
    return RED_NUMBERS.includes(num) ? 'bg-red-600' : 'bg-gray-900';
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
              <span className="text-2xl">🎰</span>
              Roulette
            </h1>
            <p className="text-sm text-muted-foreground">European roulette with single zero</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-green-500/30">
          <div className="flex items-center justify-center py-8 mb-4">
            <div className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold border-4 transition-all",
              isSpinning ? "border-yellow-500 animate-spin" : "",
              result ? getNumberColor(result.number) : "bg-card",
              !isSpinning && result?.isWin ? "border-green-400" : "",
              !isSpinning && result && !result.isWin ? "border-red-400" : "",
              !isSpinning && !result ? "border-border" : ""
            )}>
              {result?.number !== undefined ? result.number : '?'}
            </div>
          </div>

          {result && (
            <div className={cn(
              "text-center py-3 rounded-lg",
              result.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {result.isWin ? `🎉 You Won ₹${result.payout.toFixed(2)}!` : `${result.number} ${result.color}`}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Bet</label>
              <div className="grid grid-cols-3 gap-2">
                {BET_OPTIONS.map((opt) => (
                  <Button
                    key={`${opt.type}-${opt.value}`}
                    variant={selectedBet.type === opt.type && selectedBet.value === opt.value ? 'default' : 'outline'}
                    className={cn(
                      "h-12 flex flex-col text-xs",
                      selectedBet.type === opt.type && selectedBet.value === opt.value && opt.value === 'red' ? 'bg-red-600 hover:bg-red-700' : '',
                      selectedBet.type === opt.type && selectedBet.value === opt.value && opt.value === 'black' ? 'bg-gray-800 hover:bg-gray-900' : '',
                      selectedBet.type === opt.type && selectedBet.value === opt.value && !['red', 'black'].includes(opt.value) ? 'bg-green-600 hover:bg-green-700' : ''
                    )}
                    onClick={() => setSelectedBet(opt)}
                    disabled={isSpinning}
                    data-testid={`btn-bet-${opt.value}`}
                  >
                    <span className="font-bold">{opt.label}</span>
                    <span className="opacity-70">{opt.payout}x</span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Bet Amount</label>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isSpinning}
                data-testid="input-bet-amount"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {QUICK_BETS.map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setBetAmount(amount.toString())}
                    disabled={isSpinning}
                    data-testid={`btn-quick-bet-${amount}`}
                  >
                    ₹{amount}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Payout: {selectedBet.payout}x ({selectedBet.label})</span>
              <span>Potential Win: ₹{potentialWin.toFixed(2)}</span>
            </div>

            <Button
              className="w-full h-14 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              onClick={handlePlay}
              disabled={isSpinning || !betAmount}
              data-testid="btn-play"
            >
              {isSpinning ? 'Spinning...' : `Spin (₹${betAmount})`}
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

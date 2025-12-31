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

export default function AndarBaharGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [choice, setChoice] = useState<'andar' | 'bahar'>('andar');
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<{
    jokerCard: string;
    andarCards: string[];
    baharCards: string[];
    winningSide: 'andar' | 'bahar';
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
      return await api.playAndarBahar(amount, choice);
    },
    onMutate: () => {
      setIsPlaying(true);
      setResult(null);
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setIsPlaying(false);
        setResult({
          jokerCard: data.jokerCard,
          andarCards: data.andarCards,
          baharCards: data.baharCards,
          winningSide: data.winningSide,
          isWin: data.isWin,
          payout: data.payout,
        });
        
        if (data.isWin) {
          toast({
            title: `You Win! ${data.winningSide.toUpperCase()} wins!`,
            description: `+₹${data.payout.toFixed(2)}`,
            className: "bg-green-600 text-white border-none"
          });
        } else {
          toast({
            title: `${data.winningSide.toUpperCase()} wins`,
            description: `Lost ₹${data.betAmount.toFixed(2)}`,
            variant: "destructive"
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

  const potentialWin = parseFloat(betAmount) * 1.9;

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
              <span className="text-2xl">🃏</span>
              Andar Bahar
            </h1>
            <p className="text-sm text-muted-foreground">Bet on which side the matching card appears</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-amber-900/50 to-orange-900/50 border-amber-500/30">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-2">Joker Card</p>
            <div className={cn(
              "inline-flex items-center justify-center w-20 h-28 rounded-lg text-4xl font-bold border-2",
              isPlaying ? "border-yellow-500 bg-yellow-500/20 animate-pulse" : "border-white/30 bg-white/10"
            )}>
              {result?.jokerCard || '?'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <p className={cn(
                "font-bold mb-2",
                result?.winningSide === 'andar' ? "text-green-500" : ""
              )}>ANDAR</p>
              <div className="flex flex-wrap gap-1 justify-center min-h-[80px] p-2 rounded-lg bg-card/50">
                {result?.andarCards?.map((card, i) => (
                  <span key={i} className="text-lg bg-white/10 px-2 py-1 rounded">{card}</span>
                ))}
              </div>
            </div>
            <div className="text-center">
              <p className={cn(
                "font-bold mb-2",
                result?.winningSide === 'bahar' ? "text-green-500" : ""
              )}>BAHAR</p>
              <div className="flex flex-wrap gap-1 justify-center min-h-[80px] p-2 rounded-lg bg-card/50">
                {result?.baharCards?.map((card, i) => (
                  <span key={i} className="text-lg bg-white/10 px-2 py-1 rounded">{card}</span>
                ))}
              </div>
            </div>
          </div>

          {result && (
            <div className={cn(
              "text-center py-3 rounded-lg mb-4",
              result.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {result.isWin ? `🎉 You Won ₹${result.payout.toFixed(2)}!` : `Lost - ${result.winningSide.toUpperCase()} wins`}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Choose Side</label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={choice === 'andar' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 text-lg",
                    choice === 'andar' ? 'bg-amber-600 hover:bg-amber-700' : ''
                  )}
                  onClick={() => setChoice('andar')}
                  disabled={isPlaying}
                  data-testid="btn-andar"
                >
                  ANDAR
                </Button>
                <Button
                  variant={choice === 'bahar' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 text-lg",
                    choice === 'bahar' ? 'bg-orange-600 hover:bg-orange-700' : ''
                  )}
                  onClick={() => setChoice('bahar')}
                  disabled={isPlaying}
                  data-testid="btn-bahar"
                >
                  BAHAR
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
              <span>Payout: 1.9x</span>
              <span>Potential Win: ₹{potentialWin.toFixed(2)}</span>
            </div>

            <Button
              className="w-full h-14 text-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
              onClick={handlePlay}
              disabled={isPlaying || !betAmount}
              data-testid="btn-play"
            >
              {isPlaying ? 'Dealing...' : `Play (₹${betAmount})`}
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

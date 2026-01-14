import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUICK_BETS = [10, 50, 100, 500, 1000];

type GamePhase = 'idle' | 'countdown' | 'spinning' | 'revealing' | 'result';

export default function Lucky7Game() {
  const [betAmount, setBetAmount] = useState('100');
  const [bet, setBet] = useState<'low' | 'seven' | 'high'>('high');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [spinningCard, setSpinningCard] = useState<string>('?');
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

  const CARD_FACES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  useEffect(() => {
    let spinInterval: NodeJS.Timeout;
    if (gamePhase === 'spinning') {
      spinInterval = setInterval(() => {
        setSpinningCard(CARD_FACES[Math.floor(Math.random() * CARD_FACES.length)]);
      }, 80);
    }
    return () => clearInterval(spinInterval);
  }, [gamePhase]);

  const playMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playLucky7(amount, bet);
    },
    onMutate: () => {
      setResult(null);
      setGamePhase('countdown');
      setCountdown(3);
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setCountdown(2);
        setTimeout(() => {
          setCountdown(1);
          setTimeout(() => {
            setCountdown(null);
            setGamePhase('spinning');
            
            setTimeout(() => {
              setGamePhase('revealing');
              
              setTimeout(() => {
                setGamePhase('result');
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
              }, 600);
            }, 1500);
          }, 700);
        }, 700);
      }, 700);
    },
    onError: (error: any) => {
      setGamePhase('idle');
      setCountdown(null);
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

  const resetGame = () => {
    setGamePhase('idle');
    setResult(null);
    setCountdown(null);
  };

  const getMultiplier = () => bet === 'seven' ? 5 : 2;
  const potentialWin = parseFloat(betAmount) * getMultiplier();
  const isPlaying = gamePhase !== 'idle' && gamePhase !== 'result';

  const getCardDisplay = () => {
    if (gamePhase === 'countdown') return countdown?.toString() || '?';
    if (gamePhase === 'spinning') return spinningCard;
    if (gamePhase === 'revealing' || gamePhase === 'result') return result?.card || '?';
    return result?.card || '?';
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
              <span className="text-2xl">7️⃣</span>
              Lucky 7
            </h1>
            <p className="text-sm text-muted-foreground">Predict if the card is below, equal to, or above 7</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border-yellow-500/30 relative overflow-hidden">
          {result?.isWin && gamePhase === 'result' && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <Sparkles
                  key={i}
                  className={cn(
                    "absolute text-yellow-400 animate-sparkle",
                    i % 2 === 0 ? "w-4 h-4" : "w-6 h-6"
                  )}
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-center py-12 mb-4 perspective-1000">
            <div 
              className={cn(
                "relative w-40 h-56 md:w-48 md:h-64 rounded-2xl flex items-center justify-center text-6xl md:text-7xl font-bold border-4 transition-all duration-300 shadow-2xl",
                gamePhase === 'countdown' && "border-yellow-500 bg-gradient-to-br from-yellow-600/30 to-amber-600/30 animate-countdown scale-110",
                gamePhase === 'spinning' && "border-purple-500 bg-gradient-to-br from-purple-600/30 to-pink-600/30 animate-pulse",
                gamePhase === 'revealing' && "border-cyan-500 bg-gradient-to-br from-cyan-600/30 to-blue-600/30 card-flip",
                gamePhase === 'result' && result?.isWin && "border-green-500 bg-gradient-to-br from-green-600/30 to-emerald-600/30 win-glow",
                gamePhase === 'result' && result && !result.isWin && "border-red-500 bg-gradient-to-br from-red-600/30 to-rose-600/30 lose-shake",
                gamePhase === 'idle' && !result && "border-border bg-card hover:border-yellow-500/50 hover:scale-105",
                gamePhase === 'idle' && result?.isWin && "border-green-500 bg-gradient-to-br from-green-600/20 to-emerald-600/20",
                gamePhase === 'idle' && result && !result.isWin && "border-red-500 bg-gradient-to-br from-red-600/20 to-rose-600/20"
              )}
              style={{ 
                transformStyle: 'preserve-3d',
                perspective: '1000px'
              }}
              data-testid="card-display"
            >
              {gamePhase === 'countdown' && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 animate-pulse" />
              )}
              
              {gamePhase === 'spinning' && (
                <div className="absolute inset-0 rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" 
                       style={{ animation: 'pulse 0.3s ease-in-out infinite' }} />
                </div>
              )}

              <span className={cn(
                "relative z-10 drop-shadow-lg",
                gamePhase === 'countdown' && "text-yellow-400 scale-125",
                gamePhase === 'spinning' && "text-purple-300",
                result?.isWin && (gamePhase === 'result' || gamePhase === 'idle') && "text-green-400",
                result && !result.isWin && (gamePhase === 'result' || gamePhase === 'idle') && "text-red-400"
              )}>
                {getCardDisplay()}
              </span>
              
              {gamePhase === 'spinning' && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>

          {gamePhase === 'countdown' && (
            <div className="text-center text-2xl font-bold text-yellow-400 mb-4 animate-pulse">
              Get Ready...
            </div>
          )}

          {gamePhase === 'spinning' && (
            <div className="text-center text-xl font-bold text-purple-400 mb-4">
              🎰 Drawing Card... 🎰
            </div>
          )}

          {gamePhase === 'revealing' && (
            <div className="text-center text-xl font-bold text-cyan-400 mb-4 animate-pulse">
              ✨ Revealing... ✨
            </div>
          )}

          <div className="text-center text-lg font-mono mb-4">
            <span className={cn(
              "transition-all px-2 py-1 rounded",
              result?.outcome === 'low' ? 'text-blue-400 bg-blue-500/20' : ''
            )}>Low (A-6)</span>
            {' | '}
            <span className={cn(
              "transition-all px-2 py-1 rounded",
              result?.outcome === 'seven' ? 'text-yellow-400 bg-yellow-500/20' : ''
            )}>7</span>
            {' | '}
            <span className={cn(
              "transition-all px-2 py-1 rounded",
              result?.outcome === 'high' ? 'text-red-400 bg-red-500/20' : ''
            )}>High (8-K)</span>
          </div>

          {result && gamePhase === 'result' && (
            <div className={cn(
              "text-center py-4 rounded-lg text-lg font-bold transition-all",
              result.isWin ? "bg-green-500/20 text-green-400 win-glow" : "bg-red-500/20 text-red-400"
            )}>
              {result.isWin 
                ? `🎉🎊 You Won ₹${result.payout.toFixed(2)}! 🎊🎉` 
                : `💔 Card was ${result.outcome.toUpperCase()} 💔`
              }
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
                    "h-16 flex flex-col transition-all",
                    bet === 'low' ? 'bg-blue-600 hover:bg-blue-700 scale-105 shadow-lg shadow-blue-500/30' : ''
                  )}
                  onClick={() => { setBet('low'); resetGame(); }}
                  disabled={isPlaying}
                  data-testid="btn-low"
                >
                  <span className="text-lg font-bold">LOW</span>
                  <span className="text-xs opacity-80">2x</span>
                </Button>
                <Button
                  variant={bet === 'seven' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 flex flex-col transition-all",
                    bet === 'seven' ? 'bg-yellow-600 hover:bg-yellow-700 scale-105 shadow-lg shadow-yellow-500/30' : ''
                  )}
                  onClick={() => { setBet('seven'); resetGame(); }}
                  disabled={isPlaying}
                  data-testid="btn-seven"
                >
                  <span className="text-lg font-bold">7</span>
                  <span className="text-xs opacity-80">5x</span>
                </Button>
                <Button
                  variant={bet === 'high' ? 'default' : 'outline'}
                  className={cn(
                    "h-16 flex flex-col transition-all",
                    bet === 'high' ? 'bg-red-600 hover:bg-red-700 scale-105 shadow-lg shadow-red-500/30' : ''
                  )}
                  onClick={() => { setBet('high'); resetGame(); }}
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
                    className="transition-all hover:scale-105"
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
              className={cn(
                "w-full h-14 text-lg transition-all",
                isPlaying 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600" 
                  : "bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-500/30"
              )}
              onClick={handlePlay}
              disabled={isPlaying || !betAmount}
              data-testid="btn-play"
            >
              {isPlaying ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">🎴</span>
                  Drawing...
                </span>
              ) : (
                `Draw Card (₹${betAmount})`
              )}
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

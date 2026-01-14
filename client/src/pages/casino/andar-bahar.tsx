import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DealerAnimation } from "@/components/animation/dealerAnimation";

const QUICK_BETS = [10, 50, 100, 500, 1000];

type GamePhase = 'idle' | 'countdown' | 'joker-reveal' | 'dealing' | 'result';

interface DealingState {
  jokerCard: string;
  andarCards: string[];
  baharCards: string[];
  winningSide: 'andar' | 'bahar';
  isWin: boolean;
  payout: number;
}

export default function AndarBaharGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [choice, setChoice] = useState<'andar' | 'bahar'>('andar');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [visibleJoker, setVisibleJoker] = useState(false);
  const [visibleAndarCards, setVisibleAndarCards] = useState<string[]>([]);
  const [visibleBaharCards, setVisibleBaharCards] = useState<string[]>([]);
  const [dealingData, setDealingData] = useState<DealingState | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetGame = useCallback(() => {
    setGamePhase('idle');
    setCountdown(3);
    setVisibleJoker(false);
    setVisibleAndarCards([]);
    setVisibleBaharCards([]);
    setDealingData(null);
    setShowResult(false);
  }, []);

  const startDealingSequence = useCallback((data: DealingState) => {
    setDealingData(data);
    setGamePhase('countdown');
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 800);
      return () => clearTimeout(timer);
    } else {
      setGamePhase('joker-reveal');
    }
  }, [gamePhase, countdown]);

  useEffect(() => {
    if (gamePhase !== 'joker-reveal') return;
    
    const timer = setTimeout(() => {
      setVisibleJoker(true);
      setTimeout(() => setGamePhase('dealing'), 800);
    }, 300);
    return () => clearTimeout(timer);
  }, [gamePhase]);

  useEffect(() => {
    if (gamePhase !== 'dealing' || !dealingData) return;

    const allAndar = dealingData.andarCards;
    const allBahar = dealingData.baharCards;
    const maxCards = Math.max(allAndar.length, allBahar.length);
    let currentIndex = 0;

    const dealCard = () => {
      if (currentIndex >= maxCards) {
        setTimeout(() => {
          setGamePhase('result');
          setShowResult(true);
        }, 500);
        return;
      }

      if (currentIndex < allAndar.length) {
        setVisibleAndarCards(prev => [...prev, allAndar[currentIndex]]);
      }
      
      setTimeout(() => {
        if (currentIndex < allBahar.length) {
          setVisibleBaharCards(prev => [...prev, allBahar[currentIndex]]);
        }
        currentIndex++;
        setTimeout(dealCard, 400);
      }, 300);
    };

    const startDealing = setTimeout(dealCard, 200);
    return () => clearTimeout(startDealing);
  }, [gamePhase, dealingData]);

  useEffect(() => {
    if (gamePhase !== 'result' || !dealingData) return;

    if (dealingData.isWin) {
      toast({
        title: `🎉 You Win! ${dealingData.winningSide.toUpperCase()} wins!`,
        description: `+₹${dealingData.payout.toFixed(2)}`,
        className: "bg-green-600 text-white border-none"
      });
    } else {
      toast({
        title: `${dealingData.winningSide.toUpperCase()} wins`,
        description: `Better luck next time!`,
        variant: "destructive"
      });
    }

    setCurrentUser({
      ...currentUser!,
      balance: currentUser!.balance + (dealingData.isWin ? dealingData.payout : 0)
    });

    queryClient.invalidateQueries({ queryKey: ['casino-history'] });
  }, [gamePhase, dealingData]);

  const playMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playAndarBahar(amount, choice);
    },
    onMutate: () => {
      resetGame();
    },
    onSuccess: (data) => {
      startDealingSequence({
        jokerCard: data.jokerCard,
        andarCards: data.andarCards,
        baharCards: data.baharCards,
        winningSide: data.winningSide,
        isWin: data.isWin,
        payout: data.payout,
      });
      
      setCurrentUser({
        ...currentUser!,
        balance: data.newBalance
      });
    },
    onError: (error: any) => {
      resetGame();
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

  const isPlaying = gamePhase !== 'idle' && gamePhase !== 'result';
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

        <Card className={cn(
          "p-6 bg-gradient-to-br from-amber-900/50 to-orange-900/50 border-amber-500/30 relative overflow-hidden",
          showResult && dealingData?.isWin && "win-glow",
          showResult && dealingData && !dealingData.isWin && "lose-shake"
        )}>
          {gamePhase === 'countdown' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="text-7xl font-bold text-yellow-400 animate-countdown" key={countdown}>
                  {countdown}
                </div>
                <p className="text-xl text-white/80 mt-2">Get Ready!</p>
              </div>
            </div>
          )}

          <div className="flex justify-center mb-4">
            <DealerAnimation 
              gamePhase={gamePhase} 
              isWin={dealingData?.isWin}
              dealerName="Maya Singh"
            />
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-2">Joker Card</p>
            <div className={cn(
              "inline-flex items-center justify-center w-20 h-28 rounded-lg text-4xl font-bold border-2 transition-all duration-300",
              gamePhase === 'idle' && "border-white/30 bg-white/10",
              gamePhase === 'countdown' && "border-yellow-500 bg-yellow-500/20",
              visibleJoker && "card-flip border-yellow-500 bg-gradient-to-br from-yellow-500/30 to-amber-600/30 shadow-lg shadow-yellow-500/30"
            )}>
              {visibleJoker ? (
                <span className="animate-sparkle">{dealingData?.jokerCard}</span>
              ) : (
                <span className={cn(gamePhase !== 'idle' && "animate-pulse")}>?</span>
              )}
            </div>
          </div>

          {gamePhase === 'dealing' && (
            <div className="text-center mb-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                Dealing Cards...
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <p className={cn(
                "font-bold mb-2 transition-all duration-300",
                showResult && dealingData?.winningSide === 'andar' && "text-green-400 scale-110",
                choice === 'andar' && gamePhase === 'idle' && "text-amber-400"
              )}>
                ANDAR
                {choice === 'andar' && gamePhase === 'idle' && (
                  <span className="ml-2 text-xs bg-amber-500/30 px-2 py-0.5 rounded">YOUR BET</span>
                )}
              </p>
              <div className={cn(
                "flex flex-wrap gap-1 justify-center min-h-[80px] p-2 rounded-lg bg-card/50 transition-all duration-300",
                showResult && dealingData?.winningSide === 'andar' && "ring-2 ring-green-500/50 bg-green-500/10"
              )}>
                {visibleAndarCards.map((card, i) => (
                  <span 
                    key={i} 
                    className={cn(
                      "text-lg bg-white/10 px-2 py-1 rounded card-deal",
                      i === visibleAndarCards.length - 1 && gamePhase === 'dealing' && "ring-2 ring-yellow-400/50"
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {card}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-center">
              <p className={cn(
                "font-bold mb-2 transition-all duration-300",
                showResult && dealingData?.winningSide === 'bahar' && "text-green-400 scale-110",
                choice === 'bahar' && gamePhase === 'idle' && "text-orange-400"
              )}>
                BAHAR
                {choice === 'bahar' && gamePhase === 'idle' && (
                  <span className="ml-2 text-xs bg-orange-500/30 px-2 py-0.5 rounded">YOUR BET</span>
                )}
              </p>
              <div className={cn(
                "flex flex-wrap gap-1 justify-center min-h-[80px] p-2 rounded-lg bg-card/50 transition-all duration-300",
                showResult && dealingData?.winningSide === 'bahar' && "ring-2 ring-green-500/50 bg-green-500/10"
              )}>
                {visibleBaharCards.map((card, i) => (
                  <span 
                    key={i} 
                    className={cn(
                      "text-lg bg-white/10 px-2 py-1 rounded card-deal",
                      i === visibleBaharCards.length - 1 && gamePhase === 'dealing' && "ring-2 ring-yellow-400/50"
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {card}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {showResult && dealingData && (
            <div className={cn(
              "text-center py-4 rounded-lg mb-4 transition-all duration-500",
              dealingData.isWin 
                ? "bg-green-500/20 text-green-400 ring-2 ring-green-500/30" 
                : "bg-red-500/20 text-red-400"
            )}>
              {dealingData.isWin ? (
                <div className="space-y-1">
                  <div className="text-2xl">🎉 YOU WON! 🎉</div>
                  <div className="text-xl font-bold">+₹{dealingData.payout.toFixed(2)}</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xl">😔 {dealingData.winningSide.toUpperCase()} wins</div>
                  <div className="text-sm opacity-80">Better luck next time!</div>
                </div>
              )}
            </div>
          )}

          {showResult && dealingData?.isWin && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-confetti text-2xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: '-20px',
                    animationDelay: `${Math.random() * 0.5}s`,
                    animationDuration: `${1.5 + Math.random()}s`
                  }}
                >
                  {['🎉', '✨', '💰', '🌟', '🎊'][Math.floor(Math.random() * 5)]}
                </div>
              ))}
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
                    "h-16 text-lg transition-all duration-200",
                    choice === 'andar' ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/50' : ''
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
                    "h-16 text-lg transition-all duration-200",
                    choice === 'bahar' ? 'bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-400/50' : ''
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
                    className="transition-transform hover:scale-105"
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
              className={cn(
                "w-full h-14 text-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all duration-200",
                !isPlaying && "hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25"
              )}
              onClick={handlePlay}
              disabled={isPlaying || !betAmount}
              data-testid="btn-play"
            >
              {isPlaying ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {gamePhase === 'countdown' ? 'Starting...' : 'Dealing...'}
                </span>
              ) : (
                `Play (₹${betAmount})`
              )}
            </Button>

            {showResult && (
              <Button
                variant="outline"
                className="w-full"
                onClick={resetGame}
                data-testid="btn-play-again"
              >
                Play Again
              </Button>
            )}
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

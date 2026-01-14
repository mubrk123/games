import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, Sparkles } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DealerAnimation } from "@/components/animation/dealerAnimation";

const QUICK_BETS = [10, 50, 100, 500, 1000];

type GamePhase = 'idle' | 'countdown' | 'dealing-player' | 'dealing-dealer' | 'revealing' | 'result';

function Confetti({ count = 50 }: { count?: number }) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    delay: number;
    duration: number;
    color: string;
  }>>([]);

  useEffect(() => {
    const colors = ['#22c55e', '#fbbf24', '#ec4899', '#8b5cf6', '#06b6d4'];
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1 + Math.random() * 1,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setParticles(newParticles);
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full animate-confetti"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function SparkleEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <Sparkles
          key={i}
          className="absolute w-4 h-4 text-yellow-400 animate-sparkle"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

function CountdownDisplay({ value }: { value: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-lg">
      <div className="text-7xl font-heading font-bold text-white animate-countdown">
        {value}
      </div>
    </div>
  );
}

function DealingCard({ 
  card, 
  index, 
  isRevealed, 
  isPlayer,
  showAnimation 
}: { 
  card?: string; 
  index: number; 
  isRevealed: boolean; 
  isPlayer: boolean;
  showAnimation: boolean;
}) {
  const baseClasses = "w-14 h-20 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all duration-300";
  
  if (!showAnimation) {
    return (
      <div className={cn(
        baseClasses,
        isPlayer ? "bg-white/10 border-white/20" : "bg-red-900/30 border-red-500/20"
      )}>
        ?
      </div>
    );
  }

  if (!isRevealed) {
    return (
      <div 
        className={cn(
          baseClasses,
          "card-deal",
          isPlayer ? "bg-gradient-to-br from-blue-600 to-blue-800 border-blue-400/50" : "bg-gradient-to-br from-red-600 to-red-800 border-red-400/50"
        )}
        style={{ animationDelay: `${index * 0.2}s` }}
      >
        <div className="text-2xl">🎴</div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        baseClasses,
        "card-flip",
        isPlayer ? "bg-white/10 border-white/30" : "bg-red-900/30 border-red-500/30"
      )}
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      {card}
    </div>
  );
}

export default function TeenPattiGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [playerCardsDealt, setPlayerCardsDealt] = useState(0);
  const [dealerCardsDealt, setDealerCardsDealt] = useState(0);
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingResult, setPendingResult] = useState<{
    playerCards: string[];
    dealerCards: string[];
    playerHandRank: string;
    dealerHandRank: string;
    winner: 'player' | 'dealer' | 'tie';
    isWin: boolean;
    isTie: boolean;
    payout: number;
    betAmount: number;
    newBalance: number;
  } | null>(null);
  const [result, setResult] = useState<{
    playerCards: string[];
    dealerCards: string[];
    playerHandRank: string;
    dealerHandRank: string;
    winner: 'player' | 'dealer' | 'tie';
    isWin: boolean;
    isTie: boolean;
    payout: number;
  } | null>(null);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetGame = useCallback(() => {
    setGamePhase('idle');
    setCountdown(3);
    setPlayerCardsDealt(0);
    setDealerCardsDealt(0);
    setCardsRevealed(false);
    setShowConfetti(false);
    setPendingResult(null);
  }, []);

  useEffect(() => {
    if (gamePhase === 'countdown') {
      if (countdown > 0) {
        // SOUND CUE: Play countdown beep sound (beep.mp3) for each countdown number
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 800);
        return () => clearTimeout(timer);
      } else {
        // SOUND CUE: Play "dealing starts" sound (shuffle.mp3) when countdown ends
        setGamePhase('dealing-player');
      }
    }
  }, [gamePhase, countdown]);

  useEffect(() => {
    if (gamePhase === 'dealing-player') {
      if (playerCardsDealt < 3) {
        // SOUND CUE: Play card deal sound (card-deal.mp3) for each card dealt
        const timer = setTimeout(() => {
          setPlayerCardsDealt(prev => prev + 1);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        setGamePhase('dealing-dealer');
      }
    }
  }, [gamePhase, playerCardsDealt]);

  useEffect(() => {
    if (gamePhase === 'dealing-dealer') {
      if (dealerCardsDealt < 3) {
        // SOUND CUE: Play card deal sound (card-deal.mp3) for each dealer card
        const timer = setTimeout(() => {
          setDealerCardsDealt(prev => prev + 1);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        setGamePhase('revealing');
      }
    }
  }, [gamePhase, dealerCardsDealt]);

  useEffect(() => {
    if (gamePhase === 'revealing' && pendingResult) {
      // SOUND CUE: Play card flip sound (card-flip.mp3) when revealing cards
      const timer = setTimeout(() => {
        setCardsRevealed(true);
        
        setTimeout(() => {
          setGamePhase('result');
          setResult({
            playerCards: pendingResult.playerCards,
            dealerCards: pendingResult.dealerCards,
            playerHandRank: pendingResult.playerHandRank,
            dealerHandRank: pendingResult.dealerHandRank,
            winner: pendingResult.winner,
            isWin: pendingResult.isWin,
            isTie: pendingResult.isTie,
            payout: pendingResult.payout,
          });
          
          if (pendingResult.isWin) {
            // SOUND CUE: Play win celebration sound (win-fanfare.mp3) with confetti
            setShowConfetti(true);
            toast({
              title: `You Win with ${pendingResult.playerHandRank}!`,
              description: `+₹${pendingResult.payout.toFixed(2)}`,
              className: "bg-green-600 text-white border-none"
            });
          } else if (pendingResult.isTie) {
            // SOUND CUE: Play neutral tie sound (tie-chime.mp3)
            toast({
              title: `It's a Tie!`,
              description: `Bet returned`,
            });
          } else {
            // SOUND CUE: Play lose sound (lose-buzz.mp3)
            toast({
              title: `Dealer wins with ${pendingResult.dealerHandRank}`,
              description: `Lost ₹${pendingResult.betAmount.toFixed(2)}`,
              variant: "destructive"
            });
          }
          
          setCurrentUser({
            ...currentUser!,
            balance: pendingResult.newBalance
          });
          
          queryClient.invalidateQueries({ queryKey: ['casino-history'] });
        }, 800);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gamePhase, pendingResult, toast, setCurrentUser, currentUser, queryClient]);

  const playMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playTeenPatti(amount);
    },
    onMutate: () => {
      setResult(null);
      setShowConfetti(false);
      setCountdown(3);
      setPlayerCardsDealt(0);
      setDealerCardsDealt(0);
      setCardsRevealed(false);
      setGamePhase('countdown');
    },
    onSuccess: (data) => {
      setPendingResult({
        playerCards: data.playerCards,
        dealerCards: data.dealerCards,
        playerHandRank: data.playerHandRank,
        dealerHandRank: data.dealerHandRank,
        winner: data.winner,
        isWin: data.isWin,
        isTie: data.isTie,
        payout: data.payout,
        betAmount: data.betAmount,
        newBalance: data.newBalance,
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
    // SOUND CUE: Play bet placement sound (chip-stack.mp3) when deal button clicked
    playMutation.mutate();
  };

  const isPlaying = gamePhase !== 'idle' && gamePhase !== 'result';

  const renderPlayerCards = () => {
    if (gamePhase === 'idle' && !result) {
      return (
        <>
          <div className="w-14 h-20 rounded-lg bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl">?</div>
          <div className="w-14 h-20 rounded-lg bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl">?</div>
          <div className="w-14 h-20 rounded-lg bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl">?</div>
        </>
      );
    }

    if (result) {
      return result.playerCards.map((card, i) => (
        <div 
          key={i} 
          className={cn(
            "w-14 h-20 rounded-lg bg-white/10 border-2 border-white/30 flex items-center justify-center text-xl font-bold",
            result.isWin && "win-glow",
            !result.isWin && !result.isTie && "lose-shake"
          )}
        >
          {card}
        </div>
      ));
    }

    return [0, 1, 2].map((i) => (
      <DealingCard
        key={i}
        index={i}
        card={pendingResult?.playerCards[i]}
        isRevealed={cardsRevealed}
        isPlayer={true}
        showAnimation={i < playerCardsDealt}
      />
    ));
  };

  const renderDealerCards = () => {
    if (gamePhase === 'idle' && !result) {
      return (
        <>
          <div className="w-14 h-20 rounded-lg bg-red-900/30 border-2 border-red-500/20 flex items-center justify-center text-2xl">?</div>
          <div className="w-14 h-20 rounded-lg bg-red-900/30 border-2 border-red-500/20 flex items-center justify-center text-2xl">?</div>
          <div className="w-14 h-20 rounded-lg bg-red-900/30 border-2 border-red-500/20 flex items-center justify-center text-2xl">?</div>
        </>
      );
    }

    if (result) {
      return result.dealerCards.map((card, i) => (
        <div 
          key={i} 
          className={cn(
            "w-14 h-20 rounded-lg bg-red-900/30 border-2 border-red-500/30 flex items-center justify-center text-xl font-bold",
            result.winner === 'dealer' && "win-glow"
          )}
        >
          {card}
        </div>
      ));
    }

    return [0, 1, 2].map((i) => (
      <DealingCard
        key={i}
        index={i}
        card={pendingResult?.dealerCards[i]}
        isRevealed={cardsRevealed}
        isPlayer={false}
        showAnimation={i < dealerCardsDealt}
      />
    ));
  };

  const getPhaseText = () => {
    switch (gamePhase) {
      case 'countdown':
        return 'Get Ready...';
      case 'dealing-player':
        return 'Dealing your cards...';
      case 'dealing-dealer':
        return 'Dealing dealer cards...';
      case 'revealing':
        return 'Revealing cards...';
      default:
        return null;
    }
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
              <span className="text-2xl">🎴</span>
              Teen Patti
            </h1>
            <p className="text-sm text-muted-foreground">Beat the dealer with the best hand</p>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-br from-rose-900/50 to-pink-900/50 border-rose-500/30 relative overflow-hidden">
          {showConfetti && <Confetti />}
          {showConfetti && <SparkleEffect />}
          
          {gamePhase === 'countdown' && countdown > 0 && (
            <CountdownDisplay value={countdown} />
          )}
          
          {getPhaseText() && (
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm font-medium animate-pulse">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                {getPhaseText()}
              </span>
            </div>
          )}

          <div className="flex justify-center mb-6">
            <DealerAnimation 
              gamePhase={gamePhase} 
              isWin={result?.isWin}
              dealerName="Lucky Rose"
            />
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className={cn(
                "font-bold mb-3 text-lg transition-colors duration-300",
                result?.winner === 'player' ? "text-green-500" : ""
              )}>YOUR HAND</p>
              <div className="flex gap-2 justify-center mb-2">
                {renderPlayerCards()}
              </div>
              {result && (
                <p className={cn(
                  "text-sm transition-all duration-300",
                  result.isWin ? "text-green-400 font-medium" : "text-muted-foreground"
                )}>
                  {result.playerHandRank}
                </p>
              )}
            </div>

            <div className="text-center">
              <p className={cn(
                "font-bold mb-3 text-lg transition-colors duration-300",
                result?.winner === 'dealer' ? "text-red-500" : ""
              )}>DEALER</p>
              <div className="flex gap-2 justify-center mb-2">
                {renderDealerCards()}
              </div>
              {result && (
                <p className={cn(
                  "text-sm transition-all duration-300",
                  result.winner === 'dealer' ? "text-red-400 font-medium" : "text-muted-foreground"
                )}>
                  {result.dealerHandRank}
                </p>
              )}
            </div>
          </div>

          {result && (
            <div className={cn(
              "text-center py-3 rounded-lg mt-6 transition-all duration-500",
              result.isWin ? "bg-green-500/20 text-green-400 win-glow" : 
              result.isTie ? "bg-yellow-500/20 text-yellow-400" : 
              "bg-red-500/20 text-red-400"
            )}>
              <span className="text-lg font-bold">
                {result.isWin ? `🎉 You Won ₹${result.payout.toFixed(2)}!` : 
                 result.isTie ? '🤝 Tie - Bet Returned' : 
                 `😔 Dealer Wins`}
              </span>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
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

            <div className="text-sm text-muted-foreground space-y-1">
              <p>Win: 2x (3x for Pure Sequence or Trail)</p>
              <p>Tie: Bet returned</p>
            </div>

            <Button
              className={cn(
                "w-full h-14 text-lg bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 transition-all duration-300",
                isPlaying && "opacity-75 cursor-not-allowed"
              )}
              onClick={handlePlay}
              disabled={isPlaying || !betAmount}
              data-testid="btn-play"
            >
              {isPlaying ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {getPhaseText() || 'Please wait...'}
                </span>
              ) : (
                `Deal Cards (₹${betAmount})`
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-4 bg-card/50">
          <h3 className="font-bold mb-2">Hand Rankings (High to Low)</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between"><span>Trail (Three of a kind)</span><span className="text-primary">3x</span></div>
            <div className="flex justify-between"><span>Pure Sequence</span><span className="text-primary">3x</span></div>
            <div className="flex justify-between"><span>Sequence</span><span className="text-primary">2x</span></div>
            <div className="flex justify-between"><span>Color (Flush)</span><span className="text-primary">2x</span></div>
            <div className="flex justify-between"><span>Pair</span><span className="text-primary">2x</span></div>
            <div className="flex justify-between"><span>High Card</span><span className="text-primary">2x</span></div>
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

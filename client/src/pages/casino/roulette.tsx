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

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

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

type GamePhase = 'idle' | 'countdown' | 'spinning' | 'result';

export default function RouletteGame() {
  const [betAmount, setBetAmount] = useState('100');
  const [selectedBet, setSelectedBet] = useState<BetType>(BET_OPTIONS[0]);
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballPosition, setBallPosition] = useState(0);
  const [highlightedNumber, setHighlightedNumber] = useState<number | null>(null);
  const [result, setResult] = useState<{
    number: number;
    color: 'red' | 'black' | 'green';
    isWin: boolean;
    payout: number;
  } | null>(null);
  const [pendingResult, setPendingResult] = useState<any>(null);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getNumberColor = useCallback((num: number) => {
    if (num === 0) return 'green';
    return RED_NUMBERS.includes(num) ? 'red' : 'black';
  }, []);

  const getNumberBgClass = useCallback((num: number, isHighlighted: boolean = false) => {
    const color = getNumberColor(num);
    if (isHighlighted) {
      if (color === 'green') return 'bg-green-400 scale-125 shadow-lg shadow-green-400/50';
      if (color === 'red') return 'bg-red-400 scale-125 shadow-lg shadow-red-400/50';
      return 'bg-gray-400 scale-125 shadow-lg shadow-gray-400/50';
    }
    if (color === 'green') return 'bg-green-600';
    if (color === 'red') return 'bg-red-600';
    return 'bg-gray-900';
  }, [getNumberColor]);

  useEffect(() => {
    if (gamePhase === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (gamePhase === 'countdown' && countdown === 0) {
      setGamePhase('spinning');
    }
  }, [gamePhase, countdown]);

  useEffect(() => {
    if (gamePhase === 'spinning') {
      let frame = 0;
      const totalFrames = 60;
      const spinInterval = setInterval(() => {
        frame++;
        setWheelRotation(prev => prev + (15 - frame * 0.2));
        setBallPosition(prev => prev + (20 - frame * 0.25));
        
        const randomIdx = Math.floor(Math.random() * WHEEL_NUMBERS.length);
        setHighlightedNumber(WHEEL_NUMBERS[randomIdx]);
        
        if (frame >= totalFrames) {
          clearInterval(spinInterval);
          if (pendingResult) {
            setHighlightedNumber(pendingResult.number);
            setTimeout(() => {
              setGamePhase('result');
              setResult({
                number: pendingResult.number,
                color: pendingResult.color,
                isWin: pendingResult.isWin,
                payout: pendingResult.payout,
              });
              
              if (pendingResult.isWin) {
                toast({
                  title: `${pendingResult.number} ${pendingResult.color.toUpperCase()} - You Win!`,
                  description: `+₹${pendingResult.payout.toFixed(2)}`,
                  className: "bg-green-600 text-white border-none"
                });
              } else {
                toast({
                  title: `${pendingResult.number} ${pendingResult.color.toUpperCase()}`,
                  description: `Lost ₹${pendingResult.betAmount.toFixed(2)}`,
                  variant: "destructive"
                });
              }
              
              setCurrentUser({
                ...currentUser!,
                balance: pendingResult.newBalance
              });
              
              queryClient.invalidateQueries({ queryKey: ['casino-history'] });
              setPendingResult(null);
            }, 500);
          }
        }
      }, 50);
      return () => clearInterval(spinInterval);
    }
  }, [gamePhase, pendingResult, currentUser, setCurrentUser, queryClient, toast]);

  const playMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(betAmount);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');
      return await api.playRoulette(amount, selectedBet.type, selectedBet.value);
    },
    onMutate: () => {
      setResult(null);
      setCountdown(3);
      setGamePhase('countdown');
    },
    onSuccess: (data) => {
      setPendingResult(data);
    },
    onError: (error: any) => {
      setGamePhase('idle');
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
    setHighlightedNumber(null);
  };

  const potentialWin = parseFloat(betAmount) * selectedBet.payout;
  const isPlaying = gamePhase !== 'idle' && gamePhase !== 'result';

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

        <Card className="p-6 bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-green-500/30 relative overflow-hidden">
          {gamePhase === 'countdown' && (
            <div className="absolute inset-0 bg-black/70 z-20 flex items-center justify-center">
              <div className="text-center">
                <div 
                  key={countdown}
                  className="text-8xl font-bold text-yellow-400 animate-countdown"
                  data-testid="text-countdown"
                >
                  {countdown > 0 ? countdown : 'GO!'}
                </div>
                <p className="text-xl text-white mt-4">Get Ready!</p>
              </div>
            </div>
          )}

          <div className="flex justify-center mb-4">
            <DealerAnimation 
              gamePhase={gamePhase} 
              isWin={result?.isWin}
              dealerName="Victoria Belle"
            />
          </div>

          <div className="relative flex items-center justify-center py-4 mb-4">
            <div 
              className="relative w-64 h-64 md:w-72 md:h-72"
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              <div className="absolute inset-0 rounded-full border-8 border-yellow-600 bg-gradient-to-br from-amber-900 to-yellow-900 shadow-2xl">
                {WHEEL_NUMBERS.map((num, idx) => {
                  const angle = (idx * 360) / WHEEL_NUMBERS.length;
                  const isHighlighted = highlightedNumber === num;
                  return (
                    <div
                      key={num}
                      className="absolute"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `rotate(${angle}deg) translateY(-110px)`,
                        transformOrigin: '0 0',
                      }}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 md:w-7 md:h-7 -ml-3 -mt-3 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold text-white transition-all duration-150",
                          getNumberBgClass(num, isHighlighted)
                        )}
                        style={{
                          transform: `rotate(-${angle + wheelRotation}deg)`,
                        }}
                      >
                        {num}
                      </div>
                    </div>
                  );
                })}
                
                <div className="absolute inset-8 rounded-full bg-gradient-to-br from-green-800 to-green-900 border-4 border-yellow-700 flex items-center justify-center">
                  <div className="text-yellow-400 text-2xl font-bold">🎰</div>
                </div>
              </div>
            </div>

            {gamePhase === 'spinning' && (
              <div
                className="absolute w-4 h-4 bg-white rounded-full shadow-lg shadow-white/50 z-10"
                style={{
                  animation: 'ballSpin 0.3s linear infinite',
                  left: `calc(50% + ${Math.cos(ballPosition * 0.1) * 100}px)`,
                  top: `calc(50% + ${Math.sin(ballPosition * 0.1) * 100}px)`,
                }}
              />
            )}

            <div 
              className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 z-10"
              style={{
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderTop: '20px solid #facc15',
              }}
            />
          </div>

          <div className="flex items-center justify-center py-4">
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold border-4 transition-all duration-500",
              gamePhase === 'spinning' && "border-yellow-500",
              gamePhase === 'result' && result?.isWin && "win-glow border-green-400",
              gamePhase === 'result' && result && !result.isWin && "lose-shake border-red-400",
              gamePhase === 'idle' && "border-border bg-card",
              result ? getNumberBgClass(result.number) : ""
            )}>
              {gamePhase === 'spinning' ? (
                <span className="animate-pulse">?</span>
              ) : result?.number !== undefined ? (
                result.number
              ) : (
                '?'
              )}
            </div>
          </div>

          {gamePhase === 'result' && result && (
            <div className={cn(
              "text-center py-4 rounded-lg transition-all",
              result.isWin ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              <div className={cn(
                "text-2xl font-bold mb-2",
                result.isWin ? "text-green-400 win-glow" : "text-red-400 lose-shake"
              )}>
                {result.isWin ? (
                  <>
                    <span className="animate-bounce inline-block">🎉</span>
                    {' '}YOU WON!{' '}
                    <span className="animate-bounce inline-block">🎉</span>
                  </>
                ) : (
                  'Better luck next time!'
                )}
              </div>
              <p className={cn(
                "text-lg",
                result.isWin ? "text-green-300" : "text-red-300"
              )}>
                {result.number} {result.color.toUpperCase()}
                {result.isWin && ` • +₹${result.payout.toFixed(2)}`}
              </p>
              
              {result.isWin && (
                <div className="flex justify-center gap-2 mt-3">
                  {[...Array(8)].map((_, i) => (
                    <span 
                      key={i}
                      className="text-xl animate-confetti"
                      style={{ 
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${1.5 + Math.random()}s`
                      }}
                    >
                      {['🎊', '⭐', '✨', '💰', '🌟'][i % 5]}
                    </span>
                  ))}
                </div>
              )}
              
              <Button 
                onClick={resetGame} 
                className="mt-4"
                variant="outline"
                data-testid="btn-play-again"
              >
                Play Again
              </Button>
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
                      "h-12 flex flex-col text-xs transition-all",
                      selectedBet.type === opt.type && selectedBet.value === opt.value && opt.value === 'red' ? 'bg-red-600 hover:bg-red-700' : '',
                      selectedBet.type === opt.type && selectedBet.value === opt.value && opt.value === 'black' ? 'bg-gray-800 hover:bg-gray-900' : '',
                      selectedBet.type === opt.type && selectedBet.value === opt.value && !['red', 'black'].includes(opt.value) ? 'bg-green-600 hover:bg-green-700' : ''
                    )}
                    onClick={() => setSelectedBet(opt)}
                    disabled={isPlaying}
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
              <span>Payout: {selectedBet.payout}x ({selectedBet.label})</span>
              <span>Potential Win: ₹{potentialWin.toFixed(2)}</span>
            </div>

            <Button
              className={cn(
                "w-full h-14 text-lg transition-all",
                isPlaying 
                  ? "bg-yellow-600 hover:bg-yellow-700" 
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              )}
              onClick={handlePlay}
              disabled={isPlaying || !betAmount}
              data-testid="btn-play"
            >
              {gamePhase === 'countdown' ? `Starting in ${countdown}...` :
               gamePhase === 'spinning' ? 'Spinning...' : 
               gamePhase === 'result' ? 'Spin Again' :
               `Spin (₹${betAmount})`}
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

      <style>{`
        @keyframes ballSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AppShell>
  );
}

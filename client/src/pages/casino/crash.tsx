import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Rocket, TrendingUp, Shield, Zap } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const QUICK_STAKES = [10, 50, 100, 500, 1000];
const QUICK_MULTIPLIERS = [1.5, 2, 3, 5, 10];

type GamePhase = "waiting" | "flying" | "crashed" | "cashedOut";

export default function CrashGame() {
  const [stakeAmount, setStakeAmount] = useState('100');
  const [selectedStakeIndex, setSelectedStakeIndex] = useState<number | null>(null);
  const [cashoutMultiplier, setCashoutMultiplier] = useState('2.00');
  const [selectedMultIndex, setSelectedMultIndex] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("waiting");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [payout, setPayout] = useState<number>(0);
  const [rocketY, setRocketY] = useState(100);
  
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetCrashRef = useRef<number>(0);
  const autoCashoutRef = useRef<number>(2.0);
  const stakeRef = useRef<number>(100);
  const hasCashedOutRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([1]);
  
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const drawGraph = useCallback((history: number[], phase: GamePhase) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = height - (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    if (history.length < 2) return;
    
    const maxMult = Math.max(...history, 2);
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    
    if (phase === "crashed") {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.8)');
    } else if (phase === "cashedOut") {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0.8)');
    } else {
      gradient.addColorStop(0, 'rgba(251, 191, 36, 0.3)');
      gradient.addColorStop(1, 'rgba(251, 191, 36, 0.8)');
    }
    
    ctx.beginPath();
    ctx.moveTo(0, height);
    
    history.forEach((mult, i) => {
      const x = (i / Math.max(history.length - 1, 1)) * width;
      const y = height - ((mult - 1) / Math.max(maxMult - 1, 1)) * height * 0.85;
      ctx.lineTo(x, Math.max(y, 10));
    });
    
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    history.forEach((mult, i) => {
      const x = (i / Math.max(history.length - 1, 1)) * width;
      const y = height - ((mult - 1) / Math.max(maxMult - 1, 1)) * height * 0.85;
      if (i === 0) {
        ctx.moveTo(x, Math.max(y, 10));
      } else {
        ctx.lineTo(x, Math.max(y, 10));
      }
    });
    
    if (phase === "crashed") {
      ctx.strokeStyle = '#ef4444';
    } else if (phase === "cashedOut") {
      ctx.strokeStyle = '#22c55e';
    } else {
      ctx.strokeStyle = '#fbbf24';
    }
    ctx.lineWidth = 3;
    ctx.stroke();
    
    if (history.length > 1) {
      const lastMult = history[history.length - 1];
      const lastY = height - ((lastMult - 1) / Math.max(maxMult - 1, 1)) * height * 0.85;
      setRocketY(Math.max((lastY / height) * 100, 5));
    }
  }, []);

  const handleCashout = useCallback(() => {
    if (gamePhase !== "flying" || hasCashedOutRef.current) return;
    
    hasCashedOutRef.current = true;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const winAmount = parseFloat(stakeAmount) * currentMultiplier;
    setPayout(winAmount);
    setGamePhase("cashedOut");
    
    if (currentUser) {
      const newBalance = currentUser.balance + winAmount;
      setCurrentUser({ ...currentUser, balance: newBalance });
      
      fetch('/api/casino/crash/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stakeAmount: parseFloat(stakeAmount),
          cashoutMultiplier: currentMultiplier,
          crashPoint: targetCrashRef.current,
          isWin: true,
          payout: winAmount
        })
      });
    }
    
    toast({
      title: `Cashed out at ${currentMultiplier.toFixed(2)}x! 🚀`,
      description: `Won ₹${winAmount.toFixed(2)}`,
      className: "bg-green-600 text-white border-none"
    });
    
    queryClient.invalidateQueries({ queryKey: ['casino-history'] });
  }, [gamePhase, currentMultiplier, stakeAmount, currentUser, setCurrentUser, toast, queryClient]);

  const triggerAutoCashout = useCallback((multiplier: number) => {
    if (hasCashedOutRef.current) return;
    
    hasCashedOutRef.current = true;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const winAmount = stakeRef.current * multiplier;
    setPayout(winAmount);
    setGamePhase("cashedOut");
    drawGraph(historyRef.current, "cashedOut");
    
    if (currentUser) {
      const newBalance = currentUser.balance + winAmount;
      setCurrentUser({ ...currentUser, balance: newBalance });
    }
    
    toast({
      title: `Auto cashed out at ${multiplier.toFixed(2)}x! 🚀`,
      description: `Won ₹${winAmount.toFixed(2)}`,
      className: "bg-green-600 text-white border-none"
    });
    
    queryClient.invalidateQueries({ queryKey: ['casino-history'] });
  }, [currentUser, setCurrentUser, toast, queryClient, drawGraph]);

  const startGame = useCallback((targetCrash: number, autoCashout: number, stake: number) => {
    targetCrashRef.current = targetCrash;
    autoCashoutRef.current = autoCashout;
    stakeRef.current = stake;
    hasCashedOutRef.current = false;
    startTimeRef.current = Date.now();
    historyRef.current = [1];
    setGamePhase("flying");
    setCurrentMultiplier(1.00);
    setCrashPoint(null);
    setPayout(0);
    setRocketY(100);
    
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const mult = Math.pow(1.05, elapsed * 10);
      const roundedMult = Math.round(mult * 100) / 100;
      
      setCurrentMultiplier(roundedMult);
      historyRef.current = [...historyRef.current.slice(-100), roundedMult];
      drawGraph(historyRef.current, "flying");
      
      // Check auto-cashout FIRST (before crash check)
      if (roundedMult >= autoCashoutRef.current && !hasCashedOutRef.current) {
        triggerAutoCashout(autoCashoutRef.current);
        return;
      }
      
      // Then check if crashed
      if (roundedMult >= targetCrashRef.current && !hasCashedOutRef.current) {
        setGamePhase("crashed");
        setCrashPoint(targetCrashRef.current);
        drawGraph(historyRef.current, "crashed");
        animationRef.current = null;
        return;
      }
      
      if (hasCashedOutRef.current) {
        drawGraph(historyRef.current, "cashedOut");
        return;
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [drawGraph, triggerAutoCashout]);

  useEffect(() => {
    if (gamePhase === "crashed" && !hasCashedOutRef.current && crashPoint) {
      toast({
        title: `Crashed at ${crashPoint.toFixed(2)}x 💥`,
        description: `Lost ₹${parseFloat(stakeAmount).toFixed(2)}`,
        variant: "destructive"
      });
      
      if (currentUser) {
        const newBalance = currentUser.balance - parseFloat(stakeAmount);
        setCurrentUser({ ...currentUser, balance: newBalance });
      }
      
      queryClient.invalidateQueries({ queryKey: ['casino-history'] });
    }
  }, [gamePhase, crashPoint]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handlePlay = () => {
    if (!currentUser) {
      toast({ title: "Please login", variant: "destructive" });
      return;
    }
    
    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    
    if (amount > currentUser.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    
    const crash = 1 + Math.random() * Math.random() * 10;
    const roundedCrash = Math.round(crash * 100) / 100;
    const autoCashout = parseFloat(cashoutMultiplier) || 2.0;
    
    startGame(roundedCrash, autoCashout, amount);
  };

  const handleNewGame = () => {
    setGamePhase("waiting");
    setCurrentMultiplier(1.00);
    historyRef.current = [1];
    setCrashPoint(null);
    setPayout(0);
    setRocketY(100);
    drawGraph([1], "waiting");
  };

  const selectStake = (amount: number, index: number) => {
    setStakeAmount(amount.toString());
    setSelectedStakeIndex(index);
  };

  const selectMultiplier = (mult: number, index: number) => {
    setCashoutMultiplier(mult.toFixed(2));
    setSelectedMultIndex(index);
  };

  const isFlying = gamePhase === "flying";
  const isWaiting = gamePhase === "waiting";
  const isCrashed = gamePhase === "crashed";
  const isCashedOut = gamePhase === "cashedOut";

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pb-20 md:pb-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/casino">
            <Button variant="ghost" size="icon" data-testid="button-back">
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

        <Card className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 border-orange-500/30 overflow-hidden">
          <div className="relative aspect-[16/10] bg-black/60 rounded-xl mb-4 overflow-hidden">
            <canvas 
              ref={canvasRef}
              width={400}
              height={250}
              className="absolute inset-0 w-full h-full"
            />
            
            {isFlying && (
              <div 
                className="absolute right-8 transition-all duration-75 ease-out z-10"
                style={{
                  top: `${rocketY}%`,
                  transform: 'translateY(-50%) rotate(-45deg)'
                }}
              >
                <Rocket className="w-10 h-10 text-orange-500 drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-8 bg-gradient-to-t from-orange-500 via-yellow-400 to-transparent rounded-full blur-sm animate-pulse" />
              </div>
            )}
            
            {(isCrashed || isCashedOut) && (
              <div 
                className="absolute right-8 z-10"
                style={{
                  top: `${rocketY}%`,
                  transform: 'translateY(-50%)'
                }}
              >
                {isCrashed ? (
                  <div className="text-4xl animate-ping">💥</div>
                ) : (
                  <div className="text-4xl">🎉</div>
                )}
              </div>
            )}
            
            <div className="absolute top-4 left-4 z-20">
              <div className={cn(
                "text-5xl md:text-6xl font-bold font-mono transition-all drop-shadow-lg",
                isFlying && "text-yellow-400",
                isCrashed && "text-red-500",
                isCashedOut && "text-green-400",
                isWaiting && "text-white/50"
              )}>
                {currentMultiplier.toFixed(2)}x
              </div>
              
              {isFlying && (
                <div className="flex items-center gap-1 text-yellow-400 text-sm mt-1">
                  <TrendingUp className="w-4 h-4 animate-pulse" />
                  <span>Flying...</span>
                </div>
              )}
              
              {isCrashed && (
                <div className="text-red-400 text-sm mt-1 font-semibold">
                  CRASHED!
                </div>
              )}
              
              {isCashedOut && (
                <div className="text-green-400 text-sm mt-1 font-semibold">
                  +₹{payout.toFixed(2)}
                </div>
              )}
            </div>
            
            {isFlying && (
              <Button
                className="absolute bottom-4 right-4 z-20 bg-green-600 hover:bg-green-700 h-12 px-6 text-lg font-bold animate-pulse"
                onClick={handleCashout}
                data-testid="button-cashout"
              >
                <Zap className="w-5 h-5 mr-2" />
                CASHOUT ₹{(parseFloat(stakeAmount) * currentMultiplier).toFixed(0)}
              </Button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Stake Amount</label>
              <Input
                type="number"
                value={stakeAmount}
                onChange={(e) => {
                  setStakeAmount(e.target.value);
                  setSelectedStakeIndex(null);
                }}
                className="text-lg font-mono bg-black/30 border-white/20"
                min="10"
                disabled={isFlying}
                data-testid="input-stake-amount"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_STAKES.map((amount, idx) => (
                  <Button
                    key={amount}
                    variant={selectedStakeIndex === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectStake(amount, idx)}
                    disabled={isFlying}
                    className={cn(
                      "text-xs transition-all",
                      selectedStakeIndex === idx && "bg-orange-600 hover:bg-orange-700 border-orange-500 ring-2 ring-orange-400"
                    )}
                    data-testid={`button-stake-${amount}`}
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
                onChange={(e) => {
                  setCashoutMultiplier(e.target.value);
                  setSelectedMultIndex(null);
                }}
                className="text-lg font-mono bg-black/30 border-white/20"
                min="1.01"
                step="0.01"
                disabled={isFlying}
                data-testid="input-auto-cashout"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_MULTIPLIERS.map((mult, idx) => (
                  <Button
                    key={mult}
                    variant={selectedMultIndex === idx ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectMultiplier(mult, idx)}
                    disabled={isFlying}
                    className={cn(
                      "text-xs transition-all",
                      selectedMultIndex === idx && "bg-yellow-600 hover:bg-yellow-700 border-yellow-500 ring-2 ring-yellow-400"
                    )}
                    data-testid={`button-mult-${mult}`}
                  >
                    {mult}x
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-black/40 mb-4 flex justify-between items-center">
            <div>
              <span className="text-sm text-muted-foreground">Potential Win: </span>
              <span className="text-lg font-bold text-green-400">
                ₹{(parseFloat(stakeAmount || '0') * parseFloat(cashoutMultiplier || '0')).toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Balance: </span>
              <span className="text-lg font-bold text-white">
                ₹{currentUser?.balance.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          {isWaiting ? (
            <Button 
              className="w-full h-14 text-lg gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
              onClick={handlePlay}
              disabled={!currentUser}
              data-testid="button-launch"
            >
              <Rocket className="w-5 h-5" />
              Launch (₹{parseFloat(stakeAmount || '0').toFixed(0)})
            </Button>
          ) : (isCrashed || isCashedOut) ? (
            <Button 
              className="w-full h-14 text-lg gap-2"
              onClick={handleNewGame}
              data-testid="button-new-game"
            >
              Play Again
            </Button>
          ) : (
            <Button 
              className="w-full h-14 text-lg gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleCashout}
              data-testid="button-cashout-main"
            >
              <Zap className="w-5 h-5" />
              CASHOUT NOW - ₹{(parseFloat(stakeAmount) * currentMultiplier).toFixed(2)}
            </Button>
          )}
        </Card>

        <Card className="p-4 bg-slate-900/50">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">How to Play</span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Set your stake and launch the rocket</li>
            <li>• Watch the multiplier grow in real-time</li>
            <li>• Hit <span className="text-green-400 font-semibold">CASHOUT</span> anytime before crash to win</li>
            <li>• If you don't cashout before crash, you lose</li>
            <li>• Higher multipliers = bigger risk & reward!</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}

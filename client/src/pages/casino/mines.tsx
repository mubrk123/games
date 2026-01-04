import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bomb, Gem, Hand, Zap } from "lucide-react";
import { Link } from "wouter";

export default function MinesGame() {
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [mineCount, setMineCount] = useState(5);
  const [tilesToReveal, setTilesToReveal] = useState(3);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  
  // Game state
  const [gameId, setGameId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealedTiles, setRevealedTiles] = useState<number[]>([]);
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [nextMultiplier, setNextMultiplier] = useState(1);
  const [potentialCashout, setPotentialCashout] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [multiplierTable, setMultiplierTable] = useState<{tiles: number; multiplier: number}[]>([]);

  // Check for active game on mount
  useEffect(() => {
    checkActiveGame();
  }, []);

  const checkActiveGame = async () => {
    try {
      const result = await api.minesGetActive();
      if (result.active && result.gameId) {
        setGameId(result.gameId);
        setIsPlaying(true);
        setRevealedTiles(result.revealedTiles || []);
        setCurrentMultiplier(result.currentMultiplier || 1);
        setPotentialCashout(result.potentialCashout || 0);
        setMineCount(result.mineCount || 5);
        setBetAmount(result.betAmount?.toString() || "100");
      }
    } catch (error) {
      // No active game
    }
  };

  const handleStartGame = async () => {
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid bet", description: "Please enter a valid bet amount", variant: "destructive" });
      return;
    }

    if (currentUser && amount > currentUser.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setIsPlaying(true);
    setGameOver(false);
    setIsWin(false);
    setRevealedTiles([]);
    setMinePositions([]);
    setCurrentMultiplier(1);

    try {
      const result = await api.minesStart(amount, mineCount);
      setGameId(result.gameId);
      setMultiplierTable(result.multiplierTable);
      setPotentialCashout(amount);
      
      // Calculate next multiplier
      if (result.multiplierTable.length > 0) {
        setNextMultiplier(result.multiplierTable[0].multiplier);
      }
      
      if (currentUser) {
        setCurrentUser({ ...currentUser, balance: result.newBalance });
      }
      
      toast({ title: "Game Started", description: "Click tiles to reveal gems. Avoid the mines!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsPlaying(false);
    }
  };

  const handleRevealTile = async (tileIndex: number) => {
    if (!gameId || gameOver || revealedTiles.includes(tileIndex) || isRevealing) return;

    setIsRevealing(true);

    try {
      const result = await api.minesReveal(gameId, tileIndex);
      
      setRevealedTiles(result.revealedTiles);
      
      if (result.isMine) {
        // Game over - hit a mine
        setMinePositions(result.minePositions || []);
        setGameOver(true);
        setIsWin(false);
        setGameId(null);
        
        toast({ 
          title: "BOOM! 💥", 
          description: "You hit a mine!", 
          variant: "destructive" 
        });
      } else {
        // Safe tile
        setCurrentMultiplier(result.currentMultiplier || 1);
        setNextMultiplier(result.nextMultiplier || result.currentMultiplier || 1);
        setPotentialCashout(result.potentialCashout || 0);
        
        // Check if auto-cashout (all safe tiles revealed)
        if (result.gameOver && result.isWin) {
          setMinePositions(result.minePositions || []);
          setGameOver(true);
          setIsWin(true);
          setGameId(null);
          
          if (currentUser && result.payout) {
            // Get updated balance
            const activeResult = await api.minesGetActive();
            if (!activeResult.active) {
              const user = await api.getCurrentUser();
              setCurrentUser({
                ...currentUser,
                balance: parseFloat(user.user.balance)
              });
            }
          }
          
          toast({ 
            title: "Perfect! 🎉", 
            description: `You revealed all gems! Won ₹${result.payout?.toFixed(2)}` 
          });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCashout = async () => {
    if (!gameId) return;

    try {
      const result = await api.minesCashout(gameId);
      
      setMinePositions(result.minePositions);
      setGameOver(true);
      setIsWin(true);
      setGameId(null);
      
      if (currentUser) {
        setCurrentUser({ ...currentUser, balance: result.newBalance });
      }
      
      toast({ 
        title: "Cashed Out! 💰", 
        description: `You won ₹${result.payout.toFixed(2)} at ${result.multiplier}x!` 
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAutoPlay = async () => {
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid bet", description: "Please enter a valid bet amount", variant: "destructive" });
      return;
    }

    if (currentUser && amount > currentUser.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setIsPlaying(true);
    setGameOver(false);
    setIsWin(false);
    setRevealedTiles([]);
    setMinePositions([]);
    setIsRevealing(true);

    try {
      const result = await api.playMines(amount, mineCount, tilesToReveal);
      
      // Animate reveals one by one
      for (let i = 0; i < result.revealedTiles.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setRevealedTiles(prev => [...prev, result.revealedTiles[i]]);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setMinePositions(result.minePositions);
      setGameOver(true);
      setIsWin(result.isWin);
      setCurrentMultiplier(result.multiplier);
      
      if (currentUser) {
        setCurrentUser({ ...currentUser, balance: result.newBalance });
      }
      
      toast({
        title: result.isWin ? `Won ${result.multiplier}x! 💰` : "BOOM! 💥",
        description: result.isWin 
          ? `You won ₹${result.payout.toFixed(2)}!` 
          : "You hit a mine!",
        variant: result.isWin ? "default" : "destructive"
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsRevealing(false);
      setIsPlaying(false);
    }
  };

  const resetGame = () => {
    setGameId(null);
    setIsPlaying(false);
    setGameOver(false);
    setIsWin(false);
    setRevealedTiles([]);
    setMinePositions([]);
    setCurrentMultiplier(1);
    setPotentialCashout(0);
  };

  const getTileContent = (index: number) => {
    const isRevealed = revealedTiles.includes(index);
    const isMine = minePositions.includes(index);
    
    if (!isRevealed && !gameOver) {
      return null;
    }
    
    if (isMine) {
      return <Bomb className="w-6 h-6 text-red-500" />;
    }
    
    if (isRevealed) {
      return <Gem className="w-6 h-6 text-green-400" />;
    }
    
    // Game over, show unrevealed gems
    if (gameOver && !isMine) {
      return <Gem className="w-5 h-5 text-gray-500" />;
    }
    
    return null;
  };

  const safeRevealed = revealedTiles.filter(t => !minePositions.includes(t)).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-4 pb-20 md:pb-6">
        <div className="flex items-center gap-4">
          <Link href="/casino">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-heading font-bold">Mines</h1>
        </div>

        {/* Multiplier Display */}
        {isPlaying && !gameOver && (
          <Card className="p-4 bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-green-700">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Current Multiplier</p>
                <p className="text-2xl font-bold text-green-400">{currentMultiplier.toFixed(2)}x</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Potential Cashout</p>
                <p className="text-2xl font-bold text-yellow-400">₹{potentialCashout.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Next Tile</p>
                <p className="text-lg font-bold text-blue-400">{nextMultiplier.toFixed(2)}x</p>
              </div>
            </div>
          </Card>
        )}

        {/* Game Grid */}
        <Card className="p-4 bg-gradient-to-br from-gray-800 to-gray-950 border-gray-700">
          <div className="grid grid-cols-5 gap-2 p-2">
            {Array.from({ length: 25 }).map((_, i) => {
              const isRevealed = revealedTiles.includes(i);
              const isMine = minePositions.includes(i);
              const wasHit = isRevealed && isMine;
              const canClick = isPlaying && !gameOver && !isRevealed && !isRevealing && mode === 'manual';

              return (
                <motion.button
                  key={i}
                  onClick={() => canClick && handleRevealTile(i)}
                  disabled={!canClick}
                  initial={false}
                  animate={isRevealed ? { 
                    scale: [1, 1.1, 1],
                    rotateY: 180
                  } : {}}
                  transition={{ duration: 0.3 }}
                  className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                    wasHit 
                      ? 'bg-red-600' 
                      : isRevealed 
                        ? 'bg-green-600' 
                        : gameOver && isMine
                          ? 'bg-red-900/50'
                          : gameOver
                            ? 'bg-gray-700'
                            : canClick
                              ? 'bg-gray-700 hover:bg-gray-600 hover:scale-105 cursor-pointer'
                              : 'bg-gray-700/50'
                  }`}
                  data-testid={`mine-tile-${i}`}
                >
                  <AnimatePresence>
                    {(isRevealed || gameOver) && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        {getTileContent(i)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Game Status */}
          {isPlaying && !gameOver && mode === 'manual' && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                {safeRevealed} gems revealed • {25 - mineCount - safeRevealed} gems remaining
              </p>
              <Button 
                onClick={handleCashout} 
                disabled={safeRevealed === 0}
                className="bg-yellow-600 hover:bg-yellow-700"
                size="lg"
              >
                Cashout ₹{potentialCashout.toFixed(2)}
              </Button>
            </div>
          )}

          {/* Result */}
          <AnimatePresence>
            {gameOver && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center py-4"
              >
                <span className={`text-3xl font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                  {isWin ? `${currentMultiplier.toFixed(2)}x WIN!` : 'BOOM! 💥'}
                </span>
                <p className={`text-lg ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                  {isWin 
                    ? `+₹${(parseFloat(betAmount) * currentMultiplier - parseFloat(betAmount)).toFixed(0)}` 
                    : `-₹${parseFloat(betAmount).toFixed(0)}`
                  }
                </p>
                <Button onClick={resetGame} className="mt-4" variant="outline">
                  Play Again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Controls */}
        {!isPlaying && (
          <Card className="p-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'auto')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="manual" className="gap-2">
                  <Hand className="w-4 h-4" /> Manual
                </TabsTrigger>
                <TabsTrigger value="auto" className="gap-2">
                  <Zap className="w-4 h-4" /> Auto
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Mines (1-24)</label>
                    <Input
                      type="number"
                      value={mineCount}
                      onChange={(e) => setMineCount(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
                      min="1"
                      max="24"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      More mines = Higher payouts
                    </p>
                  </div>
                  
                  <TabsContent value="auto" className="mt-0">
                    <label className="text-sm text-muted-foreground mb-2 block">Tiles to Reveal</label>
                    <Input
                      type="number"
                      value={tilesToReveal}
                      onChange={(e) => setTilesToReveal(Math.min(25 - mineCount, Math.max(1, parseInt(e.target.value) || 1)))}
                      min="1"
                      max={25 - mineCount}
                    />
                  </TabsContent>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Bet Amount</label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="10"
                  />
                </div>

                <div className="flex gap-2">
                  {[50, 100, 500, 1000].map(amount => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setBetAmount(amount.toString())}
                    >
                      ₹{amount}
                    </Button>
                  ))}
                </div>

                <TabsContent value="manual" className="mt-0">
                  <Button onClick={handleStartGame} size="lg" className="w-full">
                    Start Game
                  </Button>
                </TabsContent>

                <TabsContent value="auto" className="mt-0">
                  <Button onClick={handleAutoPlay} size="lg" className="w-full" disabled={isRevealing}>
                    {isRevealing ? "Revealing..." : "Auto Play"}
                  </Button>
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        )}

        {/* Payout Table */}
        {!isPlaying && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Payout Table ({mineCount} mines)</h3>
            <div className="grid grid-cols-5 gap-2 text-xs">
              {Array.from({ length: Math.min(10, 25 - mineCount) }).map((_, i) => {
                const tiles = i + 1;
                const safeTiles = 25 - mineCount;
                let mult = 1;
                for (let j = 0; j < tiles; j++) {
                  const remaining = 25 - j;
                  const safe = safeTiles - j;
                  mult *= (remaining / safe) * 0.98;
                }
                mult = Math.round(mult * 100) / 100;
                return (
                  <div key={i} className="text-center p-2 rounded bg-gray-800">
                    <div className="text-muted-foreground">{tiles} 💎</div>
                    <div className="font-bold text-green-400">{mult.toFixed(2)}x</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

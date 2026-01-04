import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { Link } from "wouter";

function PlayingCard({ card, isFlipping = false, delay = 0 }: { card?: string; isFlipping?: boolean; delay?: number }) {
  const getCardDisplay = (card: string) => {
    const value = card.slice(0, -1);
    const suit = card.slice(-1);
    return `${value}${suit}`;
  };

  const isRed = card?.includes('♥') || card?.includes('♦');

  if (isFlipping) {
    return (
      <motion.div
        animate={{ rotateY: [0, 180, 360] }}
        transition={{ repeat: Infinity, duration: 0.6 }}
        className="w-24 h-36 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center text-4xl shadow-xl"
      >
        🂠
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.5 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, type: "spring" }}
      className={`w-24 h-36 rounded-xl flex items-center justify-center text-3xl font-bold shadow-xl ${
        isRed ? 'bg-white text-red-500' : 'bg-white text-gray-900'
      }`}
    >
      {card ? getCardDisplay(card) : '?'}
    </motion.div>
  );
}

export default function HiLoGame() {
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const [betAmount, setBetAmount] = useState("100");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dealerName] = useState("Lucky Liu");

  const handlePlay = async (guess: 'higher' | 'lower') => {
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
    setIsFlipping(true);
    setResult(null);

    try {
      // Card flipping animation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const gameResult = await api.playHiLo(amount, guess);
      setIsFlipping(false);
      setResult(gameResult);
      
      if (currentUser) {
        setCurrentUser({ ...currentUser, balance: gameResult.newBalance });
      }

      setTimeout(() => {
        toast({
          title: gameResult.isWin ? "Correct!" : "Wrong!",
          description: gameResult.isWin 
            ? `You won ₹${gameResult.payout.toFixed(2)}!` 
            : `You lost ₹${amount.toFixed(2)}`,
          variant: gameResult.isWin ? "default" : "destructive"
        });
      }, 1000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsFlipping(false);
    } finally {
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6 pb-20 md:pb-6">
        <div className="flex items-center gap-4">
          <Link href="/casino">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-heading font-bold">Hi-Lo</h1>
        </div>

        <Card className="p-6 bg-gradient-to-br from-indigo-900 to-violet-950 border-indigo-700 min-h-[400px]">
          {/* Dealer */}
          <div className="text-center mb-6">
            <motion.div
              animate={isFlipping ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: isFlipping ? Infinity : 0, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/30"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium">{dealerName}</span>
            </motion.div>
            <p className="text-sm text-muted-foreground mt-2">
              {isFlipping ? "Drawing cards..." : result ? "Result!" : "Will the next card be higher or lower?"}
            </p>
          </div>

          {/* Cards Display */}
          <div className="flex justify-center items-center gap-8 py-8">
            {/* First Card */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">First Card</p>
              {result ? (
                <PlayingCard card={result.firstCard} />
              ) : isFlipping ? (
                <PlayingCard isFlipping />
              ) : (
                <div className="w-24 h-36 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center text-4xl">
                  🂠
                </div>
              )}
            </div>

            {/* Arrow Indicator */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`text-4xl ${result.isWin ? 'text-green-400' : 'text-red-400'}`}
                >
                  {result.isWin ? '✓' : '✗'}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Second Card */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Next Card</p>
              {result ? (
                <PlayingCard card={result.nextCard} delay={0.5} />
              ) : isFlipping ? (
                <PlayingCard isFlipping />
              ) : (
                <div className="w-24 h-36 rounded-xl border-2 border-dashed border-white/30 flex items-center justify-center text-4xl text-white/30">
                  ?
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-4"
              >
                <span className={`text-2xl font-bold ${result.isWin ? 'text-green-400' : 'text-red-400'}`}>
                  {result.isWin ? `YOU WIN! +₹${result.payout.toFixed(0)}` : 'WRONG GUESS'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Betting Controls */}
        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Bet Amount</label>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Enter bet amount"
                min="10"
                disabled={isPlaying}
              />
            </div>
            <div className="flex gap-2">
              {[50, 100, 500, 1000].map(amount => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setBetAmount(amount.toString())}
                  disabled={isPlaying}
                >
                  ₹{amount}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => handlePlay('higher')} 
                disabled={isPlaying}
                className="bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <ArrowUp className="w-5 h-5 mr-2" />
                Higher
              </Button>
              <Button 
                onClick={() => handlePlay('lower')} 
                disabled={isPlaying}
                className="bg-red-600 hover:bg-red-700"
                size="lg"
              >
                <ArrowDown className="w-5 h-5 mr-2" />
                Lower
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

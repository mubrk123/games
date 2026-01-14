// import { useRef, useState } from "react";
// import { AppShell } from "@/components/layout/AppShell";
// import { Card } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { useStore } from "@/lib/store";
// import { api } from "@/lib/api";
// import { useToast } from "@/hooks/use-toast";
// import { motion, AnimatePresence } from "framer-motion";
// import { ArrowLeft } from "lucide-react";
// import { Link } from "wouter";

// /* ================= CONFIG ================= */

// const ROWS = 16;

// const MULTIPLIERS = {
//   low:    [1.5,1.2,1.1,1,0.5,1,1.1,1.2,1.5],
//   medium: [3,1.5,1.2,0.5,0.3,0.5,1.2,1.5,3],
//   high:   [10,3,1.5,0.5,0.2,0.5,1.5,3,10],
// };

// const BALL_COLORS = ["#facc15", "#fb923c", "#22c55e", "#38bdf8", "#a78bfa"];

// /* ================= AUDIO ENGINE ================= */

// function useCasinoSounds() {
//   const drop = useRef<HTMLAudioElement | null>(null);
//   const peg  = useRef<HTMLAudioElement | null>(null);
//   const win  = useRef<HTMLAudioElement | null>(null);
//   const lose = useRef<HTMLAudioElement | null>(null);

//   const lastPegTime = useRef(0);

//   const init = () => {
//     if (drop.current) return;

//     drop.current = new Audio("/sounds/drop.mp3");
//     peg.current  = new Audio("/sounds/peg.mp3");
//     win.current  = new Audio("/sounds/win.mp3");
//     lose.current = new Audio("/sounds/lose.mp3");

//     drop.current.volume = 0.4;
//     peg.current.volume  = 0.15;
//     win.current.volume  = 0.6;
//     lose.current.volume = 0.5;
//   };

//   const playDrop = () => {
//     init();
//     drop.current!.currentTime = 0;
//     drop.current!.play().catch(() => {});
//   };

//   const playPeg = () => {
//     init();
//     const now = Date.now();
//     if (now - lastPegTime.current < 80) return; // throttle
//     lastPegTime.current = now;
//     peg.current!.currentTime = 0;
//     peg.current!.play().catch(() => {});
//   };

//   const playWin = () => {
//     init();
//     win.current!.currentTime = 0;
//     win.current!.play().catch(() => {});
//   };

//   const playLose = () => {
//     init();
//     lose.current!.currentTime = 0;
//     lose.current!.play().catch(() => {});
//   };

//   return { playDrop, playPeg, playWin, playLose };
// }

// /* ================= TYPES ================= */

// type Risk = "low" | "medium" | "high";

// type Ball = {
//   id: number;
//   x: number;
//   y: number;
//   color: string;
// };

// /* ================= MAIN ================= */

// export default function PlinkoGame() {
//   const { currentUser, setCurrentUser } = useStore();
//   const { toast } = useToast();
//   const sounds = useCasinoSounds();

//   const [betAmount, setBetAmount] = useState("100");
//   const [risk, setRisk] = useState<Risk>("medium");
//   const [ballCount, setBallCount] = useState(1);
//   const [balls, setBalls] = useState<Ball[]>([]);
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [result, setResult] = useState<any>(null);

//   const ballId = useRef(0);

//   /* ================= GAME FLOW ================= */

//   const startGame = async () => {
//     const amount = parseFloat(betAmount);
//     if (!amount || amount <= 0) {
//       toast({ title: "Invalid bet", variant: "destructive" });
//       return;
//     }

//     if (currentUser && amount * ballCount > currentUser.balance) {
//       toast({ title: "Insufficient balance", variant: "destructive" });
//       return;
//     }

//     setIsPlaying(true);
//     setBalls([]);
//     setResult(null);

//     sounds.playDrop();

//     try {
//       const game = await api.playPlinko(amount, risk, ROWS);

//       for (let b = 0; b < ballCount; b++) {
//         const id = ++ballId.current;
//         let x = 50;

//         setBalls(prev => [
//           ...prev,
//           { id, x: 50, y: 0, color: BALL_COLORS[b % BALL_COLORS.length] },
//         ]);

//         for (let i = 0; i < ROWS; i++) {
//           await sleep(90);
//           sounds.playPeg();

//           x += game.path[i] === "L" ? -3 : 3;

//           setBalls(prev =>
//             prev.map(ball =>
//               ball.id === id
//                 ? { ...ball, x, y: ((i + 1) / ROWS) * 100 }
//                 : ball
//             )
//           );
//         }
//       }

//       setResult(game);
//       setCurrentUser?.({ ...currentUser!, balance: game.newBalance });

//       game.isWin ? sounds.playWin() : sounds.playLose();
//     } catch (e: any) {
//       toast({ title: "Error", description: e.message, variant: "destructive" });
//     } finally {
//       setTimeout(() => setIsPlaying(false), 800);
//     }
//   };

//   /* ================= UI ================= */

//   return (
//     <AppShell>
//       <div className="max-w-md mx-auto px-3 pb-28 space-y-6">

//         <div className="flex items-center gap-3">
//           <Link href="/casino">
//             <Button variant="ghost" size="icon"><ArrowLeft /></Button>
//           </Link>
//           <h1 className="text-xl font-bold">Plinko</h1>
//         </div>

//         <Card className="relative overflow-hidden rounded-2xl
//           bg-gradient-to-b from-[#020617] to-black
//           border border-cyan-500/20">

//           <div className="relative h-[360px]">

//             {/* PEGS */}
//             {Array.from({ length: 8 }).map((_, row) => (
//               <div
//                 key={row}
//                 className="absolute w-full flex justify-center gap-6"
//                 style={{ top: `${(row + 1) * 36}px` }}
//               >
//                 {Array.from({ length: row + 3 }).map((_, col) => (
//                   <div
//                     key={col}
//                     className="w-2.5 h-2.5 rounded-full bg-cyan-300/70"
//                   />
//                 ))}
//               </div>
//             ))}

//             {/* BALLS */}
//             <AnimatePresence>
//               {balls.map(ball => (
//                 <motion.div
//                   key={ball.id}
//                   className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full"
//                   animate={{
//                     left: `${ball.x}%`,
//                     top: `${ball.y}%`,
//                   }}
//                   transition={{
//                     left: { type: "spring", stiffness: 180, damping: 24 },
//                     top:  { type: "spring", stiffness: 180, damping: 24 },
//                   }}
//                   style={{ background: ball.color }}
//                 >
//                   <motion.div
//                     className="absolute inset-0 rounded-full"
//                     animate={{
//                       boxShadow: [
//                         `0 0 6px ${ball.color}`,
//                         `0 0 14px ${ball.color}`,
//                       ],
//                     }}
//                     transition={{
//                       duration: 0.6,
//                       repeat: Infinity,
//                       repeatType: "reverse",
//                     }}
//                   />
//                 </motion.div>
//               ))}
//             </AnimatePresence>

//             {/* MULTIPLIERS */}
//             <div className="absolute bottom-0 left-0 right-0 flex gap-1 px-2">
//               {MULTIPLIERS[risk].map((m, i) => (
//                 <div
//                   key={i}
//                   className="flex-1 py-2 rounded-t-lg text-xs font-bold text-center"
//                   style={{
//                     background:
//                       m >= 3 ? "#16a34a" :
//                       m >= 1.5 ? "#ca8a04" :
//                       m >= 1 ? "#2563eb" :
//                       "#dc2626",
//                   }}
//                 >
//                   {m}x
//                 </div>
//               ))}
//             </div>
//           </div>
//         </Card>

//         <Card className="p-4 space-y-4">
//           <div className="grid grid-cols-3 gap-2">
//             {(["low","medium","high"] as Risk[]).map(r => (
//               <Button
//                 key={r}
//                 variant={risk === r ? "default" : "outline"}
//                 onClick={() => setRisk(r)}
//                 disabled={isPlaying}
//                 className="capitalize"
//               >
//                 {r}
//               </Button>
//             ))}
//           </div>

//           <Input
//             type="number"
//             value={betAmount}
//             onChange={e => setBetAmount(e.target.value)}
//             disabled={isPlaying}
//           />

//           <div className="flex gap-2">
//             {[1,3,5].map(c => (
//               <Button
//                 key={c}
//                 variant={ballCount === c ? "default" : "outline"}
//                 onClick={() => setBallCount(c)}
//               >
//                 {c} Ball
//               </Button>
//             ))}
//           </div>

//           <Button
//             onClick={startGame}
//             disabled={isPlaying}
//             size="lg"
//             className="bg-gradient-to-r from-cyan-500 to-blue-600"
//           >
//             {isPlaying ? "Dropping..." : "Drop Ball"}
//           </Button>
//         </Card>
//       </div>
//     </AppShell>
//   );
// }

// /* ================= UTILS ================= */

// const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

import { useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

/* ================= CONFIG ================= */

const ROWS = 16;

const MULTIPLIERS = {
  low: [1.4, 1.2, 1.1, 1, 0.9, 0.8, 0.9, 1, 1.1, 1.2, 1.4],
  medium: [3, 2, 1.4, 1, 0.9, 0.7, 0.9, 1, 1.4, 2, 3],
  high: [15, 10, 5, 2, 1, 0.6, 0.2, 0.6, 1, 2, 5, 10, 15],
};

const BALL_COLORS = ["#facc15", "#fb923c", "#22c55e", "#38bdf8", "#a78bfa"];

/* ================= AUDIO ================= */

function useCasinoSounds() {
  const peg = useRef<HTMLAudioElement | null>(null);
  const win = useRef<HTMLAudioElement | null>(null);
  const lose = useRef<HTMLAudioElement | null>(null);
  const lastPegTime = useRef(0);

  const init = () => {
    if (peg.current) return;
    peg.current = new Audio("/sounds/peg.mp3");
    win.current = new Audio("/sounds/win.mp3");
    lose.current = new Audio("/sounds/lose.mp3");
    peg.current.volume = 0.15;
    win.current.volume = 0.6;
    lose.current.volume = 0.5;
  };

  const playPeg = () => {
    init();
    const now = Date.now();
    if (now - lastPegTime.current < 80) return;
    lastPegTime.current = now;
    peg.current!.currentTime = 0;
    peg.current!.play().catch(() => {});
  };

  const playWin = () => {
    init();
    win.current!.currentTime = 0;
    win.current!.play().catch(() => {});
  };

  const playLose = () => {
    init();
    lose.current!.currentTime = 0;
    lose.current!.play().catch(() => {});
  };

  return { playPeg, playWin, playLose };
}

/* ================= TYPES ================= */

type Risk = "low" | "medium" | "high";

type Ball = {
  id: number;
  x: number;
  y: number;
  color: string;
};

/* ================= UTILS ================= */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const getMultiplierFromX = (x: number, risk: Risk) => {
  const arr = MULTIPLIERS[risk];
  const width = 100 / arr.length;
  const idx = Math.min(arr.length - 1, Math.max(0, Math.floor(x / width)));
  return arr[idx];
};

/* ================= MAIN ================= */

export default function PlinkoGame() {
  const { currentUser, setCurrentUser } = useStore();
  const { toast } = useToast();
  const sounds = useCasinoSounds();

  const [betAmount, setBetAmount] = useState("100");
  const [risk, setRisk] = useState<Risk>("medium");
  const [ballCount, setBallCount] = useState(1);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);

  const ballId = useRef(0);

  const startGame = async () => {
    const amount = Number(betAmount);
    if (!amount || amount <= 0) return;

    if (!currentUser || amount * ballCount > currentUser.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setIsPlaying(true);
    setLastResult(null);
    setBalls([]);

    let localBalls: Ball[] = [];

    for (let b = 0; b < ballCount; b++) {
      let x = 50;
      const id = ++ballId.current;

      localBalls.push({
        id,
        x,
        y: 0,
        color: BALL_COLORS[b % BALL_COLORS.length],
      });

      setBalls([...localBalls]);

      for (let i = 0; i < ROWS; i++) {
        await sleep(160);
        sounds.playPeg();

        const drift =
          Math.abs(x - 50) > 20 ? (x > 50 ? -0.15 : 0.15) : 0;

        const step = Math.random() + drift < 0.5 ? -3 : 3;
        x += step + (Math.random() - 0.5) * 0.8;

        localBalls = localBalls.map(ball =>
          ball.id === id
            ? { ...ball, x, y: ((i + 1) / ROWS) * 100 }
            : ball
        );

        setBalls([...localBalls]);
      }
    }

    let totalWin = 0;
    localBalls.forEach(ball => {
      totalWin += amount * getMultiplierFromX(ball.x, risk);
    });

    const totalBet = amount * ballCount;
    const netResult = Math.floor(totalWin - totalBet);
    const newBalance = currentUser.balance + netResult;

    setCurrentUser({
      ...currentUser,
      balance: Math.max(0, newBalance),
    });

    setLastResult(netResult);
    netResult > 0 ? sounds.playWin() : sounds.playLose();

    setTimeout(() => setIsPlaying(false), 600);
  };

  /* ================= UI ================= */

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-3 pb-28 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/casino">
            <Button variant="ghost" size="icon">
              <ArrowLeft />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Plinko</h1>
        </div>

        <Card className="relative overflow-hidden rounded-2xl bg-black border border-cyan-500/20">
          <div className="relative h-[360px]">

            {/* PEGS / STONES */}
            {Array.from({ length: 8 }).map((_, row) => (
              <div
                key={row}
                className="absolute w-full flex justify-center gap-6 pointer-events-none"
                style={{ top: `${(row + 1) * 36}px` }}
              >
                {Array.from({ length: row + 3 }).map((_, col) => (
                  <div
                    key={col}
                    className="w-2.5 h-2.5 rounded-full bg-cyan-300/70 shadow-[0_0_6px_rgba(34,211,238,0.6)]"
                  />
                ))}
              </div>
            ))}

            {/* BALLS */}
            <AnimatePresence>
              {balls.map(ball => (
                <motion.div
                  key={ball.id}
                  className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full"
                  animate={{ left: `${ball.x}%`, top: `${ball.y}%` }}
                  transition={{
                    top: { duration: 0.18, ease: "easeOut" },
                    left: { type: "spring", stiffness: 120, damping: 14 },
                  }}
                  style={{ background: ball.color }}
                />
              ))}
            </AnimatePresence>

            {/* MULTIPLIERS */}
            <div className="absolute bottom-0 left-0 right-0 flex gap-1 px-2">
              {MULTIPLIERS[risk].map((m, i) => (
                <div
                  key={i}
                  className="flex-1 py-2 rounded-t-lg text-xs font-bold text-center"
                  style={{
                    background:
                      m >= 10 ? "#16a34a" :
                      m >= 3 ? "#22c55e" :
                      m >= 1 ? "#2563eb" :
                      "#dc2626",
                  }}
                >
                  {m}x
                </div>
              ))}
            </div>
          </div>
        </Card>

        {lastResult !== null && (
          <Card className="p-3 text-center text-sm font-bold">
            {lastResult > 0
              ? `You won ₹${lastResult}`
              : `You lost ₹${Math.abs(lastResult)}`}
          </Card>
        )}

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as Risk[]).map(r => (
              <Button
                key={r}
                variant={risk === r ? "default" : "outline"}
                onClick={() => setRisk(r)}
                disabled={isPlaying}
                className="capitalize"
              >
                {r}
              </Button>
            ))}
          </div>

          <Input
            type="number"
            value={betAmount}
            onChange={e => setBetAmount(e.target.value)}
            disabled={isPlaying}
          />

          <div className="flex gap-2">
            {[1, 3, 5].map(c => (
              <Button
                key={c}
                variant={ballCount === c ? "default" : "outline"}
                onClick={() => setBallCount(c)}
                disabled={isPlaying}
              >
                {c} Ball
              </Button>
            ))}
          </div>

          <Button
            onClick={startGame}
            disabled={isPlaying}
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-blue-600"
          >
            {isPlaying ? "Dropping..." : "Drop Ball"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

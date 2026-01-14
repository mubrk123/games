import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface DealerAnimationProps {
  gamePhase: string;
  isWin?: boolean;
  dealerName?: string;
  className?: string;
}

export function DealerAnimation({ 
  gamePhase, 
  isWin,
  dealerName = "Lucky Rose",
  className 
}: DealerAnimationProps) {
  const [message, setMessage] = useState("");
  const [expression, setExpression] = useState<"neutral" | "dealing" | "excited" | "sympathetic">("neutral");

  useEffect(() => {
    switch (gamePhase) {
      case "idle":
        setMessage("Place your bet to begin!");
        setExpression("neutral");
        break;
      case "countdown":
        setMessage("Get ready...");
        setExpression("dealing");
        break;
      case "dealing-player":
      case "dealing-dealer":
      case "dealing":
      case "joker-reveal":
        setMessage("Here come the cards...");
        setExpression("dealing");
        break;
      case "revealing":
        setMessage("Let's see what we have...");
        setExpression("dealing");
        break;
      case "result":
        if (isWin) {
          setMessage("Congratulations! 🎉");
          setExpression("excited");
        } else {
          setMessage("Better luck next time!");
          setExpression("sympathetic");
        }
        break;
      default:
        setMessage("Welcome to the table!");
        setExpression("neutral");
    }
  }, [gamePhase, isWin]);

  const getExpressionEmoji = () => {
    switch (expression) {
      case "dealing":
        return "🎴";
      case "excited":
        return "🎊";
      case "sympathetic":
        return "💝";
      default:
        return "✨";
    }
  };

  return (
    <motion.div 
      className={cn(
        "relative flex flex-col items-center gap-2",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="relative"
        animate={{
          scale: expression === "dealing" ? [1, 1.02, 1] : 1,
        }}
        transition={{
          duration: 0.5,
          repeat: expression === "dealing" ? Infinity : 0,
          repeatType: "reverse"
        }}
      >
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-white/20 shadow-lg">
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              className="text-4xl"
              animate={{
                rotate: expression === "excited" ? [0, -5, 5, 0] : 0,
                scale: expression === "excited" ? [1, 1.1, 1] : 1
              }}
              transition={{
                duration: 0.4,
                repeat: expression === "excited" ? 3 : 0
              }}
            >
              👩‍💼
            </motion.div>
          </div>
          
          <AnimatePresence>
            {expression === "dealing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute bottom-0 right-0 text-lg"
              >
                🃏
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <motion.div 
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center shadow-md"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 360]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <span className="text-xs">{getExpressionEmoji()}</span>
        </motion.div>
      </motion.div>
      
      <div className="text-center">
        <motion.div 
          className="text-xs font-medium text-white/80"
          key={message}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {message}
        </motion.div>
        <div className="text-[10px] text-white/50 mt-0.5">{dealerName}</div>
      </div>
      
      <AnimatePresence>
        {expression === "excited" && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-lg pointer-events-none"
                initial={{ 
                  opacity: 0, 
                  scale: 0,
                  x: 0,
                  y: 0
                }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.5],
                  x: (Math.random() - 0.5) * 100,
                  y: -50 - Math.random() * 50
                }}
                transition={{ 
                  duration: 1,
                  delay: i * 0.1,
                  ease: "easeOut"
                }}
              >
                {["✨", "🎉", "💫", "⭐", "🌟", "💎"][i]}
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function DealerBubble({ 
  message, 
  show,
  variant = "info"
}: { 
  message: string; 
  show: boolean;
  variant?: "info" | "win" | "lose";
}) {
  const variantStyles = {
    info: "bg-gradient-to-r from-blue-500/90 to-purple-500/90",
    win: "bg-gradient-to-r from-green-500/90 to-emerald-500/90",
    lose: "bg-gradient-to-r from-gray-500/90 to-gray-600/90"
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          className={cn(
            "absolute top-full mt-2 px-3 py-1.5 rounded-full text-xs font-medium text-white shadow-lg",
            variantStyles[variant]
          )}
        >
          {message}
          <div className={cn(
            "absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45",
            variant === "info" ? "bg-blue-500" : variant === "win" ? "bg-green-500" : "bg-gray-500"
          )} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CardDealingHand({ isDealing }: { isDealing: boolean }) {
  return (
    <AnimatePresence>
      {isDealing && (
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ 
            x: [0, 30, 0],
            opacity: 1,
            rotate: [0, -10, 0]
          }}
          exit={{ x: 50, opacity: 0 }}
          transition={{
            x: { duration: 0.8, repeat: Infinity },
            rotate: { duration: 0.8, repeat: Infinity }
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-3xl"
        >
          🤚
        </motion.div>
      )}
    </AnimatePresence>
  );
}

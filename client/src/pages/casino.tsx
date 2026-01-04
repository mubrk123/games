import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Dices, Rocket, Cherry, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, CasinoGame } from "@/lib/api";
import { Link } from "wouter";
import { useStore } from "@/lib/store";

const GAME_ICONS: Record<string, React.ReactNode> = {
  slots: <Cherry className="w-8 h-8" />,
  crash: <Rocket className="w-8 h-8" />,
  dice: <Dices className="w-8 h-8" />,
  roulette: <div className="w-8 h-8 text-2xl">🎰</div>,
  blackjack: <div className="w-8 h-8 text-2xl">🃏</div>,
  andar_bahar: <div className="w-8 h-8 text-2xl">🃏</div>,
  teen_patti: <div className="w-8 h-8 text-2xl">🎴</div>,
  lucky_7: <div className="w-8 h-8 text-2xl">7️⃣</div>,
  hi_lo: <div className="w-8 h-8 text-2xl">↕️</div>,
  dragon_tiger: <div className="w-8 h-8 text-2xl">🐉</div>,
  plinko: <div className="w-8 h-8 text-2xl">⚪</div>,
  wheel: <div className="w-8 h-8 text-2xl">🎡</div>,
  mines: <div className="w-8 h-8 text-2xl">💣</div>,
};

const GAME_GRADIENTS: Record<string, string> = {
  slots: "from-purple-600 to-pink-600",
  crash: "from-orange-500 to-red-600",
  dice: "from-blue-500 to-cyan-500",
  roulette: "from-green-600 to-emerald-500",
  blackjack: "from-gray-700 to-gray-900",
  andar_bahar: "from-amber-500 to-orange-600",
  teen_patti: "from-rose-500 to-pink-600",
  lucky_7: "from-yellow-500 to-amber-600",
  hi_lo: "from-indigo-500 to-violet-600",
  dragon_tiger: "from-red-600 to-orange-500",
  plinko: "from-cyan-500 to-blue-600",
  wheel: "from-yellow-400 to-red-500",
  mines: "from-gray-600 to-red-700",
};

export default function Casino() {
  const { currentUser } = useStore();
  
  const { data, isLoading } = useQuery({
    queryKey: ['casino-games'],
    queryFn: async () => {
      const result = await api.getCasinoGames();
      return result.games;
    },
  });

  const games = data || [];

  return (
    <AppShell>
      <div className="flex flex-col gap-6 pb-20 md:pb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading font-bold text-primary neon-glow" data-testid="casino-title">
            Casino
          </h1>
          <p className="text-muted-foreground">
            Play provably fair games with instant payouts
          </p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
          <Shield className="w-5 h-5 text-primary" />
          <p className="text-sm">
            <span className="font-semibold text-primary">Provably Fair</span> - Verify every game result using cryptographic proofs
          </p>
        </div>

        {!currentUser && (
          <Card className="p-6 text-center border-yellow-500/30 bg-yellow-500/5">
            <p className="text-yellow-400 mb-4">Please log in to play casino games</p>
            <Link href="/auth/login">
              <Button variant="default">Log In</Button>
            </Link>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-card/50 animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No games available</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {games.map((game) => (
              <GameCard key={game.id} game={game} disabled={!currentUser} />
            ))}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-xl font-heading font-bold mb-4">Coming Soon</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-50">
            {['Baccarat', 'Poker', 'Keno', 'Sic Bo'].map((name) => (
              <Card key={name} className="p-4 text-center">
                <div className="text-3xl mb-2">🔒</div>
                <p className="text-sm font-medium">{name}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function GameCard({ game, disabled }: { game: CasinoGame; disabled: boolean }) {
  const gradient = GAME_GRADIENTS[game.type] || "from-gray-600 to-gray-800";
  const icon = GAME_ICONS[game.type] || <Play className="w-8 h-8" />;
  
  return (
    <Link href={disabled ? "#" : `/casino/${game.slug}`}>
      <Card 
        className={`group relative overflow-hidden cursor-pointer border-border/50 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-primary/20 hover:scale-[1.02] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        data-testid={`game-card-${game.slug}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        <div className="relative p-3 sm:p-4 md:p-6 flex flex-col h-full min-h-[160px] sm:min-h-[180px] md:min-h-[200px]">
          <div className="flex items-center justify-between mb-auto">
            <div className="p-2 sm:p-3 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
                {icon}
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px] sm:text-xs px-1.5 sm:px-2">
              {game.type.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          
          <div className="mt-auto">
            <h3 className="text-base sm:text-lg md:text-xl font-heading font-bold text-white mb-0.5 sm:mb-1 truncate">
              {game.name}
            </h3>
            <p className="text-xs sm:text-sm text-white/70 mb-2 sm:mb-4 line-clamp-1 sm:line-clamp-2">
              {game.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="text-[10px] sm:text-xs text-white/60">
                <span>₹{parseFloat(game.minBet).toFixed(0)}</span>
                <span className="mx-1 sm:mx-2">-</span>
                <span>₹{parseFloat(game.maxBet).toLocaleString()}</span>
              </div>
              <Button 
                size="sm" 
                className="gap-1 sm:gap-2 h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play className="w-3 h-3 sm:w-4 sm:h-4" /> Play
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

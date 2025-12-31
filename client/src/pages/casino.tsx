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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-card/50 animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No games available</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <GameCard key={game.id} game={game} disabled={!currentUser} />
            ))}
          </div>
        )}

        <div className="mt-6">
          <h2 className="text-xl font-heading font-bold mb-4">Coming Soon</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-50">
            {['Blackjack', 'Baccarat', 'Poker', 'Hi-Lo'].map((name) => (
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
        className={`group relative overflow-hidden cursor-pointer border-border/50 hover:border-primary/50 transition-all shadow-lg hover:shadow-primary/20 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        data-testid={`game-card-${game.slug}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        <div className="relative p-6 flex flex-col h-full min-h-[200px]">
          <div className="flex items-center justify-between mb-auto">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
              {icon}
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {game.type.toUpperCase()}
            </Badge>
          </div>
          
          <div className="mt-auto">
            <h3 className="text-xl font-heading font-bold text-white mb-1">
              {game.name}
            </h3>
            <p className="text-sm text-white/70 mb-4 line-clamp-2">
              {game.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/60">
                <span>Min: ₹{parseFloat(game.minBet).toFixed(0)}</span>
                <span className="mx-2">•</span>
                <span>Max: ₹{parseFloat(game.maxBet).toLocaleString()}</span>
              </div>
              <Button 
                size="sm" 
                className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play className="w-4 h-4" /> Play
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

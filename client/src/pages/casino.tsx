import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";

export default function Casino() {
  const games = [
    { id: 1, name: "Teen Patti Live", category: "Cards", image: "linear-gradient(45deg, #FF6B6B, #556270)" },
    { id: 2, name: "Andar Bahar", category: "Cards", image: "linear-gradient(45deg, #4ECDC4, #556270)" },
    { id: 3, name: "Lightning Roulette", category: "Table", image: "linear-gradient(45deg, #FFD93D, #FF6B6B)" },
    { id: 4, name: "Crazy Time", category: "Show", image: "linear-gradient(45deg, #6C5B7B, #C06C84)" },
    { id: 5, name: "Speed Baccarat", category: "Cards", image: "linear-gradient(45deg, #F7CAC9, #92A8D1)" },
    { id: 6, name: "Dragon Tiger", category: "Cards", image: "linear-gradient(45deg, #A8E6CF, #DCEDC1)" },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-heading font-bold text-primary neon-glow">Live Casino</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full">All Games</Button>
            <Button variant="ghost" className="rounded-full">Table</Button>
            <Button variant="ghost" className="rounded-full">Slots</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {games.map((game) => (
            <div key={game.id} className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border border-border/50 hover:border-primary/50 transition-all shadow-lg hover:shadow-primary/20">
              <div 
                className="absolute inset-0 transition-transform duration-500 group-hover:scale-110"
                style={{ background: game.image }} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
              
              <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <div className="text-xs text-primary font-bold uppercase tracking-wider mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {game.category}
                </div>
                <h3 className="text-xl font-heading font-bold text-white mb-2">{game.name}</h3>
                <Button size="sm" className="w-full opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                  <Play className="w-4 h-4" /> Play Now
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

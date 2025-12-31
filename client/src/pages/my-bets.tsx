import { AppShell } from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function MyBets() {
  const { currentUser } = useStore();

  const { data: betsData, isLoading } = useQuery({
    queryKey: ['my-bets'],
    queryFn: async () => {
      const result = await api.getUserBets();
      return result.bets || [];
    },
    enabled: !!currentUser,
  });

  const bets = betsData || [];
  const openBets = bets.filter((b: any) => b.status === 'OPEN');
  const settledBets = bets.filter((b: any) => b.status !== 'OPEN');

  if (!currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p className="text-muted-foreground mb-4">Please login to view your bets</p>
          <Link href="/login">
            <Button>Login</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const BetCard = ({ bet }: { bet: any }) => {
    const isBack = bet.type === 'BACK';
    const statusIcons = {
      OPEN: <Clock className="h-4 w-4" />,
      WON: <CheckCircle className="h-4 w-4 text-green-500" />,
      LOST: <XCircle className="h-4 w-4 text-red-500" />,
      VOID: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    };

    return (
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant={isBack ? "default" : "secondary"} className={isBack ? "bg-blue-500/20 text-blue-400" : "bg-pink-500/20 text-pink-400"}>
            {bet.type}
          </Badge>
          <div className="flex items-center gap-1.5 text-sm">
            {statusIcons[bet.status as keyof typeof statusIcons]}
            <span className={bet.status === 'WON' ? 'text-green-500' : bet.status === 'LOST' ? 'text-red-500' : ''}>
              {bet.status}
            </span>
          </div>
        </div>

        <div>
          <p className="font-medium text-sm">{bet.runnerName || 'Selection'}</p>
          <p className="text-xs text-muted-foreground">{bet.matchName || 'Match'}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-muted-foreground text-[10px]">Odds</p>
            <p className="font-bold">{parseFloat(bet.odds).toFixed(2)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-muted-foreground text-[10px]">Stake</p>
            <p className="font-bold">₹{parseFloat(bet.stake).toLocaleString()}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-muted-foreground text-[10px]">Profit</p>
            <p className={`font-bold ${bet.status === 'WON' ? 'text-green-500' : ''}`}>
              ₹{parseFloat(bet.potentialProfit).toFixed(0)}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          {new Date(bet.createdAt).toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-bold">My Bets</h1>

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="open" data-testid="tab-open-bets">
              Open ({openBets.length})
            </TabsTrigger>
            <TabsTrigger value="settled" data-testid="tab-settled-bets">
              Settled ({settledBets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : openBets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-2">No open bets</p>
                <Link href="/">
                  <Button variant="outline" size="sm">Place a Bet</Button>
                </Link>
              </div>
            ) : (
              openBets.map((bet: any) => <BetCard key={bet.id} bet={bet} />)
            )}
          </TabsContent>

          <TabsContent value="settled" className="mt-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : settledBets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No settled bets yet
              </div>
            ) : (
              settledBets.map((bet: any) => <BetCard key={bet.id} bet={bet} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

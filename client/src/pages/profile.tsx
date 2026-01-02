import { AppShell } from "@/components/layout/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, Award, LogOut, ChevronRight, Settings, HelpCircle, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";

export default function Profile() {
  const { currentUser, logout } = useStore();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  if (!currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <h2 className="text-xl font-bold mb-2">Not Logged In</h2>
          <p className="text-muted-foreground mb-4">Please login to view your profile</p>
          <Link href="/login">
            <Button>Login</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const menuItems = [
    { icon: Wallet, label: "Withdrawals & Transactions", href: "/withdrawals" },
    { icon: TrendingUp, label: "Play History", href: "/my-bets" },
    { icon: Award, label: "Promotions & Bonuses", href: "#" },
    { icon: Shield, label: "Responsible Gaming", href: "#" },
    { icon: Settings, label: "Settings", href: "#" },
    { icon: HelpCircle, label: "Help & Support", href: "#" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold mx-auto mb-3">
            {currentUser.username[0].toUpperCase()}
          </div>
          <h1 className="text-xl font-bold">{currentUser.username}</h1>
          <p className="text-sm text-muted-foreground capitalize">{currentUser.role.toLowerCase()} Account</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Wallet className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</p>
              <p className="font-bold text-lg text-primary">
                {currentUser.currency} {currentUser.balance.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/20 to-red-500/5 border-red-500/20">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 text-red-400 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Exposure</p>
              <p className="font-bold text-lg text-red-400">
                {currentUser.currency} {currentUser.exposure.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-1">
          {menuItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <Button 
          variant="outline" 
          className="w-full h-12 text-red-500 border-red-500/30 hover:bg-red-500/10"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </AppShell>
  );
}

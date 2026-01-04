import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Home, Trophy, Gamepad2, Ticket, User, Users, Wallet, Settings, BarChart3 } from "lucide-react";
import { useStore } from "@/lib/store";

export function BottomNav() {
  const [location] = useLocation();
  const { currentUser } = useStore();

  const role = currentUser?.role?.toUpperCase();
  const isAdmin = role === 'ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // Admin-specific navigation
  const adminNavItems = [
    { href: "/admin", icon: Home, label: "Dashboard", testId: "nav-admin-home" },
    { href: "/admin/users", icon: Users, label: "Users", testId: "nav-admin-users" },
    { href: "/withdrawals", icon: Wallet, label: "Wallet", testId: "nav-admin-wallet" },
    { href: "/my-bets", icon: Ticket, label: "My Plays", testId: "nav-admin-plays" },
    { href: "/profile", icon: User, label: "Profile", testId: "nav-admin-profile" },
  ];

  // Super Admin navigation
  const superAdminNavItems = [
    { href: "/admin", icon: Home, label: "Dashboard", testId: "nav-super-home" },
    { href: "/admin/users", icon: Users, label: "Users", testId: "nav-super-users" },
    { href: "/admin/stats", icon: BarChart3, label: "Stats", testId: "nav-super-stats" },
    { href: "/withdrawals", icon: Wallet, label: "Wallet", testId: "nav-super-wallet" },
    { href: "/profile", icon: User, label: "Profile", testId: "nav-super-profile" },
  ];

  // Regular user navigation
  const userNavItems = [
    { href: "/", icon: Home, label: "Home", testId: "nav-home" },
    { href: "/sports", icon: Trophy, label: "Sports", testId: "nav-sports" },
    { href: "/casino", icon: Gamepad2, label: "Casino", testId: "nav-casino" },
    { href: "/my-bets", icon: Ticket, label: "My Plays", testId: "nav-plays" },
    { href: currentUser ? "/profile" : "/login", icon: User, label: currentUser ? "Profile" : "Login", testId: "nav-profile" },
  ];

  // Select navigation based on role
  const navItems = isSuperAdmin ? superAdminNavItems : (isAdmin ? adminNavItems : userNavItems);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/50 backdrop-blur-lg bg-opacity-95 md:hidden safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[60px]",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={item.testId}
              >
                <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

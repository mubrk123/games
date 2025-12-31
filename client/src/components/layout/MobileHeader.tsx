import { Link, useLocation } from "wouter";
import { Wallet, Bell, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const { currentUser } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const menuItems = [
    { href: "/", label: "Dashboard" },
    { href: "/sports", label: "Sports Exchange" },
    { href: "/casino", label: "Casino" },
    { href: "/my-bets", label: "My Bets" },
    { href: "/profile", label: "Profile & Wallet" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border/50">
      <div className="flex items-center justify-between h-14 px-3">
        <div className="flex items-center gap-2">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-card">
              <div className="p-4 border-b border-border bg-primary/5">
                <h1 className="font-heading text-xl font-bold tracking-tighter">
                  <span className="text-primary">PROBET</span>
                  <span className="text-foreground">X</span>
                </h1>
                {currentUser && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {currentUser.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{currentUser.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentUser.currency} {currentUser.balance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <nav className="p-2">
                {menuItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        location === item.href
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          
          <Link href="/">
            <h1 className="font-heading text-lg font-bold tracking-tighter cursor-pointer">
              <span className="text-primary">PROBET</span>
              <span className="text-foreground">X</span>
            </h1>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 mr-1">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">
                {currentUser.currency} {currentUser.balance.toLocaleString()}
              </span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="button-search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          </Button>
        </div>
      </div>
    </header>
  );
}

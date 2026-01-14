import { Link, useLocation } from "wouter";
import { Wallet, Bell, Search, Menu, Check, Trash2, Trophy, AlertCircle, ArrowDownCircle, ArrowUpCircle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { wsClient } from "@/lib/websocket";
import type { BetSettlement, WalletUpdate } from "@shared/realtime";

export function MobileHeader() {
  const { currentUser, notifications, unreadCount, addNotification, markNotificationRead, markAllNotificationsRead, clearNotifications } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    wsClient.connect();
    
    const unsubBetSettled = wsClient.on<BetSettlement>('bet:settled', (data) => {
      addNotification({
        type: data.status === 'WON' ? 'bet_won' : 'bet_lost',
        title: data.status === 'WON' ? '🎉 Bet Won!' : 'Bet Settled',
        message: `${data.outcome}: ${data.status} - ₹${data.payout.toFixed(2)}`,
        amount: data.payout,
      });
    });

    const unsubWallet = wsClient.on<WalletUpdate>('wallet:update', (data) => {
      if (data.change > 0) {
        addNotification({
          type: 'balance_update',
          title: 'Balance Added',
          message: data.reason || 'Funds credited to your account',
          amount: data.change,
        });
      } else if (data.change < 0) {
        addNotification({
          type: 'balance_update',
          title: 'Balance Deducted',
          message: data.reason || 'Funds debited from your account',
          amount: Math.abs(data.change),
        });
      }
    });

    return () => {
      unsubBetSettled();
      unsubWallet();
    };
  }, [addNotification]);

  const menuItems = [
    { href: "/", label: "Dashboard" },
    { href: "/sports", label: "Sports Exchange" },
    { href: "/casino", label: "Casino" },
    { href: "/my-bets", label: "My Bets" },
    { href: "/profile", label: "Profile & Wallet" },
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bet_won': return <Trophy className="h-4 w-4 text-green-500" />;
      case 'bet_lost': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'deposit_approved': return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case 'deposit_rejected': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'withdrawal_approved': return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
      case 'withdrawal_rejected': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'balance_update': return <Coins className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

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
                        {currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : `${currentUser.currency} ${currentUser.balance.toLocaleString()}`}
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
          {currentUser && currentUser.role !== 'SUPER_ADMIN' && (
            <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5 mr-1">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">
                {currentUser.currency} {currentUser.balance.toLocaleString()}
              </span>
            </div>
          )}
          {currentUser && currentUser.role === 'SUPER_ADMIN' && (
            <div className="flex items-center gap-1.5 bg-purple-500/20 rounded-full px-3 py-1.5 mr-1">
              <span className="text-xs font-bold text-purple-400">SUPER ADMIN</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="button-search">
            <Search className="h-4 w-4" />
          </Button>
          
          <Popover open={isNotifOpen} onOpenChange={setIsNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative" data-testid="button-notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <h4 className="font-semibold text-sm">Notifications</h4>
                <div className="flex gap-1">
                  {notifications.length > 0 && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllNotificationsRead}>
                        <Check className="h-3 w-3 mr-1" /> Mark all read
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={clearNotifications}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={cn(
                          "p-3 hover:bg-accent/50 transition-colors cursor-pointer",
                          !notif.read && "bg-primary/5"
                        )}
                        onClick={() => markNotificationRead(notif.id)}
                      >
                        <div className="flex gap-3">
                          <div className="mt-0.5">{getNotificationIcon(notif.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium", !notif.read && "text-primary")}>{notif.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(notif.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          {notif.amount && (
                            <span className={cn(
                              "text-sm font-mono font-bold",
                              notif.type.includes('won') || notif.type.includes('approved') ? "text-green-500" : "text-muted-foreground"
                            )}>
                              ₹{notif.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}

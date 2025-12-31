import { Navbar } from "./Navbar";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {isMobile ? <MobileHeader /> : <Navbar />}
      <main className="flex-1 flex flex-col w-full px-3 py-3 md:px-6 md:py-6 md:max-w-7xl md:mx-auto gap-4 md:gap-6 pb-20 md:pb-6">
        {children}
      </main>
      <BottomNav />
      <footer className="hidden md:block border-t py-6 text-center text-sm text-muted-foreground bg-card/50">
        <p>© 2025 ProBetX Exchange. All rights reserved.</p>
        <p className="text-xs mt-1 opacity-50">Authorized for Mockup Demonstration Only</p>
      </footer>
    </div>
  );
}

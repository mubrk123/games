import { Navbar } from "./Navbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 gap-6">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground bg-card/50">
        <p>© 2025 ProBetX Exchange. All rights reserved.</p>
        <p className="text-xs mt-1 opacity-50">Authorized for Mockup Demonstration Only</p>
      </footer>
    </div>
  );
}

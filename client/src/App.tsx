import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Casino from "@/pages/casino";
import SlotsGame from "@/pages/casino/slots";
import CrashGame from "@/pages/casino/crash";
import DiceGame from "@/pages/casino/dice";
import AdminPanel from "@/pages/admin";
import Login from "@/pages/auth/login";
import MyBets from "@/pages/my-bets";
import Profile from "@/pages/profile";
import MatchDetail from "@/pages/match-detail";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Protected Route Wrapper
function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType<any>, adminOnly?: boolean }) {
  const [location, setLocation] = useLocation();
  const currentUser = useStore(state => state.currentUser);

  useEffect(() => {
    if (!currentUser) {
      setLocation('/auth/login');
    } else if (adminOnly && currentUser.role !== 'ADMIN') {
      setLocation('/');
    }
  }, [currentUser, location, setLocation, adminOnly]);

  if (!currentUser) return null;
  if (adminOnly && currentUser.role !== 'ADMIN') return null;

  return <Component />;
}

function Router() {
  const setCurrentUser = useStore(state => state.setCurrentUser);
  const [isChecking, setIsChecking] = useState(true);

  // Check authentication status on app load
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user } = await api.getCurrentUser();
        setCurrentUser({
          id: user.id,
          username: user.username,
          role: user.role,
          balance: parseFloat(user.balance),
          exposure: parseFloat(user.exposure),
          currency: user.currency
        });
      } catch (error) {
        // Not logged in, that's fine
        setCurrentUser(null);
      } finally {
        setIsChecking(false);
      }
    }

    checkAuth();
  }, [setCurrentUser]);

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {() => {
          window.location.href = '/auth/login';
          return null;
        }}
      </Route>
      <Route path="/auth/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/sports">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/casino">
        <ProtectedRoute component={Casino} />
      </Route>
      <Route path="/casino/classic-slots">
        <ProtectedRoute component={SlotsGame} />
      </Route>
      <Route path="/casino/crash">
        <ProtectedRoute component={CrashGame} />
      </Route>
      <Route path="/casino/dice">
        <ProtectedRoute component={DiceGame} />
      </Route>
      <Route path="/my-bets">
        <ProtectedRoute component={MyBets} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>
      <Route path="/match/:id">
        <ProtectedRoute component={MatchDetail} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminPanel} adminOnly={true} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/lib/store";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Casino from "@/pages/casino";
import AdminPanel from "@/pages/admin";
import Login from "@/pages/auth/login";
import { useEffect } from "react";

// Protected Route Wrapper
function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType<any>, adminOnly?: boolean }) {
  const [location, setLocation] = useLocation();
  const currentUser = useStore(state => state.currentUser);

  useEffect(() => {
    if (!currentUser) {
      setLocation('/login');
    } else if (adminOnly && currentUser.role !== 'ADMIN') {
      setLocation('/');
    }
  }, [currentUser, location, setLocation, adminOnly]);

  if (!currentUser) return null;
  if (adminOnly && currentUser.role !== 'ADMIN') return null;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/sports">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/casino">
        <ProtectedRoute component={Casino} />
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

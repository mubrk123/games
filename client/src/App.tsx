import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/lib/userContext";
import { DemoControls } from "@/components/demo/DemoControls";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Casino from "@/pages/casino";
import AdminPanel from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/sports" component={Dashboard} />
      <Route path="/casino" component={Casino} />
      <Route path="/admin" component={AdminPanel} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UserProvider>
          <Toaster />
          <Router />
          <DemoControls />
        </UserProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

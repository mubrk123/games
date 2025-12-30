import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [_, setLocation] = useLocation();
  const login = useStore(state => state.login);
  const { toast } = useToast();

  const handleLogin = (role: 'USER' | 'ADMIN') => {
    if (!username) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    const success = login(username, role);
    if (success) {
      toast({
        title: "Welcome back!",
        description: `Logged in as ${role.toLowerCase()}`,
        className: "bg-green-600 text-white border-none"
      });
      setLocation(role === 'ADMIN' ? '/admin' : '/');
    } else {
      toast({
        title: "Login Failed",
        description: "User not found. Try 'demo' for user or 'admin' for admin.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background"></div>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="font-heading text-4xl font-bold tracking-tighter text-primary neon-glow mb-2">PROBET<span className="text-foreground">X</span></h1>
          <p className="text-muted-foreground">Premium Betting Exchange & Casino</p>
        </div>

        <Card className="border-primary/20 bg-card/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Select your role to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="user">User</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
              
              <TabsContent value="user" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Enter username (try: demo)" 
                      className="pl-9"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full font-bold" onClick={() => handleLogin('USER')}>
                  Login as User
                </Button>
                <div className="text-xs text-center text-muted-foreground">
                  Default user: <span className="font-mono text-primary">demo</span>
                </div>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Admin ID</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Enter admin ID (try: admin)" 
                      className="pl-9"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full font-bold bg-orange-600 hover:bg-orange-700" onClick={() => handleLogin('ADMIN')}>
                  Login to Panel
                </Button>
                <div className="text-xs text-center text-muted-foreground">
                   Default admin: <span className="font-mono text-orange-500">admin</span>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

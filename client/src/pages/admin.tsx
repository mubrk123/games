import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Users, Wallet, Activity, AlertTriangle, Lock, UserPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AdminPanel() {
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const result = await api.getAllUsers();
      return result.users;
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  // Fetch all bets
  const { data: betsData, isLoading: betsLoading } = useQuery({
    queryKey: ['admin-bets'],
    queryFn: async () => {
      const result = await api.getAllBets();
      return result.bets;
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const users = usersData || [];
  const bets = betsData || [];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string, password: string, balance: string }) => {
      return await api.createUser({
        username: data.username,
        password: data.password,
        role: 'USER',
        balance: data.balance
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNewUserOpen(false);
      setNewUsername("");
      setNewPassword("");
      setInitialBalance("0");
      toast({
        title: "User Created",
        description: `User created successfully.`,
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive"
      });
    }
  });

  // Add credit mutation
  const addCreditMutation = useMutation({
    mutationFn: async (data: { userId: string, amount: number }) => {
      return await api.addCredit(data.userId, data.amount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreditAmount("");
      setSelectedUserId("");
      toast({
        title: "Credit Added",
        description: "Wallet updated successfully",
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add credit",
        variant: "destructive"
      });
    }
  });

  const handleCreateUser = () => {
    if (!newUsername || !newPassword) {
      toast({
        title: "Error",
        description: "Username and password are required",
        variant: "destructive"
      });
      return;
    }
    createUserMutation.mutate({
      username: newUsername,
      password: newPassword,
      balance: initialBalance
    });
  };

  const handleAddCredit = () => {
    if (!selectedUserId || !creditAmount) {
      toast({ title: "Error", description: "Select User ID and enter amount", variant: "destructive" });
      return;
    }
    addCreditMutation.mutate({
      userId: selectedUserId,
      amount: Number(creditAmount)
    });
  };

  // Filter only 'USER' role for the table
  const clientUsers = users.filter(u => u.role === 'USER');

  // Calculate stats
  const totalExposure = clientUsers.reduce((acc, u) => acc + parseFloat(u.exposure || '0'), 0);
  const totalBalance = clientUsers.reduce((acc, u) => acc + parseFloat(u.balance), 0);

  if (usersLoading || betsLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading admin data...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-orange-500">Admin Dashboard</h1>
            <p className="text-muted-foreground">System Overview & Risk Management</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-user" className="gap-2 bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none">
                  <UserPlus className="w-4 h-4" /> Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input 
                      data-testid="input-new-username"
                      value={newUsername} 
                      onChange={e => setNewUsername(e.target.value)} 
                      placeholder="e.g. player123" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password</label>
                    <Input 
                      data-testid="input-new-password"
                      type="password"
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="User password" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Initial Balance</label>
                    <Input 
                      data-testid="input-initial-balance"
                      type="number" 
                      value={initialBalance} 
                      onChange={e => setInitialBalance(e.target.value)} 
                    />
                  </div>
                  <Button 
                    data-testid="button-submit-create-user"
                    className="w-full" 
                    onClick={handleCreateUser}
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending ? 'Creating...' : 'Create Account'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" className="gap-2 flex-1 sm:flex-none"><AlertTriangle className="w-4 h-4" /> Panic</Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Exposure</CardTitle>
              <ShieldCheck className="w-4 h-4 text-orange-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono truncate" data-testid="stat-exposure">
                ₹ {totalExposure.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="stat-users">{clientUsers.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bets</CardTitle>
              <Activity className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="stat-bets">{bets.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
              <Wallet className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono text-green-500 truncate" data-testid="stat-balance">
                ₹ {totalBalance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Management */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                 <CardTitle>User Management</CardTitle>
                 <CardDescription>Manage wallets and view exposure</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-muted/50 p-2 rounded-lg border border-border w-full sm:w-auto">
                <span className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">Manual Credit</span>
                <div className="flex gap-2 w-full sm:w-auto">
                    <select 
                      data-testid="select-user"
                      className="h-8 flex-1 sm:w-[150px] bg-background border rounded text-xs px-2"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">Select User</option>
                      {clientUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                      ))}
                    </select>
                    <Input 
                      data-testid="input-credit-amount"
                      placeholder="Amt" 
                      className="h-8 w-20" 
                      type="number" 
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                    />
                    <Button 
                      data-testid="button-add-credit"
                      size="sm" 
                      className="h-8 bg-green-600 hover:bg-green-700" 
                      onClick={handleAddCredit}
                      disabled={addCreditMutation.isPending}
                    >
                      {addCreditMutation.isPending ? 'Adding...' : 'Add'}
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Exposure</TableHead>
                    <TableHead>W/L</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientUsers.map(u => (
                    <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap" data-testid={`balance-${u.username}`}>
                        ₹ {parseFloat(u.balance).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-destructive whitespace-nowrap">
                        {parseFloat(u.exposure || '0') > 0 ? `- ₹ ${parseFloat(u.exposure).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <span className="text-green-500">{u.wonBets || 0}W</span> / <span className="text-red-500">{u.lostBets || 0}L</span>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                           <Lock className="w-3 h-3" /> <span className="hidden sm:inline">Suspend</span>
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bet History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Global Bet History</CardTitle>
              <CardDescription>Real-time feed of all user bets</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Odds</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No bets placed yet</TableCell>
                    </TableRow>
                  ) : (
                    bets.map(bet => (
                      <TableRow key={bet.id} data-testid={`bet-row-${bet.id}`}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(bet.createdAt).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${bet.type === 'BACK' ? 'bg-blue-500 text-white' : 'bg-pink-500 text-white'}`}>
                            {bet.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono">{parseFloat(bet.odds).toFixed(2)}</TableCell>
                        <TableCell className="font-mono">₹ {parseFloat(bet.stake).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded ${
                            bet.status === 'WON' ? 'bg-green-500/20 text-green-500' : 
                            bet.status === 'LOST' ? 'bg-red-500/20 text-red-500' : 
                            'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            {bet.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

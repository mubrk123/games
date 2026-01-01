import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Users, Wallet, Activity, AlertTriangle, UserPlus, Crown, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPanel() {
  const currentUser = useStore(state => state.currentUser);
  const setCurrentUser = useStore(state => state.setCurrentUser);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newAdminOpen, setNewAdminOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [distributeAmount, setDistributeAmount] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addBalanceAmount, setAddBalanceAmount] = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminsData, isLoading: adminsLoading } = useQuery({
    queryKey: ['super-admin-admins'],
    queryFn: async () => {
      const result = await api.getAdmins();
      return result.admins;
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const { data: myUsersData, isLoading: myUsersLoading } = useQuery({
    queryKey: ['admin-my-users'],
    queryFn: async () => {
      const result = await api.getMyUsers();
      return result.users;
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const { data: betsData, isLoading: betsLoading } = useQuery({
    queryKey: ['admin-bets'],
    queryFn: async () => {
      const result = await api.getAllBets();
      return result.bets;
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const admins = adminsData || [];
  const myUsers = myUsersData || [];
  const bets = betsData || [];

  const createAdminMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; balance: string }) => {
      return await api.createAdmin(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setNewAdminOpen(false);
      setNewUsername("");
      setNewPassword("");
      setInitialBalance("0");
      toast({
        title: "Admin Created",
        description: "New admin account created successfully.",
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin",
        variant: "destructive"
      });
    }
  });

  const addBalanceToAdminMutation = useMutation({
    mutationFn: async (data: { adminId: string; amount: number }) => {
      return await api.addBalanceToAdmin(data.adminId, data.amount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-admins'] });
      setAddBalanceAmount("");
      setSelectedAdminId("");
      toast({
        title: "Balance Added",
        description: "Admin balance updated successfully.",
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add balance",
        variant: "destructive"
      });
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; balance: string }) => {
      return await api.createUserWithBalance(data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['admin-my-users'] });
      const { user } = await api.getCurrentUser();
      setCurrentUser({
        id: user.id,
        username: user.username,
        role: user.role,
        balance: parseFloat(user.balance),
        exposure: parseFloat(user.exposure),
        currency: user.currency
      });
      setNewUserOpen(false);
      setNewUsername("");
      setNewPassword("");
      setInitialBalance("0");
      toast({
        title: "User Created",
        description: "New user account created. Balance deducted from your account.",
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

  const distributeBalanceMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: number }) => {
      return await api.distributeBalance(data.userId, data.amount);
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-my-users'] });
      const { user } = await api.getCurrentUser();
      setCurrentUser({
        id: user.id,
        username: user.username,
        role: user.role,
        balance: parseFloat(user.balance),
        exposure: parseFloat(user.exposure),
        currency: user.currency
      });
      setDistributeAmount("");
      setSelectedUserId("");
      toast({
        title: "Balance Distributed",
        description: `Balance transferred successfully. Your new balance: ₹${parseFloat(result.adminBalance).toLocaleString()}`,
        className: "bg-green-600 text-white border-none"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to distribute balance",
        variant: "destructive"
      });
    }
  });

  const handleCreateAdmin = () => {
    if (!newUsername || !newPassword) {
      toast({ title: "Error", description: "Username and password are required", variant: "destructive" });
      return;
    }
    createAdminMutation.mutate({ username: newUsername, password: newPassword, balance: initialBalance });
  };

  const handleAddBalanceToAdmin = () => {
    if (!selectedAdminId || !addBalanceAmount) {
      toast({ title: "Error", description: "Select admin and enter amount", variant: "destructive" });
      return;
    }
    addBalanceToAdminMutation.mutate({ adminId: selectedAdminId, amount: Number(addBalanceAmount) });
  };

  const handleCreateUser = () => {
    if (!newUsername || !newPassword) {
      toast({ title: "Error", description: "Username and password are required", variant: "destructive" });
      return;
    }
    const balance = parseFloat(initialBalance) || 0;
    if (balance > (currentUser?.balance || 0)) {
      toast({ title: "Error", description: "Insufficient balance. You cannot give more than you have.", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({ username: newUsername, password: newPassword, balance: initialBalance });
  };

  const handleDistributeBalance = () => {
    if (!selectedUserId || !distributeAmount) {
      toast({ title: "Error", description: "Select user and enter amount", variant: "destructive" });
      return;
    }
    distributeBalanceMutation.mutate({ userId: selectedUserId, amount: Number(distributeAmount) });
  };

  const clientUsers = myUsers.filter(u => u.role === 'USER');
  const totalUserBalance = clientUsers.reduce((acc, u) => acc + parseFloat(u.balance), 0);
  const totalAdminBalance = admins.reduce((acc, a) => acc + parseFloat(a.balance), 0);

  if ((isSuperAdmin && adminsLoading) || myUsersLoading || betsLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
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
            <h1 className="text-3xl font-heading font-bold text-orange-500">
              {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
            </h1>
            <p className="text-muted-foreground">
              {isSuperAdmin ? 'Manage admins and system balance' : 'Manage users and distribute balance'}
            </p>
            {!isSuperAdmin && (
              <p className="text-sm text-green-500 font-mono mt-1">
                Your Balance: ₹{(currentUser?.balance || 0).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {isSuperAdmin ? (
              <Dialog open={newAdminOpen} onOpenChange={setNewAdminOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-admin" className="gap-2 bg-purple-600 hover:bg-purple-700 flex-1 sm:flex-none">
                    <Crown className="w-4 h-4" /> Create Admin
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Admin</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Username</label>
                      <Input 
                        data-testid="input-admin-username"
                        value={newUsername} 
                        onChange={e => setNewUsername(e.target.value)} 
                        placeholder="e.g. admin1" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Password</label>
                      <Input 
                        data-testid="input-admin-password"
                        type="password"
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        placeholder="Admin password" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Initial Balance</label>
                      <Input 
                        data-testid="input-admin-balance"
                        type="number" 
                        value={initialBalance} 
                        onChange={e => setInitialBalance(e.target.value)} 
                      />
                    </div>
                    <Button 
                      data-testid="button-submit-create-admin"
                      className="w-full bg-purple-600 hover:bg-purple-700" 
                      onClick={handleCreateAdmin}
                      disabled={createAdminMutation.isPending}
                    >
                      {createAdminMutation.isPending ? 'Creating...' : 'Create Admin'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
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
                    <p className="text-sm text-muted-foreground">
                      Balance will be deducted from your account (₹{(currentUser?.balance || 0).toLocaleString()} available)
                    </p>
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
                      <label className="text-sm font-medium">Initial Balance (from your account)</label>
                      <Input 
                        data-testid="input-initial-balance"
                        type="number" 
                        value={initialBalance} 
                        onChange={e => setInitialBalance(e.target.value)}
                        max={currentUser?.balance || 0}
                      />
                    </div>
                    <Button 
                      data-testid="button-submit-create-user"
                      className="w-full" 
                      onClick={handleCreateUser}
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isSuperAdmin ? (
            <>
              <Card className="bg-card/50 border-purple-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Admins</CardTitle>
                  <Crown className="w-4 h-4 text-purple-500" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="stat-admins">{admins.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Admin Balance</CardTitle>
                  <Wallet className="w-4 h-4 text-green-500" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl sm:text-2xl font-bold font-mono text-green-500 truncate" data-testid="stat-admin-balance">
                    ₹{totalAdminBalance.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="bg-card/50 border-green-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Your Balance</CardTitle>
                  <Wallet className="w-4 h-4 text-green-500" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl sm:text-2xl font-bold font-mono text-green-500 truncate" data-testid="stat-my-balance">
                    ₹{(currentUser?.balance || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-orange-500/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Distributed</CardTitle>
                  <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-xl sm:text-2xl font-bold font-mono truncate" data-testid="stat-distributed">
                    ₹{totalUserBalance.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          <Card className="bg-card/50 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="stat-users">{clientUsers.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-purple-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bets</CardTitle>
              <Activity className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono" data-testid="stat-bets">{bets.length}</div>
            </CardContent>
          </Card>
        </div>

        {isSuperAdmin && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Admin Management</CardTitle>
                <CardDescription>Add balance to admin accounts</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-muted/50 p-2 rounded-lg border border-border w-full sm:w-auto">
                <span className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">Add Balance</span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <select 
                    data-testid="select-admin"
                    className="h-8 flex-1 sm:w-[150px] bg-background border rounded text-xs px-2"
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                  >
                    <option value="">Select Admin</option>
                    {admins.map(a => (
                      <option key={a.id} value={a.id}>{a.username}</option>
                    ))}
                  </select>
                  <Input 
                    data-testid="input-add-balance"
                    placeholder="Amount" 
                    className="h-8 w-24" 
                    type="number" 
                    value={addBalanceAmount}
                    onChange={e => setAddBalanceAmount(e.target.value)}
                  />
                  <Button 
                    data-testid="button-add-balance"
                    size="sm" 
                    className="h-8 bg-purple-600 hover:bg-purple-700" 
                    onClick={handleAddBalanceToAdmin}
                    disabled={addBalanceToAdminMutation.isPending}
                  >
                    {addBalanceToAdminMutation.isPending ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Users Created</TableHead>
                    <TableHead>Total Distributed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No admins created yet</TableCell>
                    </TableRow>
                  ) : (
                    admins.map(admin => (
                      <TableRow key={admin.id} data-testid={`admin-row-${admin.username}`}>
                        <TableCell className="font-medium">{admin.username}</TableCell>
                        <TableCell className="font-mono text-green-500" data-testid={`admin-balance-${admin.username}`}>
                          ₹{parseFloat(admin.balance).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono">{admin.usersCreated || 0}</TableCell>
                        <TableCell className="font-mono">₹{(admin.totalDistributed || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>{isSuperAdmin ? 'All Users' : 'Your Users'}</CardTitle>
              <CardDescription>
                {isSuperAdmin ? 'Users across all admins' : 'Users you created - distribute balance from your account'}
              </CardDescription>
            </div>
            {!isSuperAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-muted/50 p-2 rounded-lg border border-border w-full sm:w-auto">
                <span className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">Distribute</span>
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
                    data-testid="input-distribute-amount"
                    placeholder="Amount" 
                    className="h-8 w-24" 
                    type="number" 
                    value={distributeAmount}
                    onChange={e => setDistributeAmount(e.target.value)}
                  />
                  <Button 
                    data-testid="button-distribute"
                    size="sm" 
                    className="h-8 bg-green-600 hover:bg-green-700" 
                    onClick={handleDistributeBalance}
                    disabled={distributeBalanceMutation.isPending}
                  >
                    {distributeBalanceMutation.isPending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Exposure</TableHead>
                  <TableHead>W/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No users created yet</TableCell>
                  </TableRow>
                ) : (
                  clientUsers.map(u => (
                    <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap" data-testid={`balance-${u.username}`}>
                        ₹{parseFloat(u.balance).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-destructive whitespace-nowrap">
                        {parseFloat(u.exposure || '0') > 0 ? `- ₹${parseFloat(u.exposure).toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <span className="text-green-500">{u.wonBets || 0}W</span> / <span className="text-red-500">{u.lostBets || 0}L</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Bets</CardTitle>
            <CardDescription>Latest betting activity</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
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
                  bets.slice(0, 20).map(bet => (
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
                      <TableCell className="font-mono">₹{parseFloat(bet.stake).toFixed(2)}</TableCell>
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
    </AppShell>
  );
}

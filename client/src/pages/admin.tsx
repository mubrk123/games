import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Users, Wallet, Activity, AlertTriangle, Lock, Search, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AdminPanel() {
  const { users, bets, registerUser, addFunds } = useStore();
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const { toast } = useToast();

  const handleCreateUser = () => {
    if (!newUsername) return;
    registerUser(newUsername, Number(initialBalance));
    setNewUserOpen(false);
    setNewUsername("");
    setInitialBalance("0");
    toast({
      title: "User Created",
      description: `User ${newUsername} added successfully.`
    });
  };

  const handleAddCredit = () => {
    if (!selectedUserId || !creditAmount) {
      toast({ title: "Error", description: "Select User ID and enter amount", variant: "destructive" });
      return;
    }
    addFunds(selectedUserId, Number(creditAmount));
    setCreditAmount("");
    setSelectedUserId("");
    toast({
      title: "Credit Added",
      description: "Wallet updated successfully",
      className: "bg-green-600 text-white"
    });
  };

  // Filter only 'USER' role for the table
  const clientUsers = users.filter(u => u.role === 'USER');

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
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"><UserPlus className="w-4 h-4" /> Create User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Username</label>
                    <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. player123" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Initial Balance</label>
                    <Input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleCreateUser}>Create Account</Button>
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
              <div className="text-xl sm:text-2xl font-bold font-mono truncate">
                ₹ {clientUsers.reduce((acc, u) => acc + u.exposure, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono">{clientUsers.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bets</CardTitle>
              <Activity className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono">{bets.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
              <Wallet className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl sm:text-2xl font-bold font-mono text-green-500 truncate">
                ₹ {clientUsers.reduce((acc, u) => acc + u.balance, 0).toLocaleString()}
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
                      placeholder="Amt" 
                      className="h-8 w-20" 
                      type="number" 
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                    />
                    <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" onClick={handleAddCredit}>Add</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Exposure</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{u.id}</TableCell>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="font-mono whitespace-nowrap">₹ {u.balance.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-destructive whitespace-nowrap">
                        {u.exposure > 0 ? `- ₹ ${u.exposure.toLocaleString()}` : '-'}
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
                    <TableHead>User</TableHead>
                    <TableHead className="whitespace-nowrap">Match</TableHead>
                    <TableHead>Selection</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Odds</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">No bets placed yet</TableCell>
                    </TableRow>
                  ) : (
                    bets.map(bet => (
                      <TableRow key={bet.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(bet.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="font-medium">{bet.userName}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{bet.matchName}</TableCell>
                        <TableCell className="whitespace-nowrap">{bet.selectionName}</TableCell>
                        <TableCell>
                          <span className={bet.type === 'BACK' ? "text-blue-500 font-bold" : "text-pink-500 font-bold"}>
                            {bet.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono">{bet.odds}</TableCell>
                        <TableCell className="font-mono">₹{bet.stake}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-accent px-2 py-1 rounded">{bet.status}</span>
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

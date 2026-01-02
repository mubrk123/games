import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle, XCircle, PlusCircle } from "lucide-react";

interface WithdrawalRequest {
  id: string;
  userId: string;
  adminId: string;
  amount: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user?: { id: string; username: string; balance: string } | null;
}

interface DepositRequest {
  id: string;
  userId: string;
  adminId: string;
  amount: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED";
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user?: { id: string; username: string; balance: string } | null;
}

interface WithdrawalAvailable {
  availableWinnings: number;
  currentBalance: number;
  maxWithdrawable: number;
}

interface Transaction {
  id: string;
  userId: string;
  amount: string;
  type: string;
  description: string | null;
  createdAt: string;
}

export default function Withdrawals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = useStore((state) => state.currentUser);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const { data: availableData } = useQuery<WithdrawalAvailable>({
    queryKey: ["withdrawal-available"],
    queryFn: async () => {
      const res = await fetch("/api/withdrawals/available", { credentials: "include" });
      return res.json();
    },
    enabled: !!currentUser,
  });

  const { data: myWithdrawalRequests } = useQuery<{ requests: WithdrawalRequest[] }>({
    queryKey: ["my-withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/withdrawals/me", { credentials: "include" });
      return res.json();
    },
    enabled: !!currentUser,
  });

  const { data: myDepositRequests } = useQuery<{ requests: DepositRequest[] }>({
    queryKey: ["my-deposits"],
    queryFn: async () => api.getMyDepositRequests(),
    enabled: !!currentUser,
  });

  const { data: pendingWithdrawals } = useQuery<{ requests: WithdrawalRequest[] }>({
    queryKey: ["pending-withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals/pending", { credentials: "include" });
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: pendingDeposits } = useQuery<{ requests: DepositRequest[] }>({
    queryKey: ["pending-deposits"],
    queryFn: async () => api.getPendingDepositRequests(),
    enabled: isAdmin,
  });

  const { data: transactions } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["wallet-transactions"],
    queryFn: async () => api.getWalletTransactions(),
    enabled: !!currentUser,
  });

  // Withdrawal mutations
  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Submitted", description: "Your withdrawal request has been sent to admin" });
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ["my-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-available"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const approveWithdrawalMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/admin/withdrawals/${requestId}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: async (result) => {
      toast({ title: "Approved", description: "Withdrawal approved and funds transferred to your account" });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawals"] });
      // Refresh admin balance
      if (result.adminBalance && currentUser) {
        setCurrentUser({ ...currentUser, balance: parseFloat(result.adminBalance) });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectWithdrawalMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/admin/withdrawals/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: "Request rejected by admin" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Withdrawal request rejected" });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Deposit mutations
  const depositMutation = useMutation({
    mutationFn: async (amount: number) => api.requestDeposit(amount),
    onSuccess: () => {
      toast({ title: "Request Submitted", description: "Your deposit request has been sent to admin" });
      setDepositAmount("");
      queryClient.invalidateQueries({ queryKey: ["my-deposits"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const approveDepositMutation = useMutation({
    mutationFn: async (requestId: string) => api.approveDepositRequest(requestId),
    onSuccess: async (result: any) => {
      toast({ title: "Approved", description: "Deposit approved and funds transferred to user" });
      queryClient.invalidateQueries({ queryKey: ["pending-deposits"] });
      // Refresh admin balance
      if (result.adminBalance && currentUser) {
        setCurrentUser({ ...currentUser, balance: parseFloat(result.adminBalance) });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectDepositMutation = useMutation({
    mutationFn: async (requestId: string) => api.rejectDepositRequest(requestId, "Request rejected by admin"),
    onSuccess: () => {
      toast({ title: "Rejected", description: "Deposit request rejected" });
      queryClient.invalidateQueries({ queryKey: ["pending-deposits"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      return;
    }
    withdrawMutation.mutate(amount);
  };

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      return;
    }
    depositMutation.mutate(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REQUESTED":
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes("WON") || type.includes("CREDIT") || type.includes("IN") || type.includes("DEPOSIT")) {
      return <ArrowDownCircle className="w-4 h-4 text-green-400" />;
    }
    return <ArrowUpCircle className="w-4 h-4 text-red-400" />;
  };

  const pendingWithdrawalCount = pendingWithdrawals?.requests?.length || 0;
  const pendingDepositCount = pendingDeposits?.requests?.length || 0;
  const totalPendingCount = pendingWithdrawalCount + pendingDepositCount;

  return (
    <AppShell>
      <div className="p-4 space-y-6 pb-24">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Wallet</h1>

        <Tabs defaultValue={isAdmin ? "admin" : "deposit"}>
          <TabsList className="w-full flex" data-testid="tabs-main">
            <TabsTrigger value="deposit" className="flex-1" data-testid="tab-deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw" className="flex-1" data-testid="tab-withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history" className="flex-1" data-testid="tab-history">History</TabsTrigger>
            {isAdmin ? (
              <TabsTrigger value="admin" className="flex-1 relative" data-testid="tab-admin">
                Admin
                {totalPendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {totalPendingCount}
                  </span>
                )}
              </TabsTrigger>
            ) : (
              <TabsTrigger value="transactions" className="flex-1" data-testid="tab-transactions">Transactions</TabsTrigger>
            )}
          </TabsList>

          {/* Deposit Tab - Request funds from admin */}
          <TabsContent value="deposit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-green-500" />
                  Request Deposit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-3 rounded">
                  <p className="text-muted-foreground">Current Balance</p>
                  <p className="text-xl font-bold text-green-400" data-testid="text-deposit-balance">
                    ₹{currentUser?.balance?.toLocaleString() || "0.00"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Request funds from your admin. Once approved, the amount will be added to your balance.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter amount (max ₹100,000)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    data-testid="input-deposit-amount"
                  />
                  <Button 
                    onClick={handleDeposit} 
                    disabled={depositMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-request-deposit"
                  >
                    {depositMutation.isPending ? "..." : "Request"}
                  </Button>
                </div>

                {/* My Deposit Requests */}
                <div className="mt-6">
                  <h3 className="font-medium mb-3">My Deposit Requests</h3>
                  {myDepositRequests?.requests?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">No deposit requests yet</p>
                  ) : (
                    <div className="space-y-2">
                      {myDepositRequests?.requests?.map((req) => (
                        <div key={req.id} className="flex justify-between items-center p-3 bg-muted/50 rounded" data-testid={`deposit-request-${req.id}`}>
                          <div>
                            <p className="font-medium">₹{parseFloat(req.amount).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Request Withdrawal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-muted p-3 rounded">
                    <p className="text-muted-foreground">Current Balance</p>
                    <p className="text-xl font-bold" data-testid="text-current-balance">₹{availableData?.currentBalance?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <p className="text-muted-foreground">Withdrawable</p>
                    <p className="text-xl font-bold text-green-400" data-testid="text-withdrawable">₹{availableData?.maxWithdrawable?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Only your winnings can be withdrawn. Deposits cannot be withdrawn.</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    data-testid="input-withdraw-amount"
                  />
                  <Button onClick={handleWithdraw} disabled={withdrawMutation.isPending} data-testid="button-request-withdraw">
                    {withdrawMutation.isPending ? "..." : "Request"}
                  </Button>
                </div>

                {/* My Withdrawal Requests */}
                <div className="mt-6">
                  <h3 className="font-medium mb-3">My Withdrawal Requests</h3>
                  {myWithdrawalRequests?.requests?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">No withdrawal requests yet</p>
                  ) : (
                    <div className="space-y-2">
                      {myWithdrawalRequests?.requests?.map((req) => (
                        <div key={req.id} className="flex justify-between items-center p-3 bg-muted/50 rounded" data-testid={`withdrawal-request-${req.id}`}>
                          <div>
                            <p className="font-medium">₹{parseFloat(req.amount).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab - Combined view */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions?.transactions?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions?.transactions?.map((tx) => (
                      <div key={tx.id} className="flex justify-between items-center p-3 bg-muted rounded" data-testid={`transaction-${tx.id}`}>
                        <div className="flex items-center gap-3">
                          {getTransactionIcon(tx.type)}
                          <div>
                            <p className="text-sm font-medium">{tx.type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">{tx.description || "-"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${parseFloat(tx.amount) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {parseFloat(tx.amount) >= 0 ? "+" : ""}₹{parseFloat(tx.amount).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab (for non-admins) */}
          {!isAdmin && (
            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>All Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {transactions?.transactions?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions?.transactions?.map((tx) => (
                        <div key={tx.id} className="flex justify-between items-center p-3 bg-muted rounded" data-testid={`transaction-all-${tx.id}`}>
                          <div className="flex items-center gap-3">
                            {getTransactionIcon(tx.type)}
                            <div>
                              <p className="text-sm font-medium">{tx.type.replace(/_/g, " ")}</p>
                              <p className="text-xs text-muted-foreground">{tx.description || "-"}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${parseFloat(tx.amount) >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {parseFloat(tx.amount) >= 0 ? "+" : ""}₹{parseFloat(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Admin Tab - Manage both deposits and withdrawals */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-4">
              {/* Pending Deposit Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-green-500" />
                    Pending Deposit Requests
                    {pendingDepositCount > 0 && (
                      <Badge className="bg-green-600">{pendingDepositCount}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingDeposits?.requests?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No pending deposit requests</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingDeposits?.requests?.map((req) => (
                        <div key={req.id} className="p-4 bg-green-500/10 border border-green-500/20 rounded space-y-3" data-testid={`admin-deposit-${req.id}`}>
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{req.user?.username || "Unknown User"}</p>
                              <p className="text-sm text-muted-foreground">Current Balance: ₹{req.user?.balance || "0"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-green-400">+₹{parseFloat(req.amount).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Approving will transfer ₹{parseFloat(req.amount).toLocaleString()} from your balance to user
                          </p>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approveDepositMutation.mutate(req.id)}
                              disabled={approveDepositMutation.isPending}
                              data-testid={`button-approve-deposit-${req.id}`}
                            >
                              Approve & Transfer
                            </Button>
                            <Button
                              className="flex-1"
                              variant="destructive"
                              onClick={() => rejectDepositMutation.mutate(req.id)}
                              disabled={rejectDepositMutation.isPending}
                              data-testid={`button-reject-deposit-${req.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pending Withdrawal Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpCircle className="w-5 h-5 text-orange-500" />
                    Pending Withdrawal Requests
                    {pendingWithdrawalCount > 0 && (
                      <Badge className="bg-orange-600">{pendingWithdrawalCount}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingWithdrawals?.requests?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No pending withdrawal requests</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingWithdrawals?.requests?.map((req) => (
                        <div key={req.id} className="p-4 bg-orange-500/10 border border-orange-500/20 rounded space-y-3" data-testid={`admin-withdrawal-${req.id}`}>
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{req.user?.username || "Unknown User"}</p>
                              <p className="text-sm text-muted-foreground">Current Balance: ₹{req.user?.balance || "0"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-orange-400">-₹{parseFloat(req.amount).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Approving will transfer ₹{parseFloat(req.amount).toLocaleString()} from user to your balance
                          </p>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-orange-600 hover:bg-orange-700"
                              onClick={() => approveWithdrawalMutation.mutate(req.id)}
                              disabled={approveWithdrawalMutation.isPending}
                              data-testid={`button-approve-withdrawal-${req.id}`}
                            >
                              Approve & Receive
                            </Button>
                            <Button
                              className="flex-1"
                              variant="destructive"
                              onClick={() => rejectWithdrawalMutation.mutate(req.id)}
                              disabled={rejectWithdrawalMutation.isPending}
                              data-testid={`button-reject-withdrawal-${req.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

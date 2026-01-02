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
import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle, XCircle } from "lucide-react";

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
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const { data: availableData } = useQuery<WithdrawalAvailable>({
    queryKey: ["withdrawal-available"],
    queryFn: async () => {
      const res = await fetch("/api/withdrawals/available", { credentials: "include" });
      return res.json();
    },
    enabled: !!currentUser,
  });

  const { data: myRequests } = useQuery<{ requests: WithdrawalRequest[] }>({
    queryKey: ["my-withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/withdrawals/me", { credentials: "include" });
      return res.json();
    },
    enabled: !!currentUser,
  });

  const { data: pendingRequests } = useQuery<{ requests: WithdrawalRequest[] }>({
    queryKey: ["pending-withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals/pending", { credentials: "include" });
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: transactions } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["wallet-transactions"],
    queryFn: async () => api.getWalletTransactions(),
    enabled: !!currentUser,
  });

  const requestMutation = useMutation({
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

  const approveMutation = useMutation({
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
    onSuccess: () => {
      toast({ title: "Approved", description: "Withdrawal approved and funds transferred to your account" });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
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

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      return;
    }
    requestMutation.mutate(amount);
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
    if (type.includes("WON") || type.includes("CREDIT") || type.includes("IN")) {
      return <ArrowDownCircle className="w-4 h-4 text-green-400" />;
    }
    return <ArrowUpCircle className="w-4 h-4 text-red-400" />;
  };

  return (
    <AppShell>
      <div className="p-4 space-y-6 pb-24">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Withdrawals & Transactions</h1>

        <Tabs defaultValue={isAdmin ? "admin" : "withdraw"}>
          <TabsList className="w-full" data-testid="tabs-main">
            <TabsTrigger value="withdraw" className="flex-1" data-testid="tab-withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history" className="flex-1" data-testid="tab-history">My Requests</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1" data-testid="tab-transactions">Transactions</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin" className="flex-1" data-testid="tab-admin">Admin</TabsTrigger>}
          </TabsList>

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
                  <Button onClick={handleWithdraw} disabled={requestMutation.isPending} data-testid="button-request-withdraw">
                    {requestMutation.isPending ? "..." : "Request"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Withdrawal Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {myRequests?.requests?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No withdrawal requests yet</p>
                ) : (
                  <div className="space-y-3">
                    {myRequests?.requests?.map((req) => (
                      <div key={req.id} className="flex justify-between items-center p-3 bg-muted rounded" data-testid={`withdrawal-request-${req.id}`}>
                        <div>
                          <p className="font-medium">₹{parseFloat(req.amount).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
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

          {isAdmin && (
            <TabsContent value="admin" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Withdrawal Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingRequests?.requests?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No pending requests</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests?.requests?.map((req) => (
                        <div key={req.id} className="p-4 bg-muted rounded space-y-3" data-testid={`admin-request-${req.id}`}>
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium">{req.user?.username || "Unknown User"}</p>
                              <p className="text-sm text-muted-foreground">Balance: ₹{req.user?.balance || "0"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">₹{parseFloat(req.amount).toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700"
                              onClick={() => approveMutation.mutate(req.id)}
                              disabled={approveMutation.isPending}
                              data-testid={`button-approve-${req.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              className="flex-1"
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(req.id)}
                              disabled={rejectMutation.isPending}
                              data-testid={`button-reject-${req.id}`}
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

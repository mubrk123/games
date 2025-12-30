import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Users, Wallet, Activity, AlertTriangle, Lock, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', profit: 4000 },
  { name: 'Tue', profit: 3000 },
  { name: 'Wed', profit: 2000 },
  { name: 'Thu', profit: 2780 },
  { name: 'Fri', profit: 1890 },
  { name: 'Sat', profit: 2390 },
  { name: 'Sun', profit: 3490 },
];

export default function AdminPanel() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold text-orange-500">Admin Dashboard</h1>
            <p className="text-muted-foreground">System Overview & Risk Management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" className="gap-2"><AlertTriangle className="w-4 h-4" /> Panic Button</Button>
            <Button className="gap-2"><Activity className="w-4 h-4" /> System Health: 99.9%</Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Exposure</CardTitle>
              <ShieldCheck className="w-4 h-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">₹ 1,245,000</div>
              <p className="text-xs text-muted-foreground">+2.5% from last hour</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">843</div>
              <p className="text-xs text-muted-foreground">124 currently online</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GGR (Today)</CardTitle>
              <Wallet className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-green-500">₹ 45,230</div>
              <p className="text-xs text-muted-foreground">Gross Game Revenue</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Bets</CardTitle>
              <Activity className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">1,024</div>
              <p className="text-xs text-muted-foreground">Across 12 markets</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart & User Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly P&L Overview</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none' }}
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                  />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Wallet Management</CardTitle>
              <div className="flex gap-2">
                <Input placeholder="Search user ID..." className="h-8 w-[150px]" />
                <Button size="sm" variant="outline"><Search className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Exposure</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">demo_user</TableCell>
                    <TableCell className="font-mono">10,000</TableCell>
                    <TableCell className="font-mono text-destructive">0</TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                         <Lock className="w-3 h-3" /> Suspend
                       </Button>
                    </TableCell>
                  </TableRow>
                   <TableRow>
                    <TableCell className="font-medium">vip_player_99</TableCell>
                    <TableCell className="font-mono">1,50,000</TableCell>
                    <TableCell className="font-mono text-destructive">-25,000</TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                         <Lock className="w-3 h-3" /> Suspend
                       </Button>
                    </TableCell>
                  </TableRow>
                   <TableRow>
                    <TableCell className="font-medium">agent_007</TableCell>
                    <TableCell className="font-mono">50,000</TableCell>
                    <TableCell className="font-mono text-destructive">0</TableCell>
                    <TableCell className="text-right">
                       <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                         <Lock className="w-3 h-3" /> Suspend
                       </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-4 p-4 bg-muted/30 rounded border border-dashed border-border">
                <h4 className="text-sm font-bold mb-2 text-muted-foreground">Manual Credit (Admin Only)</h4>
                <div className="flex gap-2">
                  <Input placeholder="User ID" className="h-9" />
                  <Input placeholder="Amount" className="h-9" type="number" />
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Add Credit</Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">* Transaction will be logged in audit trail.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

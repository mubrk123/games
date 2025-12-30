import { useState } from "react";
import { useUser } from "@/lib/userContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Settings2, UserCog, Wallet, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function DemoControls() {
  const { user, toggleRole, addFunds } = useUser();
  const [isOpen, setIsOpen] = useState(true);
  const [amount, setAmount] = useState("1000");
  const { toast } = useToast();

  const handleAddFunds = () => {
    const val = parseFloat(amount);
    if (val > 0) {
      addFunds(val);
      toast({
        title: "Deposit Successful",
        description: `Added ₹${val} to wallet via manual admin credit.`,
        className: "bg-green-600 text-white border-none"
      });
    }
  };

  if (!isOpen) {
    return (
      <Button 
        className="fixed bottom-4 right-4 z-[100] rounded-full shadow-2xl"
        size="icon"
        onClick={() => setIsOpen(true)}
      >
        <Settings2 className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-[100] w-80 shadow-2xl border-primary/20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-heading font-bold flex items-center gap-2 text-primary">
            <Settings2 className="w-4 h-4" /> Demo Controls
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Current Role:</span>
              <div className={cn("font-bold font-mono mt-1", user.role === 'ADMIN' ? "text-orange-500" : "text-blue-500")}>
                {user.role}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={toggleRole} className="gap-2">
              <UserCog className="w-4 h-4" /> Switch Role
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Manual Deposit
            </label>
            <div className="flex gap-2">
              <Input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                className="h-8" 
              />
              <Button size="sm" onClick={handleAddFunds} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Add
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              *Simulates admin adding credit manually offline (Cash/WhatsApp).
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVisitors } from "@/hooks/useVisitors";
import { useToast } from "@/hooks/use-toast";
import { Search, LogOut, CheckCircle2 } from "lucide-react";

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const { visitors, checkOutVisitor } = useVisitors();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const checkedIn = useMemo(
    () => visitors.filter((v) => v.status === "checked-in" && v.type !== "resident"),
    [visitors]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return checkedIn;
    const q = search.toLowerCase();
    return checkedIn.filter((v) => `${v.firstName} ${v.surname}`.toLowerCase().includes(q));
  }, [checkedIn, search]);

  const handleCheckOut = async (id: string, name: string) => {
    await checkOutVisitor(id);
    setDone(name);
    toast({ title: "Checked Out", description: `${name} has been checked out.` });
    setTimeout(() => navigate("/kiosk"), 3000);
  };

  if (done) {
    return (
      <div className="text-center space-y-4 max-w-md">
        <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Goodbye, {done}!</h2>
        <p className="text-muted-foreground">You have been checked out successfully.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <h2 className="text-2xl font-bold text-foreground text-center">Check Out</h2>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your name..." className="pl-12 h-12 text-base" autoFocus />
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No visitors found</div>
        ) : (
          filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => handleCheckOut(v.id, `${v.firstName} ${v.surname}`)}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-border bg-card hover:border-warning transition-all text-left"
            >
              <div>
                <p className="text-base font-semibold text-foreground">{v.firstName} {v.surname}</p>
                <p className="text-sm text-muted-foreground capitalize">{v.type}</p>
              </div>
              <LogOut className="h-5 w-5 text-warning" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

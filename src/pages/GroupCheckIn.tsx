import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useVisitors } from "@/hooks/useVisitors";
import { useWatchlist } from "@/hooks/useWatchlist";
import { WatchlistAlertDialog } from "@/components/WatchlistAlertDialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface GroupMember {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
}

export default function GroupCheckIn() {
  const { addVisitor } = useVisitors();
  const { checkVisitor } = useWatchlist();
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([
    { id: crypto.randomUUID(), firstName: "", surname: "", email: "", mobile: "" },
  ]);
  const [whomToVisit, setWhomToVisit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [watchlistEntry, setWatchlistEntry] = useState<any>(null);
  const [watchlistMatchType, setWatchlistMatchType] = useState<"confirmed" | "near">("confirmed");
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [blockedMember, setBlockedMember] = useState<string>("");

  const addRow = () => {
    setMembers((prev) => [...prev, { id: crypto.randomUUID(), firstName: "", surname: "", email: "", mobile: "" }]);
  };

  const removeRow = (id: string) => {
    if (members.length <= 1) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, field: keyof GroupMember, value: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async () => {
    const valid = members.filter((m) => m.firstName.trim() && m.surname.trim());
    if (valid.length === 0) return;

    // Check watchlist for all members
    for (const m of valid) {
      const match = checkVisitor(m.firstName, m.surname);
      if (match) {
        setWatchlistEntry(match.entry);
        setWatchlistMatchType(match.matchType);
        setBlockedMember(`${m.firstName} ${m.surname}`);
        setWatchlistOpen(true);
        if (match.matchType === "near" || match.entry.alert_type === "hard") return;
      }
    }

    setSubmitting(true);
    const groupId = crypto.randomUUID();

    try {
      for (const m of valid) {
        addVisitor({
          firstName: m.firstName,
          surname: m.surname,
          email: m.email,
          mobile: m.mobile,
          type: "visitor",
          checkInTime: new Date(),
          checkOutTime: null,
          whomToVisit,
          address: "",
          status: "checked-in",
          healthDeclaration: false,
          additionalVisitors: 0,
          comments: `Group check-in (${valid.length} members) [group:${groupId}]`,
          retentionExpiry: new Date(Date.now() + 86400000 * 60),
          acknowledgedPrivacy: false,
        });
      }
      setSubmitted(true);
      toast({ title: "Group Checked In", description: `${valid.length} visitors checked in successfully.` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to check in group. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Group Checked In</h2>
              <p className="text-muted-foreground">{members.filter(m => m.firstName.trim()).length} visitors have been checked in</p>
              <Button onClick={() => { setSubmitted(false); setMembers([{ id: crypto.randomUUID(), firstName: "", surname: "", email: "", mobile: "" }]); }}>
                New Group Check-In
              </Button>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div>
                  <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" /> Group Check-In
                  </h1>
                  <p className="text-[13px] text-muted-foreground">Register multiple visitors at once</p>
                </div>
              </div>
              <Badge variant="secondary">{members.length} member{members.length !== 1 ? "s" : ""}</Badge>
            </div>
          </header>

          <main className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visiting</label>
              <Input value={whomToVisit} onChange={(e) => setWhomToVisit(e.target.value)} placeholder="Who are they visiting?" className="mt-1.5" />
            </div>

            <div className="space-y-3">
              {members.map((m, i) => (
                <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-muted-foreground">Person {i + 1}</span>
                    {members.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeRow(m.id)}>
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Input placeholder="First name *" value={m.firstName} onChange={(e) => updateMember(m.id, "firstName", e.target.value)} />
                    <Input placeholder="Surname *" value={m.surname} onChange={(e) => updateMember(m.id, "surname", e.target.value)} />
                    <Input placeholder="Email" value={m.email} onChange={(e) => updateMember(m.id, "email", e.target.value)} />
                    <Input placeholder="Mobile" value={m.mobile} onChange={(e) => updateMember(m.id, "mobile", e.target.value)} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={addRow} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Person
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleSubmit}
                disabled={submitting || members.every((m) => !m.firstName.trim())}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Check In {members.filter((m) => m.firstName.trim()).length} Visitor{members.filter((m) => m.firstName.trim()).length !== 1 ? "s" : ""}
              </Button>
            </div>
          </main>
        </SidebarInset>
      </div>
      {watchlistEntry && (
        <WatchlistAlertDialog
          open={watchlistOpen}
          onOpenChange={setWatchlistOpen}
          entry={watchlistEntry}
          matchType={watchlistMatchType}
          onProceed={() => {}}
          onDeny={() => toast({ title: "Entry Denied", description: `${blockedMember} is on the watchlist and cannot be checked in.`, variant: "destructive" })}
        />
      )}
    </SidebarProvider>
  );
}

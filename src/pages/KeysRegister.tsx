import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useKeys, PropertyKey, KeyStatus } from "@/hooks/useKeys";
import { useResidents } from "@/hooks/useResidents";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { KeyRound, Plus, Search, History, ArrowLeftRight, AlertTriangle } from "lucide-react";

const STATUS_STYLE: Record<KeyStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-success/10 text-success border-success/20" },
  issued: { label: "Issued out", className: "bg-primary/10 text-primary border-primary/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  lost: { label: "Lost", className: "bg-destructive/10 text-destructive border-destructive/20" },
  retired: { label: "Retired", className: "bg-muted text-muted-foreground border-border" },
};

const KEY_TYPES = [
  { value: "property", label: "Property / unit key" },
  { value: "master", label: "Master key" },
  { value: "mailbox", label: "Mailbox key" },
  { value: "garage", label: "Garage / shed key" },
  { value: "fob", label: "Access fob / card" },
  { value: "other", label: "Other" },
];

export default function KeysRegister() {
  const { keys, loading, addKey, issueKey, returnKey, historyFor } = useKeys();
  const { residents } = useResidents();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [issueFor, setIssueFor] = useState<PropertyKey | null>(null);
  const [returnFor, setReturnFor] = useState<PropertyKey | null>(null);
  const [historyFor_, setHistoryFor] = useState<PropertyKey | null>(null);

  // Add key form
  const [form, setForm] = useState({
    keyLabel: "", keyType: "property", propertyLabel: "", residentVisitorId: "none",
    copyNumber: "", storageLocation: "", notes: "",
  });

  // Issue form
  const [issueForm, setIssueForm] = useState({
    issuedToName: "", issuedToType: "contractor", expectedReturn: "", issuedBy: "", notes: "",
  });

  // Return form
  const [returnForm, setReturnForm] = useState({ returnedTo: "", conditionNotes: "" });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keys.filter((k) => {
      if (statusFilter !== "all" && k.status !== statusFilter) return false;
      if (!q) return true;
      return [k.keyLabel, k.propertyLabel, k.residentName, k.currentIssue?.issuedToName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [keys, search, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PropertyKey[]>();
    for (const k of filtered) {
      const label = k.propertyLabel || "Unassigned";
      map.set(label, [...(map.get(label) || []), k]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const counts = useMemo(() => ({
    total: keys.length,
    available: keys.filter((k) => k.status === "available").length,
    issued: keys.filter((k) => k.status === "issued").length,
    overdue: keys.filter((k) => k.status === "overdue").length,
  }), [keys]);

  const submitAdd = async () => {
    if (!form.keyLabel.trim() || !form.propertyLabel.trim()) {
      toast({ title: "Key name and property are required", variant: "destructive" });
      return;
    }
    const resident = residents.find((r) => r.visitorId === form.residentVisitorId);
    const error = await addKey({
      keyLabel: form.keyLabel.trim(),
      keyType: form.keyType,
      propertyLabel: form.propertyLabel.trim(),
      residentVisitorId: resident?.visitorId || null,
      residentName: resident?.name || null,
      copyNumber: form.copyNumber ? Number(form.copyNumber) : null,
      storageLocation: form.storageLocation.trim() || null,
      notes: form.notes.trim() || null,
    });
    if (error) {
      toast({ title: "Could not add key", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Key added to the register" });
    setForm({ keyLabel: "", keyType: "property", propertyLabel: "", residentVisitorId: "none", copyNumber: "", storageLocation: "", notes: "" });
    setAddOpen(false);
  };

  const submitIssue = async () => {
    if (!issueFor) return;
    if (!issueForm.issuedToName.trim()) {
      toast({ title: "Who is the key going to?", variant: "destructive" });
      return;
    }
    const error = await issueKey({
      keyId: issueFor.id,
      issuedToName: issueForm.issuedToName.trim(),
      issuedToType: issueForm.issuedToType,
      expectedReturn: issueForm.expectedReturn ? new Date(issueForm.expectedReturn) : null,
      issuedBy: issueForm.issuedBy.trim() || null,
      notes: issueForm.notes.trim() || null,
    });
    if (error) {
      toast({ title: "Could not issue key", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${issueFor.keyLabel} issued to ${issueForm.issuedToName.trim()}` });
    setIssueForm({ issuedToName: "", issuedToType: "contractor", expectedReturn: "", issuedBy: "", notes: "" });
    setIssueFor(null);
  };

  const submitReturn = async () => {
    if (!returnFor?.currentIssue) return;
    const error = await returnKey({
      issueId: returnFor.currentIssue.id,
      keyId: returnFor.id,
      returnedTo: returnForm.returnedTo.trim() || null,
      conditionNotes: returnForm.conditionNotes.trim() || null,
    });
    if (error) {
      toast({ title: "Could not record the return", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${returnFor.keyLabel} returned` });
    setReturnForm({ returnedTo: "", conditionNotes: "" });
    setReturnFor(null);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Keys Register"
            subtitle="Every property key, who has it right now, and when it is due back."
          />

          <main className="p-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Keys on register", value: counts.total, tone: "text-foreground" },
                { label: "In the cabinet", value: counts.available, tone: "text-success" },
                { label: "Issued out", value: counts.issued, tone: "text-primary" },
                { label: "Overdue back", value: counts.overdue, tone: "text-destructive" },
              ].map((s) => (
                <Card key={s.label} className="rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {counts.overdue > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-medium">
                  {counts.overdue} {counts.overdue === 1 ? "key is" : "keys are"} past the expected return time.
                </span>
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search key, property, resident or holder"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="issued">Issued out</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add key
              </Button>
            </div>

            {/* Grouped list */}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading keys…</p>
            ) : grouped.length === 0 ? (
              <Card className="rounded-xl">
                <CardContent className="p-10 text-center space-y-2">
                  <KeyRound className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No keys match what you're looking for.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {grouped.map(([property, propertyKeys]) => (
                  <div key={property} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{property}</h2>
                      <span className="text-xs text-muted-foreground">
                        {propertyKeys.length} {propertyKeys.length === 1 ? "key" : "keys"}
                        {propertyKeys[0]?.residentName ? ` · ${propertyKeys[0].residentName}` : ""}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {propertyKeys.map((k) => {
                        const style = STATUS_STYLE[k.status];
                        return (
                          <Card key={k.id} className="rounded-xl">
                            <CardContent className="p-4 flex flex-wrap items-center gap-4">
                              <div className={`h-9 w-9 rounded-lg flex items-center justify-center border ${style.className}`}>
                                <KeyRound className="h-4 w-4" />
                              </div>
                              <div className="min-w-[180px] flex-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {k.keyLabel}
                                  {k.copyNumber ? <span className="text-muted-foreground font-normal"> · copy {k.copyNumber}</span> : null}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {KEY_TYPES.find((t) => t.value === k.keyType)?.label || k.keyType}
                                  {k.storageLocation ? ` · kept in ${k.storageLocation}` : ""}
                                </p>
                              </div>
                              <div className="min-w-[200px]">
                                {k.currentIssue ? (
                                  <>
                                    <p className="text-sm text-foreground">
                                      With <span className="font-medium">{k.currentIssue.issuedToName}</span>
                                    </p>
                                    <p className={`text-xs ${k.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                      Out since {format(k.currentIssue.issuedAt, "hh:mm a dd MMM")}
                                      {k.currentIssue.expectedReturn
                                        ? ` · due ${format(k.currentIssue.expectedReturn, "hh:mm a dd MMM")}`
                                        : ""}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">In the key cabinet</p>
                                )}
                              </div>
                              <Badge variant="outline" className={style.className}>{style.label}</Badge>
                              <div className="flex gap-2">
                                {k.currentIssue ? (
                                  <Button size="sm" onClick={() => setReturnFor(k)} className="gap-1">
                                    <ArrowLeftRight className="h-3.5 w-3.5" /> Return
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="secondary" onClick={() => setIssueFor(k)} className="gap-1 border border-border">
                                    <ArrowLeftRight className="h-3.5 w-3.5" /> Issue
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setHistoryFor(k)} className="gap-1">
                                  <History className="h-3.5 w-3.5" /> History
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </SidebarInset>
      </div>

      {/* Add key */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Add a key</DialogTitle>
            <DialogDescription>Record a key so it can be issued and tracked.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Key name</Label>
                <Input value={form.keyLabel} onChange={(e) => setForm({ ...form, keyLabel: e.target.value })} placeholder="Front door" />
              </div>
              <div className="space-y-1">
                <Label>Key type</Label>
                <Select value={form.keyType} onValueChange={(v) => setForm({ ...form, keyType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KEY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Property / unit</Label>
                <Input value={form.propertyLabel} onChange={(e) => setForm({ ...form, propertyLabel: e.target.value })} placeholder="Unit 12" />
              </div>
              <div className="space-y-1">
                <Label>Copy number</Label>
                <Input value={form.copyNumber} onChange={(e) => setForm({ ...form, copyNumber: e.target.value })} inputMode="numeric" placeholder="1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Resident (optional)</Label>
              <Select value={form.residentVisitorId} onValueChange={(v) => setForm({ ...form, residentVisitorId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No resident linked</SelectItem>
                  {residents.map((r) => <SelectItem key={r.visitorId} value={r.visitorId}>{r.name}{r.room ? ` · ${r.room}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Where it's kept</Label>
              <Input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} placeholder="Reception key cabinet, hook 12" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={submitAdd} className="w-full">Add key</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue key */}
      <Sheet open={!!issueFor} onOpenChange={(o) => !o && setIssueFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Issue {issueFor?.keyLabel}</SheetTitle>
            <SheetDescription>{issueFor?.propertyLabel}{issueFor?.residentName ? ` · ${issueFor.residentName}` : ""}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label>Who is taking the key?</Label>
              <Input value={issueForm.issuedToName} onChange={(e) => setIssueForm({ ...issueForm, issuedToName: e.target.value })} placeholder="Name of the person" />
            </div>
            <div className="space-y-1">
              <Label>They are a…</Label>
              <Select value={issueForm.issuedToType} onValueChange={(v) => setIssueForm({ ...issueForm, issuedToType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="staff">Staff member</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="family">Family member</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Expected back</Label>
              <Input type="datetime-local" value={issueForm.expectedReturn} onChange={(e) => setIssueForm({ ...issueForm, expectedReturn: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Issued by</Label>
              <Input value={issueForm.issuedBy} onChange={(e) => setIssueForm({ ...issueForm, issuedBy: e.target.value })} placeholder="Staff member handing it over" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} rows={2} placeholder="Reason, job reference…" />
            </div>
            <Button onClick={submitIssue} className="w-full">Issue key</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Return key */}
      <Sheet open={!!returnFor} onOpenChange={(o) => !o && setReturnFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Return {returnFor?.keyLabel}</SheetTitle>
            <SheetDescription>
              Currently with {returnFor?.currentIssue?.issuedToName}
              {returnFor?.currentIssue ? ` since ${format(returnFor.currentIssue.issuedAt, "hh:mm a dd MMM")}` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label>Received by</Label>
              <Input value={returnForm.returnedTo} onChange={(e) => setReturnForm({ ...returnForm, returnedTo: e.target.value })} placeholder="Staff member taking it back" />
            </div>
            <div className="space-y-1">
              <Label>Condition / notes</Label>
              <Textarea value={returnForm.conditionNotes} onChange={(e) => setReturnForm({ ...returnForm, conditionNotes: e.target.value })} rows={2} />
            </div>
            <Button onClick={submitReturn} className="w-full">Record return</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* History */}
      <Sheet open={!!historyFor_} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{historyFor_?.keyLabel} history</SheetTitle>
            <SheetDescription>{historyFor_?.propertyLabel}</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 mt-4">
            {historyFor_ && historyFor(historyFor_.id).length === 0 && (
              <p className="text-sm text-muted-foreground">This key has never been issued.</p>
            )}
            {historyFor_ && historyFor(historyFor_.id).map((i) => (
              <div key={i.id} className="rounded-xl border border-border p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{i.issuedToName} <span className="text-xs text-muted-foreground">({i.issuedToType})</span></p>
                <p className="text-xs text-muted-foreground">Out {format(i.issuedAt, "hh:mm a dd MMM yyyy")}{i.issuedBy ? ` · by ${i.issuedBy}` : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {i.returnedAt
                    ? `Returned ${format(i.returnedAt, "hh:mm a dd MMM yyyy")}${i.returnedTo ? ` · to ${i.returnedTo}` : ""}`
                    : i.expectedReturn
                      ? `Still out · due ${format(i.expectedReturn, "hh:mm a dd MMM yyyy")}`
                      : "Still out"}
                </p>
                {i.conditionNotes && <p className="text-xs text-muted-foreground">{i.conditionNotes}</p>}
                {i.notes && <p className="text-xs text-muted-foreground">{i.notes}</p>}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}

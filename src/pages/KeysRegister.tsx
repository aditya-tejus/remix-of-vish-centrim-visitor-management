import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useKeys, PropertyKey, KeyStatus } from "@/hooks/useKeys";
import { useResidents } from "@/hooks/useResidents";
import { useWings } from "@/hooks/useWings";
import { useToast } from "@/hooks/use-toast";
import { AddKeyDialog, keyTypeLabel } from "@/components/keys/AddKeyDialog";
import { IssueKeySheet, IssuePrefill } from "@/components/keys/IssueKeySheet";
import { KeyFilters, KeyFilterValues, EMPTY_FILTERS } from "@/components/keys/KeyFilters";
import { format } from "date-fns";
import { KeyRound, Plus, History, ArrowLeftRight, AlertTriangle, UserCog } from "lucide-react";

const STATUS_STYLE: Record<KeyStatus, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-success/10 text-success border-success/20" },
  issued: { label: "Issued out", className: "bg-primary/10 text-primary border-primary/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  lost: { label: "Lost", className: "bg-destructive/10 text-destructive border-destructive/20" },
  retired: { label: "Retired", className: "bg-muted text-muted-foreground border-border" },
};

const HOUR = 3600000;

export default function KeysRegister() {
  const { keys, issues, loading, addKey, issueKey, returnKey, historyFor } = useKeys();
  const { residents } = useResidents();
  const { data: wings = [] } = useWings();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [addOpen, setAddOpen] = useState(false);
  const [issueFor, setIssueFor] = useState<PropertyKey | null>(null);
  const [issuePrefill, setIssuePrefill] = useState<IssuePrefill | null>(null);
  const [returnFor, setReturnFor] = useState<PropertyKey | null>(null);
  const [historyKey, setHistoryKey] = useState<PropertyKey | null>(null);
  const [staffView, setStaffView] = useState<{ id: string | null; name: string } | null>(null);
  const [returnForm, setReturnForm] = useState({ returnedTo: "", conditionNotes: "" });

  // ---- Filters, kept in the page address so a view can be shared ----
  const filters: KeyFilterValues = {
    q: searchParams.get("q") || "",
    status: searchParams.get("status") || "all",
    type: searchParams.get("type") || "all",
    holder: searchParams.get("holder") || "all",
    area: searchParams.get("area") || "all",
    wing: searchParams.get("wing") || "all",
    age: searchParams.get("age") || "all",
  };

  const patchFilters = (patch: Partial<KeyFilterValues>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === "all") next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    Object.keys(EMPTY_FILTERS).forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
  };

  // Pre-fill when arriving from a visit record ("Issue key" action)
  useEffect(() => {
    const name = searchParams.get("issueToName");
    if (!name) return;
    setIssuePrefill({
      name,
      type: searchParams.get("issueToType") || "visitor",
      visitorId: searchParams.get("issueTo"),
    });
    const next = new URLSearchParams(searchParams);
    next.delete("issueTo"); next.delete("issueToName"); next.delete("issueToType");
    next.set("status", "available");
    setSearchParams(next, { replace: true });
    toast({ title: `Pick a key to issue to ${name}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wingByVisitorId = useMemo(() => {
    const map = new Map<string, string | null>();
    residents.forEach((r) => map.set(r.visitorId, r.wingId));
    return map;
  }, [residents]);

  const areas = useMemo(
    () => [...new Set(keys.map((k) => k.propertyLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [keys]
  );

  const matchesAge = (k: PropertyKey) => {
    if (filters.age === "all") return true;
    const issue = k.currentIssue;
    if (!issue) return false;
    const now = Date.now();
    switch (filters.age) {
      case "due_today":
        return !!issue.expectedReturn && new Date(issue.expectedReturn).toDateString() === new Date().toDateString();
      case "overdue":
        return k.overdue;
      case "over_24h":
        return now - issue.issuedAt.getTime() > 24 * HOUR;
      case "over_week":
        return now - issue.issuedAt.getTime() > 7 * 24 * HOUR;
      default:
        return true;
    }
  };

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return keys.filter((k) => {
      if (filters.status !== "all" && k.status !== filters.status) return false;
      if (filters.type !== "all" && k.keyType !== filters.type) return false;
      if (filters.holder !== "all" && k.currentIssue?.issuedToType !== filters.holder) return false;
      if (filters.area !== "all" && k.propertyLabel !== filters.area) return false;
      if (filters.wing !== "all") {
        const wingId = k.residentVisitorId ? wingByVisitorId.get(k.residentVisitorId) : null;
        if (wingId !== filters.wing) return false;
      }
      if (!matchesAge(k)) return false;
      if (!q) return true;
      return [k.keyLabel, k.propertyLabel, k.residentName, k.currentIssue?.issuedToName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, searchParams, wingByVisitorId]);

  const grouped = useMemo(() => {
    const map = new Map<string, PropertyKey[]>();
    for (const k of filtered) {
      const label = k.propertyLabel || "Unassigned";
      map.set(label, [...(map.get(label) || []), k]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const out = useMemo(
    () =>
      keys
        .filter((k) => k.currentIssue)
        .sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          return b.currentIssue!.issuedAt.getTime() - a.currentIssue!.issuedAt.getTime();
        }),
    [keys]
  );

  const counts = useMemo(() => ({
    total: keys.length,
    available: keys.filter((k) => k.status === "available").length,
    issued: keys.filter((k) => k.status === "issued").length,
    overdue: keys.filter((k) => k.status === "overdue").length,
    withStaff: keys.filter((k) => k.currentIssue?.issuedToType === "staff").length,
  }), [keys]);

  const openIssue = (k: PropertyKey) => {
    setIssueFor(k);
  };

  const closeIssue = () => {
    setIssueFor(null);
    setIssuePrefill(null);
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

  const holderName = (k: PropertyKey) => k.currentIssue?.issuedToName || "";

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
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "Keys on register", value: counts.total, tone: "text-foreground" },
                { label: "In the cabinet", value: counts.available, tone: "text-success" },
                { label: "Issued out", value: counts.issued, tone: "text-primary" },
                { label: "Overdue back", value: counts.overdue, tone: "text-destructive" },
                { label: "Held by staff", value: counts.withStaff, tone: "text-foreground" },
              ].map((s) => (
                <Card key={s.label} className="rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Keys out right now */}
            {out.length > 0 && (
              <Card className="rounded-xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">Keys out right now</h2>
                    {counts.overdue > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {counts.overdue} past due
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {out.slice(0, 8).map((k) => (
                      <div
                        key={k.id}
                        className={`flex flex-wrap items-center gap-3 rounded-lg border p-2.5 ${
                          k.overdue ? "border-destructive/30 bg-destructive/5" : "border-border"
                        }`}
                      >
                        <KeyRound className={`h-4 w-4 ${k.overdue ? "text-destructive" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium text-foreground">{k.keyLabel}</span>
                        <span className="text-xs text-muted-foreground">{k.propertyLabel}</span>
                        <span className="text-sm text-foreground">→ {holderName(k)}</span>
                        <span className={`text-xs ml-auto ${k.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          Out since {format(k.currentIssue!.issuedAt, "hh:mm a dd MMM")}
                          {k.currentIssue!.expectedReturn ? ` · due ${format(k.currentIssue!.expectedReturn, "hh:mm a dd MMM")}` : ""}
                        </span>
                        <Button size="sm" onClick={() => setReturnFor(k)}>Return</Button>
                      </div>
                    ))}
                    {out.length > 8 && (
                      <p className="text-xs text-muted-foreground">
                        and {out.length - 8} more — use the “Issued out” filter to see them all.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Controls */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <KeyFilters
                  values={filters}
                  onChange={patchFilters}
                  onClear={clearFilters}
                  areas={areas}
                  wings={wings.map((w) => ({ id: w.id, name: w.name }))}
                  resultCount={filtered.length}
                />
              </div>
              <Button onClick={() => setAddOpen(true)} className="gap-2 shrink-0">
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
                                  {keyTypeLabel(k.keyType)}
                                  {k.storageLocation ? ` · kept in ${k.storageLocation}` : ""}
                                </p>
                              </div>
                              <div className="min-w-[200px]">
                                {k.currentIssue ? (
                                  <>
                                    <p className="text-sm text-foreground">
                                      With{" "}
                                      {k.currentIssue.issuedToType === "staff" ? (
                                        <button
                                          onClick={() => setStaffView({ id: k.currentIssue!.issuedToStaffId, name: k.currentIssue!.issuedToName })}
                                          className="font-medium underline underline-offset-2 hover:text-primary"
                                        >
                                          {k.currentIssue.issuedToName}
                                        </button>
                                      ) : (
                                        <span className="font-medium">{k.currentIssue.issuedToName}</span>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {" "}· {k.currentIssue.issuedToType}
                                        {k.currentIssue.issuedToType === "staff" ? " (no visit record)" : ""}
                                      </span>
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
                                  <Button size="sm" variant="secondary" onClick={() => openIssue(k)} className="gap-1 border border-border">
                                    <ArrowLeftRight className="h-3.5 w-3.5" /> Issue
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => setHistoryKey(k)} className="gap-1">
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

      <AddKeyDialog open={addOpen} onOpenChange={setAddOpen} residents={residents} onAdd={addKey} />

      <IssueKeySheet
        keyRecord={issueFor}
        prefill={issuePrefill}
        onClose={closeIssue}
        onIssue={issueKey}
      />

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
      <Sheet open={!!historyKey} onOpenChange={(o) => !o && setHistoryKey(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{historyKey?.keyLabel} history</SheetTitle>
            <SheetDescription>{historyKey?.propertyLabel}</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 mt-4">
            {historyKey && historyFor(historyKey.id).length === 0 && (
              <p className="text-sm text-muted-foreground">This key has never been issued.</p>
            )}
            {historyKey && historyFor(historyKey.id).map((i) => (
              <div key={i.id} className="rounded-xl border border-border p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{i.issuedToName} <span className="text-xs text-muted-foreground">({i.issuedToType}{i.issuedToType === "staff" ? ", no visit record" : ""})</span></p>
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

      {/* Keys held by one staff member */}
      <Sheet open={!!staffView} onOpenChange={(o) => !o && setStaffView(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" /> {staffView?.name}
            </SheetTitle>
            <SheetDescription>Keys this staff member holds, and everything they have taken before.</SheetDescription>
          </SheetHeader>
          {staffView && (() => {
            const matches = (i: { issuedToStaffId: string | null; issuedToName: string }) =>
              staffView.id ? i.issuedToStaffId === staffView.id : i.issuedToName === staffView.name;
            const holding = keys.filter((k) => k.currentIssue && matches(k.currentIssue));
            const past = issues.filter((i) => i.returnedAt && matches(i));
            return (
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Holding now</p>
                  {holding.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No keys out at the moment.</p>
                  ) : holding.map((k) => (
                    <div key={k.id} className="rounded-xl border border-border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{k.keyLabel} · {k.propertyLabel}</p>
                        <p className={`text-xs ${k.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          Out since {format(k.currentIssue!.issuedAt, "hh:mm a dd MMM")}
                          {k.currentIssue!.expectedReturn ? ` · due ${format(k.currentIssue!.expectedReturn, "hh:mm a dd MMM")}` : ""}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => { setStaffView(null); setReturnFor(k); }}>Return</Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previously</p>
                  {past.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No past key issues.</p>
                  ) : past.slice(0, 20).map((i) => (
                    <div key={i.id} className="rounded-xl border border-border p-3">
                      <p className="text-sm text-foreground">{keys.find((k) => k.id === i.keyId)?.keyLabel || "Key"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(i.issuedAt, "hh:mm a dd MMM yyyy")} → {i.returnedAt ? format(i.returnedAt, "hh:mm a dd MMM yyyy") : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}

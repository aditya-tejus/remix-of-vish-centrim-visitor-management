import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, Download, Printer, Search, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/reception-primitives";
import { ChoiceChips } from "@/components/reports/ReportParts";
import { LoadingState, EmptyState, ErrorState, PermissionDeniedState } from "@/components/states";
import { useVisitors } from "@/hooks/useVisitors";
import { usePermissions } from "@/hooks/usePermissions";
import { useSite } from "@/contexts/SiteContext";
import { useToast } from "@/hooks/use-toast";
import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { exportCsvAudited } from "@/lib/exportAudit";
import { onSiteRoll, printHtml, rollPrintHtml } from "@/lib/onSiteRoll";
import { cn } from "@/lib/utils";

type View = "all" | "past";

/**
 * Who is on site — the live roll for a fire check or shift handover.
 * Residents live here and are never on the roll. Past visits are in the visitor report.
 */
export default function OperationsReport() {
  const { visitors, loading, error, refresh } = useVisitors();
  const { can, loading: permsLoading } = usePermissions();
  const { currentSite, currentSiteId } = useSite();
  const { toast } = useToast();
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  const roll = useMemo(
    () => onSiteRoll(visitors, { now, isPastExpected: isOverstayedSync, onlyPastExpected: view === "past", search }),
    [visitors, now, view, search],
  );
  const canExport = can("data.export");

  const rows = roll.groups.flatMap((g) => g.entries);
  const handleExport = async () => {
    await exportCsvAudited(
      ["Name", "Type", "Arrived", "Here for", "Visiting or working with", "Past expected time"],
      rows.map((x) => [x.name, x.type, format(x.visit.checkInTime, "yyyy-MM-dd HH:mm"), x.stay, x.visit.whomToVisit || "", x.pastExpected ? "Yes" : ""]),
      { filenamePrefix: "on-site", auditAction: "operations_report_export", siteId: currentSiteId, siteName: currentSite?.name ?? null, scopeNote: view === "past" ? "Past expected time" : "Everyone on site" },
    );
    toast({ title: "Download ready", description: "This download is recorded in the audit trail." });
  };
  const handlePrint = () => {
    if (!printHtml(rollPrintHtml(roll.groups, { siteName: currentSite?.name ?? "", now: new Date() }))) {
      toast({ title: "Printing is blocked here", description: "Open the app in its own browser tab to print.", variant: "destructive" });
    }
  };

  if (permsLoading) return <Shell><LoadingState label="Checking your access" /></Shell>;
  if (!can("presence.view")) return <Shell><PermissionDeniedState description="You do not have permission to see who is on site." /></Shell>;

  return (
    <Shell
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePrint} disabled={loading || rows.length === 0}><Printer className="h-4 w-4" />Print roll</Button>
          {canExport && <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}><Download className="h-4 w-4" />Download</Button>}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="On site now" icon={Users} value={loading ? "…" : roll.total} note="Residents not included" />
          <StatTile label="Past expected time" icon={AlertTriangle} value={loading ? "…" : roll.pastExpected}
            tone={roll.pastExpected > 0 ? "attention" : "neutral"} note={roll.pastExpected > 0 ? "Check they are still here" : "Everyone within time"} />
          <StatTile className="col-span-2" label="Updated" value={format(now, "h:mm a")} note="Refreshes every minute. Residents who are out are on the Residents page." />
        </div>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <ChoiceChips label="Show" value={view} onChange={(v) => setView(v as View)}
              options={[{ id: "all", label: `Everyone (${roll.total})` }, { id: "past", label: `Past expected time (${roll.pastExpected})` }]} />
            <div className="relative sm:w-72">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search the roll" placeholder="Search name or who they are seeing" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="p-4">
            {error ? (
              <ErrorState description={error} onRetry={() => void refresh()} />
            ) : loading ? (
              <LoadingState label="Loading who is on site" />
            ) : rows.length === 0 ? (
              <EmptyState
                title={search ? "No one matches that search" : view === "past" ? "Nobody is past their expected time" : "Nobody is signed in"}
                description={view === "past" && !search ? "Everyone on site is within the time set for their visit type." : undefined}
              />
            ) : (
              <div className="space-y-6">
                {roll.groups.map((g) => (
                  <div key={g.type}>
                    <h2 className="mb-2 text-sm font-extrabold text-foreground">{g.label} <span className="font-semibold text-muted-foreground">({g.entries.length})</span></h2>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {g.entries.map((x) => (
                        <li key={x.visit.id} className={cn("grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4", x.pastExpected && "bg-warning-subtle/40")}>
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold text-foreground">{x.name}</p>
                            <p className="truncate text-[13px] text-muted-foreground">{x.visit.whomToVisit ? `Seeing ${x.visit.whomToVisit}` : "No one named"}</p>
                          </div>
                          <p className="text-[13px] text-foreground">
                            Arrived {format(x.visit.checkInTime, x.fromEarlierDay ? "h:mm a, EEE d MMM" : "h:mm a")}
                            <span className="text-muted-foreground"> · here {x.stay}</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5 sm:justify-end">
                            {x.fromEarlierDay && <span className="rounded-full bg-info-subtle px-2.5 py-0.5 text-xs font-bold text-info-strong">Since {format(x.visit.checkInTime, "EEE")}</span>}
                            {x.pastExpected && <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-bold text-warning-strong">Past expected time</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="text-sm text-muted-foreground">
          Looking for someone who has already left? Use the <Link to="/reports/visitor-report" className="font-bold text-primary underline-offset-4 hover:underline">visitor report</Link>.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <AppShell title="Who is on site" eyebrow="Reports"
      mainClassName="p-4 sm:p-6"
      subtitle="Everyone signed in right now, grouped by type. Print it for a fire check or shift handover."
      actions={actions}>
      {children}
    </AppShell>
  );
}

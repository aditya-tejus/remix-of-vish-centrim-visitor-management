import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FlaskConical, Trash2, RefreshCw, Info } from "lucide-react";
import {
  summariseCounts,
  totalCount,
  DEFAULT_SKIPPED,
  type DemoSeedRun,
} from "@/lib/demoSeed";

/** What the loader creates, in the administrator's words. */
const WILL_CREATE = [
  "Two wings or units, and three residents with rooms and an emergency contact",
  "A day of arrivals: visitors on site now, a group with two companions, a volunteer, a visiting nurse, a checked-out visit and one arrival with no sign-out",
  "Earlier visits for the regular visitors, so their profiles show a history",
  "Check-in outcomes: clear, a warning and one declined arrival",
  "One contractor company with two people and pending, confirmed and expired documents",
  "Two food register entries",
  "Three keys and fobs: one out, one returned, one overdue",
  "A short feedback survey with answers",
];

export function DemoDataCard() {
  const { currentSiteId, currentSite } = useSite();
  const { can, loading: permsLoading } = usePermissions();
  const { toast } = useToast();
  const [run, setRun] = useState<DemoSeedRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isAdmin = can("settings.administer");

  const refresh = useCallback(async () => {
    if (!currentSiteId) {
      setRun(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase.from("demo_seed_runs" as any) as any)
      .select("*")
      .eq("branch_id", currentSiteId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as any[])?.[0];
    setRun(
      row
        ? {
            id: row.id,
            branchId: row.branch_id,
            seedKey: row.seed_key,
            status: row.status,
            counts: row.counts ?? {},
            skipped: Array.isArray(row.skipped) ? row.skipped : DEFAULT_SKIPPED,
            createdAt: row.created_at,
            createdByLabel: row.created_by_label ?? null,
            removedAt: row.removed_at ?? null,
          }
        : null
    );
    setLoading(false);
  }, [currentSiteId]);

  useEffect(() => {
    if (isAdmin) refresh();
    else setLoading(false);
  }, [isAdmin, refresh]);

  if (permsLoading || !isAdmin) return null;

  const siteName = currentSite?.name ?? "this site";
  const lines = run ? summariseCounts(run.counts) : [];

  const load = async () => {
    if (!currentSiteId) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("seed_demo_data", { p_branch_id: currentSiteId });
    setBusy(false);
    setConfirmLoad(false);
    if (error) {
      toast({ title: "Demo data was not loaded", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Demo data loaded",
      description: `${totalCount((data as any)?.counts)} demo records created for ${siteName}.`,
    });
    refresh();
  };

  const remove = async () => {
    if (!run) return;
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("clear_demo_data", { p_run_id: run.id });
    setBusy(false);
    setConfirmRemove(false);
    if (error) {
      toast({ title: "Demo data was not removed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Demo data removed",
      description: `${(data as any)?.total ?? 0} demo records deleted from ${siteName}.`,
    });
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Demo data
            </CardTitle>
            <CardDescription>
              Realistic practice records for {siteName}, matched to the country this site operates in.
              Nothing is created until you confirm, and removing them only deletes records this loader
              created.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading || busy}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking this site…</p>
        ) : run ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Practice data loaded</Badge>
              <span className="text-sm text-muted-foreground">
                Loaded {format(new Date(run.createdAt), "hh:mm a dd MMM yyyy")}
                {run.createdByLabel ? ` by ${run.createdByLabel}` : ""}
              </span>
            </div>
            <ul className="text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {lines.map((l) => (
                <li key={l.key} className="flex justify-between border-b border-border/50 py-1">
                  <span className="text-muted-foreground">{l.label}</span>
                  <span className="font-medium tabular-nums">{l.value}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm">
              <span className="font-medium">{totalCount(run.counts)}</span> demo records in total.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No demo data is loaded for {siteName}.
          </p>
        )}

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Not created on purpose
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
            {(run?.skipped ?? DEFAULT_SKIPPED).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConfirmLoad(true)} disabled={busy || loading || !!run || !currentSiteId}>
            <FlaskConical className="h-4 w-4 mr-2" aria-hidden="true" />
            Load demo data
          </Button>
          <Button variant="destructive" onClick={() => setConfirmRemove(true)} disabled={busy || loading || !run}>
            <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
            Remove demo data
          </Button>
        </div>
        {run && (
          <p className="text-xs text-muted-foreground">
            Demo data is already loaded here. Remove it before loading it again.
          </p>
        )}
      </CardContent>

      <AlertDialog open={confirmLoad} onOpenChange={setConfirmLoad}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Load demo data for {siteName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  These practice records will be created at {siteName} only. The names are invented but
                  realistic for this country, so this site shows a standing notice while practice data is
                  loaded.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {WILL_CREATE.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p>This is written to the audit trail with the record counts.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); load(); }} disabled={busy}>
              {busy ? "Loading…" : "Load demo data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove demo data from {siteName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  {totalCount(run?.counts)} demo records will be deleted. Only records created by this demo
                  load are affected — real records are never touched.
                </p>
                <ul className="text-sm space-y-1">
                  {lines.map((l) => (
                    <li key={l.key}>
                      {l.label}: {l.value}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} disabled={busy}>
              {busy ? "Removing…" : "Remove demo data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

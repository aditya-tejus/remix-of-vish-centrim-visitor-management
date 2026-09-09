import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ClipboardCheck, RefreshCw, PlayCircle, ShieldCheck, Eye, ListOrdered } from "lucide-react";

interface IssueRow {
  issue: string;
  records: number;
  sample_ids: string[] | null;
}

interface SampleRow {
  record_id: string;
  label: string;
  detail: string;
  occurred_at: string;
}

interface DuplicateRow {
  party_id: string;
  visit_id: string;
  companion_index: number;
  display_name: string;
  name_status: string;
  status: string;
  check_in_time: string;
  check_out_time: string | null;
  is_primary: boolean;
  visit_label: string;
}

interface ReconcileResult {
  visits_created: number;
  parties_created: number;
  placeholders_created: number;
}

/** Plain wording for each check, so an administrator can act without SQL. */
const ISSUE_LABELS: Record<string, string> = {
  visitors_without_visit: "Arrivals with no attendance record",
  visits_without_parties: "Attendance records with nobody listed",
  visits_without_primary: "Attendance records with no main visitor",
  headcount_mismatch: "People counted at sign-in but not listed individually",
  duplicate_party_index: "The same position listed twice on one visit",
  multiple_primaries: "More than one main visitor on a visit",
  unresolved_companions: "Companions counted but never named",
  cross_site_party_person: "Someone linked to a person from another site",
};

/**
 * Read-only integrity checks plus a rehearsal-first repair for older records.
 * Nothing is ever deleted, merged or renamed here — gaps are filled in, and
 * anything ambiguous is listed for a person to review and decide on.
 */
export function AttendanceIntegrityCard() {
  const { currentSiteId, currentSite } = useSite();
  const { toast } = useToast();
  const [issues, setIssues] = useState<IssueRow[] | null>(null);
  const [preview, setPreview] = useState<ReconcileResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [samples, setSamples] = useState<{ issue: string; rows: SampleRow[] } | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateRow[] | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);

  const fail = (e: any) =>
    toast({
      title: "Could not complete that check",
      description: e?.message || "Please try again, or ask an administrator.",
      variant: "destructive",
    });

  const runCheck = async () => {
    setBusy("check");
    try {
      const { data, error } = await supabase.rpc("visit_integrity_report" as any, {
        p_branch_id: currentSiteId ?? null,
      });
      if (error) throw error;
      setIssues((data as unknown as IssueRow[]) || []);
      setSamples(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const runReconcile = async (dryRun: boolean) => {
    setBusy(dryRun ? "preview" : "apply");
    try {
      const { data, error } = await supabase.rpc("reconcile_visit_parties" as any, {
        p_branch_id: currentSiteId ?? null,
        p_dry_run: dryRun,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as ReconcileResult;
      setPreview(row);
      if (!dryRun) {
        toast({
          title: "Older records filled in",
          description: `${row?.parties_created ?? 0} people added to past visits. Nothing was deleted or merged.`,
        });
        await runCheck();
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const loadSamples = async (issue: string) => {
    setBusy(`samples-${issue}`);
    try {
      const { data, error } = await supabase.rpc("visit_integrity_samples" as any, {
        p_issue: issue,
        p_branch_id: currentSiteId ?? null,
        p_limit: 25,
      });
      if (error) throw error;
      setSamples({ issue, rows: (data as unknown as SampleRow[]) || [] });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const loadDuplicates = async () => {
    setBusy("duplicates");
    try {
      const { data, error } = await supabase.rpc("duplicate_party_details" as any, {
        p_branch_id: currentSiteId ?? null,
      });
      if (error) throw error;
      setDuplicates((data as unknown as DuplicateRow[]) || []);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const renumber = async (partyId: string) => {
    setBusy(`renumber-${partyId}`);
    try {
      const { error } = await supabase.rpc("renumber_visit_party" as any, { p_party_id: partyId });
      if (error) throw error;
      toast({
        title: "Position moved",
        description: "The entry was given the next free position. The record itself is unchanged and the change is in the audit trail.",
      });
      await loadDuplicates();
      await runCheck();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const duplicateIssue = issues?.find((i) => i.issue === "duplicate_party_index");
  const hasDuplicates = (duplicateIssue?.records ?? 0) > 0;
  const siteName = currentSite?.name || "this site";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Attendance record check
        </CardTitle>
        <CardDescription>
          Checks that everyone recorded as arriving at {siteName} — including companions — is listed as their own
          person. Older records can be filled in only when you press Apply. Nothing is ever deleted, merged or renamed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={runCheck}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Run check
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => runReconcile(true)}>
            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
            Preview repair
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy !== null || !preview || hasDuplicates}
            onClick={() => setConfirmApply(true)}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Apply repair
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={loadDuplicates}>
            <ListOrdered className="h-3.5 w-3.5" aria-hidden />
            Review duplicate positions
          </Button>
        </div>

        {hasDuplicates && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            {duplicateIssue?.records} entr{duplicateIssue?.records === 1 ? "y is" : "ies are"} recorded in the same
            position on a visit. Review them below and move a position where it is right to do so. The repair button
            stays off until none are left.
          </p>
        )}

        {preview && (
          <p className="text-[13px] text-muted-foreground">
            Rehearsal result: {preview.visits_created} visits, {preview.parties_created} people and{" "}
            {preview.placeholders_created} unnamed companions would be added. Nothing has been changed yet.
          </p>
        )}

        {issues &&
          (issues.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No problems found for {siteName}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>What was found</TableHead>
                  <TableHead className="w-24 text-right">Records</TableHead>
                  <TableHead className="w-32 text-right">Examples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((row) => (
                  <TableRow key={row.issue}>
                    <TableCell className="text-[13px]">{ISSUE_LABELS[row.issue] || row.issue}</TableCell>
                    <TableCell className="text-right tabular-nums text-[13px]">{row.records}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        disabled={busy !== null || row.records === 0}
                        onClick={() => loadSamples(row.issue)}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        View examples
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

        {samples && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-[13px] font-medium">
              Examples: {ISSUE_LABELS[samples.issue] || samples.issue}
            </p>
            {samples.rows.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No example records to show.</p>
            ) : (
              <ul className="space-y-1">
                {samples.rows.map((r) => (
                  <li key={r.record_id} className="text-[13px] text-muted-foreground">
                    <span className="text-foreground">{r.label}</span> — {r.detail}
                    {r.occurred_at ? ` · ${format(new Date(r.occurred_at), "hh:mm a dd MMM yyyy")}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {duplicates && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-[13px] font-medium">Duplicate positions</p>
            {duplicates.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No duplicate positions at {siteName}.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead className="w-20 text-right">Position</TableHead>
                    <TableHead className="w-40 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.map((d) => (
                    <TableRow key={d.party_id}>
                      <TableCell className="text-[13px]">
                        {d.display_name}
                        {d.is_primary ? " (main visitor)" : ""}
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {d.visit_label} · {format(new Date(d.check_in_time), "hh:mm a dd MMM")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[13px]">{d.companion_index}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={busy !== null || d.is_primary}
                          onClick={() => renumber(d.party_id)}
                        >
                          <ListOrdered className="h-3.5 w-3.5" aria-hidden />
                          Move to next position
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fill in older attendance records?</AlertDialogTitle>
            <AlertDialogDescription>
              This adds the missing people to past visits at {siteName}, exactly as shown in the rehearsal. Existing
              records are never deleted, merged or renamed, and companions who were only counted stay marked as
              unnamed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmApply(false);
                runReconcile(false);
              }}
            >
              Apply repair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

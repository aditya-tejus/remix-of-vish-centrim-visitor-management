import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, RefreshCw, PlayCircle, ShieldCheck } from "lucide-react";

interface IssueRow {
  issue: string;
  records: number;
  sample_ids: string[] | null;
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
  duplicate_party_index: "The same person listed twice on one visit",
  multiple_primaries: "More than one main visitor on a visit",
  unresolved_companions: "Companions counted but never named",
  cross_site_party_person: "Someone linked to a person from another site",
};
/**
 * Read-only integrity checks plus a rehearsal-first repair for older records.
 * Nothing is ever deleted or merged here — gaps are filled in, and anything
 * ambiguous is reported for a person to review.
 */
export function AttendanceIntegrityCard() {
  const { currentSiteId } = useSite();
  const { toast } = useToast();
  const [issues, setIssues] = useState<IssueRow[] | null>(null);
  const [preview, setPreview] = useState<ReconcileResult | null>(null);
  const [busy, setBusy] = useState<"check" | "preview" | "apply" | null>(null);

  const run = async (mode: "check" | "preview" | "apply") => {
    setBusy(mode);
    try {
      if (mode === "check") {
        const { data, error } = await supabase.rpc("visit_integrity_report" as any, {
          p_branch_id: currentSiteId ?? null,
        });
        if (error) throw error;
        setIssues((data as unknown as IssueRow[]) || []);
      } else {
        const { data, error } = await supabase.rpc("reconcile_visit_parties" as any, {
          p_branch_id: currentSiteId ?? null,
          p_dry_run: mode === "preview",
        });
        if (error) throw error;
        const row = (Array.isArray(data) ? data[0] : data) as ReconcileResult;
        setPreview(row);
        if (mode === "apply") {
          toast({
            title: "Older records filled in",
            description: `${row?.parties_created ?? 0} people added to past visits. Nothing was deleted or merged.`,
          });
          await run("check");
        }
      }
    } catch (e: any) {
      toast({
        title: "Could not complete that check",
        description: e?.message || "Please try again, or ask an administrator.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const duplicates = issues?.find((i) => i.issue === "duplicate_party_index");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" aria-hidden />
          Attendance record check
        </CardTitle>
        <CardDescription>
          Checks that everyone recorded as arriving — including companions — is listed as their own person.
          Older records can be filled in. Nothing is ever deleted, merged or renamed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => run("check")}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Run check
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null} onClick={() => run("preview")}>
            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
            Preview repair
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy !== null || !preview || !!duplicates}
            onClick={() => run("apply")}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Apply repair
          </Button>
        </div>

        {duplicates && duplicates.records > 0 && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            {duplicates.records} visit{duplicates.records === 1 ? "" : "s"} list the same person twice. These need a
            person to review them before any repair runs, so the repair button stays off until they are resolved.
          </p>
        )}

        {preview && (
          <p className="text-[13px] text-muted-foreground">
            Rehearsal result: {preview.visits_created} visits, {preview.parties_created} people and{" "}
            {preview.placeholders_created} unnamed companions would be added.
          </p>
        )}

        {issues && (
          issues.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No problems found for this site.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>What was found</TableHead>
                  <TableHead className="w-24 text-right">Records</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((row) => (
                  <TableRow key={row.issue}>
                    <TableCell className="text-[13px]">{ISSUE_LABELS[row.issue] || row.issue}</TableCell>
                    <TableCell className="text-right tabular-nums text-[13px]">{row.records}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, Plus, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddWatchlistDialog } from "@/components/AddWatchlistDialog";
import { useWatchlist, WATCHLIST_REASON_CATEGORIES } from "@/hooks/useWatchlist";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Safeguarding watchlist — a register of restrictions, not a kind of contact.
 * Lives under Records. Anyone signed in can read it; adding and removing need
 * the watchlist.manage permission (also enforced by the database).
 */
export default function WatchlistPage() {
  const { data: watchlist = [], addEntry, removeEntry, entriesDueReview } = useWatchlist();
  const { can } = usePermissions();
  const canManage = can("watchlist.manage");
  const [addOpen, setAddOpen] = useState(false);
  const category = (v?: string | null) => WATCHLIST_REASON_CATEGORIES.find((c) => c.value === v)?.label;

  return (
    <AppShell
      title="Watchlist"
      subtitle="People with a safeguarding restriction. Staff see the guidance at check-in."
      titleIcon={ShieldAlert}
      mainClassName="p-4 sm:p-6 space-y-6"
      actions={canManage ? (
        <Button
          variant="outline"
          onClick={() => setAddOpen(true)}
          className="h-11 gap-2 rounded-lg border-destructive bg-card font-bold text-destructive-strong hover:bg-emergency-muted hover:text-destructive-strong"
        >
          <Plus aria-hidden className="h-4 w-4" />Add to watchlist
        </Button>
      ) : undefined}
    >
      {!canManage && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] leading-[18px] text-muted-foreground">
          You can see the watchlist. Adding or removing an entry needs the "Manage the watchlist" permission.
        </p>
      )}

      {entriesDueReview.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-[hsl(var(--warning)/0.08)] p-4">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {entriesDueReview.length} {entriesDueReview.length === 1 ? "entry is" : "entries are"} due for review
            </p>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {entriesDueReview.map((e) => `${e.first_name} ${e.surname}`).join(", ")}. Renew, change to a soft alert, or remove{" "}
              {entriesDueReview.length === 1 ? "this restriction" : "these restrictions"}.
            </p>
          </div>
        </div>
      )}

      <section aria-label="Watchlist entries" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ShieldAlert aria-hidden className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">No one is on the watchlist.</p>
            <p className="max-w-sm text-[13px] leading-[18px] text-muted-foreground">
              Add someone when a court order, family dispute or other concern means staff need guidance before they visit.
            </p>
            {canManage && (
              <Button variant="outline" onClick={() => setAddOpen(true)} className="mt-1 h-11 rounded-lg border-destructive font-bold text-destructive-strong">
                Add to watchlist
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary hover:bg-secondary">
                  {["Name", "Reason", "Review due", "Alert", "Added by", "Added"].map((h) => (
                    <TableHead key={h} className="text-xs font-bold text-muted-foreground">{h}</TableHead>
                  ))}
                  {canManage && <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlist.map((entry) => {
                  const overdue = entry.review_date ? new Date(`${entry.review_date}T23:59:59`) < new Date() : true;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm font-bold">{entry.first_name} {entry.surname}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="truncate text-sm">{entry.reason}</p>
                        {category(entry.reason_category) && <p className="text-xs text-muted-foreground">{category(entry.reason_category)}</p>}
                      </TableCell>
                      <TableCell className={`text-sm ${overdue ? "font-bold text-warning-strong" : "text-muted-foreground"}`}>
                        {entry.review_date ? format(new Date(entry.review_date), "d MMM yyyy") : "Not set"}
                      </TableCell>
                      <TableCell>
                        {entry.alert_type === "hard" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emergency-muted px-2.5 py-0.5 text-xs font-bold text-destructive-strong">
                            <ShieldAlert aria-hidden className="h-3.5 w-3.5" />Hard block
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--warning)/0.12)] px-2.5 py-0.5 text-xs font-bold text-warning-strong">
                            <AlertTriangle aria-hidden className="h-3.5 w-3.5" />Soft alert
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.added_by}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(entry.created_at), "d MMM yyyy")}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            className="h-11 text-sm font-bold text-destructive-strong hover:text-destructive-strong"
                            onClick={() => removeEntry.mutate(entry.id)}
                            aria-label={`Remove ${entry.first_name} ${entry.surname} from the watchlist`}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AddWatchlistDialog open={addOpen} onOpenChange={setAddOpen} onAdd={(entry) => addEntry.mutate(entry)} />
    </AppShell>
  );
}

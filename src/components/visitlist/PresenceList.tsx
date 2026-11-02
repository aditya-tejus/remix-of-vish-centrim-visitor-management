import { useEffect, useState, type ReactNode } from "react";
import { format, isToday } from "date-fns";
import {
  AlertTriangle, Clock, FileSpreadsheet, FileText, Home, KeyRound, LogIn, LogOut, MessageSquare,
  MoreHorizontal, Printer, ShieldAlert, Timer, Trash2, UsersRound,
} from "lucide-react";
import type { Visitor } from "@/types/visitor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useOverstayPolicy } from "@/hooks/useOverstayPolicy";
import { useResidents } from "@/hooks/useResidents";
import { useSiteStructure } from "@/hooks/useSiteStructure";
import { useSite } from "@/contexts/SiteContext";
import { useToast } from "@/hooks/use-toast";
import type { AttendanceParty } from "@/hooks/useAttendance";
import { companionRowsForVisitor, type AccountableRow } from "@/lib/accountablePeople";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { issueBadge } from "@/lib/badgeIssue";
import { destinationFor, expectedOutBy, isOverdueBack, stayLabel } from "@/lib/presence";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  visitor: "Visitor", contractor: "Contractor", volunteer: "Volunteer", staff: "Staff", resident: "Resident",
};
const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0).toUpperCase() + t.slice(1);

interface Props {
  rows: Visitor[];
  allVisitors: Visitor[];
  companionParties: AttendanceParty[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  canCheckOut: boolean;
  canRecordReturn: boolean;
  canExport: boolean;
  canDelete: boolean;
  showDestination: boolean;
  onOpen: (v: Visitor) => void;
  onOpenResident: (residentId: string) => void;
  onCheckOut: (id: string) => void;
  onCheckOutMany: (ids: string[]) => void;
  onCheckOutParty: (partyId: string) => void;
  onRecordReturn: (id: string, comment?: string, time?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onFeedback: (v: Visitor) => void;
}

/**
 * The reception list. One row per person with what the desk is asked about —
 * who, where they went, how long they have been here — and the one action
 * that matters, with everything else in the row menu.
 */
export function PresenceList(p: Props) {
  const { toast } = useToast();
  const { openIssues } = useOpenKeyIssues();
  const { checkVisitor } = useWatchlist();
  const { isOverstayed, hoursFor } = useOverstayPolicy();
  const { residents } = useResidents();
  const { areaLabel } = useSiteStructure();
  const { currentSiteId, currentSite } = useSite();
  const [selected, setSelected] = useState<string[]>([]);
  const [returning, setReturning] = useState<Visitor | null>(null);
  const [deleting, setDeleting] = useState<Visitor | null>(null);
  const [, tick] = useState(0);

  // Live durations stay honest without a refresh.
  useEffect(() => {
    if (!p.rows.some((v) => v.status === "checked-in")) return;
    const id = setInterval(() => tick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [p.rows]);

  // Selection never carries over to a different view, filter or search.
  const rowKey = p.rows.map((r) => r.id).join(",");
  useEffect(() => { setSelected([]); }, [rowKey]);

  const eligible = p.rows.filter((v) => v.type !== "resident" && v.status === "checked-in");
  const chosen = selected.filter((id) => eligible.some((v) => v.id === id));
  const allChosen = eligible.length > 0 && chosen.length === eligible.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectable = p.canCheckOut && eligible.length > 0;

  const printBadge = (data: Parameters<typeof issueBadge>[0], visitorId: string, reprint = false) =>
    issueBadge(data, { siteId: currentSiteId, siteName: currentSite?.name ?? null, visitorId, reprint })
      .catch(() => toast({ title: "The badge could not be printed", description: "Check the printer, then try again.", variant: "destructive" }));

  if (p.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <p className="text-base font-extrabold text-foreground">{p.emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{p.emptyDescription}</p>
        {p.emptyAction && <div className="mt-4 flex justify-center">{p.emptyAction}</div>}
      </div>
    );
  }

  const menu = (v: Visitor) => {
    const groupOnSite = v.groupId ? p.rows.filter((x) => x.groupId === v.groupId && x.status === "checked-in") : [];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-lg text-muted-foreground" aria-label={`More actions for ${v.firstName} ${v.surname}`}>
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => p.onOpen(v)}><UsersRound className="mr-2 h-4 w-4" />Open profile</DropdownMenuItem>
          {v.type !== "resident" && (
            <DropdownMenuItem onClick={() => printBadge({ name: `${v.firstName} ${v.surname}`, type: v.type, visiting: v.whomToVisit || undefined, date: v.checkInTime }, v.id, true)}>
              <Printer className="mr-2 h-4 w-4" />Reprint badge
            </DropdownMenuItem>
          )}
          {groupOnSite.length > 1 && p.canCheckOut && (
            <DropdownMenuItem onClick={() => p.onCheckOutMany(groupOnSite.map((x) => x.id))}>
              <LogOut className="mr-2 h-4 w-4" />Check out whole group ({groupOnSite.length})
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => p.onFeedback(v)}><MessageSquare className="mr-2 h-4 w-4" />Record feedback</DropdownMenuItem>
          {p.canExport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { exportVisitorsToCSV([v], `visit-${v.firstName}-${v.surname}.csv`, p.companionParties); toast({ title: "Visit exported", description: `${v.firstName} ${v.surname}'s record was saved as a CSV file.` }); }}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportVisitorToPDF(v)}><FileText className="mr-2 h-4 w-4" />Export as PDF</DropdownMenuItem>
            </>
          )}
          {p.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive-strong focus:text-destructive-strong" onClick={() => setDeleting(v)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete record…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const flagsFor = (v: Visitor) => {
    const flags: ReactNode[] = [];
    const keys = openIssues.filter((i) => i.visitorId === v.id && !i.isPermanent);
    if (checkVisitor(v.firstName, v.surname)) flags.push(<Pill key="w" tone="danger" icon={ShieldAlert}>Watchlist</Pill>);
    if (v.type !== "resident" && v.status === "checked-in" && isOverstayed(v)) flags.push(<Pill key="o" tone="warning" icon={AlertTriangle}>Overdue</Pill>);
    if (isOverdueBack(v)) flags.push(<Pill key="ob" tone="warning" icon={AlertTriangle}>Overdue back</Pill>);
    if (v.type !== "resident" && v.status === "checked-in" && !isToday(v.checkInTime)) flags.push(<Pill key="d" tone="warning" icon={Clock}>Since {format(v.checkInTime, "EEE d MMM")}</Pill>);
    if (keys.length) flags.push(<Pill key="k" tone={keys.some((k) => k.overdue) ? "warning" : "neutral"} icon={KeyRound}>{keys.map((k) => k.keyLabel).join(", ")}</Pill>);
    if (v.groupId) flags.push(<Pill key="g" tone="neutral" icon={UsersRound}>{v.groupLabel || "Group"}</Pill>);
    if (v.autoCheckedOut) flags.push(<Pill key="a" tone="neutral" icon={Timer}>Checked out automatically</Pill>);
    return flags;
  };

  const whereCell = (v: Visitor) => {
    if (v.type === "resident") {
      return (
        <Cell label="Reason">
          <p className="truncate text-sm font-semibold text-foreground">{v.leaveType || v.checkoutReason || "Out"}</p>
          {v.accompaniedByName && <p className="truncate text-[13px] text-muted-foreground">With {v.accompaniedByName}</p>}
        </Cell>
      );
    }
    const d = destinationFor(v, residents, { showDestination: p.showDestination, areaLabel });
    return (
      <Cell label="Visiting">
        {!d ? <p className="text-sm text-muted-foreground">Not recorded</p> : d.residentId && !d.hidden ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); p.onOpenResident(d.residentId!); }} className="block max-w-full truncate text-left text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {d.primary}
          </button>
        ) : <p className="truncate text-sm font-semibold text-foreground">{d.primary}</p>}
        {d?.secondary && <p className="truncate text-[13px] text-muted-foreground">{d.secondary}</p>}
      </Cell>
    );
  };

  const timeCell = (v: Visitor) => {
    if (v.type === "resident") {
      return (
        <Cell label="Due back">
          <p className={cn("text-sm font-semibold tabular-nums", isOverdueBack(v) ? "text-warning-strong" : "text-foreground")}>
            {v.expectedReturnDate ? format(v.expectedReturnDate, isToday(v.expectedReturnDate) ? "h:mm a" : "EEE d MMM, h:mm a") : "Not set"}
          </p>
          {v.checkOutTime && <p className="text-[13px] tabular-nums text-muted-foreground">Left {format(v.checkOutTime, isToday(v.checkOutTime) ? "h:mm a" : "d MMM, h:mm a")}</p>}
        </Cell>
      );
    }
    const here = v.status === "checked-in";
    const over = here && isOverstayed(v);
    return (
      <Cell label={here ? "On site" : "Visit"}>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {format(v.checkInTime, "h:mm a")} – {v.checkOutTime ? format(v.checkOutTime, "h:mm a") : "now"}
        </p>
        <p className={cn("text-[13px] tabular-nums", over ? "font-bold text-warning-strong" : "text-muted-foreground")}>
          {stayLabel(v.checkInTime, v.checkOutTime)}
          {here && !over && <> · out by {format(expectedOutBy(v, hoursFor(v.type)), "h:mm a")}</>}
          {over && " · past expected time"}
        </p>
      </Cell>
    );
  };

  const action = (v: Visitor) => {
    if (v.type === "resident") {
      return p.canRecordReturn ? (
        <Button variant="outline" onClick={() => setReturning(v)} className="h-11 gap-2 rounded-lg border-input font-bold">
          <LogIn aria-hidden className="h-4 w-4" />Record return
        </Button>
      ) : null;
    }
    if (v.status !== "checked-in") return <span className="px-2 text-sm font-semibold text-muted-foreground">Checked out</span>;
    if (!p.canCheckOut) return <Pill tone="success">On site</Pill>;
    return (
      <Button variant="outline" onClick={() => p.onCheckOut(v.id)} className="h-11 gap-2 rounded-lg border-primary/40 font-bold text-primary hover:bg-accent">
        <LogOut aria-hidden className="h-4 w-4" />Check out
      </Button>
    );
  };

  const companion = (row: AccountableRow, v: Visitor) => (
    <li key={row.key} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 bg-secondary/50 px-3 py-2.5 sm:px-4 xl:grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <span aria-hidden className="flex justify-center text-muted-foreground"><span className="h-6 w-4 rounded-bl-lg border-b-2 border-l-2 border-border" /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">{row.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">With {row.withPrimaryName}{row.relationship ? ` · ${row.relationship}` : ""}{row.source === "legacy" ? " · older record" : ""}</p>
      </div>
      <div className="hidden xl:block" />
      <p className="col-start-2 text-[13px] tabular-nums text-muted-foreground xl:col-start-auto">
        In {format(row.checkInTime, "h:mm a")}{row.checkOutTime ? ` · out ${format(row.checkOutTime, "h:mm a")}` : ""}
      </p>
      <div className="col-start-2 flex flex-wrap gap-2 xl:col-start-auto xl:w-[264px] xl:justify-end">
        <Button variant="ghost" onClick={() => printBadge({ name: row.name, type: v.type, visiting: v.whomToVisit || undefined, date: row.checkInTime, companionOf: row.withPrimaryName || undefined }, v.id)} className="h-11 gap-2 rounded-lg px-3 font-bold">
          <Printer aria-hidden className="h-4 w-4" />Print badge
        </Button>
        {!row.checkOutTime && p.canCheckOut && row.partyId && (
          <Button variant="outline" onClick={() => p.onCheckOutParty(row.partyId!)} className="h-11 gap-2 rounded-lg border-input px-3 font-bold">
            <LogOut aria-hidden className="h-4 w-4" />Check out
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <section aria-label="People" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Column header and bulk actions */}
      <div className={cn(
        "flex min-h-[52px] items-center gap-3 border-b border-border px-3 sm:px-4",
        chosen.length > 0 ? "bg-accent" : "bg-secondary/60",
      )}>
        <span className="flex w-11 shrink-0 justify-center">
          {selectable && (
            <Checkbox
              checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
              onCheckedChange={() => setSelected(allChosen ? [] : eligible.map((v) => v.id))}
              aria-label="Select everyone on site in this list"
              className="h-5 w-5"
            />
          )}
        </span>
        {chosen.length > 0 ? (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2 py-1.5">
            <p className="text-sm font-bold text-accent-foreground">{chosen.length} selected</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected([])} className="h-10 rounded-lg font-bold">Clear</Button>
              <Button onClick={() => { p.onCheckOutMany(chosen); setSelected([]); }} className="h-10 gap-2 rounded-lg font-bold">
                <LogOut aria-hidden className="h-4 w-4" />Check out {chosen.length}
              </Button>
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 text-xs font-bold text-muted-foreground xl:grid">
            <span>Person</span>
            <span>{p.rows[0]?.type === "resident" ? "Reason" : "Visiting"}</span>
            <span>{p.rows[0]?.type === "resident" ? "Due back" : "Time"}</span>
            <span className="w-[264px]" />
          </div>
        )}
        {chosen.length === 0 && <span className="text-xs font-bold text-muted-foreground xl:hidden">{p.rows.length} {p.rows.length === 1 ? "person" : "people"}</span>}
      </div>

      <ul className="divide-y divide-border">
        {p.rows.map((v) => {
          const flags = flagsFor(v);
          const here = v.type !== "resident" && v.status === "checked-in";
          const attention = (here && isOverstayed(v)) || isOverdueBack(v);
          const initials = `${v.firstName?.[0] ?? ""}${v.surname?.[0] ?? ""}`.toUpperCase();
          const companions = v.type === "resident" ? [] : companionRowsForVisitor(v, p.companionParties);
          return (
            <li key={v.id} className={cn(attention && "bg-warning-subtle/50")}>
              <div className={cn(
                "grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3 gap-y-3 px-3 py-3.5 sm:px-4",
                "xl:grid-cols-[44px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center xl:gap-x-4",
              )}>
                <span className="flex h-10 items-center justify-center">
                  {selectable && here ? (
                    <Checkbox checked={chosen.includes(v.id)} onCheckedChange={() => toggle(v.id)} aria-label={`Select ${v.firstName} ${v.surname}`} className="h-5 w-5" />
                  ) : (
                    <span aria-hidden className={cn("flex h-10 w-10 items-center justify-center rounded-full text-xs font-extrabold", v.type === "resident" ? "bg-[hsl(var(--info)/0.12)] text-info-strong" : "bg-accent text-accent-foreground")}>
                      {v.type === "resident" ? <Home className="h-4 w-4" /> : initials}
                    </span>
                  )}
                </span>

                {/* Person */}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" onClick={() => p.onOpen(v)} className="max-w-full text-left text-base font-bold leading-6 text-foreground underline-offset-4 hover:text-primary hover:underline">
                        {v.firstName} {v.surname}
                        {v.additionalVisitors > 0 && <span className="font-semibold text-muted-foreground"> +{v.additionalVisitors}</span>}
                        <span className="sr-only">, open profile</span>
                      </button>
                      <p className="text-[13px] text-muted-foreground">
                        {typeLabel(v.type)}{v.mobile && v.type !== "resident" ? <> · <a href={`tel:${v.mobile.replace(/\s/g, "")}`} className="tabular-nums hover:text-primary hover:underline">{v.mobile}</a></> : null}
                      </p>
                    </div>
                    <span className="xl:hidden">{menu(v)}</span>
                  </div>
                  {flags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{flags}</div>}
                </div>

                {/* On phones the details sit under the name, in two columns */}
                <div className="col-start-2 grid grid-cols-2 gap-3 xl:contents">
                  <div className="min-w-0">{whereCell(v)}</div>
                  <div className="min-w-0">{timeCell(v)}</div>
                </div>

                <div className="col-start-2 flex items-center gap-1 xl:col-start-auto xl:w-[264px] xl:justify-end">
                  <div className="flex-1 xl:flex-none [&>button]:w-full sm:[&>button]:w-auto">{action(v)}</div>
                  <span className="hidden xl:inline-flex">{menu(v)}</span>
                </div>
              </div>
              {companions.length > 0 && <ul className="divide-y divide-border border-t border-border">{companions.map((row) => companion(row, v))}</ul>}
            </li>
          );
        })}
      </ul>

      {returning && (
        <CheckInReturnDialog
          open={!!returning}
          onOpenChange={(o) => { if (!o) setReturning(null); }}
          visitorName={`${returning.firstName} ${returning.surname}`}
          onConfirm={async (comment, time) => { await p.onRecordReturn(returning.id, comment, time); setReturning(null); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this visit record?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `${deleting.firstName} ${deleting.surname}, signed in ${format(deleting.checkInTime, "d MMM, h:mm a")}. ` : ""}
              The record is removed from the visitor list and reports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-lg font-bold">Keep record</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-lg bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) p.onDelete(deleting.id); setDeleting(null); }}
            >
              Delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground xl:sr-only">{label}</p>
      {children}
    </div>
  );
}

function Pill({ tone, icon: Icon, children }: { tone: "warning" | "danger" | "neutral" | "success"; icon?: typeof Clock; children: ReactNode }) {
  return (
    <span className={cn(
      "inline-flex max-w-full items-center gap-1 rounded-full px-2 text-xs font-bold leading-6",
      tone === "warning" && "border border-[hsl(var(--warning)/0.45)] text-warning-strong",
      tone === "danger" && "border border-destructive/40 bg-destructive/5 text-destructive-strong",
      tone === "neutral" && "bg-secondary text-foreground",
      tone === "success" && "bg-[hsl(var(--success)/0.12)] text-success-strong",
    )}>
      {Icon && <Icon aria-hidden className="h-3 w-3 shrink-0" />}<span className="truncate">{children}</span>
    </span>
  );
}

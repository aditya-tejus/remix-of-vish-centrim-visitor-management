import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, KeyRound, LogIn, RotateCw, Search, ShieldAlert, UserPlus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckInSheet } from "@/components/checkin/CheckInSheet";
import type { StaffCheckInPrefill } from "@/components/checkin/useCheckInFlow";
import { VisitorProfile } from "@/components/VisitorProfile";
import { useVisitors } from "@/hooks/useVisitors";
import { useVisitorDirectory } from "@/hooks/useVisitorDirectory";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import {
  inTab, lastVisitLabel, matchesSearch, sortEntries,
  type DirectoryEntry, type DirectoryFlags, type DirectorySort, type DirectoryTab,
} from "@/lib/visitorDirectory";
import type { Visitor } from "@/types/visitor";
import { cn } from "@/lib/utils";

const PAGE = 50;
const TYPE_LABEL: Record<string, string> = {
  visitor: "Visitor", contractor: "Contractor", volunteer: "Volunteer", staff: "Staff", other: "Other",
};
const TABS: { id: DirectoryTab; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "on_site", label: "On site now" },
  { id: "recent", label: "Last 30 days" },
  { id: "attention", label: "Needs attention" },
];

/**
 * Visitor profiles — everyone who has visited this site, one row per person.
 * Built to the Centrim Life design system: one primary action per area, underline
 * tabs with count pills, sentence-case labels, 13px minimum for meta text and no
 * contact details in the list (they stay on the profile).
 *
 * "Check in again" opens the normal Check In form with the person's details filled
 * in, so screening, terms, privacy and the watchlist step still apply. The old
 * one-tap Quick Check-In skipped all of them and has been removed.
 */
export default function Visitors() {
  const { entries, history, loading, error, truncated, refetch } = useVisitorDirectory();
  const { addVisitorAsync, checkOutVisitor } = useVisitors();
  const { checkVisitor } = useWatchlist();
  const { issuesForVisitor } = useOpenKeyIssues();

  const [tab, setTab] = useState<DirectoryTab>("all");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<DirectorySort>("last_visit");
  const [shown, setShown] = useState(PAGE);
  const [profile, setProfile] = useState<Visitor | null>(null);
  const [checkIn, setCheckIn] = useState<{ open: boolean; prefill?: StaffCheckInPrefill; type?: Visitor["type"] }>({ open: false });

  const flagsFor = useMemo(() => {
    const cache = new Map<string, DirectoryFlags>();
    return (e: DirectoryEntry): DirectoryFlags => {
      const hit = cache.get(e.key);
      if (hit) return hit;
      const open = e.visits.find((v) => v.status === "checked-in");
      const latest = e.latest;
      const f: DirectoryFlags = {
        watchlist: !!checkVisitor(latest.firstName, latest.surname),
        overdue: !!open && isOverstayedSync(open),
        screening: open && (open.screeningOutcome === "flagged" || open.screeningOutcome === "blocked") ? open.screeningOutcome : null,
        keysHeld: e.visits.reduce((n, v) => n + issuesForVisitor(v.id).length, 0),
      };
      cache.set(e.key, f);
      return f;
    };
  }, [checkVisitor, issuesForVisitor]);

  const byType = useMemo(() => entries.filter((e) => type === "all" || e.latest.type === type), [entries, type]);
  const counts = useMemo(() => {
    const c: Record<DirectoryTab, number> = { all: 0, on_site: 0, recent: 0, attention: 0 };
    for (const e of byType) for (const t of TABS) if (inTab(e, t.id, flagsFor(e))) c[t.id] += 1;
    return c;
  }, [byType, flagsFor]);
  const visible = useMemo(
    () => sortEntries(byType.filter((e) => inTab(e, tab, flagsFor(e)) && matchesSearch(e, search)), sort),
    [byType, tab, search, sort, flagsFor],
  );

  const startCheckIn = (e?: DirectoryEntry) => {
    if (!e) { setCheckIn({ open: true }); return; }
    const v = e.latest;
    setCheckIn({
      open: true,
      type: v.type,
      prefill: { firstName: v.firstName, surname: v.surname, mobile: v.mobile, email: v.email, address: v.address, type: v.type, personQr: v.personQr },
    });
  };

  const resetFilters = () => { setSearch(""); setType("all"); setTab("all"); };
  const filtered = search.trim() !== "" || type !== "all" || tab !== "all";

  return (
    <AppShell
      title="Visitor profiles"
      subtitle="Everyone who has visited this site"
      mainClassName="p-4 sm:p-6 space-y-6"
      actions={
        <Button onClick={() => startCheckIn()} className="h-11 gap-2 rounded-lg px-4 font-bold">
          <UserPlus aria-hidden className="h-4 w-4" />Check in someone new
        </Button>
      }
    >
      {/* Header card: tabs with counts, then search and filters */}
      <section aria-label="Find a person" className="rounded-[20px] border border-border bg-card px-4 pt-2 shadow-sm sm:px-6">
        <div role="tablist" aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => { setTab(t.id); setShown(PAGE); }}
                className={cn(
                  "relative flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm font-bold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                  t.id === "attention" && counts.attention > 0 && !active && "bg-[hsl(var(--warning)/0.14)] text-warning-strong",
                )}>
                  {counts[t.id]}
                </span>
                {active && <span aria-hidden className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center">
          <div className="relative flex-1 md:max-w-md">
            <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }}
              placeholder="Search name, phone or who they visit"
              aria-label="Search visitor profiles"
              className="h-11 rounded-lg pl-10 pr-10 text-sm"
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                <X aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <Select value={type} onValueChange={(v) => { setType(v); setShown(PAGE); }}>
              <SelectTrigger aria-label="Person type" className="h-11 w-full rounded-lg text-sm md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as DirectorySort)}>
              <SelectTrigger aria-label="Sort" className="h-11 w-full rounded-lg text-sm md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_visit">On site, then last visit</SelectItem>
                <SelectItem value="name">Surname A to Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* List */}
      <section aria-label="Visitor profiles" aria-busy={loading} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div aria-hidden className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,1.5fr)_10rem] gap-4 border-b border-border bg-secondary px-6 py-3 text-xs font-bold text-muted-foreground lg:grid">
          <span>Person</span><span>Status</span><span>Usually visits</span><span>Flags</span><span className="text-right">Action</span>
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-sm font-bold">{error}</p>
            <Button variant="outline" onClick={() => void refetch()} className="h-11 gap-2 rounded-lg border-input font-bold"><RotateCw aria-hidden className="h-4 w-4" />Try again</Button>
          </div>
        ) : loading && entries.length === 0 ? (
          <ul aria-label="Loading">{Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-0">
              <span className="h-10 w-10 animate-pulse rounded-full bg-muted" /><span className="h-4 w-48 animate-pulse rounded bg-muted" />
            </li>
          ))}</ul>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-sm font-bold">
              {search.trim() ? `No one matches "${search.trim()}".` : tab === "on_site" ? "No one is on site right now." : tab === "attention" ? "Nothing needs attention." : "No visitors recorded at this site yet."}
            </p>
            <p className="max-w-md text-[13px] leading-[18px] text-muted-foreground">
              {search.trim() ? "Check the spelling, try a phone number, or check them in as someone new." : "People appear here after their first visit."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {filtered && <Button variant="outline" onClick={resetFilters} className="h-11 rounded-lg border-input font-bold">Clear filters</Button>}
              <Button variant="outline" onClick={() => startCheckIn()} className="h-11 gap-2 rounded-lg border-input font-bold"><UserPlus aria-hidden className="h-4 w-4" />Check in someone new</Button>
            </div>
          </div>
        ) : (
          <ul>
            {visible.slice(0, shown).map((e) => (
              <Row key={e.key} entry={e} flags={flagsFor(e)} onOpen={() => setProfile(e.latest)} onCheckIn={() => startCheckIn(e)} />
            ))}
          </ul>
        )}

        {visible.length > shown && (
          <div className="flex flex-col items-center gap-2 border-t border-border px-6 py-4">
            <p className="text-[13px] text-muted-foreground">Showing {shown} of {visible.length}</p>
            <Button variant="outline" onClick={() => setShown((s) => s + PAGE)} className="h-11 rounded-lg border-input font-bold">Show {Math.min(PAGE, visible.length - shown)} more</Button>
          </div>
        )}
      </section>

      {truncated && (
        <p className="text-[13px] text-muted-foreground">Showing people from the most recent visits. For older history, use the Visitor report under Records.</p>
      )}

      <VisitorProfile
        visitor={profile}
        allVisitors={history}
        open={!!profile}
        onOpenChange={(o) => { if (!o) setProfile(null); }}
        onCheckOut={async (id) => { await checkOutVisitor(id); setProfile(null); void refetch(); }}
      />

      <CheckInSheet
        open={checkIn.open}
        onOpenChange={(o) => { setCheckIn((c) => ({ ...c, open: o })); if (!o) void refetch(); }}
        onAdd={addVisitorAsync}
        initialType={checkIn.type}
        prefill={checkIn.prefill}
      />
    </AppShell>
  );
}

function Row({ entry, flags, onOpen, onCheckIn }: { entry: DirectoryEntry; flags: DirectoryFlags; onOpen: () => void; onCheckIn: () => void }) {
  const v = entry.latest;
  const name = `${v.firstName} ${v.surname}`.trim();
  const initials = `${v.firstName?.[0] ?? ""}${v.surname?.[0] ?? ""}`.toUpperCase();
  const chips: { label: string; icon: typeof ShieldAlert; tone: string }[] = [];
  if (flags.watchlist) chips.push({ label: "Watchlist", icon: ShieldAlert, tone: "bg-emergency-muted text-destructive-strong" });
  if (flags.overdue) chips.push({ label: "Overdue", icon: AlertTriangle, tone: "bg-[hsl(var(--warning)/0.14)] text-warning-strong" });
  if (flags.screening === "blocked") chips.push({ label: "Screening blocked", icon: AlertTriangle, tone: "bg-emergency-muted text-destructive-strong" });
  if (flags.screening === "flagged") chips.push({ label: "Screening flagged", icon: AlertTriangle, tone: "bg-[hsl(var(--warning)/0.14)] text-warning-strong" });
  if (flags.keysHeld > 0) chips.push({ label: `${flags.keysHeld} key${flags.keysHeld === 1 ? "" : "s"} held`, icon: KeyRound, tone: "bg-accent text-accent-foreground" });

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border px-4 py-4 last:border-0 hover:bg-secondary sm:px-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,1.5fr)_10rem]">
      {/* Person */}
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground">{initials}</span>
        <div className="min-w-0">
          <button onClick={onOpen} className="block max-w-full truncate rounded text-left text-sm font-bold text-foreground underline-offset-4 hover:text-primary hover:underline">
            {name}<span className="sr-only">, open profile</span>
          </button>
          <p className="text-xs text-muted-foreground">{TYPE_LABEL[v.type] ?? v.type} · {entry.visitCount} visit{entry.visitCount === 1 ? "" : "s"}</p>
        </div>
      </div>

      {/* Action (top-right on small screens) */}
      <div className="row-span-1 flex justify-end lg:order-last">
        {entry.onSite ? (
          <Button variant="outline" onClick={onOpen} className="h-11 rounded-lg border-input bg-card px-4 text-sm font-bold">Open profile</Button>
        ) : (
          <Button variant="outline" onClick={onCheckIn} className="h-11 gap-2 rounded-lg border-input bg-card px-4 text-sm font-bold">
            <LogIn aria-hidden className="h-4 w-4" />Check in again
          </Button>
        )}
      </div>

      {/* Status */}
      <div className="col-span-2 text-[13px] leading-[18px] lg:col-span-1">
        {entry.onSite && entry.onSiteSince ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--success)/0.12)] px-2.5 py-0.5 text-xs font-bold text-success-strong">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />On site since {format(entry.onSiteSince, "h:mm a")}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Last visit <span className="font-semibold text-foreground">{lastVisitLabel(entry.lastVisit)}</span>
            <span className="hidden sm:inline"> · {format(entry.lastVisit, "d MMM")}</span>
          </span>
        )}
      </div>

      {/* Usually visits */}
      <p className="col-span-2 min-w-0 truncate text-[13px] leading-[18px] text-muted-foreground lg:col-span-1">
        {entry.usuallyVisits ? <>Visits <span className="font-semibold text-foreground">{entry.usuallyVisits}</span></> : <span className="lg:sr-only">No usual destination</span>}
      </p>

      {/* Flags */}
      <div className="col-span-2 flex flex-wrap gap-1.5 lg:col-span-1">
        {chips.length === 0 ? <span className="sr-only">No flags</span> : chips.map((c) => (
          <span key={c.label} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", c.tone)}>
            <c.icon aria-hidden className="h-3.5 w-3.5" />{c.label}
          </span>
        ))}
      </div>
    </li>
  );
}

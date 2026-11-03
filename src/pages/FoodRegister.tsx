import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatTile } from "@/components/ui/reception-primitives";
import { FOOD_PERIODS, foodTotals, groupByDay, periodRange, safeSearch, type FoodPeriod } from "@/lib/foodView";
import { cn } from "@/lib/utils";
import { useResidents } from "@/hooks/useResidents";
import { useFoodRegister } from "@/hooks/useFoodRegister";
import { AddFoodDialog } from "@/components/food/AddFoodDialog";
import { exportCsvAudited } from "@/lib/exportAudit";
import { ErrorState } from "@/components/states";
import { useSite } from "@/contexts/SiteContext";

import { FOOD_TYPES, FoodRecord, foodTypeLabel } from "@/lib/foodRegister";
import { format } from "date-fns";
import { ChevronRight, CookingPot, Download, Plus, Search, Share2, Users, UtensilsCrossed, X } from "lucide-react";

export default function FoodRegisterPage() {
  const { residents } = useResidents();
  const { currentSite, currentSiteId } = useSite();
  const [period, setPeriod] = useState<FoodPeriod>("7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [residentVisitorId, setResidentVisitorId] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<FoodRecord | null>(null);

  const range = periodRange(period, new Date(), custom);
  const filters = useMemo(
    () => ({
      from: range.from || undefined,
      to: range.to || undefined,
      residentVisitorId: residentVisitorId === "all" ? undefined : residentVisitorId,
      search: safeSearch(search) || undefined,
    }),
    [range.from, range.to, residentVisitorId, search]
  );

  const { records: loaded, loading, error, refetch } = useFoodRegister(filters);
  const records = useMemo(() => typeFilter === "all" ? loaded : loaded.filter((r) => r.foodType === typeFilter), [loaded, typeFilter]);
  const groups = useMemo(() => groupByDay(records), [records]);
  const totals = foodTotals(records);
  const roomFor = useMemo(() => new Map(residents.map((r) => [r.visitorId, [r.room, r.wing].filter(Boolean).join(" · ")])), [residents]);

  const hasFilters = period !== "7d" || residentVisitorId !== "all" || typeFilter !== "all" || !!search;
  const clearFilters = () => { setPeriod("7d"); setCustom({ from: "", to: "" }); setResidentVisitorId("all"); setTypeFilter("all"); setSearch(""); };
  const periodLabel = period === "custom"
    ? [custom.from && format(new Date(`${custom.from}T00:00:00`), "d MMM"), custom.to && format(new Date(`${custom.to}T00:00:00`), "d MMM")].filter(Boolean).join(" – ") || "chosen dates"
    : FOOD_PERIODS.find((x) => x.id === period)!.label.toLowerCase();

  // Export respects whichever filters are currently applied (exports exactly what's listed).
  const exportCsv = async () => {
    await exportCsvAudited(
      ["Date & Time", "Resident", "Food", "Food Type", "Brought By", "Shared With", "Notes", "Source"],
      records.map((r) => [
        format(r.recordedAt, "h:mm a dd MMM yyyy"),
        r.residentName,
        r.foodDescription,
        foodTypeLabel(r.foodType),
        r.broughtByName,
        r.sharedWithOthers ? (r.sharedResidentNames.join("; ") || "Yes") : "No",
        r.notes || "",
        r.source === "manual" ? "Added by staff" : "Check-in",
      ]),
      {
        filenamePrefix: "food-register",
        auditAction: "food_register_export",
        siteId: currentSiteId,
        siteName: currentSite?.name ?? null,
        scopeNote: hasFilters ? "Filtered view" : "All records in view",
      }
    );
  };

  const chip = (on: boolean) => cn(
    "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors",
    on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60",
  );

  return (
    <AppShell
      title="Food register"
      subtitle="Food brought in for residents: what it was, who brought it and who it was shared with."
      actions={
        <>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={records.length === 0}>
            <Download aria-hidden className="h-4 w-4" /> Export
          </Button>
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden className="h-4 w-4" /> Add food
          </Button>
        </>
      }
      headerContent={
        <div aria-live="polite" className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <StatTile label={`Records, ${periodLabel}`} value={loading ? "–" : totals.total} icon={UtensilsCrossed} className="bg-secondary/60 shadow-none" />
          <StatTile label="Residents" value={loading ? "–" : totals.residents} icon={Users} className="bg-secondary/60 shadow-none" />
          <StatTile label="Homemade" value={loading ? "–" : totals.homemade} icon={CookingPot} note="Check storage and labelling" className="bg-secondary/60 shadow-none" />
          <StatTile label="Shared with others" value={loading ? "–" : totals.shared} icon={Share2} className="bg-secondary/60 shadow-none" />
        </div>
      }
      mainClassName="space-y-4 p-4 sm:space-y-6 sm:p-6"
    >
      {/* Search and filters */}
      <section aria-label="Search and filter" className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search the food register" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search food, notes or names" className="pl-10 pr-11" />
            {search && (
              <Button variant="ghost" size="icon" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></Button>
            )}
          </div>
          <Select value={residentVisitorId} onValueChange={setResidentVisitorId}>
            <SelectTrigger aria-label="Resident" className="lg:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All residents</SelectItem>
              {residents.map((r) => <SelectItem key={r.visitorId} value={r.visitorId}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div role="group" aria-label="When" className="flex flex-wrap gap-2">
          {FOOD_PERIODS.map((x) => (
            <button key={x.id} type="button" aria-pressed={period === x.id} onClick={() => setPeriod(x.id)} className={chip(period === x.id)}>{x.label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="space-y-1"><Label htmlFor="food-from">From</Label><Input id="food-from" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="food-to">To</Label><Input id="food-to" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Food type" className="flex flex-wrap gap-2">
            {[{ value: "all", label: "Any food" }, ...FOOD_TYPES].map((t) => (
              <button key={t.value} type="button" aria-pressed={typeFilter === t.value} onClick={() => setTypeFilter(t.value)} className={chip(typeFilter === t.value)}>{t.label}</button>
            ))}
          </div>
          {hasFilters && (
            <Button variant="ghost" className="ml-auto gap-1.5 text-primary-hover" onClick={clearFilters}><X aria-hidden className="h-4 w-4" />Clear filters</Button>
          )}
        </div>
      </section>

      {error && <ErrorState description={error} onRetry={refetch} />}

      {/* Records, grouped by day */}
      {loading && records.length === 0 ? (
        <p role="status" className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">Loading the food register…</p>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <UtensilsCrossed aria-hidden className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-base font-extrabold text-foreground">{hasFilters ? "Nothing matches these filters" : "No food recorded yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {hasFilters ? "Try a longer time range or clear the filters." : "Food is recorded at check-in, or added here by staff."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {hasFilters && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
            <Button onClick={() => setAddOpen(true)} className="gap-2"><Plus aria-hidden className="h-4 w-4" />Add food</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`food-day-${g.key}`} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-baseline justify-between border-b border-border bg-secondary/60 px-4 py-2.5">
                <h2 id={`food-day-${g.key}`} className="text-sm font-extrabold text-foreground">{g.label}</h2>
                <span className="text-xs font-bold text-muted-foreground">{g.items.length} {g.items.length === 1 ? "record" : "records"}</span>
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelected(r)}
                      className="grid w-full grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-secondary/70 md:grid-cols-[72px_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_20px] md:items-center">
                      <span className="pt-0.5 text-sm font-semibold tabular-nums text-muted-foreground md:pt-0">{format(r.recordedAt, "h:mm a")}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-foreground">{r.residentName}</span>
                        <span className="block truncate text-[13px] text-muted-foreground">{(r.residentVisitorId && roomFor.get(r.residentVisitorId)) || "Resident"}</span>
                      </span>
                      <span className="col-start-2 min-w-0 md:col-start-auto">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-foreground">{r.foodDescription}</span>
                          <span className={cn("rounded-full px-2 text-xs font-bold leading-5", r.foodType === "homemade" ? "bg-warning-subtle text-warning-strong" : "bg-muted text-secondary-foreground")}>{foodTypeLabel(r.foodType)}</span>
                        </span>
                        {r.sharedWithOthers && (
                          <span className="mt-0.5 flex items-center gap-1 text-[13px] text-info-strong"><Share2 aria-hidden className="h-3.5 w-3.5" />Shared{r.sharedResidentNames.length ? ` with ${r.sharedResidentNames.join(", ")}` : ""}</span>
                        )}
                      </span>
                      <span className="col-start-2 min-w-0 text-[13px] text-muted-foreground md:col-start-auto">
                        <span className="block truncate">From <span className="font-semibold text-foreground">{r.broughtByName}</span></span>
                        <span className="block truncate">{r.source === "manual" ? "Added by staff" : "Recorded at check-in"}{r.notes ? ` · ${r.notes}` : ""}</span>
                      </span>
                      <ChevronRight aria-hidden className="hidden h-4 w-4 text-muted-foreground md:block" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {loaded.length >= 500 && <p className="text-center text-xs text-muted-foreground">Showing the newest 500 records. Narrow the dates to see older ones.</p>}
        </div>
      )}

      <AddFoodDialog open={addOpen} onOpenChange={setAddOpen} onSaved={refetch} />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {selected && (<>
            <SheetHeader className="space-y-0 border-b border-border px-5 py-4 pr-14 text-left">
              <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">Food record</p>
              <SheetTitle className="mt-0.5 text-xl font-extrabold leading-7">{selected.foodDescription}</SheetTitle>
              <SheetDescription>{format(selected.recordedAt, "EEEE d MMMM yyyy, h:mm a")}</SheetDescription>
            </SheetHeader>
            <dl className="space-y-0 divide-y divide-border px-5 py-2 text-sm">
              {[
                ["For", `${selected.residentName}${selected.residentVisitorId && roomFor.get(selected.residentVisitorId) ? ` · ${roomFor.get(selected.residentVisitorId)}` : ""}`],
                ["Food type", foodTypeLabel(selected.foodType)],
                ["Brought by", selected.broughtByName],
                ["Shared", selected.sharedWithOthers ? (selected.sharedResidentNames.join(", ") || "Yes, with other residents") : "No"],
                ["Notes", selected.notes || "—"],
                ["Recorded", selected.source === "manual" ? `Added by ${selected.createdBy || "staff"}` : "At visitor check-in"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </>)}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

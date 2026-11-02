import type { ReactNode } from "react";
import { AlertTriangle, DoorOpen, ExternalLink, LogIn, MoreHorizontal, Phone, ShieldAlert, Users } from "lucide-react";
import type { Resident } from "@/hooks/useResidents";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { residentLocation, type ResidentLocation } from "@/lib/residentMovement";
import { humanise, locationLabel, movementLabel, placeLabel, type ResidentView } from "@/lib/residentView";
import { cn } from "@/lib/utils";

export interface ResidentListLabels {
  place: string;
  safeguards: string;
  absenceAction: string;
  showClinical: boolean;
}

interface Props {
  residents: Resident[];
  view: ResidentView;
  now: Date;
  timeZone: string;
  labels: ResidentListLabels;
  canRecordOuting: boolean;
  canRecordReturn: boolean;
  busy: boolean;
  empty: { title: string; description: string; action?: ReactNode };
  onOpen: (r: Resident) => void;
  onOpenRecord: (r: Resident) => void;
  onRecordOuting: (r: Resident) => void;
  onRecordReturn: (r: Resident) => void;
}

/**
 * One row per resident. Movement views lead with where they went and when
 * they are due back; the directory leads with care needs and who to call.
 */
export function ResidentList(p: Props) {
  if (p.residents.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <Users aria-hidden className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-base font-extrabold text-foreground">{p.empty.title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{p.empty.description}</p>
        {p.empty.action && <div className="mt-4 flex justify-center">{p.empty.action}</div>}
      </div>
    );
  }
  const directory = p.view === "directory";
  const heads = directory
    ? ["Resident", p.labels.showClinical ? "Care and mobility" : "Key worker", "Emergency contact"]
    : ["Resident", "Where", "Times"];

  return (
    <section aria-label="Residents" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="hidden min-h-[48px] grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_236px] items-center gap-x-4 border-b border-border bg-secondary/60 px-4 text-xs font-bold text-muted-foreground xl:grid">
        {heads.map((h) => <span key={h}>{h}</span>)}
        <span />
      </div>
      <div className="flex min-h-[44px] items-center border-b border-border bg-secondary/60 px-4 text-xs font-bold text-muted-foreground xl:hidden">
        {p.residents.length} {p.residents.length === 1 ? "resident" : "residents"}
      </div>
      <ul className="divide-y divide-border">
        {p.residents.map((r) => {
          const loc = residentLocation(r, p.now);
          const overdue = loc === "overdue";
          return (
            <li key={r.visitorId} className={cn(overdue && "bg-[hsl(var(--warning)/0.05)]")}>
              <div className={cn(
                "grid grid-cols-1 gap-3 px-4 py-3.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_236px] xl:items-center xl:gap-x-4",
                overdue && "border-l-4 border-l-[hsl(var(--warning))] pl-3",
              )}>
                <Person r={r} loc={loc} p={p} />
                <div className="grid grid-cols-2 gap-3 pl-[52px] xl:contents">
                  {directory ? <DirectoryCells r={r} p={p} /> : <MovementCells r={r} loc={loc} p={p} />}
                </div>
                <div className="flex items-center gap-1 pl-[52px] xl:justify-end xl:pl-0">
                  <div className="flex-1 sm:flex-none [&>button]:w-full sm:[&>button]:w-auto">
                    {loc !== "no-absence" ? (p.canRecordReturn && (
                      <Button variant="outline" disabled={p.busy} onClick={() => p.onRecordReturn(r)} className="h-11 gap-2 rounded-lg border-primary/40 font-bold text-primary hover:bg-accent">
                        <LogIn aria-hidden className="h-4 w-4" />Record return
                      </Button>
                    )) : (p.canRecordOuting && (
                      <Button variant="outline" disabled={p.busy} onClick={() => p.onRecordOuting(r)} className="h-11 gap-2 rounded-lg border-input font-bold">
                        <DoorOpen aria-hidden className="h-4 w-4" />{p.labels.absenceAction}
                      </Button>
                    ))}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-lg text-muted-foreground" aria-label={`More for ${r.name}`}>
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => p.onOpen(r)}><Users className="mr-2 h-4 w-4" />Open details</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => p.onOpenRecord(r)}><ExternalLink className="mr-2 h-4 w-4" />Full record</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Person({ r, loc, p }: { r: Resident; loc: ResidentLocation; p: Props }) {
  const initials = `${r.firstName?.[0] ?? ""}${r.surname?.[0] ?? ""}`.toUpperCase();
  const flags: ReactNode[] = [];
  if (loc === "overdue") flags.push(<Pill key="o" tone="warning" icon={AlertTriangle}>Past expected return</Pill>);
  else if (loc !== "no-absence") flags.push(<Pill key="a" tone="info" icon={DoorOpen}>{locationLabel[loc]}</Pill>);
  if (p.labels.showClinical && r.dolsLpsFlag) flags.push(<Pill key="d" tone="danger" icon={ShieldAlert}>{p.labels.safeguards}</Pill>);
  if (p.labels.showClinical && ["high", "very_high"].includes(r.riskAssessmentLevel)) flags.push(<Pill key="r" tone="warning">Risk: {humanise(r.riskAssessmentLevel).toLowerCase()}</Pill>);
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground">
        {initials}
        {loc !== "no-absence" && <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card", loc === "overdue" ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--info))]")} />}
      </span>
      <div className="min-w-0">
        <button type="button" onClick={() => p.onOpen(r)} className="max-w-full text-left text-base font-bold leading-6 text-foreground underline-offset-4 hover:text-primary hover:underline">
          {r.name}<span className="sr-only">, open details</span>
        </button>
        <p className="text-[13px] text-muted-foreground">{placeLabel(r.room, p.labels.place)}{r.wing ? ` · ${r.wing}` : ""}</p>
        {flags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{flags}</div>}
      </div>
    </div>
  );
}

function MovementCells({ r, loc, p }: { r: Resident; loc: ResidentLocation; p: Props }) {
  if (loc === "no-absence") {
    return (
      <>
        <Cell label="Where"><p className="text-sm font-semibold text-foreground">No absence recorded</p><p className="text-[13px] text-muted-foreground">Location not confirmed</p></Cell>
        <Cell label="Times"><p className="text-[13px] text-muted-foreground">{r.keyWorker ? `Key worker ${r.keyWorker}` : "—"}</p></Cell>
      </>
    );
  }
  return (
    <>
      <Cell label="Where">
        <p className="truncate text-sm font-semibold text-foreground">{r.checkoutReason || r.leaveType || "Reason not recorded"}</p>
        <p className="truncate text-[13px] text-muted-foreground">{r.accompaniedByName ? `With ${r.accompaniedByName}` : "Accompanied by: not recorded"}</p>
      </Cell>
      <Cell label="Times">
        <p className={cn("text-sm font-semibold tabular-nums", loc === "overdue" ? "text-warning-strong" : "text-foreground")}>
          Back {r.expectedReturnDate ? movementLabel(r.expectedReturnDate, p.timeZone, p.now) : "time not set"}
        </p>
        <p className="text-[13px] tabular-nums text-muted-foreground">Left {r.checkOutTime ? movementLabel(r.checkOutTime, p.timeZone, p.now) : "time not recorded"}</p>
      </Cell>
    </>
  );
}

function DirectoryCells({ r, p }: { r: Resident; p: Props }) {
  return (
    <>
      <Cell label={p.labels.showClinical ? "Care and mobility" : "Key worker"}>
        {p.labels.showClinical ? (
          <>
            <p className="truncate text-sm font-semibold text-foreground">{humanise(r.careLevel) || "Care level not recorded"}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {[humanise(r.mobilityLevel), ...r.mobilityAids.map(humanise)].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ") || "Mobility not recorded"}
            </p>
          </>
        ) : null}
        <p className="truncate text-[13px] text-muted-foreground">{r.keyWorker ? `Key worker ${r.keyWorker}` : "No key worker"}</p>
      </Cell>
      <Cell label="Emergency contact">
        {r.emergencyContactName ? (
          <>
            <p className="truncate text-sm font-semibold text-foreground">{r.emergencyContactName}</p>
            {r.emergencyContactPhone && (
              <a href={`tel:${r.emergencyContactPhone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums text-primary underline-offset-4 hover:underline">
                <Phone aria-hidden className="h-3.5 w-3.5" />{r.emergencyContactPhone}
              </a>
            )}
          </>
        ) : <p className="text-sm text-muted-foreground">Not recorded</p>}
      </Cell>
    </>
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

export function Pill({ tone, icon: Icon, children }: { tone: "warning" | "danger" | "info" | "neutral"; icon?: typeof Users; children: ReactNode }) {
  return (
    <span className={cn(
      "inline-flex max-w-full items-center gap-1 rounded-full px-2 text-xs font-bold leading-6",
      tone === "warning" && "border border-[hsl(var(--warning)/0.45)] text-warning-strong",
      tone === "danger" && "border border-destructive/40 bg-destructive/5 text-destructive-strong",
      tone === "info" && "bg-[hsl(var(--info)/0.12)] text-info-strong",
      tone === "neutral" && "bg-secondary text-foreground",
    )}>
      {Icon && <Icon aria-hidden className="h-3 w-3 shrink-0" />}<span className="truncate">{children}</span>
    </span>
  );
}

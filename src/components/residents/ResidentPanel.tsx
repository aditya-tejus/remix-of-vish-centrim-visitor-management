import type { ReactNode } from "react";
import { DoorOpen, ExternalLink, LogIn, Phone } from "lucide-react";
import type { Resident } from "@/hooks/useResidents";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { residentLocation } from "@/lib/residentMovement";
import { humanise, locationLabel, movementLabel, placeLabel } from "@/lib/residentView";
import { Pill, type ResidentListLabels } from "@/components/residents/ResidentList";

interface Props {
  resident: Resident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: Date;
  timeZone: string;
  labels: ResidentListLabels;
  canRecordOuting: boolean;
  canRecordReturn: boolean;
  onRecordOuting: (r: Resident) => void;
  onRecordReturn: (r: Resident) => void;
  onOpenRecord: (r: Resident) => void;
}

/**
 * What the desk needs about one resident without leaving the page: where they
 * are recorded to be, how to support them, and who to call. Medication notes
 * are deliberately not shown here.
 */
export function ResidentPanel({ resident: r, open, onOpenChange, now, timeZone, labels, ...p }: Props) {
  if (!r) return null;
  const loc = residentLocation(r, now);
  const initials = `${r.firstName?.[0] ?? ""}${r.surname?.[0] ?? ""}`.toUpperCase();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]">
        <div className="border-b border-border p-5 pr-12">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground">{initials}</span>
            <div className="min-w-0">
              <SheetTitle className="text-xl font-extrabold leading-7">{r.name}</SheetTitle>
              <SheetDescription className="text-sm">{placeLabel(r.room, labels.place)}{r.wing ? ` · ${r.wing}` : ""}</SheetDescription>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill tone={loc === "overdue" ? "warning" : loc === "no-absence" ? "neutral" : "info"}>{locationLabel[loc]}</Pill>
                {labels.showClinical && r.dolsLpsFlag && <Pill tone="danger">{labels.safeguards}</Pill>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {loc !== "no-absence" ? p.canRecordReturn && (
              <Button onClick={() => p.onRecordReturn(r)} className="h-11 flex-1 gap-2 rounded-lg font-bold"><LogIn aria-hidden className="h-4 w-4" />Record return</Button>
            ) : p.canRecordOuting && (
              <Button onClick={() => p.onRecordOuting(r)} className="h-11 flex-1 gap-2 rounded-lg font-bold"><DoorOpen aria-hidden className="h-4 w-4" />{labels.absenceAction}</Button>
            )}
            <Button variant="outline" onClick={() => p.onOpenRecord(r)} className="h-11 flex-1 gap-2 rounded-lg border-input font-bold"><ExternalLink aria-hidden className="h-4 w-4" />Full record</Button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <Section title="Current movement">
            {loc === "no-absence" ? (
              <p className="text-sm text-muted-foreground">No absence recorded. This is not a confirmed sighting.</p>
            ) : (
              <Facts rows={[
                ["Reason", r.checkoutReason || r.leaveType || "Not recorded"],
                ["With", r.accompaniedByName || "Not recorded"],
                ["Left", r.checkOutTime ? movementLabel(r.checkOutTime, timeZone, now) : "Not recorded"],
                ["Due back", r.expectedReturnDate ? movementLabel(r.expectedReturnDate, timeZone, now) : "Not set"],
              ]} />
            )}
          </Section>

          {labels.showClinical && (
            <Section title="Support">
              <Facts rows={[
                ["Care level", humanise(r.careLevel) || "Not recorded"],
                ["Mobility", [humanise(r.mobilityLevel), ...r.mobilityAids.map(humanise)].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ") || "Not recorded"],
                ["Risk", humanise(r.riskAssessmentLevel) || "Not recorded"],
                ["Key worker", r.keyWorker || "Not assigned"],
              ]} />
            </Section>
          )}
          {!labels.showClinical && r.keyWorker && <Section title="Key worker"><p className="text-sm">{r.keyWorker}</p></Section>}

          <Section title="Emergency contact">
            {r.emergencyContactName ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{r.emergencyContactName}</p>
                {r.emergencyContactPhone && (
                  <Button asChild variant="outline" className="h-11 gap-2 rounded-lg border-input font-bold">
                    <a href={`tel:${r.emergencyContactPhone.replace(/\s/g, "")}`}><Phone aria-hidden className="h-4 w-4" />{r.emergencyContactPhone}</a>
                  </Button>
                )}
              </div>
            ) : <p className="text-sm text-muted-foreground">Not recorded</p>}
          </Section>

          {r.notes && <Section title="Notes"><p className="whitespace-pre-wrap text-sm">{r.notes}</p></Section>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-2 text-sm font-extrabold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-semibold text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

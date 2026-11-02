import { useMemo, useState, type ReactNode } from "react";
import { format, formatDistanceStrict, isToday } from "date-fns";
import { AlertTriangle, Clock, Home, KeyRound, LogOut, Phone, Printer, Users } from "lucide-react";
import type { Visitor } from "@/types/visitor";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useResidents } from "@/hooks/useResidents";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { isOverstayedSync } from "@/hooks/useOverstayPolicy";
import { useSite } from "@/contexts/SiteContext";
import { useToast } from "@/hooks/use-toast";
import {
  buildHandover, handoverPrintHtml, handoverType, HANDOVER_TYPES, type HandoverType, type OnSiteEntry,
} from "@/lib/handover";
import { cn } from "@/lib/utils";

interface HandoverPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Everyone at the site who is not a resident, any arrival day. */
  visitors: Visitor[];
  /** The day whose sign-outs are listed. "Still on site" is always right now. */
  date: Date;
}

const ALL_TYPES = new Set<HandoverType>(HANDOVER_TYPES.map((t) => t.id));

/**
 * Shift handover: what the next shift must know, most urgent first.
 * Screen and print share one model (src/lib/handover.ts) so they never disagree.
 */
export function HandoverPrintDialog({ open, onOpenChange, visitors, date }: HandoverPrintDialogProps) {
  const { currentSite } = useSite();
  const { toast } = useToast();
  const { residents } = useResidents({ enabled: open });
  const { openIssues } = useOpenKeyIssues();
  const [types, setTypes] = useState<Set<HandoverType>>(ALL_TYPES);
  const [includeSignedOut, setIncludeSignedOut] = useState(true);
  const [notes, setNotes] = useState("");
  const now = new Date();

  const handover = useMemo(
    () => buildHandover({
      people: visitors, date, residents, keys: openIssues, types, includeSignedOut,
      isPastExpected: (v) => isOverstayedSync(v),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visitors, date, residents, openIssues, types, includeSignedOut, open],
  );
  const { onSite, signedOut, residentsOut, keysOut, counts } = handover;
  const pastExpected = onSite.filter((x) => x.pastExpected).length;
  const overdueResidents = residentsOut.filter((r) => r.overdue).length;
  const overdueKeys = keysOut.filter((k) => k.overdue).length;
  const shownTypes = HANDOVER_TYPES.filter((t) => t.id !== "other" || counts.other > 0);
  const allOn = types.size === ALL_TYPES.size;
  // Long secondary lists start short so "Still on site" stays the focus.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const PREVIEW = 5;
  const limit = <T,>(list: T[], key: string) => (expanded[key] ? list : list.slice(0, PREVIEW));
  const more = (total: number, key: string) => total > PREVIEW ? (
    <button type="button" onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))} className="min-h-11 w-full border-t border-border text-sm font-bold text-primary hover:bg-secondary/60">
      {expanded[key] ? "Show fewer" : `Show all ${total}`}
    </button>
  ) : null;

  const toggleType = (id: HandoverType) => setTypes((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next.size === 0 ? new Set(ALL_TYPES) : next;
  });

  const print = () => {
    const html = handoverPrintHtml(handover, {
      siteName: currentSite?.name ?? "", date, now: new Date(), notes, includeSignedOut,
    });
    // A hidden frame avoids pop-up blockers and keeps staff on the page.
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    try {
      const doc = frame.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      setTimeout(() => {
        try { frame.contentWindow!.focus(); frame.contentWindow!.print(); }
        catch { toast({ title: "Printing is blocked here", description: "Open the app in its own browser tab to print.", variant: "destructive" }); }
        cleanup();
      }, 250);
    } catch {
      cleanup();
      toast({ title: "Printing is blocked here", description: "Open the app in its own browser tab to print.", variant: "destructive" });
    }
  };

  const controls = (
    <>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <Tile icon={Users} label="Still on site" value={onSite.length} note={pastExpected ? `${pastExpected} past expected time` : undefined} />
              <Tile icon={Home} label="Residents out" value={residentsOut.length} note={overdueResidents ? `${overdueResidents} overdue back` : undefined} />
              <Tile icon={KeyRound} label="Keys not returned" value={keysOut.length} note={overdueKeys ? `${overdueKeys} overdue` : undefined} />
              <Tile icon={LogOut} label={`Signed out ${isToday(date) ? "today" : format(date, "d MMM")}`} value={includeSignedOut ? signedOut.length : "–"} />
            </dl>
  
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div role="group" aria-label="People to include" className="flex flex-wrap gap-2">
                <Chip on={allOn} onClick={() => setTypes(new Set(ALL_TYPES))}>Everyone</Chip>
                {shownTypes.map((t) => (
                  <Chip key={t.id} on={!allOn && types.has(t.id)} onClick={() => (allOn ? setTypes(new Set([t.id])) : toggleType(t.id))}>
                    {t.plural}<span className="ml-1.5 tabular-nums text-muted-foreground">{counts[t.id]}</span>
                  </Chip>
                ))}
              </div>
              <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                <Switch checked={includeSignedOut} onCheckedChange={setIncludeSignedOut} />
                Include signed out
              </label>
            </div>
  
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[min(90vh,900px)] sm:max-w-[960px] sm:rounded-[20px]">
        {/* Fixed header */}
        <div className="border-b border-border px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <p className="text-[11px] font-extrabold uppercase leading-4 tracking-[0.06em] text-primary">Shift handover</p>
          <DialogTitle className="mt-1 text-2xl font-extrabold leading-8 text-foreground">Handover report</DialogTitle>
          <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
            {currentSite?.name ? `${currentSite.name} · ` : ""}{format(now, "EEEE d MMMM")} · as of {format(now, "h:mm a")}
          </DialogDescription>

          {/* Totals and filters stay fixed on larger screens; on phones they scroll so the list gets the room. */}
          <div className="hidden sm:block">{controls}</div>
        </div>

        {/* Scrolling content with the design system's slim scrollbar */}
        <ScrollArea className="min-h-0 flex-1 bg-secondary/40">
          <div className="space-y-4 p-4 sm:p-6">
            <div className="sm:hidden">{controls}</div>
            <Panel title="Still on site" count={onSite.length} hint="Longest here first" empty="Nobody is on site right now.">
              {onSite.map((x) => <OnSiteRow key={x.visit.id} x={x} now={now} />)}
            </Panel>

            <Panel title="Residents out" count={residentsOut.length} empty="All residents are in.">
              {residentsOut.map((r) => (
                <Row key={r.id} attention={r.overdue}>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground">{r.name}{r.room && <span className="font-semibold text-muted-foreground"> · {r.room}</span>}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {r.leaveType || "Out"}{r.accompaniedBy ? ` with ${r.accompaniedBy}` : ""}{r.leftAt ? ` · left ${format(r.leftAt, "h:mm a")}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-[13px]">
                    <p className="text-muted-foreground">Expected back</p>
                    <p className="font-bold text-foreground">{r.expectedBack ? format(r.expectedBack, isToday(r.expectedBack) ? "h:mm a" : "d MMM, h:mm a") : "Not set"}</p>
                    {r.overdue && <Flag>Overdue</Flag>}
                  </div>
                </Row>
              ))}
            </Panel>

            <Panel title="Keys not returned" count={keysOut.length} empty="Every key is back." more={more(keysOut.length, "keys")}>
              {limit(keysOut, "keys").map((k) => (
                <Row key={k.id} attention={k.overdue}>
                  <KeyRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground">{k.label}</p>
                    <p className="text-[13px] text-muted-foreground">With {k.issuedTo} · since {format(k.issuedAt, isToday(k.issuedAt) ? "h:mm a" : "d MMM, h:mm a")}</p>
                  </div>
                  {k.overdue && <Flag>Overdue</Flag>}
                </Row>
              ))}
            </Panel>

            {includeSignedOut && (
              <Panel title={`Signed out ${isToday(date) ? "today" : format(date, "EEEE d MMM")}`} count={signedOut.length} hint="Latest first" empty="Nobody has signed out yet." more={more(signedOut.length, "out")}>
                {limit(signedOut, "out").map((v) => (
                  <Row key={v.id} muted>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{v.firstName} {v.surname} <TypePill type={handoverType(v.type)} /></p>
                      {v.whomToVisit && <p className="truncate text-[13px] text-muted-foreground">Visited {v.whomToVisit}</p>}
                    </div>
                    <p className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                      {format(v.checkInTime, "h:mm a")} – {v.checkOutTime ? format(v.checkOutTime, "h:mm a") : "—"}
                    </p>
                  </Row>
                ))}
              </Panel>
            )}

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <label htmlFor="handover-notes" className="text-base font-extrabold text-foreground">Notes for the next shift</label>
              <p className="text-[13px] text-muted-foreground">Printed with the report. Not saved.</p>
              <Textarea
                id="handover-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="For example: plumber due back at 4 PM, family meeting for Room 12 at 5 PM"
                className="mt-3 min-h-[96px] rounded-xl border-input text-sm"
              />
            </section>
          </div>
        </ScrollArea>

        {/* Fixed footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">Prints with sign-off lines for both shifts.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 flex-1 rounded-lg border-input font-bold sm:flex-none">Close</Button>
            <Button onClick={print} className="h-11 flex-1 gap-2 rounded-lg font-bold sm:flex-none">
              <Printer aria-hidden className="h-4 w-4" /> Print handover
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Tile({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: number | string; note?: string }) {
  return (
    <div className={cn("rounded-xl px-3 py-2.5", note ? "border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.06)]" : "border border-transparent bg-secondary")}>
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Icon aria-hidden className="h-3.5 w-3.5" />{label}</dt>
      <dd className="mt-0.5 text-2xl font-extrabold leading-8 tabular-nums text-foreground">{value}</dd>
      {note && <dd className="flex items-center gap-1 text-xs font-bold text-warning-strong"><AlertTriangle aria-hidden className="h-3 w-3" />{note}</dd>}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors",
        on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60",
      )}
    >
      {children}
    </button>
  );
}

function Panel({ title, count, hint, empty, more, children }: { title: string; count: number; hint?: string; empty: string; more?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-baseline gap-2 px-4 pb-2 pt-4 sm:px-5">
        <h3 className="text-base font-extrabold text-foreground">{title}</h3>
        <span className="rounded-full bg-secondary px-2 text-xs font-bold leading-5 tabular-nums text-muted-foreground">{count}</span>
        {hint && count > 1 && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </div>
      {count === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-5">{empty}</p> : <ul className="divide-y divide-border border-t border-border">{children}</ul>}
      {count > 0 && more}
    </section>
  );
}

function Row({ children, attention, muted }: { children: ReactNode; attention?: boolean; muted?: boolean }) {
  return (
    <li className={cn(
      "flex items-start gap-3 px-4 py-3 text-sm sm:px-5",
      attention && "border-l-4 border-l-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.06)] pl-3 sm:pl-4",
      muted && "py-2.5",
    )}>
      {children}
    </li>
  );
}

function Flag({ children }: { children: ReactNode }) {
  return <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[hsl(var(--warning)/0.5)] px-2 text-xs font-bold leading-5 text-warning-strong"><AlertTriangle aria-hidden className="h-3 w-3" />{children}</span>;
}

function TypePill({ type }: { type: HandoverType }) {
  const label = HANDOVER_TYPES.find((t) => t.id === type)!.label;
  return <span className="ml-1 rounded-full bg-secondary px-2 align-middle text-[11px] font-bold leading-5 text-muted-foreground">{label}</span>;
}

function OnSiteRow({ x, now }: { x: OnSiteEntry; now: Date }) {
  const v = x.visit;
  const initials = `${v.firstName?.[0] ?? ""}${v.surname?.[0] ?? ""}`.toUpperCase();
  return (
    <Row attention={x.pastExpected}>
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground">{initials}</span>
      <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="font-bold text-foreground">
            {v.firstName} {v.surname}
            {v.additionalVisitors > 0 && <span className="font-semibold text-muted-foreground"> +{v.additionalVisitors}</span>}
            <TypePill type={x.type} />
          </p>
          <p className="truncate text-[13px] text-muted-foreground">{v.whomToVisit ? <>Visiting <span className="font-semibold text-foreground">{v.whomToVisit}</span></> : "No destination recorded"}</p>
        </div>
        <div className="text-[13px] text-muted-foreground">
          <p className="flex items-center gap-1.5 tabular-nums"><Clock aria-hidden className="h-3.5 w-3.5" />
            In {format(v.checkInTime, x.fromEarlierDay ? "d MMM, h:mm a" : "h:mm a")} · {formatDistanceStrict(v.checkInTime, now)}
          </p>
          {v.mobile && (
            <a href={`tel:${v.mobile.replace(/\s/g, "")}`} className="flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline">
              <Phone aria-hidden className="h-3.5 w-3.5" />{v.mobile}
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-1 md:justify-end">
          {x.pastExpected && <Flag>Past expected time</Flag>}
          {x.fromEarlierDay && <Flag>Since {format(v.checkInTime, "EEE d MMM")}</Flag>}
          {x.keys.map((k) => (
            <span key={k} className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 text-xs font-bold leading-5 text-foreground"><KeyRound aria-hidden className="h-3 w-3" />{k}</span>
          ))}
        </div>
      </div>
    </Row>
  );
}

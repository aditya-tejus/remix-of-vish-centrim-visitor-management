import { useNavigate } from "react-router-dom";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Visitor } from "@/types/visitor";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  Phone, Mail, MapPin, Users, KeyRound, LogOut, Printer,
  ArrowUpRight, ShieldAlert, Calendar,
} from "lucide-react";

function formatDuration(start: Date, end: Date | null): string {
  const endTime = end || new Date();
  const totalMins = differenceInMinutes(endTime, start);
  if (totalMins < 1) return "< 1m";
  const hrs = differenceInHours(endTime, start);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

interface VisitorProfileProps {
  visitor: Visitor | null;
  allVisitors: Visitor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Check out the person standing at the desk, straight from the panel. */
  onCheckOut?: (id: string) => void;
  onPrintBadge?: (visitor: Visitor) => void;
}

/**
 * Quick panel: recognise the person, act on them, see when they were last here.
 * Everything else (compliance evidence, full history) lives on the full profile page.
 */
export function VisitorProfile({
  visitor, allVisitors, open, onOpenChange, onCheckOut, onPrintBadge,
}: VisitorProfileProps) {
  const { openIssues } = useOpenKeyIssues();
  const { checkVisitor } = useWatchlist();
  const navigate = useNavigate();

  if (!visitor) return null;

  const visitHistory = allVisitors.filter(
    (v) =>
      (v.firstName === visitor.firstName && v.surname === visitor.surname) ||
      (v.email && v.email === visitor.email) ||
      (v.mobile && v.mobile === visitor.mobile)
  );

  const visitIds = new Set(visitHistory.map((v) => v.id));
  const heldKeys = openIssues.filter((i) => i.visitorId && visitIds.has(i.visitorId));

  const allVisits = [...visitHistory].sort(
    (a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()
  );
  const recentVisits = allVisits.slice(0, 5);
  const onSite = visitor.status === "checked-in";
  const flag = checkVisitor(visitor.firstName, visitor.surname);
  const fullName = `${visitor.firstName} ${visitor.surname}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[440px] p-0 flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {visitor.firstName[0]}{visitor.surname[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold text-foreground">{fullName}</SheetTitle>
              <SheetDescription className="mt-0.5 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                  {visitor.type}
                </Badge>
                {onSite ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    On site · {formatDuration(visitor.checkInTime, null)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    Left {visitor.checkOutTime ? format(visitor.checkOutTime, "hh:mm a") : ""}
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Safeguarding first — never buried */}
          {flag && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <p className="text-[13px] font-semibold text-destructive flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                {flag.entry.alert_type === "hard" ? "Access restricted" : "Watchlist — check before allowing access"}
              </p>
              <p className="text-[12px] text-foreground">{flag.entry.reason}</p>
              {flag.entry.instructions && (
                <p className="text-[12px] text-muted-foreground">{flag.entry.instructions}</p>
              )}
            </div>
          )}

          {/* Recognise */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">{visitor.mobile || "—"}</span>
            </div>
            {visitor.email && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate">{visitor.email}</span>
              </div>
            )}
            {visitor.whomToVisit && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">Visiting {visitor.whomToVisit}</span>
              </div>
            )}
            {visitor.additionalVisitors > 0 && (
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {visitor.additionalVisitors} with them
                  {visitor.companionDetails?.length
                    ? ` — ${visitor.companionDetails.map((c) => c.name).filter(Boolean).join(", ")}`
                    : ""}
                </span>
              </div>
            )}
          </div>

          {/* Keys */}
          {heldKeys.length > 0 && (
            <div className="space-y-2">
              {heldKeys.map((k) => (
                <button
                  key={k.id}
                  onClick={() => navigate("/keys")}
                  className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                    k.overdue ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
                  }`}
                >
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    {k.keyLabel}{k.propertyLabel ? ` · ${k.propertyLabel}` : ""}
                  </p>
                  <p className={`text-[11px] ${k.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    Out since {format(k.issuedAt, "hh:mm a dd MMM")}
                    {k.expectedReturn ? ` · due ${format(k.expectedReturn, "hh:mm a dd MMM")}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Act */}
          <div className="grid grid-cols-2 gap-2">
            {onSite && onCheckOut && (
              <Button size="sm" className="gap-1.5" onClick={() => onCheckOut(visitor.id)}>
                <LogOut className="h-3.5 w-3.5" /> Check out
              </Button>
            )}
            {onSite && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 border border-border"
                onClick={() =>
                  navigate(
                    `/keys?issueTo=${visitor.id}&issueToName=${encodeURIComponent(fullName)}&issueToType=${visitor.type}`
                  )
                }
              >
                <KeyRound className="h-3.5 w-3.5" /> {heldKeys.length > 0 ? "Keys" : "Issue key"}
              </Button>
            )}
            {onPrintBadge && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onPrintBadge(visitor)}>
                <Printer className="h-3.5 w-3.5" /> Badge
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => { onOpenChange(false); navigate(`/visitors/${visitor.id}`); }}
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Full profile
            </Button>
          </div>

          <Separator />

          {/* Remember */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Recent visits
              </p>
              <span className="text-[10px] text-muted-foreground font-medium">
                {allVisits.length} in total
              </span>
            </div>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No earlier visits recorded.</p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border">
                {recentVisits.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-[12px] text-foreground">
                      {format(v.checkInTime, "dd MMM")} · {format(v.checkInTime, "hh:mm a")}
                      {v.checkOutTime ? ` – ${format(v.checkOutTime, "hh:mm a")}` : " – on site"}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[40%]">
                      {v.whomToVisit || ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

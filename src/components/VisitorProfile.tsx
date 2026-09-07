import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { Visitor } from "@/types/visitor";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  Phone, Mail, MapPin, Clock, User, Shield, Calendar, Users,
  ChevronDown, ChevronRight, Thermometer, FileCheck, Heart,
  LogIn, Timer, MessageSquare, Syringe, Home, KeyRound,
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
}

function VisitDetailPanel({ visit, isCurrent }: { visit: Visitor; isCurrent: boolean }) {
  return (
    <div className="space-y-3 pt-2 pb-1">
      {/* Time & Duration */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground font-medium">Check-In</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">{format(visit.checkInTime, "HH:mm")}</p>
          <p className="text-[10px] text-muted-foreground">{format(visit.checkInTime, "dd MMM yyyy")}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground font-medium">Check-Out</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">
            {visit.checkOutTime ? format(visit.checkOutTime, "HH:mm") : "—"}
          </p>
          {visit.checkOutTime && (
            <p className="text-[10px] text-muted-foreground">{format(visit.checkOutTime, "dd MMM yyyy")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground font-medium">Duration</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">
            {formatDuration(visit.checkInTime, visit.checkOutTime)}
          </p>
        </div>
        {visit.whomToVisit && (
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[10px] text-muted-foreground font-medium">Visiting</p>
            <p className="text-xs font-semibold text-foreground mt-0.5">{visit.whomToVisit}</p>
          </div>
        )}
      </div>

      {/* Check-in Compliance */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" /> Check-in Compliance
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-muted-foreground font-medium">Declaration</p>
            <p className={`text-[11px] font-semibold mt-0.5 ${visit.healthDeclaration ? "text-success" : "text-destructive"}`}>
              {visit.healthDeclaration ? "✓ Declared" : "✗ Not declared"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-muted-foreground font-medium">Temperature</p>
            <p className="text-[11px] font-semibold text-foreground mt-0.5">
              {visit.bodyTemperature ? `${visit.bodyTemperature}°C` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-muted-foreground font-medium">Privacy Consent</p>
            <p className={`text-[11px] font-semibold mt-0.5 ${visit.acknowledgedPrivacy ? "text-success" : "text-destructive"}`}>
              {visit.acknowledgedPrivacy ? "✓ Acknowledged" : "✗ Pending"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-[10px] text-muted-foreground font-medium">Data Retention</p>
            <p className="text-[11px] font-semibold text-foreground mt-0.5">
              {format(visit.retentionExpiry, "dd MMM yyyy")}
            </p>
          </div>
        </div>
      </div>

      {/* Screening Q&A */}
      {visit.healthAnswers && Object.keys(visit.healthAnswers).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <FileCheck className="h-3 w-3" /> Screening Responses
          </p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {Object.entries(visit.healthAnswers).map(([questionKey, answer]) => {
              const displayAnswer = typeof answer === "boolean"
                ? (answer ? "Yes" : "No")
                : String(answer || "—");
              const isRisk = answer === true;
              return (
                <div key={questionKey} className="flex items-start justify-between gap-3 px-3 py-2">
                  <p className="text-[11px] text-foreground flex-1">
                    {questionKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <span className={`text-[11px] font-semibold shrink-0 ${isRisk ? "text-destructive" : "text-success"}`}>
                    {displayAnswer}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vaccination Info */}
      {(visit.influenzaVaccineDate || visit.covidVaccineStatus !== undefined) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Syringe className="h-3 w-3" /> Vaccination
          </p>
          <div className="grid grid-cols-2 gap-2">
            {visit.influenzaVaccineDate && (
              <div className="rounded-lg border border-border p-2">
                <p className="text-[10px] text-muted-foreground font-medium">Flu Vaccine</p>
                <p className="text-[11px] font-semibold text-foreground mt-0.5">{visit.influenzaVaccineDate}</p>
              </div>
            )}
            {visit.covidVaccineStatus !== undefined && (
              <div className="rounded-lg border border-border p-2">
                <p className="text-[10px] text-muted-foreground font-medium">COVID Vaccine</p>
                <p className={`text-[11px] font-semibold mt-0.5 ${visit.covidVaccineStatus ? "text-success" : "text-muted-foreground"}`}>
                  {visit.covidVaccineStatus ? "✓ Vaccinated" : "Not provided"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Companions */}
      {visit.additionalVisitors > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Companions ({visit.additionalVisitors})
          </p>
          {visit.companionDetails && visit.companionDetails.length > 0 ? (
            <div className="space-y-1.5">
              {visit.companionDetails.map((c, i) => (
                <div key={i} className="rounded-lg bg-muted/40 p-2 space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">
                    {c.name || `Person ${i + 1}`}
                    {c.relation && <span className="font-normal text-muted-foreground ml-1">({c.relation})</span>}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {c.phone && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Phone className="h-2.5 w-2.5" />{c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Mail className="h-2.5 w-2.5" />{c.email}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{visit.additionalVisitors} companion(s) — no details recorded</p>
          )}
        </div>
      )}

      {/* Leave / Checkout info */}
      {(visit.leaveType || visit.checkoutReason) && (
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground font-medium">Reason for Checkout</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">{visit.checkoutReason || visit.leaveType || "—"}</p>
        </div>
      )}

      {/* Comments */}
      {visit.comments && (
        <div className="rounded-lg bg-muted/30 border border-border p-2.5">
          <p className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Comments
          </p>
          <p className="text-xs text-foreground italic">"{visit.comments}"</p>
        </div>
      )}
    </div>
  );
}

export function VisitorProfile({ visitor, allVisitors, open, onOpenChange }: VisitorProfileProps) {
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const { openIssues } = useOpenKeyIssues();
  const navigate = useNavigate();

  if (!visitor) return null;

  const visitHistory = allVisitors.filter(
    (v) =>
      ((v.firstName === visitor.firstName && v.surname === visitor.surname) ||
        (v.email && v.email === visitor.email) ||
        (v.mobile && v.mobile === visitor.mobile))
  );

  const visitIds = new Set(visitHistory.map((v) => v.id));
  const heldKeys = openIssues.filter((i) => i.visitorId && visitIds.has(i.visitorId));

  const allVisits = visitHistory.sort(
    (a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {visitor.firstName[0]}{visitor.surname[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold text-foreground">
                {visitor.firstName} {visitor.surname}
              </SheetTitle>
              <SheetDescription className="mt-0.5 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                  {visitor.type}
                </Badge>
                {visitor.status === "checked-in" ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Checked In
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    Checked Out
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">· {allVisits.length} visit{allVisits.length !== 1 ? "s" : ""}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">

          {/* Basic Contact Info */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact Details</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{visitor.mobile || "—"}</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">{visitor.email}</span>
              </div>
              {visitor.address && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{visitor.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Keys currently held */}
          {(heldKeys.length > 0 || visitor.status === "checked-in") && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3 w-3" /> Keys
              </p>
              {heldKeys.map((k) => (
                <button
                  key={k.id}
                  onClick={() => navigate("/keys")}
                  className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                    k.overdue ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
                  }`}
                >
                  <p className="text-xs font-semibold text-foreground">
                    Key issued · {k.keyLabel}{k.propertyLabel ? ` · ${k.propertyLabel}` : ""}
                  </p>
                  <p className={`text-[11px] ${k.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    Out since {format(k.issuedAt, "hh:mm a dd MMM")}
                    {k.expectedReturn ? ` · due back ${format(k.expectedReturn, "hh:mm a dd MMM")}` : ""}
                  </p>
                </button>
              ))}
              {heldKeys.length === 0 && (
                <p className="text-xs text-muted-foreground">No key issued on this visit.</p>
              )}
              {visitor.status === "checked-in" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full gap-1.5 border border-border"
                  onClick={() =>
                    navigate(
                      `/keys?issueTo=${visitor.id}&issueToName=${encodeURIComponent(`${visitor.firstName} ${visitor.surname}`)}&issueToType=${visitor.type}`
                    )
                  }
                >
                  <KeyRound className="h-3.5 w-3.5" /> Issue key
                </Button>
              )}
            </div>
          )}

          <Separator />

          {/* Visit History — expandable */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Visit History
              </p>
              <span className="text-[10px] text-muted-foreground font-medium">{allVisits.length} visit{allVisits.length !== 1 ? "s" : ""}</span>
            </div>

            {allVisits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No visit history found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allVisits.map((v) => {
                  const isExpanded = expandedVisitId === v.id;
                  const isCurrent = v.status === "checked-in";
                  return (
                    <Collapsible key={v.id} open={isExpanded} onOpenChange={() => setExpandedVisitId(isExpanded ? null : v.id)}>
                      <CollapsibleTrigger className="w-full">
                        <div className={`rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm text-left
                          ${isExpanded ? "border-primary/40 bg-primary/[0.03] shadow-sm" : "border-border bg-card hover:border-primary/20"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span className="text-xs font-semibold text-foreground">
                                {format(v.checkInTime, "dd MMM yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {formatDuration(v.checkInTime, v.checkOutTime)}
                              </span>
                              {isCurrent ? (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-success/30 text-success">
                                  Active
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {format(v.checkInTime, "HH:mm")} – {v.checkOutTime ? format(v.checkOutTime, "HH:mm") : "—"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 ml-5.5 text-[11px] text-muted-foreground">
                            {v.whomToVisit && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />{v.whomToVisit}
                              </span>
                            )}
                            {v.additionalVisitors > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />{v.additionalVisitors} companion{v.additionalVisitors !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-2 mr-2 border-l-2 border-primary/20 pl-4 mt-1">
                          <VisitDetailPanel visit={v} isCurrent={isCurrent} />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

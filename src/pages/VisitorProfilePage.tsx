import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
import { useVisitorHistory } from "@/hooks/useVisitorHistory";
import { useResidents } from "@/hooks/useResidents";
import { useAttendance } from "@/hooks/useAttendance";
import { useFormFields } from "@/hooks/useFormFields";
import { useFoodRegister } from "@/hooks/useFoodRegister";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuestionLabels } from "@/hooks/useQuestionLabels";
import { useSuppliers } from "@/hooks/useSuppliers";
import { resolveCheckInFields } from "@/lib/checkInFields";
import {
  buildAttentionItems, splitDetails, describeRelationship, keysForPerson,
  foodForPerson, historyPage, HISTORY_PAGE_SIZE, type AttentionItem,
} from "@/lib/profileSections";
import { companionRowsForVisitor, primaryRowForVisitor } from "@/lib/accountablePeople";
import { ContractorCredentialSummary } from "@/components/contractor/ContractorCredentialSummary";
import { ScreeningAnswers } from "@/components/ScreeningAnswers";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  Phone, Mail, MapPin, Clock, User, Shield, Calendar, Users, ArrowLeft, FileText,
  FileSpreadsheet, Pencil, Trash2, Loader2, LogIn, LogOut, UtensilsCrossed, Timer,
  MessageSquare, MoreHorizontal, KeyRound, ShieldAlert, ChevronDown, AlertTriangle,
  Ban, Info, History, Building2, Briefcase, CheckCircle2,
} from "lucide-react";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { EditVisitorDialog } from "@/components/EditVisitorDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { VisitorBadge } from "@/components/VisitorBadge";
import { issueBadge } from "@/lib/badgeIssue";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useWatchlist } from "@/hooks/useWatchlist";
import { CheckOutSheet } from "@/components/CheckOutSheet";

function formatDuration(start: Date, end: Date | null): string {
  const endTime = end || new Date();
  const totalMins = differenceInMinutes(endTime, start);
  if (totalMins < 1) return "< 1m";
  const hrs = differenceInHours(endTime, start);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

const ATTENTION_ICON = {
  critical: Ban,
  warning: AlertTriangle,
  info: Info,
} as const;

function SectionCard({
  title, icon: Icon, count, children,
}: { title: string; icon: any; count?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3" aria-label={title}>
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {title}
        </h2>
        {count && <span className="text-[11px] text-muted-foreground font-medium">{count}</span>}
      </div>
      {children}
    </section>
  );
}

export default function VisitorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { visitors, deleteVisitor, addVisitor, checkOutVisitor } = useVisitors();
  const { toast } = useToast();
  const { role } = useAuth();
  const { can } = usePermissions();
  const { currentSite, currentSiteId } = useSite();
  const isAdmin = role === "admin";
  const { openIssues } = useOpenKeyIssues();
  const { checkVisitor } = useWatchlist();
  const { parties, checkOutPeople } = useAttendance();
  const { labelFor } = useQuestionLabels();
  const { suppliers } = useSuppliers();
  const { records: foodRecords } = useFoodRegister({});

  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historicOpen, setHistoricOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE_SIZE);
  const [editOpen, setEditOpen] = useState(false);
  const [quickCheckInOpen, setQuickCheckInOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteVisit, setConfirmDeleteVisit] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [outstandingCredentials, setOutstandingCredentials] = useState<string[]>([]);

  const visitor = visitors.find((v) => v.id === id);
  const { visits: fullHistory } = useVisitorHistory(visitor);
  const { residents } = useResidents();
  const { data: formFields = [] } = useFormFields(visitor?.type as any);
  const [residentVisitors, setResidentVisitors] = useState<any[]>([]);

  // For residents: who has come in to see them.
  useEffect(() => {
    let active = true;
    if (!visitor || visitor.type !== "resident") { setResidentVisitors([]); return; }
    (async () => {
      const { data } = await supabase
        .from("visitors")
        .select("id, first_name, surname, type, check_in_time, check_out_time, status, whom_to_visit, visited_resident_ids")
        .neq("type", "resident")
        .or(`visited_resident_ids.cs.{${visitor.id}},whom_to_visit.ilike.${visitor.firstName} ${visitor.surname}`)
        .order("check_in_time", { ascending: false })
        .limit(50);
      if (active) setResidentVisitors(data || []);
    })();
    return () => { active = false; };
  }, [visitor?.id, visitor?.type, visitor?.firstName, visitor?.surname]);

  const fieldSpecs = useMemo(() => resolveCheckInFields(formFields as any), [formFields]);

  if (!visitor) {
    return (
      <AppShell title="Visitor Profile" subtitle="This record could not be found" mainClassName="p-6">
        <div className="mx-auto max-w-md space-y-3 py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">Visitor not found</h2>
          <p className="text-sm text-muted-foreground">
            This visitor record no longer exists, or it belongs to another site.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" /> Go back
            </Button>
            <Button onClick={() => navigate("/visitors")}>All visitor profiles</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const fullName = `${visitor.firstName} ${visitor.surname}`.trim();
  const isResident = visitor.type === "resident";
  const isContractor = visitor.type === "contractor";
  const isCheckedIn = visitor.status === "checked-in";

  // Every visit this person has ever made, not just today's records.
  const localMatches = visitors.filter(
    (v) =>
      v.id !== visitor.id &&
      ((v.firstName === visitor.firstName && v.surname === visitor.surname) ||
        (v.email && v.email === visitor.email) ||
        (v.mobile && v.mobile === visitor.mobile))
  );
  const merged = new Map<string, any>();
  [visitor, ...localMatches].forEach((v) => merged.set(v.id, v));
  fullHistory.forEach((h) => { if (!merged.has(h.id)) merged.set(h.id, h); });
  const allVisits = Array.from(merged.values()).sort(
    (a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()
  );

  /** Who was this visit for — a real resident record when we can match one. */
  const residentForVisit = (v: any) => {
    const rid = v.visitedResidentIds?.[0];
    if (rid) {
      const hit = residents.find((r) => r.visitorId === rid);
      if (hit) return hit;
    }
    const name = (v.whomToVisit || "").trim().toLowerCase();
    if (!name) return null;
    return residents.find((r) => r.name.toLowerCase() === name) || null;
  };

  const primaryRow = primaryRowForVisitor(visitor, parties as any);
  const companionRows = companionRowsForVisitor(visitor, parties as any);
  const relationship = describeRelationship(primaryRow);
  const isLegacyRecord = primaryRow.source === "legacy";

  const visitIds = new Set(allVisits.map((v) => v.id));
  const heldKeys = can("keys.view") ? keysForPerson(openIssues, visitIds) : [];
  const flag = checkVisitor(visitor.firstName, visitor.surname);
  const foodEntries = foodForPerson(foodRecords as any[], {
    visitorId: visitor.id,
    fullName,
    visitIds,
  });

  const screeningFlags = visitor.screeningFlags || [];
  const attention: AttentionItem[] = buildAttentionItems({
    watchlist: flag?.entry || null,
    screeningOutcome: visitor.screeningOutcome,
    screeningFlagCount: screeningFlags.length,
    keys: heldKeys,
    outstandingCredentials: can("contractor.credentials.view") ? outstandingCredentials : [],
  });

  const { active: activeDetails, historic: historicDetails } = splitDetails(visitor, fieldSpecs);
  const supplierName = suppliers.find((s) => s.id === visitor.supplierId)?.name || null;
  const currentResident = residentForVisit(visitor);
  const { rows: historyRows, remaining: historyRemaining } = historyPage(allVisits, historyShown);

  /**
   * Activity is built from this person's own arrivals at this site only.
   * The audit trail itself carries no site, so it is not shown here.
   */
  const activity = allVisits.flatMap((v: any) => {
    const lines: { id: string; at: Date; text: string }[] = [
      { id: `${v.id}-in`, at: v.checkInTime, text: isResident ? "Left the home" : "Signed in" },
    ];
    if (v.checkOutTime) {
      lines.push({ id: `${v.id}-out`, at: v.checkOutTime, text: isResident ? "Returned" : "Signed out" });
    }
    if (v.screeningOutcome === "blocked" || v.screeningOutcome === "flagged") {
      lines.push({
        id: `${v.id}-scr`,
        at: v.checkInTime,
        text: v.screeningOutcome === "blocked" ? "Check-in questions blocked this arrival" : "Check-in questions raised a concern",
      });
    }
    return lines;
  }).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 25);

  const handleDeleteAll = async () => {
    setDeleting(true);
    const ids = allVisits.map((v) => v.id);
    for (const vid of ids) await deleteVisitor(vid);
    await supabase.from("audit_log").insert({
      action: "profile_full_delete",
      performed_by: "admin",
      details: { visitor_name: fullName, records_deleted: ids.length },
      records_affected: ids.length,
    });
    setDeleting(false);
    setConfirmDeleteAll(false);
    toast({ title: "Profile deleted", description: `All ${ids.length} record(s) permanently deleted.` });
    navigate("/visitors");
  };

  const handleDeleteVisit = async (visitId: string) => {
    setDeleting(true);
    await deleteVisitor(visitId);
    await supabase.from("audit_log").insert({
      action: "visit_record_delete",
      performed_by: "admin",
      details: { visitor_name: fullName, visit_id: visitId },
      records_affected: 1,
    });
    setDeleting(false);
    setConfirmDeleteVisit(null);
    toast({ title: "Visit deleted", description: "Visit record permanently deleted." });
    if (visitId === visitor.id) navigate("/visitors");
  };

  const headerActions = (
    <>
      <Button variant="ghost" size="icon" aria-label="Go back" onClick={() => navigate(-1)} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div className="flex items-center gap-2">
        {isCheckedIn ? (
          <Button size="sm" onClick={() => setCheckOutOpen(true)} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Check out
          </Button>
        ) : (
          <Button size="sm" onClick={() => setQuickCheckInOpen(true)} className="gap-1.5">
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Check in again
          </Button>
        )}
        <VisitorBadge
          visitor={visitor}
          variant="print"
          onPrint={() => {
            issueBadge({
              name: fullName,
              type: visitor.type,
              visiting: currentResident?.name || visitor.whomToVisit || undefined,
              mobile: visitor.mobile || undefined,
              room: [currentResident?.room, currentResident?.wing].filter(Boolean).join(" · ") || undefined,
              qrValue: visitor.personQr || visitor.qrCode || visitor.id,
              date: visitor.checkInTime,
            }, { visitorId: visitor.id, siteId: currentSiteId, siteName: currentSite?.name });
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="More actions for this visitor" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5 mr-2" aria-hidden="true" /> Record feedback
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5 mr-2" aria-hidden="true" /> Edit details
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              const name = `${visitor.firstName}_${visitor.surname}`.replace(/\s+/g, "_");
              exportVisitorsToCSV([visitor], `${name}_${format(new Date(), "yyyy-MM-dd")}.csv`);
            }}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-2" aria-hidden="true" /> Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportVisitorToPDF(visitor)}>
              <FileText className="h-3.5 w-3.5 mr-2" aria-hidden="true" /> Export PDF
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDeleteAll(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" aria-hidden="true" /> Delete profile
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <AppShell title="Visitor Profile" subtitle={fullName} actions={headerActions} mainClassName="p-6">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* 1 — IDENTITY AND CURRENT STATE */}
        <section aria-label="Who this is and where they are" className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-5">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {visitor.firstName[0]}{visitor.surname[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                  {visitor.type}
                </Badge>
                {currentSite?.name && (
                  <span className="text-xs text-muted-foreground">{currentSite.name}</span>
                )}
                {isCheckedIn ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {isResident ? "Returned" : "On site"} · {formatDuration(visitor.checkInTime, null)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    {isResident ? "Away" : "Signed out"}
                    {visitor.checkOutTime ? ` · ${format(visitor.checkOutTime, "hh:mm a")}` : ""}
                  </span>
                )}
                {relationship && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> {relationship}
                  </span>
                )}
                {isLegacyRecord && (
                  <Badge variant="outline" className="text-[10px]">Older record</Badge>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2 — NEEDS ATTENTION */}
        {attention.length > 0 && (
          <section aria-label="Needs attention" className="space-y-2">
            {attention.map((item) => {
              const Icon = ATTENTION_ICON[item.tone];
              const critical = item.tone === "critical";
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 flex items-start gap-3 ${
                    critical ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 mt-0.5 shrink-0 ${critical ? "text-destructive" : "text-warning"}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold ${critical ? "text-destructive" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{item.detail}</p>
                  </div>
                  {item.id === "keys" && (
                    <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => navigate("/keys")}>
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Keys register
                    </Button>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* 3 — CURRENT VISIT */}
        <SectionCard title="This visit" icon={Clock}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground font-medium">{isResident ? "Left" : "Arrived"}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{format(visitor.checkInTime, "hh:mm a")}</p>
              <p className="text-[10px] text-muted-foreground">{format(visitor.checkInTime, "dd MMM yyyy")}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground font-medium">{isResident ? "Returned" : "Left"}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {visitor.checkOutTime ? format(visitor.checkOutTime, "hh:mm a") : "—"}
              </p>
              {visitor.checkOutTime && (
                <p className="text-[10px] text-muted-foreground">{format(visitor.checkOutTime, "dd MMM yyyy")}</p>
              )}
              {visitor.autoCheckedOut && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Signed out automatically{visitor.checkoutReason ? ` · ${visitor.checkoutReason.replace(/^Signed out automatically /, "")}` : ""}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground font-medium">{isResident ? "Location" : "Visiting"}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {currentResident
                  ? `${currentResident.name}${currentResident.room ? ` · ${currentResident.room}` : ""}`
                  : visitor.whomToVisit || "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground font-medium">Time on site</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {formatDuration(visitor.checkInTime, visitor.checkOutTime)}
              </p>
            </div>
          </div>

          {/* Contractor context */}
          {isContractor && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" aria-hidden="true" /> Company
                </p>
                <p className="text-sm text-foreground mt-0.5">{supplierName || "Not recorded"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" aria-hidden="true" /> Work
                </p>
                <p className="text-sm text-foreground mt-0.5">{(visitor as any).workType || "Not recorded"}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" aria-hidden="true" /> Where
                </p>
                <p className="text-sm text-foreground mt-0.5">{(visitor as any).workLocation || "Not recorded"}</p>
              </div>
            </div>
          )}

          {/* Screening outcome */}
          {can("screening.view") && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Check-in questions
              </p>
              <p className="text-[13px] text-foreground inline-flex items-center gap-1.5">
                {visitor.screeningOutcome === "blocked" ? (
                  <><Ban className="h-3.5 w-3.5 text-destructive" aria-hidden="true" /> Blocked</>
                ) : visitor.screeningOutcome === "flagged" ? (
                  <><AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden="true" /> Warning raised</>
                ) : visitor.screeningOutcome === "clear" ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Clear</>
                ) : (
                  <><Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> No outcome recorded</>
                )}
              </p>
              {screeningFlags.length > 0 && (
                <ul className="text-[12px] text-muted-foreground space-y-1">
                  {screeningFlags.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-warning" aria-hidden="true" />
                      {labelFor(f.question_id)} — {f.severity}
                    </li>
                  ))}
                </ul>
              )}
              {visitor.healthAnswers && Object.keys(visitor.healthAnswers).length > 0 && (
                <ScreeningAnswers answers={visitor.healthAnswers} />
              )}
            </div>
          )}

          {/* Contractor documents, read only */}
          {isContractor && can("contractor.credentials.view") && (
            <ContractorCredentialSummary
              firstName={visitor.firstName}
              surname={visitor.surname}
              mobile={visitor.mobile}
              supplierId={visitor.supplierId ?? null}
              onOutstandingChange={setOutstandingCredentials}
            />
          )}

          {/* Who came with them */}
          {companionRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" aria-hidden="true" /> Came with {visitor.firstName}
              </p>
              <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {companionRows.map((c) => (
                  <li key={c.key} className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground">
                        {c.name}
                        {c.relationship ? <span className="text-muted-foreground"> ({c.relationship})</span> : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(c.checkInTime, "hh:mm a")}
                        {c.checkOutTime ? ` – ${format(c.checkOutTime, "hh:mm a")}` : " · still on site"}
                        {c.source === "legacy" ? " · older record" : ""}
                      </p>
                    </div>
                    {c.status === "checked-in" && c.partyId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await checkOutPeople([c.partyId as string]);
                            toast({ title: "Signed out", description: `${c.name} has been signed out.` });
                          } catch {
                            toast({ title: "Could not sign out", variant: "destructive" });
                          }
                        }}
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Sign out
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Food brought in */}
          {foodEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" /> Food register
              </p>
              <ul className="text-[12px] text-muted-foreground space-y-1">
                {foodEntries.slice(0, 5).map((f: any) => (
                  <li key={f.id}>
                    {format(new Date(f.recordedAt), "dd MMM · hh:mm a")} — {f.foodDescription}
                    {f.residentName ? ` for ${f.residentName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visitor.comments && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">{visitor.comments}</p>
          )}
        </SectionCard>

        {/* 4 — DETAILS */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" aria-hidden="true" /> Details
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${detailsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-1">
              {activeDetails.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No other details are collected for this person type at this site.
                </p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeDetails.map((d) => (
                    <div key={d.valueKey} className="rounded-lg bg-muted/40 p-3">
                      <dt className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                        {d.valueKey === "mobile" && <Phone className="h-3 w-3" aria-hidden="true" />}
                        {d.valueKey === "email" && <Mail className="h-3 w-3" aria-hidden="true" />}
                        {d.valueKey === "address" && <MapPin className="h-3 w-3" aria-hidden="true" />}
                        {d.label}
                      </dt>
                      <dd className="text-sm text-foreground mt-0.5 break-words">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {historicDetails.length > 0 && can("settings.administer") && (
                <Collapsible open={historicOpen} onOpenChange={setHistoricOpen}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" aria-hidden="true" /> Historic information no longer collected
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${historicOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      These details were recorded before this site stopped asking for them. They are kept for the record only.
                    </p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {historicDetails.map((d) => (
                        <div key={d.valueKey} className="rounded-lg border border-dashed border-border p-3">
                          <dt className="text-[10px] text-muted-foreground font-medium">{d.label}</dt>
                          <dd className="text-sm text-foreground mt-0.5 break-words">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* 5 — VISIT HISTORY */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <CollapsibleTrigger className="w-full flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" /> Visit history
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{allVisits.length} visit{allVisits.length !== 1 ? "s" : ""}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
              {historyRows.map((v: any) => (
                <div
                  key={v.id}
                  className={`rounded-lg border p-3 ${v.id === visitor.id ? "border-primary/30 bg-primary/[0.03]" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{format(v.checkInTime, "dd MMM yyyy")}</span>
                    <div className="flex items-center gap-2">
                      {v.source === "legacy" && <Badge variant="outline" className="text-[9px] h-4 px-1.5">Older record</Badge>}
                      {v.id === visitor.id && <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/30 text-primary">This visit</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {v.status === "checked-in" ? (isResident ? "Back" : "On site") : "Signed out"}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          aria-label={`Delete the visit on ${format(v.checkInTime, "dd MMM yyyy")}`}
                          onClick={() => setConfirmDeleteVisit(v.id)}
                          className="p-1 rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {format(v.checkInTime, "hh:mm a")}{v.checkOutTime ? ` – ${format(v.checkOutTime, "hh:mm a")}` : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" aria-hidden="true" />
                      {formatDuration(v.checkInTime, v.checkOutTime)}
                    </span>
                    {(() => {
                      const res = residentForVisit(v);
                      if (!res && !v.whomToVisit) return null;
                      return (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" aria-hidden="true" />
                          {res ? `${res.name}${res.room ? ` · ${res.room}` : ""}` : v.whomToVisit}
                        </span>
                      );
                    })()}
                    {v.additionalVisitors > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden="true" /> +{v.additionalVisitors}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {historyRemaining > 0 && (
                <Button variant="outline" size="sm" onClick={() => setHistoryShown((n) => n + HISTORY_PAGE_SIZE)}>
                  Show {Math.min(historyRemaining, HISTORY_PAGE_SIZE)} more
                </Button>
              )}

              {isResident && (
                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> Visitors for this resident
                  </p>
                  {residentVisitors.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">No visits recorded yet.</p>
                  ) : (
                    residentVisitors.map((rv) => (
                      <button
                        key={rv.id}
                        onClick={() => navigate(`/visitors/${rv.id}`)}
                        className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{rv.first_name} {rv.surname}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {rv.status === "checked-in" ? "On site" : "Left"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(new Date(rv.check_in_time), "dd MMM yyyy · hh:mm a")}
                          {rv.check_out_time ? ` – ${format(new Date(rv.check_out_time), "hh:mm a")}` : ""}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* 6 — ACTIVITY */}
        {can("data.export") && (
          <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <CollapsibleTrigger className="w-full flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" aria-hidden="true" /> Activity
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${activityOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1 space-y-1.5">
                {activity.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Nothing recorded for this person at this site.</p>
                ) : (
                  activity.map((a) => (
                    <p key={a.id} className="text-[12px] text-muted-foreground">
                      {format(a.at, "dd MMM yyyy · hh:mm a")} — {a.text}
                    </p>
                  ))
                )}
                <p className="text-[11px] text-muted-foreground pt-1">
                  Built from this person's own arrivals at this site. The full change log is on the audit page.
                </p>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </div>

      <AddVisitDialog
        open={quickCheckInOpen}
        onOpenChange={setQuickCheckInOpen}
        onAdd={addVisitor}
        prefill={{
          firstName: visitor.firstName,
          surname: visitor.surname,
          mobile: visitor.mobile,
          email: visitor.email,
          address: visitor.address,
          type: visitor.type,
        }}
      />

      <CheckOutSheet
        open={checkOutOpen}
        onOpenChange={setCheckOutOpen}
        visitors={visitors}
        onCheckOut={checkOutVisitor}
        preSelectedVisitorId={visitor.id}
        onPreSelectedClear={() => {}}
      />

      <EditVisitorDialog visitor={visitor} open={editOpen} onOpenChange={setEditOpen} onSaved={() => {}} />

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        visitorId={visitor.id}
        visitorName={fullName}
        visitorType={visitor.type}
      />

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" /> Delete entire profile
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all <span className="font-semibold text-foreground">{allVisits.length}</span> visit record(s) for{" "}
              <span className="font-semibold text-foreground">{fullName}</span>. This cannot be undone and is written to the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
              Delete all records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteVisit} onOpenChange={(open) => !open && setConfirmDeleteVisit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete visit record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this single visit record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteVisit && handleDeleteVisit(confirmDeleteVisit)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
              Delete visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

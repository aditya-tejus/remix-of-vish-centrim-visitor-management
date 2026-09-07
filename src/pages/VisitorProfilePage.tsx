import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
import { useVisitorHistory } from "@/hooks/useVisitorHistory";
import { useResidents } from "@/hooks/useResidents";
import { ScreeningAnswers } from "@/components/ScreeningAnswers";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  Phone, Mail, MapPin, Clock, User, Shield, Calendar, Users,
  ArrowLeft, FileText, FileSpreadsheet, Pencil, Trash2, Loader2,
  LogIn, LogOut, Home, UtensilsCrossed, Heart, Timer, MessageSquare,
} from "lucide-react";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { EditVisitorDialog } from "@/components/EditVisitorDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { AddVisitDialog } from "@/components/AddVisitDialog";
import { VisitorBadge } from "@/components/VisitorBadge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Visitor } from "@/types/visitor";
import { useAuth } from "@/hooks/useAuth";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useWatchlist } from "@/hooks/useWatchlist";
import { CheckOutSheet } from "@/components/CheckOutSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, KeyRound, ShieldAlert, ChevronDown } from "lucide-react";

function formatDuration(start: Date, end: Date | null): string {
  const endTime = end || new Date();
  const totalMins = differenceInMinutes(endTime, start);
  if (totalMins < 1) return "< 1m";
  const hrs = differenceInHours(endTime, start);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function VisitorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { visitors, deleteVisitor, addVisitor, checkOutVisitor } = useVisitors();
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { openIssues } = useOpenKeyIssues();
  const { checkVisitor } = useWatchlist();
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quickCheckInOpen, setQuickCheckInOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteVisit, setConfirmDeleteVisit] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const visitor = visitors.find((v) => v.id === id);
  const { visits: fullHistory } = useVisitorHistory(visitor);
  const { residents } = useResidents();
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
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

  if (!visitor) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-lg font-semibold text-foreground">Visitor not found</p>
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
              </Button>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

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
    const id = v.visitedResidentIds?.[0];
    if (id) {
      const hit = residents.find((r) => r.visitorId === id);
      if (hit) return hit;
    }
    const name = (v.whomToVisit || "").trim().toLowerCase();
    if (!name) return null;
    const matches = residents.find((r) => r.name.toLowerCase() === name);
    return matches || null;
  };

  const isResident = visitor.type === "resident";
  const isCheckedIn = visitor.status === "checked-in";

  const handleDeleteAll = async () => {
    setDeleting(true);
    const ids = allVisits.map((v) => v.id);
    for (const vid of ids) {
      await deleteVisitor(vid);
    }
    await supabase.from("audit_log").insert({
      action: "profile_full_delete",
      performed_by: "admin",
      details: { visitor_name: `${visitor.firstName} ${visitor.surname}`, records_deleted: ids.length },
      records_affected: ids.length,
    });
    setDeleting(false);
    setConfirmDeleteAll(false);
    toast({ title: "Profile Deleted", description: `All ${ids.length} record(s) permanently deleted.` });
    navigate("/visitors");
  };

  const handleDeleteVisit = async (visitId: string) => {
    setDeleting(true);
    await deleteVisitor(visitId);
    await supabase.from("audit_log").insert({
      action: "visit_record_delete",
      performed_by: "admin",
      details: { visitor_name: `${visitor.firstName} ${visitor.surname}`, visit_id: visitId },
      records_affected: 1,
    });
    setDeleting(false);
    setConfirmDeleteVisit(null);
    toast({ title: "Visit Deleted", description: "Visit record permanently deleted." });
    if (visitId === visitor.id) navigate("/visitors");
  };

  const visitIds = new Set(allVisits.map((v) => v.id));
  const heldKeys = openIssues.filter((i) => i.visitorId && visitIds.has(i.visitorId));
  const flag = checkVisitor(visitor.firstName, visitor.surname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-6 py-4">
              <SidebarTrigger />
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-foreground">Visitor Profile</h1>
                <p className="text-xs text-muted-foreground">{visitor.firstName} {visitor.surname}</p>
              </div>
              <div className="flex items-center gap-2">
                {isCheckedIn ? (
                  <Button size="sm" onClick={() => setCheckOutOpen(true)} className="gap-1.5">
                    <LogOut className="h-3.5 w-3.5" /> Check out
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setQuickCheckInOpen(true)} className="gap-1.5">
                    <LogIn className="h-3.5 w-3.5" /> Check in again
                  </Button>
                )}
                <VisitorBadge visitor={visitor} variant="print" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                      <MessageSquare className="h-3.5 w-3.5 mr-2" /> Record feedback
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit details
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      const name = `${visitor.firstName}_${visitor.surname}`.replace(/\s+/g, "_");
                      exportVisitorsToCSV([visitor], `${name}_${format(new Date(), "yyyy-MM-dd")}.csv`);
                    }}>
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportVisitorToPDF(visitor)}>
                      <FileText className="h-3.5 w-3.5 mr-2" /> Export PDF
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setConfirmDeleteAll(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete profile
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="p-6">
            <div className="space-y-6">
              {/* ===== PROFILE HEADER ===== */}
              <div className="flex items-center gap-5">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {visitor.firstName[0]}{visitor.surname[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{visitor.firstName} {visitor.surname}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                      {visitor.type}
                    </Badge>
                    {isCheckedIn ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        {isResident ? "Returned" : "Checked In"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        {isResident ? "Away" : "Checked Out"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{allVisits.length} total visit{allVisits.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              {flag && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1">
                  <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    {flag.entry.alert_type === "hard" ? "Access restricted" : "Watchlist — check before allowing access"}
                  </p>
                  <p className="text-[13px] text-foreground">{flag.entry.reason}</p>
                  {flag.entry.instructions && (
                    <p className="text-[13px] text-muted-foreground">{flag.entry.instructions}</p>
                  )}
                </div>
              )}

              {heldKeys.length > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4" /> Holding {heldKeys.length} key{heldKeys.length !== 1 ? "s" : ""}
                  </p>
                  {heldKeys.map((k) => (
                    <p key={k.id} className={`text-[13px] ${k.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {k.keyLabel}{k.propertyLabel ? ` · ${k.propertyLabel}` : ""} — out since {format(k.issuedAt, "hh:mm a dd MMM")}
                      {k.overdue ? " · overdue" : ""}
                    </p>
                  ))}
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => navigate("/keys")}>
                    Open keys register
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ===== LEFT COLUMN ===== */}
                <div className="lg:col-span-2 space-y-6">

                  {/* BASIC DETAILS */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Basic Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium">Phone</p>
                          <p className="text-sm font-medium text-foreground">{visitor.mobile || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium">Email</p>
                          <p className="text-sm font-medium text-foreground">{visitor.email}</p>
                        </div>
                      </div>
                      {visitor.address && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 sm:col-span-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium">Address</p>
                            <p className="text-sm font-medium text-foreground">{visitor.address}</p>
                          </div>
                        </div>
                      )}
                      {isResident && (
                        <>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground font-medium">Room / Unit</p>
                              <p className="text-sm font-medium text-foreground">{visitor.address || "Not assigned"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground font-medium">Emergency Contact</p>
                              <p className="text-sm font-medium text-foreground">{visitor.whomToVisit || "Not specified"}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* CURRENT VISIT */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Current Visit
                      </p>
                      {isCheckedIn && (
                        <Badge variant="outline" className="text-[10px] border-success/30 text-success gap-1">
                          <Timer className="h-3 w-3" />
                          {formatDuration(visitor.checkInTime, null)} on-site
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">{isResident ? "Left" : "Check-In"}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{format(visitor.checkInTime, "HH:mm")}</p>
                        <p className="text-[10px] text-muted-foreground">{format(visitor.checkInTime, "dd MMM yyyy")}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">{isResident ? "Returned" : "Check-Out"}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {visitor.checkOutTime ? format(visitor.checkOutTime, "HH:mm") : "—"}
                        </p>
                        {visitor.checkOutTime && (
                          <p className="text-[10px] text-muted-foreground">{format(visitor.checkOutTime, "dd MMM yyyy")}</p>
                        )}
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">{isResident ? "Location" : "Visiting"}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{visitor.whomToVisit || "—"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">Duration</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {formatDuration(visitor.checkInTime, visitor.checkOutTime)}
                        </p>
                      </div>
                    </div>
                    {visitor.additionalVisitors > 0 && (
                      <div className="flex items-center gap-2 text-xs rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium text-foreground">{visitor.additionalVisitors} companion{visitor.additionalVisitors !== 1 ? "s" : ""}</span>
                        {visitor.companionDetails && visitor.companionDetails.length > 0 && (
                          <span className="text-muted-foreground">
                            — {visitor.companionDetails.map(c => c.name).filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    )}
                    {visitor.comments && (
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 italic">
                        "{visitor.comments}"
                      </div>
                    )}
                  </div>

                   {/* CHECK-IN COMPLIANCE — evidence, only opened when asked for */}
                  <Collapsible open={complianceOpen} onOpenChange={setComplianceOpen}>
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <CollapsibleTrigger className="w-full flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Shield className="h-3 w-3" /> Check-in compliance & evidence
                      </p>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${complianceOpen ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">Declaration</p>
                        <p className={`text-xs font-semibold mt-1 ${visitor.healthDeclaration ? "text-success" : "text-destructive"}`}>
                          {visitor.healthDeclaration ? "✓ Declared" : "✗ Not declared"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">Temperature</p>
                        <p className="text-sm font-semibold text-foreground mt-1">
                          {visitor.bodyTemperature ? `${visitor.bodyTemperature}°C` : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">Privacy Consent</p>
                        <p className={`text-xs font-semibold mt-1 ${visitor.acknowledgedPrivacy ? "text-success" : "text-destructive"}`}>
                          {visitor.acknowledgedPrivacy ? "✓ Acknowledged" : "✗ Pending"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-muted-foreground font-medium">Data Retention</p>
                        <p className="text-xs font-semibold text-foreground mt-1">
                          {format(visitor.retentionExpiry, "dd MMM yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Screening Q&A */}
                    {visitor.healthAnswers && Object.keys(visitor.healthAnswers).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Shield className="h-3 w-3" /> Screening Responses
                        </p>
                        <ScreeningAnswers answers={visitor.healthAnswers} />
                      </div>
                    )}

                    {/* Vaccination Info */}
                    {(visitor.influenzaVaccineDate || visitor.covidVaccineStatus !== undefined) && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          Vaccination
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {visitor.influenzaVaccineDate && (
                            <div className="rounded-lg border border-border p-3">
                              <p className="text-[10px] text-muted-foreground font-medium">Flu Vaccine</p>
                              <p className="text-xs font-semibold text-foreground mt-1">{visitor.influenzaVaccineDate}</p>
                            </div>
                          )}
                          {visitor.covidVaccineStatus !== undefined && (
                            <div className="rounded-lg border border-border p-3">
                              <p className="text-[10px] text-muted-foreground font-medium">COVID Vaccine</p>
                              <p className={`text-xs font-semibold mt-1 ${visitor.covidVaccineStatus ? "text-success" : "text-muted-foreground"}`}>
                                {visitor.covidVaccineStatus ? "✓ Vaccinated" : "Not provided"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Companion Details */}
                    {visitor.companionDetails && visitor.companionDetails.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Users className="h-3 w-3" /> Companion Details
                        </p>
                        <div className="space-y-2">
                          {visitor.companionDetails.map((c, i) => (
                            <div key={i} className="rounded-lg bg-muted/40 p-3 space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {c.name || `Person ${i + 1}`}
                                {c.relation && <span className="font-normal text-muted-foreground ml-1">({c.relation})</span>}
                              </p>
                              <div className="flex flex-wrap gap-4">
                                {c.phone && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />{c.phone}
                                  </span>
                                )}
                                {c.email && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" />{c.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    </CollapsibleContent>
                    </div>
                  </Collapsible>
                </div>

                {/* ===== RIGHT COLUMN — VISIT HISTORY ===== */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Visit History
                      </p>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {allVisits.length} visit{allVisits.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {allVisits.map((v) => {
                        const duration = formatDuration(v.checkInTime, v.checkOutTime);
                        return (
                          <div
                            key={v.id}
                            onClick={() => setExpandedVisit(expandedVisit === v.id ? null : v.id)}
                            className={`group rounded-lg border p-3 transition-colors cursor-pointer hover:border-primary/40 ${
                              v.id === visitor.id
                                ? "border-primary/30 bg-primary/[0.03]"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-foreground">
                                {format(v.checkInTime, "dd MMM yyyy")}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteVisit(v.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                                    title="Delete this visit"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                )}
                                {v.id === visitor.id && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/30 text-primary">
                                    Current
                                  </Badge>
                                )}
                                {v.status === "checked-in" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                                    <span className="h-1 w-1 rounded-full bg-success" />
                                    {isResident ? "Back" : "In"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Out</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(v.checkInTime, "HH:mm")}
                                {v.checkOutTime && ` – ${format(v.checkOutTime, "HH:mm")}`}
                              </span>
                              <span className="flex items-center gap-1 text-primary/70 font-medium">
                                <Timer className="h-3 w-3" />
                                {duration}
                              </span>
                              {(() => {
                                const res = residentForVisit(v);
                                if (!res && !v.whomToVisit) return null;
                                return (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {res ? `${res.name}${res.room ? ` · ${res.room}` : ""}${res.wing ? ` · ${res.wing}` : ""}` : v.whomToVisit}
                                  </span>
                                );
                              })()}
                              {v.additionalVisitors > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  +{v.additionalVisitors}
                                </span>
                              )}
                            </div>

                            {expandedVisit === v.id && (
                              <div className="mt-3 pt-3 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
                                {v.bodyTemperature != null && (
                                  <p className="text-[11px] text-muted-foreground">
                                    Temperature recorded: <span className="font-semibold text-foreground">{v.bodyTemperature}°C</span>
                                  </p>
                                )}
                                {v.checkoutReason && (
                                  <p className="text-[11px] text-muted-foreground">
                                    Reason for leaving: <span className="text-foreground">{v.checkoutReason}</span>
                                  </p>
                                )}
                                {Array.isArray(v.companionDetails) && v.companionDetails.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">People with them</p>
                                    {v.companionDetails.map((c: any, i: number) => (
                                      <p key={i} className="text-[11px] text-foreground">
                                        {c.name || `Companion ${i + 1}`}
                                        {c.relation ? ` · ${c.relation}` : ""}
                                        <span className="text-muted-foreground">
                                          {c.checkedOutAt ? ` · left ${format(new Date(c.checkedOutAt), "hh:mm a")}` : " · still on site"}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {v.healthAnswers && Object.keys(v.healthAnswers).length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Questions answered</p>
                                    <ScreeningAnswers answers={v.healthAnswers} />
                                  </div>
                                )}
                                {v.comments && (
                                  <p className="text-[11px] text-muted-foreground">Notes: <span className="text-foreground">{v.comments}</span></p>
                                )}
                                {!v.healthAnswers || Object.keys(v.healthAnswers).length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground italic">No questions were recorded for this visit.</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isResident && (
                    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Users className="h-3 w-3" /> Visitors for this resident
                        </p>
                        <span className="text-[10px] text-muted-foreground font-medium">{residentVisitors.length}</span>
                      </div>
                      {residentVisitors.length === 0 ? (
                        <p className="text-[12px] text-muted-foreground">No visits recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {residentVisitors.map((rv) => (
                            <button
                              key={rv.id}
                              onClick={() => navigate(`/visitors/${rv.id}`)}
                              className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">{rv.first_name} {rv.surname}</span>
                                {rv.status === "checked-in" ? (
                                  <span className="text-[10px] font-medium text-success">On site</span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Left</span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {format(new Date(rv.check_in_time), "dd MMM yyyy · hh:mm a")}
                                {rv.check_out_time ? ` – ${format(new Date(rv.check_out_time), "hh:mm a")}` : ""}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>

      {/* Quick Check-In — opens full wizard to re-ask health & compliance questions */}
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

      <EditVisitorDialog
        visitor={visitor}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => {}}
      />

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        visitorId={visitor.id}
        visitorName={`${visitor.firstName} ${visitor.surname}`}
        visitorType={visitor.type}
      />

      {/* Confirm delete entire profile */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Entire Profile
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all <span className="font-semibold text-foreground">{allVisits.length}</span> visit record(s) for{" "}
              <span className="font-semibold text-foreground">{visitor.firstName} {visitor.surname}</span>.
              This action cannot be undone and will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete All Records
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete single visit */}
      <AlertDialog open={!!confirmDeleteVisit} onOpenChange={(open) => !open && setConfirmDeleteVisit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visit Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this single visit record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteVisit && handleDeleteVisit(confirmDeleteVisit)}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

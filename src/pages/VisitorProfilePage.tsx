import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
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
  const isAdmin = true;
  const [editOpen, setEditOpen] = useState(false);
  const [quickCheckInOpen, setQuickCheckInOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteVisit, setConfirmDeleteVisit] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const visitor = visitors.find((v) => v.id === id);

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

  // Find all visits by same person
  const visitHistory = visitors.filter(
    (v) =>
      v.id !== visitor.id &&
      ((v.firstName === visitor.firstName && v.surname === visitor.surname) ||
        (v.email && v.email === visitor.email) ||
        (v.mobile && v.mobile === visitor.mobile))
  );
  const allVisits = [visitor, ...visitHistory].sort(
    (a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()
  );

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

  const handleQuickCheckOut = async () => {
    await checkOutVisitor(visitor.id);
    toast({ title: "Checked Out", description: `${visitor.firstName} ${visitor.surname} has been checked out.` });
  };

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
              <div className="flex gap-2">
                {/* Quick Check-In — opens full wizard with pre-filled data & re-asks health questions */}
                <Button size="sm" onClick={() => setQuickCheckInOpen(true)} className="gap-1.5">
                  <LogIn className="h-3.5 w-3.5" /> Quick Check-In
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFeedbackOpen(true)} className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Give Feedback
                </Button>
                {/* Quick Check-Out */}
                {isCheckedIn && (
                  <Button size="sm" variant="outline" onClick={handleQuickCheckOut} className="gap-1.5">
                    <LogOut className="h-3.5 w-3.5" /> Quick Check-Out
                  </Button>
                )}
                {/* Print Badge */}
                <VisitorBadge visitor={visitor} variant="print" />
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteAll(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Profile
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => {
                  const name = `${visitor.firstName}_${visitor.surname}`.replace(/\s+/g, "_");
                  const date = format(new Date(), "yyyy-MM-dd");
                  exportVisitorsToCSV([visitor], `${name}_${date}.csv`);
                }}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportVisitorToPDF(visitor)}>
                  <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
                </Button>
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

                   {/* CHECK-IN COMPLIANCE */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Shield className="h-3 w-3" /> Check-in Compliance
                    </p>
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
                        <div className="rounded-lg border border-border divide-y divide-border">
                          {Object.entries(visitor.healthAnswers).map(([questionKey, answer]) => {
                            const displayAnswer = typeof answer === "boolean"
                              ? (answer ? "Yes" : "No")
                              : String(answer || "—");
                            const isRisk = answer === true;
                            return (
                              <div key={questionKey} className="flex items-start justify-between gap-3 px-3 py-2.5">
                                <p className="text-xs text-foreground flex-1">
                                  {questionKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                </p>
                                <span className={`text-xs font-semibold shrink-0 ${isRisk ? "text-destructive" : "text-success"}`}>
                                  {displayAnswer}
                                </span>
                              </div>
                            );
                          })}
                        </div>
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
                  </div>
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
                            className={`group rounded-lg border p-3 transition-colors ${
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
                              {v.whomToVisit && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {v.whomToVisit}
                                </span>
                              )}
                              {v.additionalVisitors > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  +{v.additionalVisitors}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

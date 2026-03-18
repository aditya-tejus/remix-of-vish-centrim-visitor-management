import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Visitor } from "@/types/visitor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, LogIn, Trash2, FileText, FileSpreadsheet, Clock, Check, X, Info } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, isPast, differenceInDays } from "date-fns";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { useToast } from "@/hooks/use-toast";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { supabase } from "@/integrations/supabase/client";
import { DraftAcceptDialog } from "@/components/DraftAcceptDialog";
import { ResidentFilterBar } from "@/components/ResidentFilterBar";
import { useWings, useResidentDetails } from "@/hooks/useWings";

interface LeaveRequest {
  id: string;
  resident_name: string;
  resident_room: string | null;
  leave_type: string | null;
  expected_departure: string | null;
  expected_return: string | null;
  status: string;
  source: string;
  reason: string | null;
  reviewed_by: string | null;
  companions: any;
  comments: string | null;
  external_reference: string | null;
  created_at: string;
}

interface ResidentLeaveTableProps {
  residents: Visitor[];
  onCheckInReturn?: (id: string, comment?: string) => Promise<void>;
  onDelete: (id: string) => void;
}

function getResidentLeaveStatus(resident: Visitor): { label: string; variant: "default" | "destructive" | "secondary" | "outline" } {
  if (resident.status === "checked-in") return { label: "Returned", variant: "default" };
  if (resident.expectedReturnDate && isPast(resident.expectedReturnDate)) return { label: "Overdue", variant: "destructive" };
  return { label: "On Leave", variant: "secondary" };
}

const careLevelColors: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  high: "bg-warning/10 text-warning border-warning/30",
  memory: "bg-info/10 text-info border-info/30",
  palliative: "bg-destructive/10 text-destructive border-destructive/30",
  respite: "bg-success/10 text-success border-success/30",
};

const escortLabels: Record<string, string> = {
  family: "Family", friend: "Friend", staff: "Staff Escort",
  transport: "Transport", "medical-escort": "Medical Escort",
  alone: "Alone", group: "Group Outing",
};

export function ResidentLeaveTable({ residents, onCheckInReturn, onDelete }: ResidentLeaveTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [returnVisitor, setReturnVisitor] = useState<Visitor | null>(null);
  const [drafts, setDrafts] = useState<LeaveRequest[]>([]);
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);
  const [acceptDraft, setAcceptDraft] = useState<LeaveRequest | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // Filters
  const [selectedWings, setSelectedWings] = useState<string[]>([]);
  const [careLevel, setCareLevel] = useState("all");
  const [leaveStatus, setLeaveStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: wings = [] } = useWings();
  const { data: residentDetails = [] } = useResidentDetails();

  // Map resident details by visitor_id
  const detailsMap = useMemo(() => {
    const map = new Map<string, typeof residentDetails[0]>();
    residentDetails.forEach((d) => map.set(d.visitor_id, d));
    return map;
  }, [residentDetails]);

  // Wing name map
  const wingMap = useMemo(() => {
    const map = new Map<string, typeof wings[0]>();
    wings.forEach((w) => map.set(w.id, w));
    return map;
  }, [wings]);

  useEffect(() => {
    const fetchDrafts = async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("source", "external")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (data) setDrafts(data as LeaveRequest[]);
    };
    fetchDrafts();
  }, []);

  // Filter residents
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      const details = detailsMap.get(r.id);
      // Wing filter
      if (selectedWings.length > 0 && (!details?.wing_id || !selectedWings.includes(details.wing_id))) return false;
      // Care level filter
      if (careLevel !== "all" && (details?.care_level || "standard") !== careLevel) return false;
      // Leave status filter
      if (leaveStatus !== "all") {
        const status = getResidentLeaveStatus(r);
        const statusMap: Record<string, string> = { "on-leave": "On Leave", overdue: "Overdue", returned: "Returned", pending: "Pending" };
        if (status.label !== statusMap[leaveStatus]) return false;
      }
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = `${r.firstName} ${r.surname}`.toLowerCase();
        const room = details?.room?.toLowerCase() || "";
        const keyWorker = details?.key_worker?.toLowerCase() || "";
        if (!name.includes(q) && !room.includes(q) && !keyWorker.includes(q)) return false;
      }
      return true;
    });
  }, [residents, selectedWings, careLevel, leaveStatus, searchQuery, detailsMap]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setDismissingId(null);
    toast({ title: "Draft dismissed" });
  };

  const handleAccepted = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setAcceptDraft(null);
    toast({ title: "Draft accepted", description: "Leave record has been created." });
  };

  const pendingCount = drafts.length;

  return (
    <div>
      {/* Filter bar */}
      <ResidentFilterBar
        wings={wings}
        selectedWings={selectedWings}
        onWingsChange={setSelectedWings}
        careLevel={careLevel}
        onCareLevelChange={setCareLevel}
        leaveStatus={leaveStatus}
        onLeaveStatusChange={setLeaveStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Draft imports banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between px-5 py-3 bg-[hsl(38,100%,97%)] border-b border-warning/20">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-foreground">
              {pendingCount} pending import{pendingCount > 1 ? "s" : ""} from clinical system
            </span>
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-warning hover:text-warning" onClick={() => setShowDraftsOnly(!showDraftsOnly)}>
            {showDraftsOnly ? "Show all" : "Review drafts"}
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/50">
            <TableHead className="w-10 pl-5">
              <Checkbox
                checked={filteredResidents.length > 0 && filteredResidents.every((v) => selectedIds.has(v.id))}
                onCheckedChange={() => {
                  const allSelected = filteredResidents.every((v) => selectedIds.has(v.id));
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    filteredResidents.forEach((v) => allSelected ? next.delete(v.id) : next.add(v.id));
                    return next;
                  });
                }}
              />
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Resident</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Room</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Wing</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Care Level</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reason</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Escort / Accompanied By</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground font-bold">Expected Return</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Days Away</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Draft rows */}
          {(!showDraftsOnly ? drafts : drafts).map((draft) => (
            <TableRow key={`draft-${draft.id}`} className="border-dashed border-2 border-warning/40 bg-[hsl(38,100%,98%)]">
              <TableCell className="pl-5"><div className="h-4 w-4" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-warning/10 text-warning text-[11px] font-semibold">
                      {draft.resident_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm">{draft.resident_name}</span>
                    <Badge variant="outline" className="ml-2 text-[9px] bg-warning/10 text-warning border-warning/30">
                      Draft — Clinical System
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{draft.resident_room || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">—</TableCell>
              <TableCell className="text-sm text-muted-foreground">—</TableCell>
              <TableCell className="text-sm">{draft.leave_type || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {draft.companions && Array.isArray(draft.companions) && draft.companions.length > 0
                  ? (draft.companions as any[]).map((c: any) => c.name || "").filter(Boolean).join(", ") || "—"
                  : "—"}
              </TableCell>
              <TableCell>
                {draft.expected_return ? (
                  <span className="text-sm font-semibold">{format(new Date(draft.expected_return), "HH:mm dd MMM")}</span>
                ) : "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">—</TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">Pending</Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-success hover:text-success hover:bg-success/10 gap-1" onClick={() => setAcceptDraft(draft)}>
                    <Check className="h-3 w-3" />Accept
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1" onClick={() => handleDismiss(draft.id)} disabled={dismissingId === draft.id}>
                    <X className="h-3 w-3" />Dismiss
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {/* Resident rows */}
          {!showDraftsOnly && filteredResidents.length === 0 && drafts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-16">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-lg">🏠</span>
                  </div>
                  <p className="text-sm text-muted-foreground">No resident leave records found</p>
                </div>
              </TableCell>
            </TableRow>
          ) : !showDraftsOnly && (
            filteredResidents.map((resident) => {
              const status = getResidentLeaveStatus(resident);
              const isOverdue = status.label === "Overdue";
              const details = detailsMap.get(resident.id);
              const wing = details?.wing_id ? wingMap.get(details.wing_id) : null;
              const daysAbsent = resident.status === "checked-out" && resident.checkOutTime
                ? differenceInDays(new Date(), resident.checkOutTime)
                : 0;

              return (
                <TableRow
                  key={resident.id}
                  className={`group transition-colors cursor-pointer ${
                    isOverdue
                      ? "bg-destructive/[0.04] border-l-2 border-l-destructive"
                      : resident.status === "checked-in"
                      ? "bg-primary/[0.04] border-l-2 border-l-primary"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => navigate(`/visitors/${resident.id}`)}
                >
                  <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(resident.id)} onCheckedChange={() => toggleSelect(resident.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                          {resident.firstName[0]}{resident.surname[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <button
                          className="font-medium text-sm text-primary hover:underline text-left"
                          onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${resident.id}`); }}
                        >
                          {resident.firstName} {resident.surname}
                        </button>
                        {details?.key_worker && (
                          <p className="text-[10px] text-muted-foreground">KW: {details.key_worker}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{details?.room || resident.whomToVisit || "—"}</TableCell>
                  <TableCell>
                    {wing ? (
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: wing.color, color: wing.color }}>
                        {wing.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${careLevelColors[details?.care_level || "standard"] || careLevelColors.standard}`}>
                      {(details?.care_level || "standard").charAt(0).toUpperCase() + (details?.care_level || "standard").slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {resident.leaveType || resident.checkoutReason ? (
                      <Badge variant="outline" className="text-[10px]">{resident.leaveType || resident.checkoutReason}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {resident.accompaniedBy ? (
                      <div>
                        <span className="text-xs font-medium text-foreground">
                          {escortLabels[resident.accompaniedBy] || resident.accompaniedBy}
                        </span>
                        {resident.accompaniedByName && (
                          <p className="text-[10px] text-muted-foreground">{resident.accompaniedByName}</p>
                        )}
                        {resident.comments && resident.comments.includes("Escort:") && (
                          <p className="text-[10px] text-muted-foreground">
                            {resident.comments.split("\n").find(l => l.startsWith("Escort:"))?.replace("Escort: ", "") || ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {resident.expectedReturnDate ? (
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <Clock className="h-3.5 w-3.5 text-destructive" />}
                        <span className={`text-sm font-semibold ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                          {format(resident.expectedReturnDate, "HH:mm dd MMM")}
                        </span>
                        {isOverdue && <Badge variant="destructive" className="text-[9px] ml-1 animate-overdue">OVERDUE</Badge>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {resident.status === "checked-out" ? (
                      <span className={`text-sm font-mono ${daysAbsent > 3 ? "text-destructive font-semibold" : "text-foreground"}`}>
                        {daysAbsent}d
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant} className={`text-[10px] ${isOverdue ? "animate-pulse" : ""}`}>
                        {status.label}
                      </Badge>
                      {resident.status === "checked-out" && (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setReturnVisitor(resident)}>
                          <LogIn className="h-3 w-3" />Return
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => exportVisitorsToCSV([resident])}>
                          <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />Export CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportVisitorToPDF(resident)}>
                          <FileText className="h-3.5 w-3.5 mr-2" />Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(resident.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Delete Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {returnVisitor && (
        <CheckInReturnDialog
          open={!!returnVisitor}
          onOpenChange={(o) => { if (!o) setReturnVisitor(null); }}
          visitorName={`${returnVisitor.firstName} ${returnVisitor.surname}`}
          onConfirm={async (comment) => {
            await onCheckInReturn?.(returnVisitor.id, comment);
            setReturnVisitor(null);
          }}
        />
      )}

      {acceptDraft && (
        <DraftAcceptDialog
          open={!!acceptDraft}
          onOpenChange={(o) => { if (!o) setAcceptDraft(null); }}
          draft={acceptDraft}
          onAccepted={handleAccepted}
        />
      )}
    </div>
  );
}

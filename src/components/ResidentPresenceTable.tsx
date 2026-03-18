import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Visitor } from "@/types/visitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogIn, AlertTriangle, ShieldAlert, Clock, Phone, CheckCircle2 } from "lucide-react";
import { format, isPast, formatDistanceToNow, isToday } from "date-fns";
import { Wing, ResidentDetail } from "@/hooks/useWings";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useState, useMemo } from "react";

interface ResidentPresenceTableProps {
  residents: Resident[];
  residentVisitors: Visitor[];
  detailsMap: Map<string, ResidentDetail>;
  wingMap: Map<string, Wing>;
  onCheckInReturn?: (id: string, comment?: string) => Promise<void>;
  onQuickAway?: (resident: Resident) => void;
  statusFilter?: string | null;
  totalResidentCount?: number;
}

type PresenceStatus = "on-site" | "away" | "on-leave" | "overdue";

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

export function ResidentPresenceTable({
  residents, residentVisitors, detailsMap, wingMap,
  onCheckInReturn, onQuickAway, statusFilter, totalResidentCount,
}: ResidentPresenceTableProps) {
  const navigate = useNavigate();
  const [returnResident, setReturnResident] = useState<{ id: string; name: string } | null>(null);

  const visitorMap = useMemo(() => {
    const map = new Map<string, Visitor>();
    residentVisitors.forEach(v => {
      const existing = map.get(v.id);
      if (!existing || v.checkInTime > existing.checkInTime) {
        map.set(v.id, v);
      }
    });
    return map;
  }, [residentVisitors]);

  const getPresence = (resident: Resident): { status: PresenceStatus; visitor: Visitor | null } => {
    const visitor = visitorMap.get(resident.visitorId);
    if (!visitor) return { status: "on-site", visitor: null };
    if (visitor.status === "checked-out") {
      const isOverdue = visitor.expectedReturnDate && isPast(visitor.expectedReturnDate);
      if (isOverdue) return { status: "overdue", visitor };
      const isAway = visitor.leaveType === "Away" || !visitor.leaveType;
      return { status: isAway ? "away" : "on-leave", visitor };
    }
    return { status: "on-site", visitor };
  };

  // Urgency sort order: overdue → due-back-today → away → on-leave
  const urgencyOrder: Record<PresenceStatus, number> = {
    overdue: 0,
    away: 1,
    "on-leave": 2,
    "on-site": 3,
  };

  // Get only exception residents (not on-site) unless a specific filter is applied
  const exceptionResidents = useMemo(() => {
    let filtered: Resident[];

    if (statusFilter === "due-today") {
      // Due back today filter
      filtered = residents.filter(r => {
        const { visitor } = getPresence(r);
        return visitor?.status === "checked-out" && visitor.expectedReturnDate && isToday(visitor.expectedReturnDate);
      });
    } else if (statusFilter && statusFilter !== "on-site") {
      filtered = residents.filter(r => getPresence(r).status === statusFilter);
    } else {
      // Default: show only exceptions (not on-site)
      filtered = residents.filter(r => getPresence(r).status !== "on-site");
    }

    // Sort by urgency, then by nearest return time
    return filtered.sort((a, b) => {
      const presA = getPresence(a);
      const presB = getPresence(b);
      const urgencyDiff = urgencyOrder[presA.status] - urgencyOrder[presB.status];
      if (urgencyDiff !== 0) return urgencyDiff;

      // Within same urgency, sort by nearest return time
      const retA = presA.visitor?.expectedReturnDate?.getTime() ?? Infinity;
      const retB = presB.visitor?.expectedReturnDate?.getTime() ?? Infinity;
      return retA - retB;
    });
  }, [residents, statusFilter, visitorMap]);

  // Green empty state when all residents are on site
  if (exceptionResidents.length === 0) {
    const total = totalResidentCount ?? residents.length;
    return (
      <div className="text-center py-16 px-6">
        <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <p className="text-base font-semibold text-foreground mt-3">
          All {total} residents on site
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          No one is currently away, on leave, or overdue
        </p>
      </div>
    );
  }

  // Render expanded row for away/leave/overdue
  const renderExceptionRow = (resident: Resident) => {
    const { status, visitor } = getPresence(resident);
    if (status === "on-site") return null;

    const borderClass = {
      away: "border-l-warning bg-warning/[0.03]",
      "on-leave": "border-l-info bg-info/[0.03]",
      overdue: "border-l-destructive bg-destructive/[0.05]",
    }[status];

    const statusBadge = {
      away: <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-warning/30 shrink-0">Away</Badge>,
      "on-leave": <Badge variant="secondary" className="text-[10px] bg-info/10 text-info border-info/30 shrink-0">On Leave</Badge>,
      overdue: (
        <Badge variant="destructive" className="text-[10px] gap-0.5 animate-pulse shrink-0">
          <AlertTriangle className="h-2.5 w-2.5" /> Overdue
        </Badge>
      ),
    }[status];

    const escortPhone = visitor?.comments?.split("\n").find(l => l.startsWith("Escort phone:"))?.replace("Escort phone: ", "");

    return (
      <div
        key={resident.id}
        className={`flex items-center gap-3 px-4 py-2.5 border-l-[3px] ${borderClass} cursor-pointer hover:bg-muted/30 transition-colors`}
        onClick={() => navigate(`/visitors/${resident.visitorId}`)}
      >
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
            {resident.firstName[0]}{resident.surname[0]}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 grid grid-cols-[1fr_minmax(80px,1.2fr)_minmax(80px,1fr)_minmax(60px,auto)_auto] gap-3 items-center">
          {/* Resident + Room */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{resident.firstName} {resident.surname}</span>
              {resident.dolsLpsFlag && <ShieldAlert className="h-3 w-3 text-destructive shrink-0" />}
              <Badge variant="outline" className={`text-[9px] shrink-0 ${careLevelColors[resident.careLevel] || careLevelColors.standard}`}>
                {resident.careLevel.charAt(0).toUpperCase() + resident.careLevel.slice(1)}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">{resident.room || "—"}</span>
          </div>

          {/* Where / Why */}
          <div className="text-[12px] text-muted-foreground truncate">
            {visitor?.leaveType && visitor.leaveType !== "Away" && (
              <span className="text-foreground font-medium">{visitor.leaveType}</span>
            )}
            {visitor?.checkoutReason && (
              <span className="block truncate">{visitor.checkoutReason}</span>
            )}
            {!visitor?.leaveType && !visitor?.checkoutReason && "—"}
          </div>

          {/* Escort + Contact */}
          <div className="text-[12px] min-w-0">
            {visitor?.accompaniedBy ? (
              <div>
                <span className="font-medium text-foreground">
                  {escortLabels[visitor.accompaniedBy] || visitor.accompaniedBy}
                </span>
                {visitor.accompaniedByName && (
                  <span className="block text-muted-foreground truncate">{visitor.accompaniedByName}</span>
                )}
                {escortPhone && (
                  <a
                    href={`tel:${escortPhone}`}
                    className="flex items-center gap-0.5 text-primary hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    <Phone className="h-3 w-3" /> {escortPhone}
                  </a>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>

          {/* Due Back countdown */}
          <div className="text-[12px] font-medium whitespace-nowrap">
            {visitor?.expectedReturnDate ? (
              <span className={`flex items-center gap-1 ${status === "overdue" ? "text-destructive font-semibold" : "text-foreground"}`}>
                <Clock className="h-3 w-3" />
                {status === "overdue"
                  ? formatDistanceToNow(visitor.expectedReturnDate, { addSuffix: false }) + " overdue"
                  : format(visitor.expectedReturnDate, "HH:mm")
                }
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>

          {/* Status + Action */}
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {statusBadge}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setReturnResident({ id: visitor!.id, name: `${resident.firstName} ${resident.surname}` })}
            >
              <LogIn className="h-3 w-3" /> Return
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="divide-y divide-border/50">
        {exceptionResidents.map(renderExceptionRow)}
      </div>

      {returnResident && (
        <CheckInReturnDialog
          open={!!returnResident}
          onOpenChange={o => { if (!o) setReturnResident(null); }}
          visitorName={returnResident.name}
          onConfirm={async (comment) => {
            await onCheckInReturn?.(returnResident.id, comment);
            setReturnResident(null);
          }}
        />
      )}
    </>
  );
}

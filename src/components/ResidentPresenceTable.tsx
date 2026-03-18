import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Visitor } from "@/types/visitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogIn, AlertTriangle, ShieldAlert, DoorOpen, Users, Clock, Phone } from "lucide-react";
import { format, isPast, formatDistanceToNow } from "date-fns";
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
}

type PresenceStatus = "in-building" | "away" | "on-leave" | "overdue";

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
  onCheckInReturn, onQuickAway, statusFilter,
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
    if (!visitor) return { status: "in-building", visitor: null };
    if (visitor.status === "checked-out") {
      const isOverdue = visitor.expectedReturnDate && isPast(visitor.expectedReturnDate);
      if (isOverdue) return { status: "overdue", visitor };
      const isAway = visitor.leaveType === "Away" || !visitor.leaveType;
      return { status: isAway ? "away" : "on-leave", visitor };
    }
    return { status: "in-building", visitor };
  };

  // Filter by status if active
  const filteredResidents = useMemo(() => {
    if (!statusFilter) return residents;
    return residents.filter(r => getPresence(r).status === statusFilter);
  }, [residents, statusFilter, visitorMap]);

  // Group by wing
  const wingGroups = useMemo(() => {
    const statusOrder: Record<PresenceStatus, number> = { overdue: 0, away: 1, "on-leave": 2, "in-building": 3 };
    const groups = new Map<string, { wing: Wing | null; residents: Resident[] }>();

    const sortedWings = [...wingMap.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    sortedWings.forEach(w => groups.set(w.id, { wing: w, residents: [] }));
    groups.set("unassigned", { wing: null, residents: [] });

    filteredResidents.forEach(r => {
      const wingId = r.wingId || "unassigned";
      if (!groups.has(wingId)) groups.set(wingId, { wing: wingMap.get(wingId) || null, residents: [] });
      groups.get(wingId)!.residents.push(r);
    });

    groups.forEach(group => {
      group.residents.sort((a, b) => statusOrder[getPresence(a).status] - statusOrder[getPresence(b).status]);
    });

    return Array.from(groups.entries())
      .filter(([, g]) => g.residents.length > 0)
      .map(([id, g]) => ({ id, ...g }));
  }, [filteredResidents, wingMap, visitorMap]);

  if (filteredResidents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
          <span className="text-muted-foreground text-lg">🏠</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {statusFilter ? "No residents match this filter" : "No residents found"}
        </p>
      </div>
    );
  }

  const getWingStats = (wingResidents: Resident[]) => {
    let inBuilding = 0, away = 0, onLeave = 0, overdue = 0;
    wingResidents.forEach(r => {
      const s = getPresence(r).status;
      if (s === "in-building") inBuilding++;
      else if (s === "away") away++;
      else if (s === "on-leave") onLeave++;
      else overdue++;
    });
    return { inBuilding, away, onLeave, overdue };
  };

  // Render compact chip for in-building residents
  const renderInBuildingChip = (resident: Resident) => (
    <button
      key={resident.id}
      onClick={() => navigate(`/visitors/${resident.visitorId}`)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-[12px] font-medium text-foreground transition-colors group/chip cursor-pointer border border-transparent hover:border-border"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
      <span className="truncate max-w-[120px]">{resident.firstName} {resident.surname[0]}.</span>
      <span className="text-muted-foreground font-mono text-[10px]">{resident.room?.replace("Room ", "R") || ""}</span>
      {resident.dolsLpsFlag && <ShieldAlert className="h-3 w-3 text-destructive shrink-0" />}
      {onQuickAway && (
        <span
          className="opacity-0 group-hover/chip:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); onQuickAway(resident); }}
        >
          <DoorOpen className="h-3 w-3 text-warning" />
        </span>
      )}
    </button>
  );

  // Render expanded row for away/leave/overdue
  const renderAwayRow = (resident: Resident) => {
    const { status, visitor } = getPresence(resident);
    if (status === "in-building") return null;

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

    // Extract escort phone from comments
    const escortPhone = visitor?.comments?.split("\n").find(l => l.startsWith("Escort phone:"))?.replace("Escort phone: ", "");

    return (
      <div
        key={resident.id}
        className={`flex items-center gap-3 px-4 py-2.5 border-l-[3px] ${borderClass} cursor-pointer hover:bg-muted/30 transition-colors`}
        onClick={() => navigate(`/visitors/${resident.visitorId}`)}
      >
        {/* Avatar + Name */}
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
      <div className="divide-y divide-border">
        {wingGroups.map(group => {
          const stats = getWingStats(group.residents);
          const inBuildingResidents = group.residents.filter(r => getPresence(r).status === "in-building");
          const awayResidents = group.residents.filter(r => getPresence(r).status !== "in-building");

          return (
            <div key={group.id}>
              {/* Wing header */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-5 w-1.5 rounded-full"
                    style={{ backgroundColor: group.wing?.color || "hsl(var(--muted-foreground))" }}
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {group.wing?.name || "Unassigned"}
                  </span>
                  {group.wing?.floor && (
                    <span className="text-[10px] text-muted-foreground font-medium">· {group.wing.floor}</span>
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono tabular-nums">
                    <Users className="h-3 w-3 mr-1" />{group.residents.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium">
                  <span className="text-success">{stats.inBuilding} in</span>
                  {stats.away > 0 && <span className="text-warning">{stats.away} away</span>}
                  {stats.onLeave > 0 && <span className="text-info">{stats.onLeave} leave</span>}
                  {stats.overdue > 0 && <span className="text-destructive animate-pulse">{stats.overdue} overdue</span>}
                </div>
              </div>

              {/* Away/Leave/Overdue expanded rows */}
              {awayResidents.length > 0 && (
                <div className="divide-y divide-border/50">
                  {awayResidents.map(renderAwayRow)}
                </div>
              )}

              {/* In-building compact chips */}
              {inBuildingResidents.length > 0 && (
                <div className="px-5 py-2.5 flex flex-wrap gap-1.5">
                  {inBuildingResidents.map(renderInBuildingChip)}
                </div>
              )}
            </div>
          );
        })}
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

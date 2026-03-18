import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Visitor } from "@/types/visitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogIn, AlertTriangle, ShieldAlert, DoorOpen, Users } from "lucide-react";
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
}

const careLevelColors: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  high: "bg-warning/10 text-warning border-warning/30",
  memory: "bg-info/10 text-info border-info/30",
  palliative: "bg-destructive/10 text-destructive border-destructive/30",
  respite: "bg-success/10 text-success border-success/30",
};

type PresenceStatus = "in-building" | "away" | "on-leave" | "overdue";

export function ResidentPresenceTable({ residents, residentVisitors, detailsMap, wingMap, onCheckInReturn, onQuickAway }: ResidentPresenceTableProps) {
  const navigate = useNavigate();
  const [returnResident, setReturnResident] = useState<{ id: string; name: string } | null>(null);

  // Match by visitorId instead of name
  const visitorMap = new Map<string, Visitor>();
  residentVisitors.forEach(v => {
    const existing = visitorMap.get(v.id);
    if (!existing || v.checkInTime > existing.checkInTime) {
      visitorMap.set(v.id, v);
    }
  });

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

  // Group residents by wing, sorted by wing sort_order
  const wingGroups = useMemo(() => {
    const statusOrder: Record<PresenceStatus, number> = { overdue: 0, away: 1, "on-leave": 2, "in-building": 3 };
    const groups = new Map<string, { wing: Wing | null; residents: Resident[] }>();

    // Sort wings by sort_order
    const sortedWings = [...wingMap.values()].sort((a, b) => a.sort_order - b.sort_order);

    // Initialize groups for each wing
    sortedWings.forEach(w => groups.set(w.id, { wing: w, residents: [] }));
    groups.set("unassigned", { wing: null, residents: [] });

    // Assign residents to groups
    residents.forEach(r => {
      const wingId = r.wingId || "unassigned";
      if (!groups.has(wingId)) {
        groups.set(wingId, { wing: wingMap.get(wingId) || null, residents: [] });
      }
      groups.get(wingId)!.residents.push(r);
    });

    // Sort residents within each group by status priority
    groups.forEach(group => {
      group.residents.sort((a, b) => statusOrder[getPresence(a).status] - statusOrder[getPresence(b).status]);
    });

    // Remove empty groups and convert to array
    return Array.from(groups.entries())
      .filter(([, g]) => g.residents.length > 0)
      .map(([id, g]) => ({ id, ...g }));
  }, [residents, wingMap, visitorMap]);

  if (residents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
          <span className="text-muted-foreground text-lg">🏠</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">No residents found</p>
      </div>
    );
  }

  const statusBadge = (status: PresenceStatus) => {
    switch (status) {
      case "in-building":
        return <Badge variant="default" className="text-[10px] bg-success/10 text-success border-success/30">In Building</Badge>;
      case "away":
        return <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-warning/30">Away</Badge>;
      case "on-leave":
        return <Badge variant="secondary" className="text-[10px] bg-info/10 text-info border-info/30">On Leave</Badge>;
      case "overdue":
        return (
          <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> Overdue
          </Badge>
        );
    }
  };

  const borderClass = (status: PresenceStatus) => {
    switch (status) {
      case "in-building": return "hover:bg-muted/50 border-l-[3px] border-l-success";
      case "away": return "bg-warning/[0.03] border-l-[3px] border-l-warning";
      case "on-leave": return "bg-info/[0.03] border-l-[3px] border-l-info";
      case "overdue": return "bg-destructive/[0.04] border-l-[3px] border-l-destructive";
    }
  };

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

  const renderResidentRow = (resident: Resident) => {
    const { status, visitor } = getPresence(resident);
    const wing = resident.wingId ? wingMap.get(resident.wingId) : null;

    return (
      <TableRow
        key={resident.id}
        className={`group transition-colors cursor-pointer min-h-[64px] ${borderClass(status)}`}
        onClick={() => navigate(`/visitors/${resident.visitorId}`)}
      >
        <TableCell className="pl-5 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {resident.firstName[0]}{resident.surname[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[15px]">{resident.firstName} {resident.surname}</span>
                {resident.dolsLpsFlag && (
                  <span title="DoLS/LPS"><ShieldAlert className="h-3.5 w-3.5 text-destructive" /></span>
                )}
              </div>
              {resident.keyWorker && (
                <p className="text-[11px] text-muted-foreground">KW: {resident.keyWorker}</p>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-[13px] font-mono py-3">{resident.room || "—"}</TableCell>
        <TableCell className="py-3">
          <Badge variant="outline" className={`text-[10px] ${careLevelColors[resident.careLevel] || careLevelColors.standard}`}>
            {resident.careLevel.charAt(0).toUpperCase() + resident.careLevel.slice(1)}
          </Badge>
        </TableCell>
        <TableCell className="py-3">
          {statusBadge(status)}
        </TableCell>
        <TableCell className="py-3">
          {visitor && visitor.status === "checked-out" && (
            <div className="text-[13px] text-muted-foreground space-y-0.5">
              {visitor.checkoutReason && <span className="block">{visitor.checkoutReason}</span>}
              {visitor.expectedReturnDate && (
                <span className={`block ${status === "overdue" ? "text-destructive font-semibold" : ""}`}>
                  {status === "overdue"
                    ? `Overdue by ${formatDistanceToNow(visitor.expectedReturnDate)}`
                    : `Back by ${format(visitor.expectedReturnDate, "HH:mm")}`
                  }
                </span>
              )}
              {visitor.accompaniedByName && (
                <span className="block text-[11px]">With: {visitor.accompaniedByName}</span>
              )}
            </div>
          )}
          {status === "in-building" && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()} className="py-3">
          <div className="flex items-center gap-1">
            {visitor && visitor.status === "checked-out" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setReturnResident({ id: visitor.id, name: `${resident.firstName} ${resident.surname}` })}
              >
                <LogIn className="h-3 w-3" /> Return
              </Button>
            )}
            {status === "in-building" && onQuickAway && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-warning hover:text-warning"
                onClick={() => onQuickAway(resident)}
              >
                <DoorOpen className="h-3 w-3" /> Away
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/50">
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-[48px] pl-5">Resident</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Room</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Care Level</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Details</TableHead>
            <TableHead className="w-28"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wingGroups.map(group => {
            const stats = getWingStats(group.residents);
            return (
              <> 
                {/* Wing group header */}
                <TableRow key={`wing-header-${group.id}`} className="hover:bg-transparent bg-muted/30 border-t-2 border-border">
                  <TableCell colSpan={6} className="py-2.5 pl-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {group.wing ? (
                          <div
                            className="h-6 w-1.5 rounded-full"
                            style={{ backgroundColor: group.wing.color || "hsl(var(--muted-foreground))" }}
                          />
                        ) : (
                          <div className="h-6 w-1.5 rounded-full bg-muted-foreground/30" />
                        )}
                        <span className="text-sm font-semibold text-foreground">
                          {group.wing?.name || "Unassigned"}
                        </span>
                        {group.wing?.floor && (
                          <span className="text-[10px] text-muted-foreground font-medium">· {group.wing.floor}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] ml-1 font-mono tabular-nums">
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
                  </TableCell>
                </TableRow>

                {/* Resident rows for this wing */}
                {group.residents.map(renderResidentRow)}
              </>
            );
          })}
        </TableBody>
      </Table>

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

import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Visitor } from "@/types/visitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogIn, AlertTriangle, ShieldAlert, DoorOpen } from "lucide-react";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { Wing, ResidentDetail } from "@/hooks/useWings";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useState } from "react";

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
      // Differentiate "away" (short/same-day) vs "on-leave" (planned/overnight)
      const isAway = visitor.leaveType === "Away" || !visitor.leaveType;
      return { status: isAway ? "away" : "on-leave", visitor };
    }
    return { status: "in-building", visitor };
  };

  const sortedResidents = [...residents].sort((a, b) => {
    const order: Record<PresenceStatus, number> = { overdue: 0, away: 1, "on-leave": 2, "in-building": 3 };
    return order[getPresence(a).status] - order[getPresence(b).status];
  });

  if (sortedResidents.length === 0) {
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-muted/50">
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-[48px] pl-5">Resident</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Room</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Wing</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Care Level</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Details</TableHead>
            <TableHead className="w-28"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResidents.map(resident => {
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
                  {wing ? (
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: wing.color, color: wing.color }}>
                      {wing.name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
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

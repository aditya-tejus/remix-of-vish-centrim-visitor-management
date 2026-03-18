import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Visitor } from "@/types/visitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogIn, AlertTriangle } from "lucide-react";
import { format, isPast } from "date-fns";
import { Wing, ResidentDetail } from "@/hooks/useWings";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useState } from "react";

interface ResidentPresenceTableProps {
  residents: Resident[];
  residentVisitors: Visitor[];
  detailsMap: Map<string, ResidentDetail>;
  wingMap: Map<string, Wing>;
  onCheckInReturn?: (id: string, comment?: string) => Promise<void>;
}

const careLevelColors: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  high: "bg-warning/10 text-warning border-warning/30",
  memory: "bg-info/10 text-info border-info/30",
  palliative: "bg-destructive/10 text-destructive border-destructive/30",
  respite: "bg-success/10 text-success border-success/30",
};

export function ResidentPresenceTable({ residents, residentVisitors, detailsMap, wingMap, onCheckInReturn }: ResidentPresenceTableProps) {
  const navigate = useNavigate();
  const [returnResident, setReturnResident] = useState<{ id: string; name: string } | null>(null);

  const visitorMap = new Map<string, Visitor>();
  residentVisitors.forEach(v => {
    const existing = visitorMap.get(`${v.firstName}-${v.surname}`);
    if (!existing || v.checkInTime > existing.checkInTime) {
      visitorMap.set(`${v.firstName}-${v.surname}`, v);
    }
  });

  const getPresence = (resident: Resident) => {
    const key = `${resident.firstName}-${resident.surname}`;
    const visitor = visitorMap.get(key);
    if (!visitor) return { status: "in-building" as const, visitor: null };
    if (visitor.status === "checked-out") {
      const isOverdue = visitor.expectedReturnDate && isPast(visitor.expectedReturnDate);
      return { status: isOverdue ? "overdue" as const : "away" as const, visitor };
    }
    return { status: "in-building" as const, visitor };
  };

  const sortedResidents = [...residents].sort((a, b) => {
    const order = { overdue: 0, away: 1, "in-building": 2 };
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
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResidents.map(resident => {
            const { status, visitor } = getPresence(resident);
            const wing = resident.wingId ? wingMap.get(resident.wingId) : null;
            const isOverdue = status === "overdue";

            return (
              <TableRow
                key={resident.id}
                className={`group transition-colors cursor-pointer min-h-[64px] ${
                  isOverdue
                    ? "bg-destructive/[0.04] border-l-[3px] border-l-destructive"
                    : status === "away"
                    ? "bg-warning/[0.03] border-l-[3px] border-l-warning"
                    : "hover:bg-muted/50 border-l-[3px] border-l-success"
                }`}
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
                      <span className="font-semibold text-[15px]">{resident.firstName} {resident.surname}</span>
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
                  {status === "in-building" && (
                    <Badge variant="default" className="text-[10px] bg-success/10 text-success border-success/30">In Building</Badge>
                  )}
                  {status === "away" && (
                    <Badge variant="secondary" className="text-[10px]">Away</Badge>
                  )}
                  {status === "overdue" && (
                    <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
                      <AlertTriangle className="h-3 w-3" /> Overdue
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  {visitor && visitor.status === "checked-out" && (
                    <div className="text-[13px] text-muted-foreground space-y-0.5">
                      {visitor.leaveType && <span className="block">{visitor.leaveType}</span>}
                      {visitor.expectedReturnDate && (
                        <span className={`block ${isOverdue ? "text-destructive font-semibold" : ""}`}>
                          Return: {format(visitor.expectedReturnDate, "dd MMM HH:mm")}
                        </span>
                      )}
                    </div>
                  )}
                  {status === "in-building" && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()} className="py-3">
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

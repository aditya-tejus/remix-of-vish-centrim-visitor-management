import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, AlertTriangle, Footprints } from "lucide-react";
import { Wing } from "@/hooks/useWings";

interface ResidentDirectoryTableProps {
  residents: Resident[];
  wingMap: Map<string, Wing>;
}

const careLevelColors: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  high: "bg-warning/10 text-warning border-warning/30",
  memory: "bg-info/10 text-info border-info/30",
  palliative: "bg-destructive/10 text-destructive border-destructive/30",
  respite: "bg-success/10 text-success border-success/30",
};

const mobilityColors: Record<string, string> = {
  independent: "text-success",
  assisted: "text-warning",
  wheelchair: "text-info",
  bedbound: "text-destructive",
};

export function ResidentDirectoryTable({ residents, wingMap }: ResidentDirectoryTableProps) {
  const navigate = useNavigate();

  if (residents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
          <span className="text-muted-foreground text-lg">👥</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">No residents found</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent bg-muted/50">
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground h-[48px] pl-5">Resident</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Room</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Wing</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Care Level</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Key Worker</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Mobility</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Emergency Contact</TableHead>
          <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Flags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {residents.map(resident => {
          const wing = resident.wingId ? wingMap.get(resident.wingId) : null;

          return (
            <TableRow
              key={resident.id}
              className="group transition-colors cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/visitors/${resident.visitorId}`)}
            >
              <TableCell className="pl-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                      {resident.firstName[0]}{resident.surname[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm">{resident.firstName} {resident.surname}</span>
                    {resident.mobile && (
                      <p className="text-[10px] text-muted-foreground">{resident.mobile}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm font-mono">{resident.room || "—"}</TableCell>
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
                <Badge variant="outline" className={`text-[10px] ${careLevelColors[resident.careLevel] || careLevelColors.standard}`}>
                  {resident.careLevel.charAt(0).toUpperCase() + resident.careLevel.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{resident.keyWorker || "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Footprints className={`h-3.5 w-3.5 ${mobilityColors[resident.mobilityLevel] || "text-muted-foreground"}`} />
                  <span className="text-xs capitalize">{resident.mobilityLevel}</span>
                </div>
                {resident.mobilityAids.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{resident.mobilityAids.join(", ")}</p>
                )}
              </TableCell>
              <TableCell>
                {resident.emergencyContactName ? (
                  <div className="text-xs">
                    <span className="font-medium">{resident.emergencyContactName}</span>
                    {resident.emergencyContactPhone && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {resident.emergencyContactPhone}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {resident.dolsLpsFlag && (
                    <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/30">DoLS</Badge>
                  )}
                  {resident.riskAssessmentLevel !== "standard" && (
                    <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/30">
                      Risk: {resident.riskAssessmentLevel}
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

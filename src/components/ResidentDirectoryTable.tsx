import { useNavigate } from "react-router-dom";
import { Resident } from "@/hooks/useResidents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Footprints, ShieldAlert, DoorOpen, Users } from "lucide-react";
import { Wing } from "@/hooks/useWings";

interface ResidentDirectoryTableProps {
  residents: Resident[];
  wingMap: Map<string, Wing>;
  presenceMap?: Map<string, "no-absence" | "away" | "on-leave" | "overdue">;
  onQuickAway?: (resident: Resident) => void;
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

const presenceDot: Record<string, string> = {
  "no-absence": "bg-muted-foreground",
  "away": "bg-warning",
  "on-leave": "bg-info",
  "overdue": "bg-destructive animate-pulse",
};

export function ResidentDirectoryTable({ residents, wingMap, presenceMap, onQuickAway }: ResidentDirectoryTableProps) {
  const navigate = useNavigate();

  if (residents.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Users aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mt-2">No residents found</p>
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto"><Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent bg-muted/50">
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-[48px] pl-5">Resident</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Room</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Wing</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Care Level</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Key Worker</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Mobility</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Emergency Contact</TableHead>
          <TableHead className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Flags</TableHead>
          {onQuickAway && <TableHead className="w-20"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {residents.map(resident => {
          const wing = resident.wingId ? wingMap.get(resident.wingId) : null;
          const presence = presenceMap?.get(resident.visitorId) || "no-absence";

          return (
            <TableRow
              key={resident.id}
              className="group transition-colors cursor-pointer hover:bg-muted/50 min-h-[64px]"
              
            >
              <TableCell className="pl-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {resident.firstName[0]}{resident.surname[0]}
                      </AvatarFallback>
                    </Avatar>
                    {presenceMap && (
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${presenceDot[presence]}`} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="link" className="p-0 h-auto text-base whitespace-normal text-left" onClick={() => navigate(`/visitors/${resident.visitorId}`)}>{resident.firstName} {resident.surname}</Button>
                      {resident.dolsLpsFlag && (
                        <span title="DoLS/LPS"><ShieldAlert className="h-3.5 w-3.5 text-destructive" /></span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{presence === "no-absence" ? "No absence reported · Location not confirmed" : "Recorded absence"}</p>
                    {resident.mobile && (
                      <a
                        href={`tel:${resident.mobile}`}
                        className="text-sm text-primary hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {resident.mobile}
                      </a>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm font-mono py-3">{resident.room || "—"}</TableCell>
              <TableCell className="py-3">
                {wing ? (
                  <Badge variant="outline" className="text-sm" >
                    {wing.name}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">{resident.wing || "—"}</span>
                )}
              </TableCell>
              <TableCell className="py-3">
                <Badge variant="outline" className={`text-sm ${careLevelColors[resident.careLevel] || careLevelColors.standard}`}>
                  {resident.careLevel.charAt(0).toUpperCase() + resident.careLevel.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm py-3">{resident.keyWorker || "—"}</TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-1.5">
                  <Footprints className={`h-3.5 w-3.5 ${mobilityColors[resident.mobilityLevel] || "text-muted-foreground"}`} />
                  <span className="text-sm capitalize">{resident.mobilityLevel || "Not recorded"}</span>
                </div>
                {resident.mobilityAids.length > 0 && (
                  <p className="text-sm text-muted-foreground">{resident.mobilityAids.join(", ")}</p>
                )}
              </TableCell>
              <TableCell className="py-3">
                {resident.emergencyContactName ? (
                  <div className="text-sm">
                    <span className="font-medium">{resident.emergencyContactName}</span>
                    {resident.emergencyContactPhone && (
                      <a
                        href={`tel:${resident.emergencyContactPhone}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        <Phone className="h-3 w-3" /> {resident.emergencyContactPhone}
                      </a>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-1">
                  {resident.dolsLpsFlag && (
                    <Badge variant="outline" className="text-sm bg-destructive/10 text-destructive border-destructive/30">DoLS</Badge>
                  )}
                  {resident.riskAssessmentLevel !== "standard" && (
                    <Badge variant="outline" className="text-sm bg-warning/10 text-warning border-warning/30">
                      Risk: {resident.riskAssessmentLevel}
                    </Badge>
                  )}
                </div>
              </TableCell>
              {onQuickAway && (
                <TableCell onClick={e => e.stopPropagation()} className="py-3">
                  {presence === "no-absence" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-touch text-sm gap-1  transition-opacity text-warning hover:text-warning"
                      onClick={() => onQuickAway(resident)}
                    >
                      <DoorOpen className="h-3 w-3" /> Away
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table></div>
  );
}

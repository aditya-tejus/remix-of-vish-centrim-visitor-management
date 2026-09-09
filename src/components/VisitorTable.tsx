import { useState, useEffect } from "react";
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
import {
  MoreHorizontal, LogOut, Trash2, FileText, FileSpreadsheet, Users,
  MessageSquare, KeyRound, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useOverstayPolicy } from "@/hooks/useOverstayPolicy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { useToast } from "@/hooks/use-toast";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useResidents } from "@/hooks/useResidents";


interface VisitorTableProps {
  visitors: Visitor[];
  onCheckOut: (id: string) => void;
  onCheckOutMany?: (ids: string[]) => void;
  onCheckInReturn?: (id: string, comment?: string, timeOverride?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onFeedback?: (visitor: Visitor) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
}

/** Times are what the desk is asked about; duration is supporting detail. */
const visitorColumns = [
  { key: "name", label: "Person" },
  { key: "checkIn", label: "In" },
  { key: "checkOut", label: "Out" },
  { key: "visiting", label: "Visiting" },
  { key: "companions", label: "With" },
  { key: "action", label: "" },
];

const staffColumns = [
  { key: "name", label: "Staff Member" },
  { key: "checkIn", label: "In" },
  { key: "checkOut", label: "Out" },
  { key: "visiting", label: "Department" },
  { key: "action", label: "" },
];

const contractorColumns = [
  { key: "name", label: "Contractor" },
  { key: "checkIn", label: "In" },
  { key: "checkOut", label: "Out" },
  { key: "visiting", label: "Company / Purpose" },
  { key: "action", label: "" },
];

function formatDuration(checkIn: Date, checkOut: Date | null): string {
  const end = checkOut || new Date();
  const diffMs = end.getTime() - checkIn.getTime();
  if (diffMs < 0) return "—";
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

const typeLabelsMap: Record<string, string> = {
  visitor: "Visitor",
  contractor: "Contractor",
  volunteer: "Volunteer",
  staff: "Staff",
};

export function VisitorTable({
  visitors, onCheckOut, onCheckOutMany, onCheckInReturn, onDelete, onFeedback,
  activeTab, onTabChange, onFilter, activeFilter,
}: VisitorTableProps) {
  const [returnVisitor, setReturnVisitor] = useState<Visitor | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openIssues } = useOpenKeyIssues();
  const { checkVisitor } = useWatchlist();
  const { isOverstayed, hoursFor } = useOverstayPolicy();
  const { residents } = useResidents();

  /** Resolve the person being visited to a real resident record where we can. */
  const residentFor = (visitor: Visitor) => {
    const byId = visitor.visitedResidentIds?.[0];
    if (byId) {
      const found = residents.find((r) => r.visitorId === byId);
      if (found) return found;
    }
    const name = (visitor.whomToVisit || "").trim().toLowerCase();
    if (!name) return null;
    const matches = residents.filter((r) => r.name.toLowerCase() === name);
    return matches.length === 1 ? matches[0] : null;
  };

  // Tick every 30s so live durations stay honest
  useEffect(() => {
    const hasActive = visitors.some(v => v.status === "checked-in");
    if (!hasActive) return;
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, [visitors]);

  const visitorsByType: Record<string, Visitor[]> = {
    all: visitors,
    visitor: visitors.filter((v) => v.type === "visitor"),
    contractor: visitors.filter((v) => v.type === "contractor"),
    volunteer: visitors.filter((v) => v.type === "volunteer"),
    staff: visitors.filter((v) => v.type === "staff"),
  };

  const isWatchlisted = (v: Visitor) => !!checkVisitor(v.firstName, v.surname);

  const handleSingleCSV = (visitor: Visitor) => {
    exportVisitorsToCSV([visitor], `visitor-${visitor.firstName}-${visitor.surname}.csv`);
    toast({ title: "CSV Exported", description: `Record for ${visitor.firstName} ${visitor.surname} exported.` });
  };

  const tabLabels: Record<string, string> = {
    all: "All",
    visitor: "Visitors",
    contractor: "Contractors",
    volunteer: "Volunteers",
    staff: "Staff",
  };

  const getColumns = (type: string) => {
    switch (type) {
      case "staff": return staffColumns;
      case "contractor": return contractorColumns;
      default: return visitorColumns;
    }
  };

  const keysForVisitor = (id: string) => openIssues.filter((i) => i.visitorId === id);

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const actionLabel = (type: string) =>
    type === "staff" ? "Sign Out" : type === "contractor" ? "Depart" : "Check Out";

  const renderRow = (visitor: Visitor, type: string) => {
    const showTypeBadge = type === "all";
    const overstayed = isOverstayed(visitor);
    const keys = keysForVisitor(visitor.id);
    const overdueKey = keys.some((k) => k.overdue);
    const flagged = isWatchlisted(visitor);
    const onSite = visitor.status === "checked-in";
    const showCompanions = type === "visitor" || type === "volunteer" || type === "all";

    return (
      <TableRow
        key={visitor.id}
        className={`group transition-colors cursor-pointer ${
          onSite
            ? "bg-primary/[0.03] border-l-[3px] border-l-primary"
            : "hover:bg-muted/50"
        }`}
        onClick={() => navigate(`/visitors/${visitor.id}`)}
      >
        {/* Selection */}
        <TableCell className="py-3 w-9" onClick={(e) => e.stopPropagation()}>
          {onSite && (
            <Checkbox
              checked={selectedIds.includes(visitor.id)}
              onCheckedChange={() => toggleSelected(visitor.id)}
              aria-label={`Select ${visitor.firstName} ${visitor.surname}`}
            />
          )}
        </TableCell>

        {/* Person */}
        <TableCell className="py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {visitor.firstName[0]}{visitor.surname[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <button
                  className="font-semibold text-[15px] text-primary hover:underline text-left truncate"
                  onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${visitor.id}`); }}
                >
                  {visitor.firstName} {visitor.surname}
                </button>
                {flagged && (
                  <span title="On the watchlist — check instructions before allowing access">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  </span>
                )}
                {overstayed && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-destructive"
                    title={`On site longer than ${hoursFor(visitor.type)}h`}
                  >
                    <AlertTriangle className="h-3 w-3" /> Overdue
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {showTypeBadge && (
                  <span className="text-[11px] text-muted-foreground">
                    {typeLabelsMap[visitor.type] || visitor.type}
                  </span>
                )}
                {keys.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate("/keys"); }}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      overdueKey ? "text-destructive" : "text-warning"
                    }`}
                  >
                    <KeyRound className="h-3 w-3" />
                    {overdueKey ? "Key overdue" : "Key out"} · {keys.map((k) => k.keyLabel).join(", ")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </TableCell>

        {/* In — time first, duration as quiet supporting text */}
        <TableCell className="py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-mono text-foreground">{format(visitor.checkInTime, "hh:mm a")}</span>
            <span className={`text-[11px] tabular-nums ${overstayed ? "text-destructive" : "text-muted-foreground"}`}>
              {formatDuration(visitor.checkInTime, visitor.checkOutTime)}
              {onSite ? " so far" : ""}
            </span>
          </div>
        </TableCell>

        {/* Out — actual time once left, expected time while on site */}
        <TableCell className="py-3">
          {visitor.checkOutTime ? (
            <div className="flex flex-col">
              <span className="text-[13px] font-mono text-foreground">{format(visitor.checkOutTime, "hh:mm a")}</span>
              <span className="text-[11px] text-muted-foreground">{format(visitor.checkOutTime, "dd MMM")}</span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${overstayed ? "text-destructive" : "text-success"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${overstayed ? "bg-destructive" : "bg-success"}`} />
                {overstayed ? "Overdue" : "On site"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Due {format(new Date(visitor.checkInTime.getTime() + hoursFor(visitor.type) * 3600000), "hh:mm a")}
              </span>
            </div>
          )}
        </TableCell>


        {/* Visiting / Department / Company */}
        <TableCell className="py-3">
          {visitor.whomToVisit ? (
            <div className="flex flex-col">
              {(() => {
                const res = residentFor(visitor);
                return res ? (
                  <>
                    <button
                      className="text-[13px] text-primary hover:underline text-left"
                      onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${res.visitorId}`); }}
                    >
                      {res.name}
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      {[res.room, res.wing].filter(Boolean).join(" · ") || "Resident"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] text-foreground">{visitor.whomToVisit}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {visitor.type === "staff" ? "Department" : visitor.type === "contractor" ? "Staff" : "Resident"}
                    </span>
                  </>
                );
              })()}
            </div>
          ) : (
            <span className="text-[12px] text-muted-foreground italic">Not recorded</span>
          )}
        </TableCell>

        {/* Companions */}
        {showCompanions && (
          <TableCell className="py-3">
            {visitor.additionalVisitors > 0 ? (
              <Badge variant="secondary" className="text-[10px] gap-1 font-semibold">
                <Users className="h-3 w-3" />{visitor.additionalVisitors}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        )}

        {/* Action */}
        <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
          {onSite ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => onCheckOut(visitor.id)}
            >
              <LogOut className="h-3 w-3" />
              {actionLabel(visitor.type)}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Done</span>
          )}
        </TableCell>

        {/* Overflow menu */}
        <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleSingleCSV(visitor)}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportVisitorToPDF(visitor)}>
                <FileText className="h-3.5 w-3.5 mr-2" />Export PDF
              </DropdownMenuItem>
              {onFeedback && (
                <DropdownMenuItem onClick={() => onFeedback(visitor)}>
                  <MessageSquare className="h-3.5 w-3.5 mr-2" />Give Feedback
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(visitor.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete Record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  const visibleSelected = selectedIds.filter((id) =>
    visitorsByType[activeTab || "all"].some((v) => v.id === id && v.status === "checked-in")
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <Tabs value={activeTab || "all"} onValueChange={onTabChange} defaultValue="all">
        <div className="border-b border-border px-4 overflow-x-auto">
          <TabsList className="inline-flex items-center bg-transparent rounded-none p-0 gap-0 h-auto">
            {Object.entries(visitorsByType).map(([type, list]) => (
              <TabsTrigger
                key={type}
                value={type}
                className="rounded-none h-11 px-5 text-[15px] font-medium border-b-[3px] border-b-transparent transition-all duration-150 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:border-b-primary data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground"
              >
                {tabLabels[type]}
                <span className="ml-1.5 text-[11px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums">
                  {list.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>


        {visibleSelected.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/5 border-b border-border">
            <p className="text-[13px] font-medium text-foreground">
              {visibleSelected.length} selected
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => { onCheckOutMany?.(visibleSelected); setSelectedIds([]); }}
              >
                <LogOut className="h-3.5 w-3.5" /> Check out selected
              </Button>
            </div>
          </div>
        )}

        {(["all", "visitor", "contractor", "volunteer", "staff"] as const).map((type) => {
          const list = visitorsByType[type];
          const columns = getColumns(type);
          return (
            <TabsContent key={type} value={type} className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="w-9" />
                    {columns.map((col) => (
                      <TableHead key={col.key} className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-[44px]">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 2} className="text-center py-16">
                        <p className="text-sm text-muted-foreground">No {tabLabels[type].toLowerCase()} to show</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((visitor) => renderRow(visitor, type))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          );
        })}
      </Tabs>

      {returnVisitor && (
        <CheckInReturnDialog
          open={!!returnVisitor}
          onOpenChange={(o) => { if (!o) setReturnVisitor(null); }}
          visitorName={`${returnVisitor.firstName} ${returnVisitor.surname}`}
          onConfirm={async (comment, timeOverride) => {
            await onCheckInReturn?.(returnVisitor.id, comment, timeOverride);
            setReturnVisitor(null);
          }}
        />
      )}
    </div>
  );
}

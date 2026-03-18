import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Visitor } from "@/types/visitor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, LogOut, Trash2, FileText, FileSpreadsheet, Users, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { exportVisitorsToCSV, exportVisitorToPDF, exportVisitorsToPDFBulk } from "@/lib/exportVisitors";
import { useToast } from "@/hooks/use-toast";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { TabContextStats } from "@/components/TabContextStats";

interface VisitorTableProps {
  visitors: Visitor[];
  onCheckOut: (id: string) => void;
  onCheckInReturn?: (id: string, comment?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onFeedback?: (visitor: Visitor) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onFilter?: (key: string) => void;
  activeFilter?: string | null;
}

const visitorColumns = [
  { key: "name", label: "Visitor" },
  { key: "contact", label: "Contact" },
  { key: "checkIn", label: "Check-In" },
  { key: "duration", label: "Duration" },
  { key: "visiting", label: "Visiting" },
  { key: "companions", label: "Companions" },
  { key: "status", label: "Status" },
];

const staffColumns = [
  { key: "name", label: "Staff Member" },
  { key: "contact", label: "Contact" },
  { key: "checkIn", label: "Signed In" },
  { key: "duration", label: "Duration" },
  { key: "department", label: "Department" },
  { key: "status", label: "Status" },
];

const contractorColumns = [
  { key: "name", label: "Contractor" },
  { key: "contact", label: "Contact" },
  { key: "checkIn", label: "Arrived" },
  { key: "duration", label: "Duration" },
  { key: "company", label: "Company / Purpose" },
  { key: "status", label: "Status" },
];

// Live duration formatter
function formatDuration(checkIn: Date, checkOut: Date | null): string {
  const end = checkOut || new Date();
  const diffMs = end.getTime() - checkIn.getTime();
  if (diffMs < 0) return "—";
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

// Type badge colors
const typeBadgeStyles: Record<string, string> = {
  visitor: "bg-primary/10 text-primary border-primary/20",
  contractor: "bg-warning/10 text-warning border-warning/20",
  volunteer: "bg-info/10 text-info border-info/20",
  staff: "bg-secondary text-secondary-foreground border-border",
};

const typeLabelsMap: Record<string, string> = {
  visitor: "Visitor",
  contractor: "Contractor",
  volunteer: "Volunteer",
  staff: "Staff",
};

export function VisitorTable({ visitors, onCheckOut, onCheckInReturn, onDelete, onFeedback, activeTab, onTabChange, onFilter, activeFilter }: VisitorTableProps) {
  const [returnVisitor, setReturnVisitor] = useState<Visitor | null>(null);
  const [, setTick] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Tick every 30s to update durations for checked-in visitors
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

  const emptyIcons: Record<string, string> = {
    all: "📋",
    visitor: "👤",
    contractor: "🔧",
    volunteer: "🤝",
    staff: "👨‍💼",
  };

  const getColumns = (type: string) => {
    switch (type) {
      case "staff": return staffColumns;
      case "contractor": return contractorColumns;
      default: return visitorColumns;
    }
  };

  const isOverstayed = (v: Visitor) => v.status === "checked-in" && Date.now() - v.checkInTime.getTime() > 8 * 3600000;

  const renderRow = (visitor: Visitor, type: string) => {
    const showTypeBadge = type === "all";
    const duration = formatDuration(visitor.checkInTime, visitor.checkOutTime);
    const overstayed = isOverstayed(visitor);

    return (
      <TableRow
        key={visitor.id}
        className={`group transition-colors cursor-pointer ${
          visitor.status === "checked-in"
            ? "bg-primary/[0.03] border-l-2 border-l-primary"
            : "hover:bg-muted/50"
        }`}
        onClick={() => navigate(`/visitors/${visitor.id}`)}
      >
        {/* Name + optional type badge */}
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                {visitor.firstName[0]}{visitor.surname[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <button
                className="font-medium text-sm text-primary hover:underline text-left"
                onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${visitor.id}`); }}
              >
                {visitor.firstName} {visitor.surname}
              </button>
              {showTypeBadge && (
                <span className={`inline-flex items-center w-fit mt-0.5 text-[10px] font-semibold px-1.5 py-0 rounded border ${typeBadgeStyles[visitor.type] || "bg-muted text-muted-foreground border-border"}`}>
                  {typeLabelsMap[visitor.type] || visitor.type}
                </span>
              )}
            </div>
          </div>
        </TableCell>

        {/* Contact */}
        <TableCell>
          <div className="text-sm text-foreground">{visitor.mobile}</div>
          <div className="text-[11px] text-muted-foreground">{visitor.email}</div>
        </TableCell>

        {/* Check-In time */}
        <TableCell>
          <span className="text-sm font-mono text-foreground">{format(visitor.checkInTime, "HH:mm")}</span>
          <span className="text-[11px] text-muted-foreground ml-1">{format(visitor.checkInTime, "dd MMM")}</span>
        </TableCell>

        {/* Duration */}
        <TableCell>
          <span className={`text-sm font-mono tabular-nums ${
            overstayed ? "text-destructive font-semibold" : visitor.status === "checked-in" ? "text-foreground" : "text-muted-foreground"
          }`}>
            {duration}
          </span>
        </TableCell>

        {/* Visiting / Department / Company */}
        <TableCell className="text-sm text-foreground">{visitor.whomToVisit || "—"}</TableCell>

        {/* Companions (visitors/volunteers only) */}
        {(type === "visitor" || type === "volunteer" || type === "all") && (
          <TableCell>
            {visitor.additionalVisitors > 0 ? (
              <Badge variant="secondary" className="text-[10px] gap-1 font-semibold">
                <Users className="h-3 w-3" />{visitor.additionalVisitors}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        )}

        {/* Status */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          {visitor.status === "checked-in" ? (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => onCheckOut(visitor.id)}>
              <LogOut className="h-3 w-3" />
              {type === "staff" ? "Sign Out" : type === "contractor" ? "Depart" : "Check Out"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              {visitor.checkOutTime ? format(visitor.checkOutTime, "HH:mm") : "—"}
            </span>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
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
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onFeedback(visitor)}>
                    <MessageSquare className="h-3.5 w-3.5 mr-2" />Give Feedback
                  </DropdownMenuItem>
                </>
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

  return (
    <div className="rounded-[10px] border border-border bg-card overflow-hidden shadow-sm">
      <Tabs value={activeTab || "all"} onValueChange={onTabChange} defaultValue="all">
        <div className="border-b border-border px-2">
          <TabsList className="inline-flex items-center bg-muted rounded-lg p-1 gap-0.5 h-auto">
            {Object.entries(visitorsByType).map(([type, list]) => (
              <TabsTrigger
                key={type}
                value={type}
                className="rounded-md h-8 px-4 text-[13px] font-medium transition-all duration-150 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                {tabLabels[type]}
                <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold">
                  {list.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabContextStats
          tab={activeTab || "all"}
          visitors={visitorsByType[activeTab || "all"]}
          allVisitors={visitors}
          onFilter={onFilter}
          activeFilter={activeFilter}
        />

        {(["all", "visitor", "contractor", "volunteer", "staff"] as const).map((type) => {
          const list = visitorsByType[type];
          const columns = getColumns(type);
          return (
            <TabsContent key={type} value={type} className="mt-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/50">
                    {columns.map((col) => (
                      <TableHead key={col.key} className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground h-[44px]">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground text-lg">{emptyIcons[type]}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">No {tabLabels[type].toLowerCase()} found</p>
                        </div>
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
          onConfirm={async (comment) => {
            await onCheckInReturn?.(returnVisitor.id, comment);
            setReturnVisitor(null);
          }}
        />
      )}
    </div>
  );
}

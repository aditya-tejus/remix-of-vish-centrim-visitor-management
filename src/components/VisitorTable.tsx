import { useState } from "react";
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
import { MoreHorizontal, LogOut, LogIn, Trash2, FileText, FileSpreadsheet, X, Users, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { exportVisitorsToCSV, exportVisitorToPDF, exportVisitorsToPDFBulk } from "@/lib/exportVisitors";
import { useToast } from "@/hooks/use-toast";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { ResidentLeaveTable } from "@/components/ResidentLeaveTable";

interface VisitorTableProps {
  visitors: Visitor[];
  onCheckOut: (id: string) => void;
  onCheckInReturn?: (id: string, comment?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onFeedback?: (visitor: Visitor) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

// Columns config per type
const visitorColumns = [
  { key: "name", label: "Visitor" },
  { key: "contact", label: "Contact" },
  { key: "checkIn", label: "Check-In" },
  { key: "checkOut", label: "Check-Out" },
  { key: "visiting", label: "Visiting" },
  { key: "companions", label: "Companions" },
  { key: "status", label: "Status" },
];

const staffColumns = [
  { key: "name", label: "Staff Member" },
  { key: "contact", label: "Contact" },
  { key: "checkIn", label: "Signed In" },
  { key: "checkOut", label: "Signed Out" },
  { key: "department", label: "Department" },
  { key: "status", label: "Status" },
];

const contractorColumns = [
  { key: "name", label: "Contractor" },
  { key: "contact", label: "Contact" },
  { key: "checkIn", label: "Arrived" },
  { key: "checkOut", label: "Departed" },
  { key: "company", label: "Company / Purpose" },
  { key: "status", label: "Status" },
];

export function VisitorTable({ visitors, onCheckOut, onCheckInReturn, onDelete, onFeedback, activeTab, onTabChange }: VisitorTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [returnVisitor, setReturnVisitor] = useState<Visitor | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const visitorsByType: Record<string, Visitor[]> = {
    all: visitors,
    visitor: visitors.filter((v) => v.type === "visitor"),
    contractor: visitors.filter((v) => v.type === "contractor"),
    volunteer: visitors.filter((v) => v.type === "volunteer"),
    staff: visitors.filter((v) => v.type === "staff"),
    resident: visitors.filter((v) => v.type === "resident"),
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (list: Visitor[]) => {
    const allSelected = list.every((v) => selectedIds.has(v.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      list.forEach((v) => (allSelected ? next.delete(v.id) : next.add(v.id)));
      return next;
    });
  };

  const selectedVisitors = visitors.filter((v) => selectedIds.has(v.id));

  const handleBulkCSV = () => {
    exportVisitorsToCSV(selectedVisitors);
    toast({ title: "CSV Exported", description: `${selectedVisitors.length} record(s) exported.` });
  };

  const handleBulkPDF = () => {
    exportVisitorsToPDFBulk(selectedVisitors);
  };

  const handleSingleCSV = (visitor: Visitor) => {
    exportVisitorsToCSV([visitor], `visitor-${visitor.firstName}-${visitor.surname}.csv`);
    toast({ title: "CSV Exported", description: `Record for ${visitor.firstName} ${visitor.surname} exported.` });
  };

  const typeLabels: Record<string, string> = {
    all: "All",
    visitor: "Visitors",
    contractor: "Contractors",
    volunteer: "Volunteers",
    staff: "Staff",
    resident: "Residents",
  };

  const emptyIcons: Record<string, string> = {
    all: "📋",
    visitor: "👤",
    contractor: "🔧",
    volunteer: "🤝",
    staff: "👨‍💼",
    resident: "🏠",
  };

  const getColumns = (type: string) => {
    switch (type) {
      case "staff": return staffColumns;
      case "contractor": return contractorColumns;
      default: return visitorColumns;
    }
  };

  const renderGenericRow = (visitor: Visitor, type: string) => {
    const columns = getColumns(type);
    return (
      <TableRow
        key={visitor.id}
        className={`group transition-colors cursor-pointer ${
          visitor.status === "checked-in"
            ? "bg-primary/[0.04] border-l-2 border-l-primary shadow-sm"
            : selectedIds.has(visitor.id)
            ? "bg-primary/[0.03]"
            : "hover:bg-muted/50"
        }`}
        onClick={() => navigate(`/visitors/${visitor.id}`)}
      >
        <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selectedIds.has(visitor.id)} onCheckedChange={() => toggleSelect(visitor.id)} />
        </TableCell>

        {/* Name */}
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                {visitor.firstName[0]}{visitor.surname[0]}
              </AvatarFallback>
            </Avatar>
            <button
              className="font-medium text-sm text-primary hover:underline text-left"
              onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${visitor.id}`); }}
            >
              {visitor.firstName} {visitor.surname}
            </button>
          </div>
        </TableCell>

        {/* Contact */}
        <TableCell>
          <div className="text-sm text-foreground">{visitor.mobile}</div>
          <div className="text-[11px] text-muted-foreground">{visitor.email}</div>
        </TableCell>

        {/* Check-In / Signed In / Arrived */}
        <TableCell>
          <span className="text-sm font-mono text-foreground">{format(visitor.checkInTime, "HH:mm")}</span>
          <span className="text-[11px] text-muted-foreground ml-1">{format(visitor.checkInTime, "dd MMM")}</span>
        </TableCell>

        {/* Check-Out / Signed Out / Departed */}
        <TableCell>
          {visitor.checkOutTime ? (
            <>
              <span className="text-sm font-mono text-foreground">{format(visitor.checkOutTime, "HH:mm")}</span>
              <span className="text-[11px] text-muted-foreground ml-1">{format(visitor.checkOutTime, "dd MMM")}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Visiting / Department / Company */}
        <TableCell className="text-sm text-foreground">{visitor.whomToVisit || "—"}</TableCell>

        {/* Companions (only for visitors) */}
        {type === "visitor" && (
          <TableCell>
            {visitor.additionalVisitors > 0 ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] gap-1 font-semibold">
                  <Users className="h-3 w-3" />{visitor.additionalVisitors}
                </Badge>
              </div>
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
              {type === "staff" ? "Signed Out" : type === "contractor" ? "Departed" : "Checked Out"}
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
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-info/5 border-b border-info/10">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary-foreground">{selectedIds.size}</span>
            </div>
            <span className="text-sm font-medium text-foreground">selected</span>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleBulkCSV}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleBulkPDF}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />PDF
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab || "visitor"} onValueChange={onTabChange} defaultValue="visitor">
        <div className="border-b border-border px-2">
          <TabsList className="inline-flex items-center bg-muted rounded-lg p-1 gap-0.5 h-auto">
            {Object.entries(visitorsByType).map(([type, list]) => (
              <TabsTrigger
                key={type}
                value={type}
                className="rounded-md h-8 px-4 text-[13px] font-medium transition-all duration-150 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                {typeLabels[type]}
                <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-semibold`}>
                  {list.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Residents tab — completely independent view */}
        <TabsContent value="resident" className="mt-0">
          <ResidentLeaveTable
            residents={visitorsByType.resident}
            onCheckInReturn={onCheckInReturn}
            onDelete={onDelete}
          />
        </TabsContent>

        {/* Visitors, Staff, Contractors tabs */}
        {(["visitor", "staff", "contractor"] as const).map((type) => {
          const list = visitorsByType[type];
          const columns = getColumns(type);
          return (
            <TabsContent key={type} value={type} className="mt-0">
              <Table>
                <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                    <TableHead className="w-10 pl-5">
                      <Checkbox
                        checked={list.length > 0 && list.every((v) => selectedIds.has(v.id))}
                        onCheckedChange={() => toggleAll(list)}
                      />
                    </TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key} className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground h-[48px]">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 2} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-muted-foreground text-lg">{emptyIcons[type]}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">No {typeLabels[type].toLowerCase()} found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((visitor) => renderGenericRow(visitor, type))
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

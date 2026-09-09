import { useState, useEffect, Fragment } from "react";
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
  MessageSquare, KeyRound, ShieldAlert, AlertTriangle, UsersRound, Printer,
} from "lucide-react";
import { useOpenKeyIssues } from "@/hooks/useOpenKeyIssues";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useOverstayPolicy } from "@/hooks/useOverstayPolicy";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { useToast } from "@/hooks/use-toast";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useResidents } from "@/hooks/useResidents";
import { useSiteStructure } from "@/hooks/useSiteStructure";
import type { AttendanceParty } from "@/hooks/useAttendance";
import { companionRowsForVisitor, type AccountableRow } from "@/lib/accountablePeople";
import { issueBadge } from "@/lib/badgeIssue";
import { useSite } from "@/contexts/SiteContext";

interface VisitorTableProps {
  visitors: Visitor[];
  onCheckOut: (id: string) => void;
  onCheckOutMany?: (ids: string[]) => void;
  onCheckInReturn?: (id: string, comment?: string, timeOverride?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onFeedback?: (visitor: Visitor) => void;
  /** Which person type is selected, so the right columns and wording show. */
  personType?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Permission and privacy switches, decided by the page. */
  canCheckOut?: boolean;
  canExport?: boolean;
  canDelete?: boolean;
  showDestination?: boolean;
  /** Companions recorded as individual people on these visits. */
  companionParties?: AttendanceParty[];
  /** Signs out one companion on their own, leaving the rest of the visit open. */
  onCheckOutParty?: (partyId: string) => void;
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
  resident: "Resident",
};

export function VisitorTable({
  visitors, onCheckOut, onCheckOutMany, onCheckInReturn, onDelete, onFeedback,
  personType = "all",
  emptyTitle = "Nothing to show",
  emptyDescription = "No records match the current view.",
  canCheckOut = true, canExport = true, canDelete = false, showDestination = true,
  companionParties = [],
  onCheckOutParty,
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
  const { areaLabel, roomLabel } = useSiteStructure();
  const { currentSiteId, currentSite } = useSite();


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

  // Selection never carries over between views or type filters.
  useEffect(() => { setSelectedIds([]); }, [personType, visitors.length]);

  const isWatchlisted = (v: Visitor) => !!checkVisitor(v.firstName, v.surname);

  const handleSingleCSV = (visitor: Visitor) => {
    exportVisitorsToCSV([visitor], `visitor-${visitor.firstName}-${visitor.surname}.csv`, companionParties);
    toast({ title: "CSV Exported", description: `Record for ${visitor.firstName} ${visitor.surname} exported.` });
  };

  const columns = personType === "staff" ? staffColumns
    : personType === "contractor" ? contractorColumns
    : visitorColumns;

  const keysForVisitor = (id: string) => openIssues.filter((i) => i.visitorId === id);

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const actionLabel = (type: string) =>
    type === "staff" ? "Sign Out" : type === "contractor" ? "Depart" : "Check Out";

  const eligible = visitors.filter((v) => v.status === "checked-in");
  const visibleSelected = selectedIds.filter((id) => eligible.some((v) => v.id === id));
  const allEligibleSelected = eligible.length > 0 && visibleSelected.length === eligible.length;

  /** Who or where the person went — hidden entirely when the site keeps it private. */
  const destinationBlock = (visitor: Visitor) => {
    if (!visitor.whomToVisit) {
      return <span className="text-[12px] text-muted-foreground italic">Not recorded</span>;
    }
    const res = residentFor(visitor);
    if (!showDestination) {
      return (
        <div className="flex flex-col">
          <span className="text-[13px] text-foreground">
            {res?.wing ? `${areaLabel} ${res.wing}` : "Recorded"}
          </span>
          <span className="text-[11px] text-muted-foreground">Name hidden by site privacy setting</span>
        </div>
      );
    }
    return res ? (
      <div className="flex flex-col">
        <button
          className="text-[13px] text-primary hover:underline text-left"
          onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${res.visitorId}`); }}
        >
          {res.name}
        </button>
        <span className="text-[11px] text-muted-foreground">
          {[res.room ? `${roomLabel} ${res.room}` : "", res.wing].filter(Boolean).join(" · ") || "Resident"}
        </span>
      </div>
    ) : (
      <div className="flex flex-col">
        <span className="text-[13px] text-foreground">{visitor.whomToVisit}</span>
        <span className="text-[11px] text-muted-foreground">
          {visitor.type === "staff" ? "Department" : visitor.type === "contractor" ? "Staff" : "Resident"}
        </span>
      </div>
    );
  };

  const nameBlock = (visitor: Visitor) => {
    const overstayed = isOverstayed(visitor);
    const keys = keysForVisitor(visitor.id);
    const overdueKey = keys.some((k) => k.overdue);
    const flagged = isWatchlisted(visitor);
    return (
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {visitor.firstName[0]}{visitor.surname[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              className="font-semibold text-[15px] text-primary hover:underline text-left truncate"
              onClick={(e) => { e.stopPropagation(); navigate(`/visitors/${visitor.id}`); }}
            >
              {visitor.firstName} {visitor.surname}
            </button>
            {visitor.groupId && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0"
                title={visitor.groupOrganiserName ? `Group organiser: ${visitor.groupOrganiserName}` : "Part of a group arrival"}
              >
                <UsersRound className="h-3 w-3" aria-hidden />
                {visitor.groupLabel || "Group"}
              </span>
            )}
            {flagged && (
              <span title="On the watchlist — check instructions before allowing access" aria-label="On the watchlist">
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              </span>
            )}
            {overstayed && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-destructive"
                title={`On site longer than ${hoursFor(visitor.type)}h`}
              >
                <AlertTriangle className="h-3 w-3" aria-hidden /> Overdue
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {personType === "all" && (
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
                <KeyRound className="h-3 w-3" aria-hidden />
                {overdueKey ? "Key overdue" : "Key out"} · {keys.map((k) => k.keyLabel).join(", ")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const overflowMenu = (visitor: Visitor) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label={`More actions for ${visitor.firstName} ${visitor.surname}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canExport && (
          <>
            <DropdownMenuItem onClick={() => handleSingleCSV(visitor)}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportVisitorToPDF(visitor)}>
              <FileText className="h-3.5 w-3.5 mr-2" />Export PDF
            </DropdownMenuItem>
          </>
        )}
        {visitor.groupId && visitor.status === "checked-in" && canCheckOut && onCheckOutMany && (
          <DropdownMenuItem
            onClick={() =>
              onCheckOutMany(
                visitors.filter((v) => v.groupId === visitor.groupId && v.status === "checked-in").map((v) => v.id),
              )
            }
          >
            <UsersRound className="h-3.5 w-3.5 mr-2" />Sign out whole group
          </DropdownMenuItem>
        )}
        {onFeedback && (
          <DropdownMenuItem onClick={() => onFeedback(visitor)}>
            <MessageSquare className="h-3.5 w-3.5 mr-2" />Give Feedback
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(visitor.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-2" />Delete Record
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const primaryAction = (visitor: Visitor) => {
    if (visitor.status !== "checked-in") {
      return <span className="text-xs text-muted-foreground">Left</span>;
    }
    if (!canCheckOut) return <span className="text-xs text-muted-foreground">On site</span>;
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-9 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
        onClick={() => onCheckOut(visitor.id)}
      >
        <LogOut className="h-3 w-3" aria-hidden />
        {actionLabel(visitor.type)}
      </Button>
    );
  };

  const renderRow = (visitor: Visitor) => {
    const overstayed = isOverstayed(visitor);
    const onSite = visitor.status === "checked-in";
    const showCompanions = columns.some((c) => c.key === "companions");

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
        <TableCell className="py-3 w-9" onClick={(e) => e.stopPropagation()}>
          {onSite && canCheckOut && (
            <Checkbox
              checked={selectedIds.includes(visitor.id)}
              onCheckedChange={() => toggleSelected(visitor.id)}
              aria-label={`Select ${visitor.firstName} ${visitor.surname}`}
            />
          )}
        </TableCell>

        <TableCell className="py-3">{nameBlock(visitor)}</TableCell>

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

        <TableCell className="py-3">{destinationBlock(visitor)}</TableCell>

        {showCompanions && (
          <TableCell className="py-3">
            {visitor.additionalVisitors > 0 ? (
              <Badge variant="secondary" className="text-[10px] gap-1 font-semibold">
                <Users className="h-3 w-3" aria-hidden />{visitor.additionalVisitors}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        )}

        <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
          {primaryAction(visitor)}
        </TableCell>

        <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
          {overflowMenu(visitor)}
        </TableCell>
      </TableRow>
    );
  };

  /** A companion gets their own badge, showing their own name. */
  const printCompanionBadge = (row: AccountableRow, visitor: Visitor) => {
    issueBadge(
      {
        name: row.name,
        type: visitor.type,
        visiting: visitor.whomToVisit || undefined,
        date: row.checkInTime,
        companionOf: row.withPrimaryName || undefined,
      },
      { siteId: currentSiteId, siteName: currentSite?.name ?? null, visitorId: visitor.id }
    );
  };

  /** Each companion is shown as their own accountable person on the visit. */
  const renderCompanionRows = (visitor: Visitor) =>
    companionRowsForVisitor(visitor, companionParties).map((row) => (
      <TableRow key={row.key} className="bg-muted/20">
        <TableCell className="py-2 w-9" />
        <TableCell className="py-2">
          <div className="flex items-center gap-2 pl-4">
            <UsersRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <div className="flex flex-col">
              <span className="text-[13px] text-foreground">{row.name}</span>
              <span className="text-[11px] text-muted-foreground">
                With {row.withPrimaryName}
                {row.relationship ? ` · ${row.relationship}` : ""}
                {row.source === "legacy" ? " · older record" : ""}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-2">
          <span className="text-[13px] font-mono text-foreground">{format(row.checkInTime, "hh:mm a")}</span>
        </TableCell>
        <TableCell className="py-2">
          {row.checkOutTime ? (
            <span className="text-[13px] font-mono text-foreground">{format(row.checkOutTime, "hh:mm a")}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              On site
            </span>
          )}
        </TableCell>
        <TableCell className="py-2" />
        {columns.some((c) => c.key === "companions") && <TableCell className="py-2" />}
        <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
          {!row.checkOutTime && canCheckOut && onCheckOutParty && row.partyId && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px] gap-1.5"
              onClick={() => onCheckOutParty(row.partyId!)}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          )}
        </TableCell>
        <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[12px] gap-1.5"
            onClick={() => printCompanionBadge(row, visitor)}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print badge
          </Button>
        </TableCell>
      </TableRow>
    ));


  /** Narrow screens get the same information as a stacked card. */
  const renderCard = (visitor: Visitor) => {
    const onSite = visitor.status === "checked-in";
    const overstayed = isOverstayed(visitor);
    return (
      <div
        key={visitor.id}
        className={`p-4 space-y-3 ${onSite ? "border-l-[3px] border-l-primary bg-primary/[0.03]" : ""}`}
        onClick={() => navigate(`/visitors/${visitor.id}`)}
      >
        <div className="flex items-start justify-between gap-2">
          {nameBlock(visitor)}
          <div onClick={(e) => e.stopPropagation()}>{overflowMenu(visitor)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span>In {format(visitor.checkInTime, "hh:mm a")}</span>
          <span>
            {visitor.checkOutTime
              ? `Out ${format(visitor.checkOutTime, "hh:mm a")}`
              : overstayed
                ? "Overdue"
                : `Due ${format(new Date(visitor.checkInTime.getTime() + hoursFor(visitor.type) * 3600000), "hh:mm a")}`}
          </span>
          {visitor.additionalVisitors > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden />{visitor.additionalVisitors}
            </span>
          )}
        </div>
        <div className="text-[12px]">{destinationBlock(visitor)}</div>
        <div onClick={(e) => e.stopPropagation()}>{primaryAction(visitor)}</div>
      </div>
    );
  };

  /** On phones each companion gets their own card, tagged to who they arrived with. */
  const renderCompanionCards = (visitor: Visitor) =>
    companionRowsForVisitor(visitor, companionParties).map((row) => (
        <div key={row.key} className="p-4 pl-8 space-y-2 bg-muted/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <UsersRound className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden />
              <div>
                <p className="text-[14px] font-medium text-foreground">{row.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  With {row.withPrimaryName}
                  {row.relationship ? ` · ${row.relationship}` : ""}
                  {row.source === "legacy" ? " · older record" : ""}
                </p>
              </div>
            </div>
            {row.checkOutTime ? (
              <span className="text-[12px] text-muted-foreground">
                Out {format(row.checkOutTime, "hh:mm a")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> On site
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">In {format(row.checkInTime, "hh:mm a")}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-[12px] gap-1.5"
                onClick={() => printCompanionBadge(row, visitor)}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden /> Print badge
              </Button>
              {!row.checkOutTime && canCheckOut && onCheckOutParty && row.partyId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-[12px] gap-1.5"
                  onClick={() => onCheckOutParty(row.partyId!)}
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                </Button>
              )}
            </div>
          </div>

        </div>
      ));

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {visibleSelected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-primary/5 border-b border-border">
          <p className="text-[13px] font-medium text-foreground">
            {visibleSelected.length} selected
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            <Button
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => { onCheckOutMany?.(visibleSelected); setSelectedIds([]); }}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden /> Check out selected
            </Button>
          </div>
        </div>
      )}

      {visitors.length === 0 ? (
        <div className="px-6 py-14 text-center space-y-1">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          <p className="text-[13px] text-muted-foreground max-w-md mx-auto">{emptyDescription}</p>
        </div>
      ) : (
        <>
          {/* Table for tablet landscape and up */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  <TableHead className="w-9">
                    {canCheckOut && eligible.length > 0 && (
                      <Checkbox
                        checked={allEligibleSelected}
                        onCheckedChange={() =>
                          setSelectedIds(allEligibleSelected ? [] : eligible.map((v) => v.id))
                        }
                        aria-label="Select everyone on site in this view"
                      />
                    )}
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead key={col.key} className="text-xs uppercase tracking-wider font-semibold text-muted-foreground h-[44px]">
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitors.map((visitor) => (
                  <Fragment key={visitor.id}>
                    {renderRow(visitor)}
                    {renderCompanionRows(visitor)}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Stacked cards on phones and narrow tablets */}
          <div className="md:hidden divide-y divide-border">
            {visitors.map((visitor) => (
              <div key={visitor.id} className="divide-y divide-border">
                {renderCard(visitor)}
                {renderCompanionCards(visitor)}
              </div>
            ))}
          </div>
        </>
      )}

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

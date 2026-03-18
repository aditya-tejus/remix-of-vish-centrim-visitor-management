import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Filter, RefreshCw, FileText, ChevronDown, Download,
  LogIn, UserCheck, Edit, Trash2, Shield, AlertTriangle, Clock,
  Settings as SettingsIcon, Lock, Link2, Bell, Bookmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

interface AuditEntry {
  id: string;
  action: string;
  performed_by: string;
  created_at: string;
  details: any;
  records_affected: number | null;
}

const EVENT_CATEGORIES: Record<string, { label: string; color: string; icon: any }> = {
  visitor_checked_in: { label: "CHECK-IN", color: "bg-success/10 text-success", icon: LogIn },
  visitor_checked_out: { label: "CHECK-OUT", color: "bg-muted text-muted-foreground", icon: UserCheck },
  auto_checkout: { label: "AUTO CHECK-OUT", color: "bg-muted text-muted-foreground", icon: Clock },
  bulk_checkout_overstayed: { label: "BULK CHECK-OUT", color: "bg-muted text-muted-foreground", icon: Clock },
  visitor_data_edited: { label: "DATA EDIT", color: "bg-info/10 text-info", icon: Edit },
  draft_accepted: { label: "DRAFT ACCEPTED", color: "bg-warning/10 text-warning", icon: Bookmark },
  draft_dismissed: { label: "DRAFT DISMISSED", color: "bg-warning/10 text-warning", icon: Bookmark },
  checkout_request_approved: { label: "REQUEST APPROVED", color: "bg-warning/10 text-warning", icon: Bookmark },
  checkout_request_rejected: { label: "REQUEST REJECTED", color: "bg-warning/10 text-warning", icon: Bookmark },
  settings_changed: { label: "SETTINGS CHANGE", color: "bg-info/10 text-info", icon: SettingsIcon },
  right_to_erasure_full: { label: "ERASURE", color: "bg-destructive/10 text-destructive", icon: Trash2 },
  right_to_erasure_partial: { label: "PARTIAL ERASURE", color: "bg-destructive/10 text-destructive", icon: Shield },
  sar_export: { label: "SAR EXPORT", color: "bg-[hsl(263,70%,95%)] text-[hsl(263,70%,50%)]", icon: Download },
  user_login: { label: "LOGIN", color: "bg-destructive/10 text-destructive", icon: Lock },
  integration_sync: { label: "INTEGRATION", color: "bg-[hsl(263,70%,95%)] text-[hsl(263,70%,50%)]", icon: Link2 },
  return_notification_sent: { label: "NOTIFICATION", color: "bg-[hsl(263,70%,95%)] text-[hsl(263,70%,50%)]", icon: Bell },
  watchlist_triggered: { label: "WATCHLIST", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
  automated_retention_cleanup: { label: "SYSTEM", color: "bg-[hsl(263,70%,95%)] text-[hsl(263,70%,50%)]", icon: RefreshCw },
};

const DEFAULT_EVENT = { label: "SYSTEM", color: "bg-muted text-muted-foreground", icon: FileText };

function getEvent(action: string) {
  return EVENT_CATEGORIES[action] || DEFAULT_EVENT;
}

export function AuditTrailTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const filtered = logs.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const meta = getEvent(log.action);
      return (
        meta.label.toLowerCase().includes(q) ||
        log.performed_by.toLowerCase().includes(q) ||
        JSON.stringify(log.details || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  const handleExportCSV = () => {
    const csvRows = [
      ["Timestamp", "Event Type", "Actor", "Details"].join(","),
      ...filtered.map((log) => {
        const meta = getEvent(log.action);
        return [
          format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
          meta.label,
          log.performed_by,
          JSON.stringify(log.details || {}),
        ].join(",");
      }),
    ].join("\n");
    
    const blob = new Blob([csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Retention notice */}
      <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <span><strong className="text-foreground">Data retention:</strong> Audit records are retained for 7 years in compliance with regulatory requirements.</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search audit log..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>{getEvent(a).label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchLogs} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-[13px]">
          <Download className="h-3.5 w-3.5" />Export CSV
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length} entries</div>

      {/* Log table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No audit entries found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log) => {
                const meta = getEvent(log.action);
                const Icon = meta.icon;
                const isExpanded = expandedId === log.id;
                const hasDetails = log.details && Object.keys(log.details).length > 0;

                return (
                  <div key={log.id}>
                    <button
                      className="flex items-center gap-3 px-5 py-3 w-full text-left hover:bg-muted/30 transition-colors"
                      onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                    >
                      <div className="text-right shrink-0 w-[90px] hidden sm:block">
                        <p className="text-xs text-foreground font-mono">{format(new Date(log.created_at), "HH:mm")}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(log.created_at), "dd MMM yyyy")}</p>
                      </div>
                      <Badge className={`${meta.color} border-0 text-[9px] font-bold tracking-wider shrink-0 w-[110px] justify-center`}>
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground w-[100px] shrink-0 truncate">{log.performed_by}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {log.details?.visitor_name || log.details?.description || log.action.replace(/_/g, " ")}
                        </p>
                      </div>
                      {hasDetails && (
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      )}
                    </button>
                    {isExpanded && hasDetails && (
                      <div className="px-5 pb-4 pl-[120px]">
                        <div className="rounded-md bg-muted/40 border border-border p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

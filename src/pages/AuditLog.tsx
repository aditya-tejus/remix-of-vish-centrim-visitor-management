import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Clock, Shield, UserCheck, LogIn, Trash2, Edit, Download,
  Search, Filter, RefreshCw, FileText, AlertTriangle, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

const ACTION_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  visitor_checked_in: { label: "Visitor Checked In", icon: LogIn, color: "bg-emerald-500/10 text-emerald-600" },
  visitor_checked_out: { label: "Visitor Checked Out", icon: UserCheck, color: "bg-blue-500/10 text-blue-600" },
  visitor_data_edited: { label: "Visitor Data Edited", icon: Edit, color: "bg-amber-500/10 text-amber-600" },
  right_to_erasure_full: { label: "Full Erasure", icon: Trash2, color: "bg-destructive/10 text-destructive" },
  right_to_erasure_partial: { label: "Partial Erasure", icon: Shield, color: "bg-orange-500/10 text-orange-600" },
  right_to_erasure_visit_delete: { label: "Visit Record Deleted", icon: Trash2, color: "bg-destructive/10 text-destructive" },
  visitor_profile_deleted: { label: "Profile Deleted", icon: Trash2, color: "bg-destructive/10 text-destructive" },
  visitor_visit_deleted: { label: "Visit Deleted", icon: Trash2, color: "bg-destructive/10 text-destructive" },
  sar_export: { label: "SAR Export", icon: Download, color: "bg-purple-500/10 text-purple-600" },
  automated_retention_cleanup: { label: "Auto Cleanup", icon: RefreshCw, color: "bg-muted text-muted-foreground" },
  bulk_checkout_overstayed: { label: "Bulk Checkout", icon: AlertTriangle, color: "bg-amber-500/10 text-amber-600" },
};

const DEFAULT_META = { label: "System Action", icon: FileText, color: "bg-muted text-muted-foreground" };

function getActionMeta(action: string) {
  return ACTION_META[action] || DEFAULT_META;
}

export default function AuditLogPage() {
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
      const meta = getActionMeta(log.action);
      return (
        meta.label.toLowerCase().includes(q) ||
        log.performed_by.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        JSON.stringify(log.details || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <AppShell
      title="Audit Log"
      subtitle="GDPR Article 30 — Processing activity records"
      mainClassName="p-6 space-y-4"
      actions={
        <Badge variant="secondary" className="font-mono text-xs">
          {filtered.length} entries
        </Badge>
      }
    >
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, users, details…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((a) => (
                    <SelectItem key={a} value={a}>{getActionMeta(a).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchLogs} title="Refresh" aria-label="Refresh audit log">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Log List */}
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
                    <p className="text-xs mt-1">Try adjusting your search or filter</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map((log) => {
                      const meta = getActionMeta(log.action);
                      const Icon = meta.icon;
                      const isExpanded = expandedId === log.id;
                      const hasDetails = log.details && Object.keys(log.details).length > 0;

                      return (
                        <div key={log.id}>
                          <button
                            className="flex items-center gap-3 px-5 py-3.5 w-full text-left hover:bg-muted/30 transition-colors"
                            onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                          >
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground truncate">{meta.label}</p>
                                {log.records_affected != null && log.records_affected > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                                    {log.records_affected} record{log.records_affected !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                By {log.performed_by}
                                {log.details?.visitor_name && <> · {log.details.visitor_name}</>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right hidden sm:block">
                                <p className="text-xs text-muted-foreground font-mono">
                                  {format(new Date(log.created_at), "HH:mm")}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(log.created_at), "dd MMM yyyy")}
                                </p>
                              </div>
                              <span className="text-[10px] text-muted-foreground sm:hidden">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                              </span>
                              {hasDetails && (
                                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              )}
                            </div>
                          </button>

                          {isExpanded && hasDetails && (
                            <div className="px-5 pb-4 pl-[4.25rem]">
                              <div className="rounded-md bg-muted/40 border border-border p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                                <pre className="whitespace-pre-wrap break-words">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
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
    </AppShell>
  );
}

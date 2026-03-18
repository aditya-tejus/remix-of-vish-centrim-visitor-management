import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, AlertTriangle, XCircle, Loader2, ChevronDown, Info, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type ReqStatus = "implemented" | "not-implemented" | "not-confirmed" | "partial";

interface GdprReqDef {
  id: string;
  name: string;
  defaultStatus: ReqStatus;
  article: string;
  detail: string;
  action: string;
  usedIn: { label: string; path: string }[];
}

const gdprRequirementDefs: GdprReqDef[] = [
  { id: "privacy_notice", name: "Privacy Notice Displayed", defaultStatus: "implemented", article: "Art. 13",
    detail: "A clear privacy notice is shown to every visitor during check-in, explaining what data is collected and why.",
    action: "No action needed — fully implemented.",
    usedIn: [{ label: "Check-In Form (Step 4)", path: "/check-in" }, { label: "Public Check-In", path: "/public-check-in" }] },
  { id: "consent_checkbox", name: "Consent Checkbox", defaultStatus: "implemented", article: "Art. 7",
    detail: "Visitors must actively tick a consent checkbox before submitting their details. Consent is recorded with a timestamp.",
    action: "No action needed — fully implemented.",
    usedIn: [{ label: "Check-In Form (Step 4 — Terms & Privacy)", path: "/check-in" }] },
  { id: "privacy_policy_link", name: "Full Privacy Policy Link", defaultStatus: "implemented", article: "Art. 13(2)",
    detail: "A link to the full privacy policy is accessible from the check-in form privacy notice, pointing to https://app.centrimlife.uk/legal.",
    action: "No action needed — link is live in the Privacy Notice component.",
    usedIn: [{ label: "Check-In Privacy Notice", path: "/check-in" }, { label: "Public Check-In", path: "/public-check-in" }] },
  { id: "data_retention", name: "Configurable Data Retention", defaultStatus: "implemented", article: "Art. 5(1)(e)",
    detail: "Retention periods can be configured (30–180 days). Data is automatically flagged for deletion after the configured period.",
    action: "Configure the period in the Data Retention tab.",
    usedIn: [{ label: "Settings → Data Retention", path: "/settings" }, { label: "Cleanup Edge Function", path: "/settings" }] },
  { id: "data_export_sar", name: "Data Export for Subject Access", defaultStatus: "implemented", article: "Art. 20",
    detail: "Visitor records can be exported in CSV and PDF formats to fulfil Subject Access Requests (SARs).",
    action: "No action needed — use the export buttons on visitor profiles.",
    usedIn: [{ label: "Visitor Profile → Export", path: "/visitors" }, { label: "GDPR → SAR Export", path: "/gdpr" }] },
  { id: "data_correction", name: "Visitor Data Correction", defaultStatus: "implemented", article: "Art. 16",
    detail: "Authorised staff can edit visitor records to correct inaccurate personal data.",
    action: "No action needed — use the edit function on visitor profiles.",
    usedIn: [{ label: "Visitor Profile → Edit", path: "/visitors" }, { label: "Visit List → Edit Dialog", path: "/visit-list" }] },
  { id: "right_to_erasure", name: "Right to Erasure", defaultStatus: "not-confirmed", article: "Art. 17",
    detail: "Individual visitor records can be deleted on request. Verify that deletion removes all associated data.",
    action: "Test the deletion flow and confirm all linked data is removed.",
    usedIn: [{ label: "GDPR → Erasure Toolkit", path: "/gdpr" }, { label: "Visitor Profile → Delete", path: "/visitors" }] },
  { id: "automated_cleanup", name: "Automated Data Cleanup", defaultStatus: "implemented", article: "Art. 5(1)(e)",
    detail: "A daily cron job runs at 2:00 AM to automatically delete visitor records that have exceeded the configured retention period. Stale checked-in records get a 7-day grace period.",
    action: "No action needed — automated cleanup runs daily at 2:00 AM.",
    usedIn: [{ label: "Cleanup Edge Function", path: "/settings" }, { label: "Settings → Data Retention", path: "/settings" }] },
  { id: "audit_trail", name: "Activity Audit Trail", defaultStatus: "not-confirmed", article: "Art. 30",
    detail: "All data access and modifications are logged. Verify logs capture who accessed what and when.",
    action: "Review the Audit Log page and confirm entries are recorded.",
    usedIn: [{ label: "Audit Log Page", path: "/audit-log" }] },
  { id: "encryption_at_rest", name: "Data Encryption at Rest", defaultStatus: "partial", article: "Art. 32",
    detail: "Database storage is encrypted at rest via the cloud provider. Consider app-level encryption for health declarations.",
    action: "Evaluate whether health declaration data needs additional encryption.",
    usedIn: [{ label: "Database Configuration", path: "/settings" }] },
  { id: "rbac", name: "Role-Based Access Control", defaultStatus: "partial", article: "Art. 32",
    detail: "Admin and staff roles are defined. Ensure only authorised personnel can access sensitive visitor data.",
    action: "Audit current role assignments and restrict access as needed.",
    usedIn: [{ label: "User Roles (Database)", path: "/settings" }] },
  { id: "dpa", name: "Data Processing Agreement", defaultStatus: "implemented", article: "Art. 28",
    detail: "Data processing is handled by Centrim Life with infrastructure hosted on AWS. A formal Data Processing Agreement is in place covering all third-party processing of visitor data.",
    action: "No action needed — DPA is established with Centrim Life and AWS.",
    usedIn: [{ label: "Centrim Life Platform", path: "/settings" }] },
  { id: "health_screening", name: "Check-in Compliance Questions", defaultStatus: "implemented", article: "Art. 13/6",
    detail: "Configurable compliance questions are presented during check-in.",
    action: "Manage questions in the Forms tab.",
    usedIn: [{ label: "Check-In Form (Step 3)", path: "/check-in" }, { label: "Settings → Forms", path: "/settings" }] },
  { id: "vaccination_records", name: "Vaccination Records", defaultStatus: "implemented", article: "Art. 9",
    detail: "Configurable vaccination fields capture data during check-in. Fields are managed by admins.",
    action: "Manage vaccination fields in the Forms tab.",
    usedIn: [{ label: "Check-In Form (Step 3)", path: "/check-in" }, { label: "Settings → Forms", path: "/settings" }] },
];

const statusConfig: Record<ReqStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  implemented: { label: "Done", icon: CheckCircle, color: "text-success" },
  "not-implemented": { label: "Missing", icon: XCircle, color: "text-destructive" },
  "not-confirmed": { label: "Verify", icon: AlertTriangle, color: "text-warning" },
  partial: { label: "Partial", icon: AlertTriangle, color: "text-warning" },
};

const statusOptions: { value: ReqStatus; label: string }[] = [
  { value: "implemented", label: "✓ Done" },
  { value: "partial", label: "◐ Partial" },
  { value: "not-confirmed", label: "⚠ Verify" },
  { value: "not-implemented", label: "✗ Missing" },
];



export function ComplianceTab() {
  const [expandedReq, setExpandedReq] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ReqStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("gdpr_requirements")
      .select("id, status")
      .then(({ data }) => {
        if (data) {
          const map: Record<string, ReqStatus> = {};
          data.forEach((r: any) => { map[r.id] = r.status as ReqStatus; });
          setStatuses(map);
        }
        setLoadingStatuses(false);
      });
  }, []);

  const getStatus = (id: string, defaultStatus: ReqStatus): ReqStatus => statuses[id] || defaultStatus;

  const handleStatusChange = async (id: string, newStatus: ReqStatus) => {
    setSavingId(id);
    const prev = statuses[id];
    setStatuses((s) => ({ ...s, [id]: newStatus }));

    const { error } = await supabase
      .from("gdpr_requirements")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    setSavingId(null);
    if (error) {
      setStatuses((s) => ({ ...s, [id]: prev || "not-implemented" }));
      toast({ title: "Error", description: "Failed to update status. Check admin permissions.", variant: "destructive" });
    } else {
      toast({ title: "Status Updated", description: `"${gdprRequirementDefs.find((r) => r.id === id)?.name}" set to ${statusConfig[newStatus].label}.` });
    }
  };

  const requirements = gdprRequirementDefs.map((r) => ({ ...r, status: getStatus(r.id, r.defaultStatus) }));
  const implementedCount = requirements.filter((r) => r.status === "implemented").length;
  const compliancePercent = Math.round((implementedCount / requirements.length) * 100);

  const statusCounts = {
    implemented: requirements.filter((r) => r.status === "implemented").length,
    "not-implemented": requirements.filter((r) => r.status === "not-implemented").length,
    "not-confirmed": requirements.filter((r) => r.status === "not-confirmed").length,
    partial: requirements.filter((r) => r.status === "partial").length,
  };

  return (
    <div className="space-y-6">
      {/* Compliance Score */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Compliance Score</h2>
              <p className="text-xs text-muted-foreground">How ready is your facility for a UK GDPR audit?</p>
            </div>
          </div>
          <span className="text-3xl font-bold text-primary">{loadingStatuses ? "—" : `${compliancePercent}%`}</span>
        </div>
        <Progress value={loadingStatuses ? 0 : compliancePercent} className="h-2" />
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: "Implemented", count: statusCounts.implemented, color: "text-success", bg: "bg-success/10" },
            { label: "Missing", count: statusCounts["not-implemented"], color: "text-destructive", bg: "bg-destructive/10" },
            { label: "Verify", count: statusCounts["not-confirmed"], color: "text-warning", bg: "bg-warning/10" },
            { label: "Partial", count: statusCounts.partial, color: "text-muted-foreground", bg: "bg-muted" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{loadingStatuses ? "—" : s.count}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements List */}
      <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">GDPR Requirements Checklist</h2>
          <p className="text-xs text-muted-foreground">Click to expand details. Use the status dropdown to update each requirement.</p>
        </div>
        <div className="divide-y divide-border">
          {requirements.map((req) => {
            const config = statusConfig[req.status];
            const Icon = config.icon;
            const isExpanded = expandedReq === req.id;
            const isSaving = savingId === req.id;
            return (
              <div key={req.id}>
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{req.name}</p>
                      <p className="text-[11px] text-muted-foreground">{req.article}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={req.status} onValueChange={(v) => handleStatusChange(req.id, v as ReqStatus)}>
                      <SelectTrigger className={`h-7 w-[120px] rounded-lg text-[11px] font-semibold border-0 ${config.color} ${statusConfig[req.status]?.color === "text-success" ? "bg-success/10" : statusConfig[req.status]?.color === "text-destructive" ? "bg-destructive/10" : statusConfig[req.status]?.color === "text-warning" ? "bg-warning/10" : "bg-muted"}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <button onClick={() => setExpandedReq(isExpanded ? null : req.id)}>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 bg-muted/20 border-t border-border/50">
                    <div className="ml-7 space-y-2.5">
                      <p className="text-sm text-muted-foreground leading-relaxed">{req.detail}</p>

                      {req.usedIn.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Where it's used</p>
                          <div className="flex flex-wrap gap-1.5">
                            {req.usedIn.map((loc, i) => (
                              <button
                                key={i}
                                onClick={() => navigate(loc.path)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                              >
                                <ExternalLink className="h-3 w-3 text-primary" />
                                {loc.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {req.usedIn.length === 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <AlertTriangle className="h-3 w-3 text-warning" />
                          Not yet integrated — requires implementation
                        </div>
                      )}

                      <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2.5">
                        <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs font-medium text-foreground">{req.action}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

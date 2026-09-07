import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Upload, FileText, Loader2, ShieldCheck,
} from "lucide-react";
import type { CredentialCheck } from "@/lib/contractorCredentials";
import { uploadContractorDocument, contractorDocumentUrl } from "@/hooks/useContractorPeople";

const STATE_META: Record<
  CredentialCheck["state"],
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  valid: { label: "Valid", className: "border-success/30 bg-success/5", icon: CheckCircle2 },
  expiring: { label: "Expiring soon", className: "border-warning/40 bg-warning/5", icon: AlertTriangle },
  expired: { label: "Expired", className: "border-destructive/40 bg-destructive/5", icon: XCircle },
  missing: { label: "Not on file", className: "border-destructive/40 bg-destructive/5", icon: XCircle },
  pending: { label: "Waiting for staff check", className: "border-warning/40 bg-warning/5", icon: Clock },
};

interface Props {
  checklist: CredentialCheck[];
  /** Individual worker — required before a personal document can be attached */
  personId?: string | null;
  /** Unattended kiosk: no verifying, uploads go to the staff review folder */
  kiosk?: boolean;
  /** Bigger rows and controls for the kiosk */
  large?: boolean;
  onSavePerson?: (typeId: string, fields: { expiry_date?: string | null; document_path?: string | null; reference?: string | null; uploaded_by?: string | null; uploaded_at?: string | null }) => Promise<void>;
  onSaveCompany?: (typeId: string, fields: { expiry_date?: string | null; reference?: string | null }) => Promise<void>;
  onVerify?: (typeId: string, expiry?: string | null) => Promise<void>;
  /** Hide the entry controls and show status only */
  readOnly?: boolean;
}

export function ComplianceChecklist({
  checklist,
  personId,
  kiosk = false,
  large = false,
  onSavePerson,
  onSaveCompany,
  onVerify,
  readOnly = false,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (checklist.length === 0) return null;

  const openDocument = async (path: string) => {
    const url = await contractorDocumentUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast({ title: "Could not open document", variant: "destructive" });
  };

  const handleFile = async (c: CredentialCheck, file: File) => {
    if (!personId) {
      toast({ title: "Add the contractor's name and mobile first", variant: "destructive" });
      return;
    }
    setBusy(c.typeId);
    try {
      const path = await uploadContractorDocument(file, { personId, credentialTypeId: c.typeId, kiosk });
      await onSavePerson?.(c.typeId, {
        document_path: path,
        uploaded_by: kiosk ? "Kiosk (self-upload)" : "Staff",
        uploaded_at: new Date().toISOString(),
      });
      toast({ title: `${c.label} attached`, description: "A staff member will confirm it." });
    } catch {
      toast({ title: "Upload failed", description: "Please try again or ask a staff member.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const saveExpiry = async (c: CredentialCheck, value: string) => {
    setBusy(c.typeId);
    try {
      if (c.scope === "person") await onSavePerson?.(c.typeId, { expiry_date: value || null });
      else await onSaveCompany?.(c.typeId, { expiry_date: value || null });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const text = large ? "text-base" : "text-[13px]";
  const sub = large ? "text-sm" : "text-[11px]";

  return (
    <div className={large ? "space-y-3" : "space-y-2"}>
      {checklist.map((c) => {
        const meta = STATE_META[c.state];
        const Icon = meta.icon;
        const ok = c.state === "valid" || c.state === "expiring";
        const needsAction = !ok;

        return (
          <div key={c.typeId} className={`rounded-xl border-2 ${meta.className} ${large ? "p-4" : "p-3"} space-y-2`}>
            <div className="flex items-start gap-3">
              <Icon className={`${large ? "h-6 w-6" : "h-4 w-4"} shrink-0 mt-0.5 ${
                ok ? "text-success" : c.state === "pending" ? "text-warning" : "text-destructive"
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`${text} font-semibold text-foreground`}>
                  {c.label}
                  {c.blocking && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-destructive">Required</span>
                  )}
                </p>
                <p className={`${sub} text-muted-foreground`}>
                  {c.state === "valid" && c.expiry && `Valid to ${c.expiry}`}
                  {c.state === "expiring" && `Expires in ${c.daysToExpiry} days (${c.expiry})`}
                  {c.state === "expired" && `Expired on ${c.expiry}`}
                  {c.state === "missing" && "Nothing on file"}
                  {c.state === "pending" && "Uploaded — a staff member needs to confirm it"}
                  {` · ${c.scope === "person" ? "held by the person" : "held by the company"}`}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold shrink-0">{meta.label}</Badge>
            </div>

            {c.documentPath && !kiosk && (
              <button
                onClick={() => openDocument(c.documentPath!)}
                className={`${sub} inline-flex items-center gap-1.5 text-primary hover:underline font-medium`}
              >
                <FileText className="h-3.5 w-3.5" /> View document
                {c.uploadedBy ? ` · added by ${c.uploadedBy}` : ""}
              </button>
            )}

            {c.verificationStatus === "verified" && c.verifiedBy && !kiosk && (
              <p className={`${sub} text-muted-foreground flex items-center gap-1.5`}>
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Confirmed by {c.verifiedBy}
                {c.verifiedAt ? ` on ${new Date(c.verifiedAt).toLocaleDateString()}` : ""}
              </p>
            )}

            {!readOnly && needsAction && (
              <div className="space-y-2 pt-1">
                {c.scope === "person" && (
                  <>
                    <input
                      ref={(el) => (fileInputs.current[c.typeId] = el)}
                      type="file"
                      accept="image/*,application/pdf"
                      capture={kiosk ? "environment" : undefined}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(c, f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="secondary"
                      className={`w-full gap-2 rounded-xl ${large ? "h-14 text-base" : "h-10 text-[13px]"}`}
                      disabled={busy === c.typeId}
                      onClick={() => fileInputs.current[c.typeId]?.click()}
                    >
                      {busy === c.typeId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {c.documentPath ? "Attach a newer document" : kiosk ? "Take a photo of it" : "Attach document"}
                    </Button>
                  </>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <Label className={`${sub} text-muted-foreground`}>Expiry date shown on the document</Label>
                    <Input
                      type="date"
                      defaultValue={c.expiry || ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.typeId]: e.target.value }))}
                      onBlur={(e) => e.target.value !== (c.expiry || "") && saveExpiry(c, e.target.value)}
                      className={`rounded-lg ${large ? "h-14 text-base" : "h-9 text-sm"}`}
                    />
                  </div>
                </div>

                {!kiosk && onVerify && (
                  <Button
                    className={`w-full gap-2 rounded-xl ${large ? "h-14 text-base" : "h-10 text-[13px]"}`}
                    disabled={busy === c.typeId || c.scope !== "person"}
                    onClick={async () => {
                      setBusy(c.typeId);
                      try {
                        await onVerify(c.typeId, drafts[c.typeId] ?? c.expiry ?? null);
                        toast({ title: `${c.label} confirmed` });
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <ShieldCheck className="h-4 w-4" /> I have seen it — mark confirmed
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

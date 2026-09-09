import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileCheck2, XCircle, MinusCircle, FileText, Loader2, ChevronDown, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  openContractorDocument, reviewContractorDocument, useDocumentHistory,
  type DocumentDetail,
} from "@/hooks/useContractorDocuments";
import { REASON_CODES, STATUS_TEXT, validateDecision, type DocumentStatus, type ReviewDecision } from "@/lib/contractorDocuments";

interface Props {
  document: DocumentDetail | null;
  onOpenChange: (v: boolean) => void;
  onDecided?: () => void;
}

/** One document, its history, and a decision that must be made explicitly. */
export function DocumentReviewSheet({ document, onOpenChange, onDecided }: Props) {
  const { toast } = useToast();
  const { can } = usePermissions();
  const { versions, reviews } = useDocumentHistory(document);
  const [decision, setDecision] = useState<ReviewDecision | "">("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const canManage = can("contractor.credentials.manage");
  const canView = can("contractor.credentials.view");
  const pending = document?.status === "pending";

  const open = async () => {
    if (!document) return;
    const url = await openContractorDocument(document.id);
    if (url) window.open(url, "_blank", "noopener");
    else toast({ title: "File unavailable", description: "Ask for the document again.", variant: "destructive" });
  };

  const record = async () => {
    if (!document || !decision) return;
    const check = validateDecision({ decision, reasonCode: reason, notes, alreadyDecided: !pending });
    if (!check.ok) {
      toast({ title: check.error!, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await reviewContractorDocument({
        documentId: document.id,
        decision,
        reasonCode: reason || null,
        notes: notes || null,
        confirmedExpiry: expiry || null,
      });
      toast({ title: "Decision recorded" });
      setDecision(""); setReason(""); setNotes(""); setExpiry("");
      onOpenChange(false);
      onDecided?.();
    } catch (e: any) {
      toast({ title: "Could not record the decision", description: e?.message || "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!document} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
        {document && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" /> {document.type_label}
              </SheetTitle>
              <SheetDescription>
                {document.holder_name}
                {document.company_name && document.holder_scope === "person" ? ` · ${document.company_name}` : ""}
                {` · version ${document.version}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border border-border divide-y divide-border text-[13px]">
                {[
                  ["Status", STATUS_TEXT[document.status as DocumentStatus] ?? document.status],
                  ["Held by", document.holder_scope === "person" ? "The person" : "The company"],
                  ["Issued", document.issue_date || "Not recorded"],
                  ["Expires", document.expiry_date || "Not recorded"],
                  ["Reference", document.document_number || "Not recorded"],
                  ["Submitted by", `${document.submitted_by} · ${new Date(document.submitted_at).toLocaleString()}`],
                  ["File", document.file_name || "No file attached"],
                ].map(([k, v]) => (
                  <div key={k} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground text-right">{v}</span>
                  </div>
                ))}
              </div>

              {document.file_name && (
                canView ? (
                  <Button variant="outline" onClick={open} className="w-full">
                    <FileText className="h-4 w-4" aria-hidden="true" /> Open document
                  </Button>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    You do not have permission to open contractor documents.
                  </p>
                )
              )}

              {canManage && pending && (
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Decision</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["approved", "Approve", FileCheck2],
                      ["rejected", "Reject", XCircle],
                      ["not_required", "Not required", MinusCircle],
                    ] as const).map(([value, label, Icon]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={decision === value ? "default" : "outline"}
                        onClick={() => setDecision(value)}
                        className="justify-center"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                      </Button>
                    ))}
                  </div>

                  {decision === "approved" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rev-expiry">Expiry date on the document</Label>
                      <Input id="rev-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                    </div>
                  )}

                  {decision === "rejected" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rev-reason">Reason</Label>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger id="rev-reason"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                        <SelectContent>
                          {REASON_CODES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {decision && (
                    <div className="space-y-1.5">
                      <Label htmlFor="rev-notes">Notes{decision === "rejected" ? " (required if no reason chosen)" : ""}</Label>
                      <Textarea id="rev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                    </div>
                  )}

                  <Button className="w-full" disabled={!decision || busy} onClick={record}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Record decision
                  </Button>
                </div>
              )}

              {canManage && !pending && (
                <p className="text-[13px] text-muted-foreground">
                  This version has already been decided. Submit a new version to replace it.
                </p>
              )}

              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4" aria-hidden="true" /> Version history ({versions.length})
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {versions.map((v) => (
                    <div key={v.id} className="rounded-lg border border-border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium text-foreground">Version {v.version}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {STATUS_TEXT[v.status as DocumentStatus] ?? v.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {v.submitted_by} · {new Date(v.submitted_at).toLocaleString()}
                      </p>
                      {reviews.filter((r) => r.document_id === v.id).map((r) => (
                        <p key={r.id} className="text-[11px] text-muted-foreground">
                          {r.decision === "approved" ? "Approved" : r.decision === "rejected" ? "Rejected" : "Marked not required"}
                          {` by ${r.reviewer_label} on ${new Date(r.created_at).toLocaleString()}`}
                          {r.reason_code ? ` · ${r.reason_code}` : ""}
                          {r.notes ? ` · ${r.notes}` : ""}
                        </p>
                      ))}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

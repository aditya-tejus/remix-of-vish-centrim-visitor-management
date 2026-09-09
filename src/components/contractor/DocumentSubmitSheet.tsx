import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitContractorDocument } from "@/hooks/useContractorDocuments";
import type { CredentialType } from "@/lib/contractorCredentials";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string | null;
  types: CredentialType[];
  personId?: string | null;
  supplierId?: string | null;
  onSubmitted?: () => void;
}

const SOURCES = [
  { value: "upload", label: "Uploaded here" },
  { value: "email", label: "Sent to us" },
  { value: "in_person", label: "Handed in at reception" },
  { value: "portal", label: "Supplied by the company" },
];

/**
 * Records new evidence. It always lands as awaiting review — submitting
 * something never makes it count.
 */
export function DocumentSubmitSheet({
  open, onOpenChange, branchId, types, personId, supplierId, onSubmitted,
}: Props) {
  const { toast } = useToast();
  const [typeId, setTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [reference, setReference] = useState("");
  const [source, setSource] = useState("upload");
  const [busy, setBusy] = useState(false);

  const selected = types.find((t) => t.id === typeId);
  const scope: "person" | "company" = selected?.holder_scope === "person" ? "person" : "company";
  const holderMissing = scope === "person" ? !personId : !supplierId;

  const reset = () => {
    setTypeId(""); setFile(null); setIssue(""); setExpiry(""); setReference(""); setSource("upload");
  };

  const submit = async () => {
    if (!branchId || !selected) return;
    setBusy(true);
    try {
      await submitContractorDocument({
        branchId,
        credentialTypeId: selected.id,
        credentialKey: selected.key,
        holderScope: scope,
        personId: scope === "person" ? personId : null,
        supplierId: scope === "company" ? supplierId : null,
        file,
        issueDate: issue || null,
        expiryDate: expiry || null,
        documentNumber: reference || null,
        source,
      });
      toast({ title: "Sent for review", description: `${selected.label} is awaiting a reviewer's decision.` });
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      toast({ title: "Could not send for review", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileClock className="h-5 w-5 text-primary" aria-hidden="true" /> Add a compliance document
          </SheetTitle>
          <SheetDescription>
            It is recorded as awaiting review. A reviewer decides whether it counts.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Document type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger id="doc-type"><SelectValue placeholder="Choose a document" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label} — {t.holder_scope === "person" ? "the person" : "the company"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {holderMissing && selected && (
            <p className="text-[13px] text-destructive">
              {scope === "person"
                ? "No contractor record is linked, so a personal document cannot be attached."
                : "No company is linked, so a company document cannot be attached."}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="doc-file">File</Label>
            <Input id="doc-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="text-[11px] text-muted-foreground">
              Stored privately. It can only be opened through a link that expires within two minutes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-issue">Issued</Label>
              <Input id="doc-issue" type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-expiry">Expires</Label>
              <Input id="doc-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-ref">Reference number</Label>
            <Input id="doc-ref" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Certificate or licence number" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-source">Where it came from</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="doc-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={!typeId || holderMissing || busy || !branchId} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            Send for review
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

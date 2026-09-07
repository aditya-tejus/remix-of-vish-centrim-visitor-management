import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useVisitors } from "@/hooks/useVisitors";
import { useStaffMembers } from "@/hooks/useStaffMembers";
import { useResidents } from "@/hooks/useResidents";
import type { PropertyKey } from "@/hooks/useKeys";
import { format } from "date-fns";

export interface IssuePrefill {
  name: string;
  type: string;
  visitorId?: string | null;
}

interface Props {
  keyRecord: PropertyKey | null;
  onClose: () => void;
  prefill?: IssuePrefill | null;
  onIssue: (input: {
    keyId: string;
    issuedToName: string;
    issuedToType: string;
    visitorId?: string | null;
    issuedToStaffId?: string | null;
    expectedReturn?: Date | null;
    issuedBy?: string | null;
    notes?: string | null;
  }) => Promise<any>;
}

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

export function IssueKeySheet({ keyRecord, onClose, prefill, onIssue }: Props) {
  const { toast } = useToast();
  const { visitors } = useVisitors();
  const { staff } = useStaffMembers();
  const { residents } = useResidents();

  // person value encodes source: visit:<id> | staff:<id> | resident:<visitorId> | manual
  const [person, setPerson] = useState("manual");
  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState("contractor");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const onSite = visitors.filter((v) => v.status === "checked-in" && v.type !== "resident");

  useEffect(() => {
    if (!keyRecord) return;
    if (prefill) {
      const match = prefill.visitorId ? onSite.find((v) => v.id === prefill.visitorId) : null;
      setPerson(match ? `visit:${match.id}` : "manual");
      setManualName(prefill.name);
      setManualType(prefill.type || "visitor");
    } else {
      setPerson("manual");
      setManualName("");
      setManualType("contractor");
    }
    setExpectedReturn("");
    setIssuedBy("");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyRecord?.id]);

  const quickDue = (kind: "2h" | "eod" | "tomorrow") => {
    const d = new Date();
    if (kind === "2h") d.setHours(d.getHours() + 2);
    if (kind === "eod") d.setHours(17, 0, 0, 0);
    if (kind === "tomorrow") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    setExpectedReturn(toLocalInput(d));
  };

  const resolveHolder = () => {
    if (person.startsWith("visit:")) {
      const v = onSite.find((x) => x.id === person.slice(6));
      if (v) return { name: `${v.firstName} ${v.surname}`, type: v.type, visitorId: v.id, staffId: null as string | null };
    }
    if (person.startsWith("staff:")) {
      const s = staff.find((x) => x.id === person.slice(6));
      if (s) return { name: s.name, type: "staff", visitorId: null, staffId: s.id };
    }
    if (person.startsWith("resident:")) {
      const r = residents.find((x) => x.visitorId === person.slice(9));
      if (r) return { name: r.name, type: "resident", visitorId: r.visitorId, staffId: null };
    }
    return { name: manualName.trim(), type: manualType, visitorId: null, staffId: null };
  };

  const submit = async () => {
    if (!keyRecord) return;
    const holder = resolveHolder();
    if (!holder.name) {
      toast({ title: "Who is taking the key?", variant: "destructive" });
      return;
    }
    setSaving(true);
    const error = await onIssue({
      keyId: keyRecord.id,
      issuedToName: holder.name,
      issuedToType: holder.type,
      visitorId: holder.visitorId,
      issuedToStaffId: holder.staffId,
      expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
      issuedBy: issuedBy.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not issue the key", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${keyRecord.keyLabel} issued to ${holder.name}` });
    onClose();
  };

  return (
    <Sheet open={!!keyRecord} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[50vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Issue {keyRecord?.keyLabel}</SheetTitle>
          <SheetDescription>
            {keyRecord?.propertyLabel}
            {keyRecord?.copyNumber ? ` · copy ${keyRecord.copyNumber}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label>Who is taking the key?</Label>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger><SelectValue placeholder="Pick a person" /></SelectTrigger>
              <SelectContent>
                {onSite.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>On site right now</SelectLabel>
                    {onSite.map((v) => (
                      <SelectItem key={v.id} value={`visit:${v.id}`}>
                        {v.firstName} {v.surname} · {v.type}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel>Staff</SelectLabel>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={`staff:${s.id}`}>
                      {s.name}{s.role ? ` · ${s.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Residents</SelectLabel>
                  {residents.map((r) => (
                    <SelectItem key={r.visitorId} value={`resident:${r.visitorId}`}>
                      {r.name}{r.room ? ` · ${r.room}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Not on the lists</SelectLabel>
                  <SelectItem value="manual">Type a name…</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {person === "manual" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Name of the person" />
                <Select value={manualType} onValueChange={setManualType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="staff">Staff member</SelectItem>
                    <SelectItem value="resident">Resident</SelectItem>
                    <SelectItem value="family">Family member</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {person.startsWith("visit:")
                ? "This handover will be linked to their visit record."
                : "Staff and off-log holders are tracked here only — nothing is added to the visit log."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Expected back</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" className="border border-border" onClick={() => quickDue("2h")}>In 2 hours</Button>
              <Button type="button" size="sm" variant="secondary" className="border border-border" onClick={() => quickDue("eod")}>End of day</Button>
              <Button type="button" size="sm" variant="secondary" className="border border-border" onClick={() => quickDue("tomorrow")}>Tomorrow</Button>
            </div>
            <Input type="datetime-local" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Issued by</Label>
            <Input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Staff member handing it over" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reason, job reference…" />
          </div>

          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Issuing…" : "Issue key"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useState, useEffect } from "react";
import { Visitor } from "@/types/visitor";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { z } from "zod";

const visitorSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  surname: z.string().trim().min(1, "Surname is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  mobile: z.string().trim().min(1, "Mobile is required").max(50),
  type: z.enum(["visitor", "resident", "contractor", "staff"]),
  address: z.string().max(500).optional(),
  whomToVisit: z.string().max(200).optional(),
  comments: z.string().max(1000).optional(),
});

interface EditVisitorDialogProps {
  visitor: Visitor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditVisitorDialog({ visitor, open, onOpenChange, onSaved }: EditVisitorDialogProps) {
  const isAdmin = true;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    firstName: "", surname: "", email: "", mobile: "",
    type: "visitor" as string, address: "", whomToVisit: "", comments: "",
  });

  useEffect(() => {
    if (visitor && open) {
      setForm({
        firstName: visitor.firstName,
        surname: visitor.surname,
        email: visitor.email,
        mobile: visitor.mobile,
        type: visitor.type,
        address: visitor.address || "",
        whomToVisit: visitor.whomToVisit || "",
        comments: visitor.comments || "",
      });
      setErrors({});
    }
  }, [visitor, open]);

  if (!visitor) return null;

  const getChanges = () => {
    const changes: { field: string; before: string; after: string }[] = [];
    const fieldMap: Record<string, string> = {
      firstName: "First Name", surname: "Surname", email: "Email",
      mobile: "Mobile", type: "Type", address: "Address",
      whomToVisit: "Visiting", comments: "Comments",
    };
    for (const [key, label] of Object.entries(fieldMap)) {
      const before = (visitor as any)[key] ?? "";
      const after = (form as any)[key] ?? "";
      if (String(before) !== String(after)) {
        changes.push({ field: label, before: String(before), after: String(after) });
      }
    }
    return changes;
  };

  const handleSave = async () => {
    const result = visitorSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        fieldErrors[e.path[0] as string] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const changes = getChanges();
    if (changes.length === 0) {
      toast({ title: "No changes", description: "No fields were modified." });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("visitors")
      .update({
        first_name: form.firstName,
        surname: form.surname,
        email: form.email,
        mobile: form.mobile,
        type: form.type,
        address: form.address,
        whom_to_visit: form.whomToVisit,
        comments: form.comments,
      })
      .eq("id", visitor.id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Log the change to audit_log
    await supabase.from("audit_log").insert({
      action: "visitor_data_edited",
      details: {
        visitor_id: visitor.id,
        visitor_name: `${visitor.firstName} ${visitor.surname}`,
        changes,
      },
      records_affected: 1,
      performed_by: "system",
      user_id: null,
    });

    toast({ title: "Visitor updated", description: `${changes.length} field(s) changed successfully.` });
    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  const changes = getChanges();
  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Visitor</DialogTitle>
          <DialogDescription>
            Update visitor information. Changes are tracked for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
              {errors.firstName && <p className="text-[11px] text-destructive">{errors.firstName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Surname *</Label>
              <Input value={form.surname} onChange={(e) => update("surname", e.target.value)} />
              {errors.surname && <p className="text-[11px] text-destructive">{errors.surname}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mobile *</Label>
            <Input type="tel" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
            {errors.mobile && <p className="text-[11px] text-destructive">{errors.mobile}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => update("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visitor">Visitor</SelectItem>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Visiting</Label>
            <Input value={form.whomToVisit} onChange={(e) => update("whomToVisit", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Comments</Label>
            <Textarea value={form.comments} onChange={(e) => update("comments", e.target.value)} rows={2} />
          </div>

          {/* Change Preview */}
          {changes.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {changes.length} change{changes.length !== 1 ? "s" : ""} detected
              </div>
              <div className="space-y-1.5">
                {changes.map((c) => (
                  <div key={c.field} className="text-[11px]">
                    <span className="font-semibold text-foreground">{c.field}:</span>{" "}
                    <span className="text-destructive line-through">{c.before || "—"}</span>{" → "}
                    <span className="text-success font-medium">{c.after || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || changes.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

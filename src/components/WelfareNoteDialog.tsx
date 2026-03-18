import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WelfareNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  residentName: string;
}

const categories = [
  "Social Isolation Concern",
  "Family Contact Required",
  "Activity Recommendation",
  "Wellbeing Check",
  "General Observation",
];

export function WelfareNoteDialog({ open, onOpenChange, residentName }: WelfareNoteDialogProps) {
  const [note, setNote] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);

    // Log welfare note to audit log
    await supabase.from("audit_log").insert({
      action: "welfare_note_added",
      performed_by: "staff",
      details: {
        resident_name: residentName,
        category,
        note: note.trim(),
      },
      records_affected: 1,
    });

    setSaving(false);
    setNote("");
    setCategory(categories[0]);
    onOpenChange(false);
    toast({
      title: "Welfare Note Saved",
      description: `Note recorded for ${residentName}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNote(""); setCategory(categories[0]); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Add Welfare Note
          </DialogTitle>
          <DialogDescription>
            Record a welfare observation for <span className="font-semibold text-foreground">{residentName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-sm">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe your observation or concern..."
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !note.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

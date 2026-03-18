import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useCompanionFields, useFormFieldMutations, FormField } from "@/hooks/useFormFields";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, Pencil, Save, X, Users, Plus, Trash2 } from "lucide-react";
import type { VisitorType } from "@/hooks/useHealthQuestions";

interface Props {
  visitorType: VisitorType;
}

export function CompanionFieldsManager({ visitorType }: Props) {
  const { data: fields = [], isLoading } = useCompanionFields(visitorType);
  const { update, create, remove } = useFormFieldMutations();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");

  const startEdit = (f: FormField) => { setEditingId(f.id); setEditLabel(f.label); };

  const saveLabel = async (f: FormField) => {
    if (!editLabel.trim()) return;
    try {
      await update.mutateAsync({ id: f.id, label: editLabel.trim() });
      toast({ title: "Field label updated" });
      setEditingId(null);
    } catch {
      toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
    }
  };

  const toggleRequired = async (f: FormField) => {
    try { await update.mutateAsync({ id: f.id, required: !f.required }); } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const toggleActive = async (f: FormField) => {
    try { await update.mutateAsync({ id: f.id, is_active: !f.is_active }); } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const moveField = async (f: FormField, direction: "up" | "down") => {
    const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === f.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    try {
      await Promise.all([
        update.mutateAsync({ id: sorted[idx].id, sort_order: sorted[swapIdx].sort_order }),
        update.mutateAsync({ id: sorted[swapIdx].id, sort_order: sorted[idx].sort_order }),
      ]);
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const handleAddField = async () => {
    if (!newLabel.trim() || !newFieldKey.trim()) {
      toast({ title: "Please fill in both label and field key", variant: "destructive" });
      return;
    }
    const key = "companion_" + newFieldKey.trim().toLowerCase().replace(/\s+/g, "_");
    const maxOrder = fields.reduce((max, f) => Math.max(max, f.sort_order), 99);
    try {
      await create.mutateAsync({
        label: newLabel.trim(), field_key: key, field_type: "text",
        required: false, sort_order: maxOrder + 1, is_active: true, visitor_type: visitorType,
      });
      toast({ title: "Companion field added" });
      setNewLabel(""); setNewFieldKey(""); setShowAddForm(false);
    } catch { toast({ title: "Error", description: "Failed to add field.", variant: "destructive" }); }
  };

  const handleDelete = async (f: FormField) => {
    try { await remove.mutateAsync(f.id); toast({ title: "Field removed" }); } catch { toast({ title: "Error", variant: "destructive" }); }
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading fields...</div>;

  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const defaultKeys = ["companion_name", "companion_phone", "companion_email", "companion_relation"];

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Companion Fields</h2>
            <p className="text-xs text-muted-foreground">
              Configure data collected for additional people with <span className="font-medium text-foreground capitalize">{visitorType}s</span>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-3.5 w-3.5" /> Add Field
        </Button>
      </div>

      {showAddForm && (
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. ID Number" className="h-8 text-sm" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Field Key</label>
            <Input value={newFieldKey} onChange={(e) => setNewFieldKey(e.target.value)} placeholder="e.g. id_number" className="h-8 text-sm" />
          </div>
          <Button size="sm" onClick={handleAddField} disabled={create.isPending}>{create.isPending ? "Adding..." : "Add"}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowAddForm(false); setNewLabel(""); setNewFieldKey(""); }}>Cancel</Button>
        </div>
      )}

      <div className="divide-y divide-border">
        {sorted.map((f, idx) => (
          <div key={f.id} className="px-5 py-3 flex items-center gap-3">
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveField(f, "up")}><ArrowUp className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === sorted.length - 1} onClick={() => moveField(f, "down")}><ArrowDown className="h-3 w-3" /></Button>
            </div>
            <div className="flex-1 min-w-0">
              {editingId === f.id ? (
                <div className="flex items-center gap-2">
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") saveLabel(f); if (e.key === "Escape") setEditingId(null); }} autoFocus />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveLabel(f)}><Save className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${f.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>{f.label}</p>
                  <Badge variant="outline" className="text-[10px]">{f.field_key}</Badge>
                  {f.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(f)}><Pencil className="h-3 w-3" /></Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Required</span>
                <Switch checked={f.required} onCheckedChange={() => toggleRequired(f)} className="scale-75" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Active</span>
                <Switch checked={f.is_active} onCheckedChange={() => toggleActive(f)} className="scale-75" />
              </div>
              {!defaultKeys.includes(f.field_key) && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(f)}><Trash2 className="h-3.5 w-3.5" /></Button>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No companion fields configured.</div>
        )}
      </div>
    </div>
  );
}

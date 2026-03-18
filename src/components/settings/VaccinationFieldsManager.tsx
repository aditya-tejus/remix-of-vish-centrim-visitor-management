import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useVaccinationFields, useVaccinationFieldMutations, VaccinationField, VisitorType } from "@/hooks/useHealthQuestions";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, Syringe, Eye, EyeOff, X } from "lucide-react";

const fieldTypes = [
  { value: "date", label: "Date" },
  { value: "text", label: "Text" },
  { value: "select", label: "Dropdown" },
  { value: "file", label: "File Upload" },
];

interface EditState {
  name: string;
  label: string;
  field_type: VaccinationField["field_type"];
  required: boolean;
  options: string[];
  optionInput: string;
}

const emptyEdit: EditState = { name: "", label: "", field_type: "date", required: false, options: [], optionInput: "" };

interface Props {
  visitorType: VisitorType;
}

export function VaccinationFieldsManager({ visitorType }: Props) {
  const { data: fields = [], isLoading } = useVaccinationFields(visitorType);
  const { add, update, remove } = useVaccinationFieldMutations();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<EditState>(emptyEdit);

  const startEdit = (f: VaccinationField) => {
    setEditingId(f.id); setAdding(false);
    setEdit({ name: f.name, label: f.label, field_type: f.field_type, required: f.required, options: f.options || [], optionInput: "" });
  };
  const startAdd = () => { setAdding(true); setEditingId(null); setEdit(emptyEdit); };
  const cancel = () => { setEditingId(null); setAdding(false); setEdit(emptyEdit); };

  const handleSave = async () => {
    if (!edit.label.trim() || !edit.name.trim()) return;
    try {
      if (adding) {
        const maxOrder = fields.reduce((m, f) => Math.max(m, f.sort_order), 0);
        await add.mutateAsync({ name: edit.name, label: edit.label, field_type: edit.field_type, required: edit.required, options: edit.options, sort_order: maxOrder + 1, visitor_type: visitorType });
        toast({ title: "Field added" });
      } else if (editingId) {
        await update.mutateAsync({ id: editingId, name: edit.name, label: edit.label, field_type: edit.field_type, required: edit.required, options: edit.options });
        toast({ title: "Field updated" });
      }
      cancel();
    } catch {
      toast({ title: "Error", description: "Failed to save. Check admin permissions.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try { await remove.mutateAsync(id); toast({ title: "Field deleted" }); }
    catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const toggleActive = async (f: VaccinationField) => {
    try { await update.mutateAsync({ id: f.id, is_active: !f.is_active }); }
    catch { toast({ title: "Error", variant: "destructive" }); }
  };

  const renderForm = () => (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Field Name (key) <span className="text-destructive">*</span></Label>
          <Input value={edit.name} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value.replace(/\s/g, "_").toLowerCase() }))} placeholder="e.g. flu_vaccine" className="rounded-lg h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Display Label <span className="text-destructive">*</span></Label>
          <Input value={edit.label} onChange={(e) => setEdit((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Flu Vaccine Date" className="rounded-lg h-9 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Field Type</Label>
          <Select value={edit.field_type} onValueChange={(v) => setEdit((p) => ({ ...p, field_type: v as any }))}>
            <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {fieldTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-1">
          <div className="flex items-center gap-2">
            <Checkbox checked={edit.required} onCheckedChange={(c) => setEdit((p) => ({ ...p, required: c === true }))} />
            <span className="text-xs text-foreground">Required</span>
          </div>
        </div>
      </div>
      {edit.field_type === "select" && (
        <div className="space-y-2">
          <Label className="text-xs">Dropdown Options</Label>
          <div className="flex gap-2">
            <Input value={edit.optionInput} onChange={(e) => setEdit((p) => ({ ...p, optionInput: e.target.value }))} placeholder="Add option..." className="rounded-lg h-8 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (edit.optionInput.trim()) setEdit((p) => ({ ...p, options: [...p.options, p.optionInput.trim()], optionInput: "" })); } }} />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { if (edit.optionInput.trim()) setEdit((p) => ({ ...p, options: [...p.options, p.optionInput.trim()], optionInput: "" })); }}>Add</Button>
          </div>
          {edit.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {edit.options.map((o, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[11px]">{o}<button onClick={() => setEdit((p) => ({ ...p, options: p.options.filter((_, j) => j !== i) }))}><X className="h-3 w-3" /></button></Badge>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="gap-1 text-xs" onClick={handleSave} disabled={!edit.label.trim() || !edit.name.trim()}>
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading fields...</div>;

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Syringe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Vaccination Fields</h2>
            <p className="text-xs text-muted-foreground">Vaccination records for <span className="font-medium text-foreground capitalize">{visitorType}s</span> during check-in</p>
          </div>
        </div>
        <Button size="sm" className="gap-1 text-xs" onClick={startAdd} disabled={adding}>
          <Plus className="h-3.5 w-3.5" /> Add Field
        </Button>
      </div>

      <div className="divide-y divide-border">
        {adding && <div className="px-5 py-3">{renderForm()}</div>}
        {fields.map((f) => (
          <div key={f.id} className="px-5 py-3">
            {editingId === f.id ? renderForm() : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${f.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>{f.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{fieldTypes.find((t) => t.value === f.field_type)?.label}</Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{f.name}</span>
                    {f.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(f)}>
                    {f.is_active ? <Eye className="h-3.5 w-3.5 text-success" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(f)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {fields.length === 0 && !adding && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No vaccination fields configured for this type.</div>
        )}
      </div>
    </div>
  );
}

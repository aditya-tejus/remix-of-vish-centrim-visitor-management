import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useFormFields, useFormFieldMutations, FormField } from "@/hooks/useFormFields";
import { useToast } from "@/hooks/use-toast";
import {
  GripVertical, Pencil, Save, X, Plus, Trash2,
  User, AtSign, Phone, MapPin, Building2, Briefcase,
  Hash, FileText, Calendar, Tag, ClipboardList, Camera, PenLine, UserCheck,
  CreditCard, Receipt, CircleDollarSign, type LucideIcon,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { VisitorType } from "@/hooks/useHealthQuestions";

/** Map field keys to semantically meaningful icons */
const FIELD_ICON_MAP: Record<string, LucideIcon> = {
  first_name: User,
  surname: User,
  email: AtSign,
  mobile: Phone,
  address: MapPin,
  company_name: Building2,
  company: Building2,
  organisation: Building2,
  organization: Building2,
  department: Briefcase,
  job_title: Briefcase,
  role: Briefcase,
  id_number: Hash,
  reference: Hash,
  badge_number: Hash,
  notes: FileText,
  comments: FileText,
  date_of_birth: Calendar,
  dob: Calendar,
  category: Tag,
  purpose: ClipboardList,
  reason: ClipboardList,
  photo_capture: Camera,
  signature_capture: PenLine,
  responsible_staff: UserCheck,
  payment_amount: CircleDollarSign,
  payment_method: CreditCard,
  payment_status: Tag,
  receipt_number: Receipt,
  payment_date: Calendar,
};

function getFieldIcon(fieldKey: string): LucideIcon {
  if (FIELD_ICON_MAP[fieldKey]) return FIELD_ICON_MAP[fieldKey];
  // Check partial matches
  for (const [key, icon] of Object.entries(FIELD_ICON_MAP)) {
    if (fieldKey.includes(key)) return icon;
  }
  return FileText;
}

interface Props {
  visitorType: VisitorType;
}

export function FormFieldsManager({ visitorType }: Props) {
  const { data: fields = [], isLoading } = useFormFields(visitorType, "");
  const { update, create, remove } = useFormFieldMutations();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");

  const startEdit = (f: FormField) => {
    setEditingId(f.id);
    setEditLabel(f.label);
  };

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
    try {
      await update.mutateAsync({ id: f.id, required: !f.required });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const toggleActive = async (f: FormField) => {
    try {
      await update.mutateAsync({ id: f.id, is_active: !f.is_active });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(groupedFields);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    try {
      await Promise.all(
        reordered.map((f, i) => update.mutateAsync({ id: f.id, sort_order: i }))
      );
    } catch {
      toast({ title: "Error reordering", variant: "destructive" });
    }
  };

  const handleAddField = async () => {
    if (!newLabel.trim() || !newFieldKey.trim()) {
      toast({ title: "Please fill in both label and field key", variant: "destructive" });
      return;
    }
    const key = newFieldKey.trim().toLowerCase().replace(/\s+/g, "_");
    const maxOrder = fields.reduce((max, f) => Math.max(max, f.sort_order), 0);
    try {
      await create.mutateAsync({
        label: newLabel.trim(),
        field_key: key,
        field_type: "text",
        required: false,
        sort_order: maxOrder + 1,
        is_active: true,
        visitor_type: visitorType,
      });
      toast({ title: "Custom field added" });
      setNewLabel("");
      setNewFieldKey("");
      setShowAddForm(false);
    } catch {
      toast({ title: "Error", description: "Failed to add field.", variant: "destructive" });
    }
  };

  const handleDelete = async (f: FormField) => {
    try {
      await remove.mutateAsync(f.id);
      toast({ title: "Field removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove field.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading fields...</div>;

  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const defaultKeys = ["first_name", "surname", "email", "mobile"];

  // Group fields: identity first, then contact, then custom
  const identityKeys = ["first_name", "surname"];
  const contactKeys = ["email", "mobile", "address"];
  const identityFields = sorted.filter((f) => identityKeys.includes(f.field_key));
  const contactFields = sorted.filter((f) => contactKeys.includes(f.field_key));
  const customFields = sorted.filter((f) => !identityKeys.includes(f.field_key) && !contactKeys.includes(f.field_key));
  const groupedFields = [...identityFields, ...contactFields, ...customFields];

  const renderField = (f: FormField, idx: number) => {
    const Icon = getFieldIcon(f.field_key);
    const isDefault = defaultKeys.includes(f.field_key);

    return (
      <Draggable key={f.id} draggableId={f.id} index={idx}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`px-4 py-3 flex items-center gap-3 transition-colors ${
              !f.is_active ? "opacity-60" : ""
            } ${snapshot.isDragging ? "bg-muted shadow-md rounded-lg" : ""}`}
          >
            <div
              {...provided.dragHandleProps}
              className="shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/60 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40" />
            </div>

            <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              {editingId === f.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveLabel(f);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => saveLabel(f)}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${f.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {f.label}
                  </p>
                  <Badge variant="outline" className="text-[10px] font-mono">{f.field_key}</Badge>
                  {f.required && (
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold">
                      Required
                    </Badge>
                  )}
                  {isDefault && (
                    <Badge variant="secondary" className="text-[10px]">Core</Badge>
                  )}
                  <button
                    onClick={() => startEdit(f)}
                    className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit label"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Required</span>
                <Switch checked={f.required} onCheckedChange={() => toggleRequired(f)} className="scale-75" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">Active</span>
                <Switch checked={f.is_active} onCheckedChange={() => toggleActive(f)} className="scale-75" />
              </div>
              {!isDefault && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(f)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Fields Collection</h2>
            <p className="text-xs text-muted-foreground">
              Customize check-in form fields for{" "}
              <span className="font-medium text-foreground capitalize">{visitorType}s</span>
              <span className="text-muted-foreground/60"> · {sorted.filter((f) => f.is_active).length} active</span>
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-3.5 w-3.5" />
          Add Field
        </Button>
      </div>

      {/* Add new field form */}
      {showAddForm && (
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Company Name"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Field Key</label>
            <Input
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              placeholder="e.g. company_name"
              className="h-9 text-sm font-mono"
            />
          </div>
          <Button size="sm" onClick={handleAddField} disabled={create.isPending} className="h-9">
            {create.isPending ? "Adding..." : "Add"}
          </Button>
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setShowAddForm(false); setNewLabel(""); setNewFieldKey(""); }}>
            Cancel
          </Button>
        </div>
      )}

      {/* Field list with drag-and-drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="fields-list">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="divide-y divide-border">
              {groupedFields.map((f, idx) => renderField(f, idx))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {sorted.length === 0 && (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">
          No fields configured. Click "Add Field" to get started.
        </div>
      )}
    </div>
  );
}

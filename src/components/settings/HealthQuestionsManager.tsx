import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useHealthQuestions, useHealthQuestionMutations, HealthQuestion, VisitorType } from "@/hooks/useHealthQuestions";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, X, Save, Shield, Eye, EyeOff } from "lucide-react";

const questionTypes = [
  { value: "yesno", label: "Yes / No" },
  { value: "text", label: "Text Input" },
  { value: "textarea", label: "Text Area" },
  { value: "select", label: "Dropdown Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "File Upload" },
];

interface EditState {
  question: string;
  type: HealthQuestion["type"];
  required: boolean;
  placeholder: string;
  options: string[];
  optionInput: string;
}

const emptyEdit: EditState = { question: "", type: "yesno", required: false, placeholder: "", options: [], optionInput: "" };

interface Props {
  visitorType: VisitorType;
}

export function HealthQuestionsManager({ visitorType }: Props) {
  const { data: questions = [], isLoading } = useHealthQuestions(visitorType);
  const { add, update, remove } = useHealthQuestionMutations();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<EditState>(emptyEdit);

  const startEdit = (q: HealthQuestion) => {
    setEditingId(q.id);
    setAdding(false);
    setEdit({ question: q.question, type: q.type, required: q.required, placeholder: q.placeholder || "", options: q.options || [], optionInput: "" });
  };

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setEdit(emptyEdit);
  };

  const cancel = () => { setEditingId(null); setAdding(false); setEdit(emptyEdit); };

  const handleSave = async () => {
    if (!edit.question.trim()) return;
    try {
      if (adding) {
        const maxOrder = questions.reduce((m, q) => Math.max(m, q.sort_order), 0);
        await add.mutateAsync({ question: edit.question, type: edit.type, required: edit.required, placeholder: edit.placeholder || null, options: edit.options, sort_order: maxOrder + 1, visitor_type: visitorType });
        toast({ title: "Question added" });
      } else if (editingId) {
        await update.mutateAsync({ id: editingId, question: edit.question, type: edit.type, required: edit.required, placeholder: edit.placeholder || null, options: edit.options });
        toast({ title: "Question updated" });
      }
      cancel();
    } catch {
      toast({ title: "Error", description: "Failed to save. Check admin permissions.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast({ title: "Question deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    }
  };

  const toggleActive = async (q: HealthQuestion) => {
    try {
      await update.mutateAsync({ id: q.id, is_active: !q.is_active });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const addOption = () => {
    if (edit.optionInput.trim()) {
      setEdit((p) => ({ ...p, options: [...p.options, p.optionInput.trim()], optionInput: "" }));
    }
  };

  const removeOption = (idx: number) => {
    setEdit((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }));
  };

  const renderForm = () => (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Question Text <span className="text-destructive">*</span></Label>
        <Input value={edit.question} onChange={(e) => setEdit((p) => ({ ...p, question: e.target.value }))} placeholder="Enter question..." className="rounded-lg h-9 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Answer Type</Label>
          <Select value={edit.type} onValueChange={(v) => setEdit((p) => ({ ...p, type: v as any }))}>
            <SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {questionTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Placeholder</Label>
          <Input value={edit.placeholder} onChange={(e) => setEdit((p) => ({ ...p, placeholder: e.target.value }))} placeholder="Optional..." className="rounded-lg h-9 text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={edit.required} onCheckedChange={(c) => setEdit((p) => ({ ...p, required: c === true }))} />
        <span className="text-xs text-foreground">Required</span>
      </div>
      {edit.type === "select" && (
        <div className="space-y-2">
          <Label className="text-xs">Dropdown Options</Label>
          <div className="flex gap-2">
            <Input value={edit.optionInput} onChange={(e) => setEdit((p) => ({ ...p, optionInput: e.target.value }))} placeholder="Add option..." className="rounded-lg h-8 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addOption}>Add</Button>
          </div>
          {edit.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {edit.options.map((o, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[11px]">
                  {o}
                  <button onClick={() => removeOption(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="gap-1 text-xs" onClick={handleSave} disabled={!edit.question.trim()}>
          <Save className="h-3 w-3" /> Save
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={cancel}>Cancel</Button>
      </div>
    </div>
  );

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading questions...</div>;

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
             <h2 className="font-semibold text-foreground">Check-in Compliance Questions</h2>
            <p className="text-xs text-muted-foreground">Questions for <span className="font-medium text-foreground capitalize">{visitorType}s</span> during check-in</p>
          </div>
        </div>
        <Button size="sm" className="gap-1 text-xs" onClick={startAdd} disabled={adding}>
          <Plus className="h-3.5 w-3.5" /> Add Question
        </Button>
      </div>

      <div className="divide-y divide-border">
        {adding && <div className="px-5 py-3">{renderForm()}</div>}
        {questions.map((q) => (
          <div key={q.id} className="px-5 py-3">
            {editingId === q.id ? renderForm() : (
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${q.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>{q.question}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{questionTypes.find((t) => t.value === q.type)?.label}</Badge>
                    {q.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                    {!q.is_active && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(q)} title={q.is_active ? "Disable" : "Enable"}>
                    {q.is_active ? <Eye className="h-3.5 w-3.5 text-success" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(q)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {questions.length === 0 && !adding && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No questions configured for this type. Click "Add Question" to create one.</div>
        )}
      </div>
    </div>
  );
}

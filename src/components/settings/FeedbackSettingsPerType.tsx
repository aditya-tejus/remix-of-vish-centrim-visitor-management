import { useState } from "react";
import { useFeedbackQuestions, useFeedbackMutations, FeedbackQuestion } from "@/hooks/useFeedback";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Save, X, GripVertical } from "lucide-react";

interface Props {
  personType: string;
}

const categories = ["general", "facilities", "staff", "food", "safety", "other"];

export function FeedbackSettingsPerType({ personType }: Props) {
  const { toast } = useToast();
  const { data: questions = [] } = useFeedbackQuestions(false, personType);
  const { addQuestion, updateQuestion, deleteQuestion } = useFeedbackMutations();
  const [newQ, setNewQ] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  const handleAdd = async () => {
    if (!newQ.trim()) return;
    try {
      await addQuestion.mutateAsync({ question: newQ.trim(), category: newCategory, visitor_type: personType });
      setNewQ("");
      setNewCategory("general");
      toast({ title: "Question added" });
    } catch {
      toast({ title: "Error adding question", variant: "destructive" });
    }
  };

  const handleSaveEdit = async (q: FeedbackQuestion) => {
    if (!editText.trim()) return;
    try {
      await updateQuestion.mutateAsync({ id: q.id, question: editText.trim(), category: editCategory });
      setEditingId(null);
      toast({ title: "Question updated" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Add new */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New Question</label>
          <Input
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            placeholder="e.g. How would you rate the cleanliness?"
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
        </div>
        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleAdd} disabled={addQuestion.isPending} className="gap-1 h-8">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {/* Question list */}
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {questions.sort((a, b) => a.sort_order - b.sort_order).map((q) => (
          <div key={q.id} className="px-3 py-2.5 flex items-center gap-2">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <div className="flex-1 min-w-0">
              {editingId === q.id ? (
                <div className="flex items-center gap-2">
                  <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-7 text-xs flex-1" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(q); if (e.key === "Escape") setEditingId(null); }} />
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger className="w-[100px] h-7 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => (<SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>))}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(q)}><Save className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-medium ${q.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>{q.question}</p>
                  <Badge variant="outline" className="text-[9px] capitalize">{q.category}</Badge>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingId(q.id); setEditText(q.question); setEditCategory(q.category); }}>
                    <Pencil className="h-2.5 w-2.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={q.is_active} onCheckedChange={(v) => updateQuestion.mutateAsync({ id: q.id, is_active: v })} className="scale-75" />
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteQuestion.mutateAsync(q.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {questions.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">No feedback questions configured. Add one above.</div>
        )}
      </div>
    </div>
  );
}

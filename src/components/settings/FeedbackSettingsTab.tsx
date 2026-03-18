import { useState } from "react";
import { useFeedbackQuestions, useFeedbackMutations, FeedbackQuestion } from "@/hooks/useFeedback";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Save, X, MessageSquare, GripVertical, Users, HardHat, Home, UserCog } from "lucide-react";

const VISITOR_TYPES = [
  { value: "visitor", label: "Visitors", icon: Users },
  { value: "contractor", label: "Contractors", icon: HardHat },
  { value: "resident", label: "Residents", icon: Home },
  { value: "staff", label: "Staff", icon: UserCog },
] as const;

export function FeedbackSettingsTab() {
  const { toast } = useToast();
  const [visitorType, setVisitorType] = useState<string>("visitor");
  const { data: questions = [] } = useFeedbackQuestions(false, visitorType);
  const { addQuestion, updateQuestion, deleteQuestion } = useFeedbackMutations();
  const [newQ, setNewQ] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  const categories = ["general", "facilities", "staff", "food", "safety", "other"];

  const handleAdd = async () => {
    if (!newQ.trim()) return;
    try {
      await addQuestion.mutateAsync({ question: newQ.trim(), category: newCategory, visitor_type: visitorType });
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
    <div className="space-y-6">
      {/* Visitor type tabs */}
      <Tabs value={visitorType} onValueChange={setVisitorType}>
        <TabsList className="w-full">
          {VISITOR_TYPES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex-1 gap-1.5">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Feedback Questions</h2>
            <p className="text-xs text-muted-foreground">
              Questions for <span className="font-medium text-foreground capitalize">{visitorType}s</span>
              <span className="text-muted-foreground/60"> · {questions.filter(q => q.is_active).length} active</span>
            </p>
          </div>
        </div>

        {/* Add new question */}
        <div className="px-5 py-3 border-b border-border flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New Question</label>
            <Input
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="e.g. How would you rate the cleanliness?"
              className="h-9 text-sm"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={addQuestion.isPending} className="gap-1 h-9">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        {/* Question list */}
        <div className="divide-y divide-border">
          {questions.sort((a, b) => a.sort_order - b.sort_order).map((q) => (
            <div key={q.id} className="px-5 py-3 flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                {editingId === q.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(q);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveEdit(q)}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${q.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {q.question}
                    </p>
                    <Badge variant="outline" className="text-[10px] capitalize">{q.category}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setEditingId(q.id);
                        setEditText(q.question);
                        setEditCategory(q.category);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Active</span>
                  <Switch
                    checked={q.is_active}
                    onCheckedChange={(v) => updateQuestion.mutateAsync({ id: q.id, is_active: v })}
                    className="scale-75"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => deleteQuestion.mutateAsync(q.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No feedback questions configured for this type. Add one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

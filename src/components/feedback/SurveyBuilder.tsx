import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  useFeedbackSurveys, useSurveyMutations, useFeedbackQuestions, useFeedbackMutations,
  FeedbackSurvey, FeedbackQuestion,
} from "@/hooks/useFeedback";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Pencil, Save, X, GripVertical, ChevronDown, ChevronRight,
  ClipboardList, ExternalLink, Users, HardHat, Home, UserCog, Heart,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const PERSON_TYPES = [
  { value: "visitor", label: "Visitors", icon: Users },
  { value: "contractor", label: "Contractors", icon: HardHat },
  { value: "resident", label: "Residents", icon: Home },
  { value: "staff", label: "Staff", icon: UserCog },
  { value: "volunteer", label: "Volunteers", icon: Heart },
];

const CATEGORIES = ["general", "facilities", "staff", "food", "safety", "other"];

export function SurveyBuilder() {
  const { toast } = useToast();
  const { data: surveys = [] } = useFeedbackSurveys();
  const { addSurvey, updateSurvey, deleteSurvey } = useSurveyMutations();

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTypes, setNewTypes] = useState<string[]>(["visitor"]);
  const [newTrigger, setNewTrigger] = useState("checkout");
  const [newSource, setNewSource] = useState("built_in");
  const [newExternalUrl, setNewExternalUrl] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleType = (type: string) => {
    setNewTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await addSurvey.mutateAsync({
        title: newTitle.trim(),
        description: newDesc.trim(),
        assigned_types: newTypes,
        trigger_point: newTrigger,
        source: newSource,
        external_url: newExternalUrl,
      });
      setNewTitle(""); setNewDesc(""); setNewTypes(["visitor"]); setNewSource("built_in"); setNewExternalUrl("");
      setShowCreate(false);
      toast({ title: "Survey created" });
    } catch {
      toast({ title: "Error creating survey", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {!showCreate ? (
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Survey
        </Button>
      ) : (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">New Feedback Survey</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Post-Visit Satisfaction" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Trigger Point</label>
                <Select value={newTrigger} onValueChange={setNewTrigger}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkout">At Check-Out</SelectItem>
                    <SelectItem value="post_visit">Post-Visit (email)</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description..." className="min-h-[60px] resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Assign to Person Types</label>
              <div className="flex flex-wrap gap-2">
                {PERSON_TYPES.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => toggleType(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      newTypes.includes(value) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/30"
                    }`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <Select value={newSource} onValueChange={setNewSource}>
                <SelectTrigger className="h-9 w-[250px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="built_in">Built-in Questionnaire</SelectItem>
                  <SelectItem value="centrim_compliance">Centrim Life Compliance Module</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newSource === "centrim_compliance" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">External Module URL</label>
                <Input value={newExternalUrl} onChange={(e) => setNewExternalUrl(e.target.value)} placeholder="https://..." className="h-9" />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={addSurvey.isPending} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {surveys.map((s) => (
          <SurveyCard key={s.id} survey={s} expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            onUpdate={updateSurvey.mutateAsync} onDelete={deleteSurvey.mutateAsync} />
        ))}
        {surveys.length === 0 && !showCreate && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            No surveys created yet. Create one to start collecting feedback.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Survey Card with DnD ───

function SurveyCard({ survey, expanded, onToggle, onUpdate, onDelete }: {
  survey: FeedbackSurvey; expanded: boolean; onToggle: () => void;
  onUpdate: (s: Partial<FeedbackSurvey> & { id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const { data: questions = [] } = useFeedbackQuestions(false, expanded ? survey.id : undefined);
  const { addQuestion, updateQuestion } = useFeedbackMutations();
  const [newQ, setNewQ] = useState("");
  const [newCat, setNewCat] = useState("general");

  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  const handleAddQ = async () => {
    if (!newQ.trim()) return;
    try {
      await addQuestion.mutateAsync({
        question: newQ.trim(), category: newCat, survey_id: survey.id,
        visitor_type: survey.assigned_types[0] || "visitor",
      });
      setNewQ("");
      toast({ title: "Question added" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    // Batch update sort_order
    try {
      await Promise.all(
        reordered.map((q, idx) =>
          q.sort_order !== idx ? updateQuestion.mutateAsync({ id: q.id, sort_order: idx }) : Promise.resolve()
        )
      );
    } catch {
      toast({ title: "Error reordering", variant: "destructive" });
    }
  }, [sorted, updateQuestion, toast]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{survey.title}</h3>
            {survey.source === "centrim_compliance" && (
              <Badge variant="outline" className="text-[10px] gap-1"><ExternalLink className="h-2.5 w-2.5" /> Centrim Life</Badge>
            )}
            <Badge variant={survey.is_active ? "default" : "secondary"} className="text-[10px]">
              {survey.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {survey.assigned_types.map((t) => (
              <Badge key={t} variant="outline" className="text-[9px] capitalize">{t}</Badge>
            ))}
            <span className="text-[10px] text-muted-foreground">
              · {survey.trigger_point === "checkout" ? "At Check-Out" : survey.trigger_point === "post_visit" ? "Post-Visit" : "Manual"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Switch checked={survey.is_active} onCheckedChange={(v) => onUpdate({ id: survey.id, is_active: v })} className="scale-75" />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(survey.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {survey.source === "centrim_compliance" ? (
            <div className="p-5 text-center text-sm text-muted-foreground space-y-2">
              <ExternalLink className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>This survey uses the <strong>Centrim Life Compliance Module</strong>.</p>
              {survey.external_url && (
                <a href={survey.external_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Open Module →</a>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Add question */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New Question</label>
                  <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="e.g. How would you rate the cleanliness?" className="h-8 text-sm" onKeyDown={(e) => { if (e.key === "Enter") handleAddQ(); }} />
                </div>
                <Select value={newCat} onValueChange={setNewCat}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddQ} className="gap-1 h-8">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>

              {/* DnD question list */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={`survey-${survey.id}`}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}
                      className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {sorted.map((q, idx) => (
                        <Draggable key={q.id} draggableId={q.id} index={idx}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`bg-card transition-shadow ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20 rounded-lg z-10" : ""}`}
                            >
                              <QuestionRow
                                question={q}
                                onUpdate={updateQuestion.mutateAsync}
                                onDelete={async (id) => {
                                  const { deleteQuestion } = useFeedbackMutations();
                                  // handled inline
                                }}
                                dragHandleProps={dragProvided.dragHandleProps}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {sorted.length === 0 && (
                        <div className="py-6 text-center text-xs text-muted-foreground">No questions yet. Add one above.</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Question Row ───

function QuestionRow({ question: q, onUpdate, onDelete, dragHandleProps }: {
  question: FeedbackQuestion;
  onUpdate: (data: Partial<FeedbackQuestion> & { id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  dragHandleProps?: any;
}) {
  const { deleteQuestion } = useFeedbackMutations();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(q.question);
  const [editCat, setEditCat] = useState(q.category);

  const save = async () => {
    if (!editText.trim()) return;
    await onUpdate({ id: q.id, question: editText.trim(), category: editCat });
    setEditing(false);
  };

  return (
    <div className="px-3 py-2.5 flex items-center gap-2">
      <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 -m-1 rounded hover:bg-muted/50 transition-colors">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="h-7 text-xs flex-1" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
            <Select value={editCat} onValueChange={setEditCat}>
              <SelectTrigger className="w-[100px] h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize text-xs">{c}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={save}><Save className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className={`text-xs font-medium ${q.is_active ? "text-foreground" : "text-muted-foreground line-through"}`}>{q.question}</p>
            <Badge variant="outline" className="text-[9px] capitalize">{q.category}</Badge>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditing(true); setEditText(q.question); setEditCat(q.category); }}>
              <Pencil className="h-2.5 w-2.5" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch checked={q.is_active} onCheckedChange={(v) => onUpdate({ id: q.id, is_active: v })} className="scale-75" />
        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteQuestion.mutateAsync(q.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

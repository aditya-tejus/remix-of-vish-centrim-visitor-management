import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useContractorQuestionTypes, type ContractorQuestion } from "@/hooks/useContractorQuestions";

const SCOPE_LABEL: Record<string, string> = {
  company: "Asked once for the company",
  person: "Asked once for the person",
  visit: "Asked every visit",
};

const VALIDITY_OPTIONS = [
  { value: "0", label: "Never lapses" },
  { value: "90", label: "Lasts 3 months" },
  { value: "180", label: "Lasts 6 months" },
  { value: "365", label: "Lasts 12 months" },
  { value: "730", label: "Lasts 2 years" },
];

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

export function ContractorQuestionsTab() {
  const { questions, loading, refetch } = useContractorQuestionTypes();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newScope, setNewScope] = useState<"company" | "person" | "visit">("visit");
  const [newBy, setNewBy] = useState<"contractor" | "staff">("contractor");
  const [newType, setNewType] = useState<"yesno" | "text">("yesno");
  const [newJurisdiction, setNewJurisdiction] = useState<"ALL" | "AU" | "UK">("ALL");
  const [busy, setBusy] = useState(false);

  const patch = async (id: string, fields: Partial<ContractorQuestion>) => {
    const { error } = await supabase.from("contractor_questions" as any).update(fields as any).eq("id", id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
  };

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    const { error } = await supabase.from("contractor_questions" as any).insert({
      key: slugify(label) || `question_${Date.now()}`,
      label,
      input_type: newType,
      owner_scope: newScope,
      answered_by: newBy,
      validity_days: newScope === "visit" ? null : 365,
      required: true,
      blocks_on_no: false,
      jurisdiction: newJurisdiction,
      sort_order: (questions.at(-1)?.sort_order ?? 0) + 10,
    } as any);
    setBusy(false);
    if (error) {
      toast({ title: "Could not add question", description: error.message, variant: "destructive" });
      return;
    }
    setNewLabel(""); setAdding(false);
    await refetch();
    toast({ title: "Question added" });
  };

  const remove = async (q: ContractorQuestion) => {
    const { error } = await supabase.from("contractor_questions" as any).delete().eq("id", q.id);
    if (error) {
      toast({ title: "Could not remove", description: error.message, variant: "destructive" });
      return;
    }
    await refetch();
    toast({ title: "Question removed" });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = questions[index];
    const b = questions[index + dir];
    if (!a || !b) return;
    await supabase.from("contractor_questions" as any).update({ sort_order: b.sort_order } as any).eq("id", a.id);
    await supabase.from("contractor_questions" as any).update({ sort_order: a.sort_order } as any).eq("id", b.id);
    await refetch();
  };

  const firstTimer = questions.filter((q) => q.is_active && q.answered_by === "contractor");
  const returning = questions.filter((q) => q.is_active && q.answered_by === "contractor" && q.owner_scope === "visit");
  const staffOnly = questions.filter((q) => q.is_active && q.answered_by === "staff");

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
        <ClipboardCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Decide what each contractor is asked, and how often. Questions kept against the <strong>company</strong> or
          the <strong>person</strong> are only asked again once the answer lapses, so a regular tradesperson answers
          almost nothing. <strong>Staff only</strong> questions never appear on the kiosk.
        </p>
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="text-sm font-medium mb-1">What contractors will be asked</p>
        <p className="text-xs text-muted-foreground">
          First visit: {firstTimer.length} question{firstTimer.length === 1 ? "" : "s"} · Returning with everything on
          file: {returning.length} · Left for reception: {staffOnly.length}
        </p>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && questions.length === 0 && (
          <p className="text-xs text-muted-foreground">No questions yet — add your first one below.</p>
        )}

        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{q.label}</p>
                <p className="text-xs text-muted-foreground">
                  {SCOPE_LABEL[q.owner_scope]} · {q.answered_by === "staff" ? "staff only" : "contractor can answer"}
                  {q.jurisdiction !== "ALL" && ` · ${q.jurisdiction === "AU" ? "Australia" : "United Kingdom"}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(q)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={q.owner_scope} onValueChange={(v) => patch(q.id, { owner_scope: v as any, validity_days: v === "visit" ? null : q.validity_days ?? 365 })}>
                <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Asked once for the company</SelectItem>
                  <SelectItem value="person">Asked once for the person</SelectItem>
                  <SelectItem value="visit">Asked every visit</SelectItem>
                </SelectContent>
              </Select>

              <Select value={q.answered_by} onValueChange={(v) => patch(q.id, { answered_by: v as any })}>
                <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor answers</SelectItem>
                  <SelectItem value="staff">Staff only</SelectItem>
                </SelectContent>
              </Select>

              {q.owner_scope !== "visit" && (
                <Select
                  value={String(q.validity_days ?? 0)}
                  onValueChange={(v) => patch(q.id, { validity_days: v === "0" ? null : Number(v) })}
                >
                  <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VALIDITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={q.jurisdiction} onValueChange={(v) => patch(q.id, { jurisdiction: v as any })}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All regions</SelectItem>
                  <SelectItem value="AU">Australia</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                </SelectContent>
              </Select>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={q.required} onCheckedChange={(v) => patch(q.id, { required: v === true })} />
                <span className="text-xs text-foreground">Must be answered</span>
              </label>

              {q.input_type === "yesno" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={q.blocks_on_no} onCheckedChange={(v) => patch(q.id, { blocks_on_no: v === true })} />
                  <span className="text-xs text-foreground">A “No” holds them up</span>
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={q.is_active} onCheckedChange={(v) => patch(q.id, { is_active: v })} />
                <span className="text-xs text-muted-foreground">{q.is_active ? "Active" : "Hidden"}</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Question</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Completed manual handling training?" className="h-9 text-sm" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={newScope} onValueChange={(v) => setNewScope(v as any)}>
              <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Asked once for the company</SelectItem>
                <SelectItem value="person">Asked once for the person</SelectItem>
                <SelectItem value="visit">Asked every visit</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newBy} onValueChange={(v) => setNewBy(v as any)}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contractor">Contractor answers</SelectItem>
                <SelectItem value="staff">Staff only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yesno">Yes / No</SelectItem>
                <SelectItem value="text">Short answer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newJurisdiction} onValueChange={(v) => setNewJurisdiction(v as any)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All regions</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="UK">United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={add} disabled={busy || !newLabel.trim()}>Add question</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add question
        </Button>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeedbackResponses, useFeedbackQuestions, useFeedbackSurveys } from "@/hooks/useFeedback";
import { format } from "date-fns";
import { Search, MessageSquare } from "lucide-react";

const emojis = ["😞", "😕", "😐", "🙂", "😊"];

export function ResponsesList() {
  const { data: responses = [] } = useFeedbackResponses(500);
  const { data: questions = [] } = useFeedbackQuestions();
  const { data: surveys = [] } = useFeedbackSurveys();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filtered = useMemo(() => {
    let list = responses;
    if (filterType !== "all") list = list.filter((r) => r.visitor_type === filterType);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((r) => r.visitor_name.toLowerCase().includes(s) || r.comment?.toLowerCase().includes(s));
    }
    return list;
  }, [responses, search, filterType]);

  const getQuestionText = (qid: string) => questions.find((q) => q.id === qid)?.question || "—";
  const getSurveyTitle = (sid: string | null) => surveys.find((s) => s.id === sid)?.title || "—";

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or comment..." className="pl-9 h-9 text-sm" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="visitor">Visitor</SelectItem>
            <SelectItem value="contractor">Contractor</SelectItem>
            <SelectItem value="resident">Resident</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="volunteer">Volunteer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {filtered.slice(0, 100).map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-start gap-3">
            <span className="text-2xl mt-0.5">{emojis[r.rating - 1] || "—"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{r.visitor_name || "Anonymous"}</span>
                <Badge variant="outline" className="text-[9px] capitalize">{r.visitor_type}</Badge>
                <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{getQuestionText(r.question_id)}</p>
              {r.comment && <p className="text-xs text-foreground mt-1 italic">"{r.comment}"</p>}
            </div>
            <div className="shrink-0 text-right">
              <span className="text-lg font-bold text-foreground">{r.rating}/5</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            No responses found.
          </div>
        )}
      </div>
    </div>
  );
}

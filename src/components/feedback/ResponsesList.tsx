import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceChips } from "@/components/reports/ReportParts";
import { RatingPill } from "@/components/feedback/RatingPill";
import { LoadingState } from "@/components/states";
import { useFeedbackQuestions, useFeedbackResponses, useFeedbackSurveys } from "@/hooks/useFeedback";
import { RATING_BANDS, filterResponses, groupResponsesByDay, ratingBand, type RatingBand } from "@/lib/feedbackView";

const PAGE = 40;
const TYPES = [
  { id: "visitor", label: "Visitors" }, { id: "contractor", label: "Contractors" }, { id: "resident", label: "Residents" },
  { id: "staff", label: "Staff" }, { id: "volunteer", label: "Volunteers" },
];

export function ResponsesList() {
  const { data: responses = [], isLoading } = useFeedbackResponses(500);
  const { data: questions = [] } = useFeedbackQuestions();
  const { data: surveys = [] } = useFeedbackSurveys();
  const [params, setParams] = useSearchParams();
  const band = (RATING_BANDS.some((b) => b.id === params.get("rating")) ? params.get("rating") : "all") as RatingBand;
  const setBand = (b: RatingBand) => { const next = new URLSearchParams(params); if (b === "all") next.delete("rating"); else next.set("rating", b); setParams(next, { replace: true }); setShown(PAGE); };
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => ({
    all: responses.length,
    low: responses.filter((r) => ratingBand(r.rating) === "low").length,
    okay: responses.filter((r) => ratingBand(r.rating) === "okay").length,
    good: responses.filter((r) => ratingBand(r.rating) === "good").length,
  }), [responses]);
  const filtered = useMemo(() => filterResponses(responses, { band, type, search }), [responses, band, type, search]);
  const groups = useMemo(() => groupResponsesByDay(filtered.slice(0, shown)), [filtered, shown]);
  const question = (id: string) => questions.find((q) => q.id === id)?.question;
  const survey = (id: string | null) => surveys.find((s) => s.id === id)?.title;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-3 border-b border-border p-4">
        <ChoiceChips label="Rating" value={band} onChange={(v) => setBand(v as RatingBand)}
          options={RATING_BANDS.map((b) => ({ id: b.id, label: `${b.label} (${counts[b.id]})` }))} />
        <p className="text-[13px] text-muted-foreground">Needs follow-up is a rating of 1 or 2. Okay is 3. Good is 4 or 5.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search name or comment" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} placeholder="Search name or comment" className="pl-9" />
          </div>
          <Select value={type} onValueChange={(v) => { setType(v); setShown(PAGE); }}>
            <SelectTrigger className="sm:w-[180px]" aria-label="Who gave the feedback"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <div className="p-4"><LoadingState label="Loading feedback" /></div> : filtered.length === 0 ? (
        <div className="p-10 text-center">
          <MessageSquare aria-hidden className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-base font-extrabold text-foreground">{band === "low" && !search && type === "all" ? "Nothing needs follow-up" : "No responses match"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{band === "low" && !search && type === "all" ? "No one has rated 1 or 2." : "Clear the search or pick another rating."}</p>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="flex items-baseline justify-between bg-muted/70 px-4 py-2 text-[13px] font-extrabold text-foreground">
                {g.label}<span className="font-semibold text-muted-foreground">{g.items.length} {g.items.length === 1 ? "answer" : "answers"}</span>
              </h2>
              <ul className="divide-y divide-border">
                {g.items.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <RatingPill rating={r.rating} className="w-[76px]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{r.visitor_name || "Anonymous"}
                        <span className="font-semibold capitalize text-muted-foreground"> · {r.visitor_type} · {format(new Date(r.created_at), "h:mm a")}</span></p>
                      <p className="text-[13px] text-muted-foreground">{[survey(r.survey_id), question(r.question_id)].filter(Boolean).join(" · ") || "Question removed"}</p>
                      {r.comment && <p className="mt-1 text-sm text-foreground">“{r.comment}”</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border p-3 text-[13px] text-muted-foreground">
            <span>Showing {Math.min(shown, filtered.length)} of {filtered.length}</span>
            {filtered.length > shown && <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>Show more</Button>}
          </div>
        </>
      )}
    </section>
  );
}

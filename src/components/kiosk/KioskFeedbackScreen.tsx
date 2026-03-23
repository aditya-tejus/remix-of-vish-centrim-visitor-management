import { useState, useMemo, useCallback, useEffect } from "react";
import { useFeedbackSurveys, useFeedbackQuestions, useFeedbackMutations } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, MessageSquare, SkipForward } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface KioskFeedbackScreenProps {
  visitorId?: string;
  visitorName: string;
  visitorType: string;
  onComplete: () => void;
}

const EMOJI_SCALE = [
  { value: 1, emoji: "😠", label: "Very Poor" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 3, emoji: "😐", label: "OK" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "😍", label: "Excellent" },
];

export function KioskFeedbackScreen({ visitorId, visitorName, visitorType, onComplete }: KioskFeedbackScreenProps) {
  const { toast } = useToast();
  const { data: surveys = [] } = useFeedbackSurveys(true);
  const activeSurvey = useMemo(
    () => surveys.find((s) => s.is_active && s.trigger_point === "checkout" && s.assigned_types.includes(visitorType)),
    [surveys, visitorType]
  );
  const { data: questions = [] } = useFeedbackQuestions(true, activeSurvey?.id);
  const { submitFeedback } = useFeedbackMutations();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!activeSurvey) return;
    setSubmitting(true);
    const responses = questions
      .filter((q) => ratings[q.id])
      .map((q) => ({
        visitor_id: visitorId,
        visitor_name: visitorName,
        visitor_type: visitorType,
        question_id: q.id,
        rating: ratings[q.id],
        comment: comments[q.id] || "",
        survey_id: activeSurvey.id,
      }));
    if (responses.length > 0) {
      await submitFeedback.mutateAsync(responses);
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
    }
    onComplete();
  }, [activeSurvey, questions, ratings, comments, visitorId, visitorName, visitorType, submitFeedback, onComplete, toast]);

  // No active survey — skip immediately
  useEffect(() => {
    if (!activeSurvey && surveys.length >= 0) {
      onComplete();
    }
  }, [activeSurvey, onComplete, surveys.length]);

  // External survey — show link card
  if (activeSurvey?.source === "centrim_compliance" && activeSurvey.external_url) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">We'd Love Your Feedback</h2>
          <p className="text-lg text-muted-foreground">{activeSurvey.description || "Please take a moment to share your experience."}</p>
        </div>
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-8 text-center space-y-4">
          <Button
            size="lg"
            className="h-16 text-lg gap-3 px-8"
            onClick={() => window.open(activeSurvey.external_url, "_blank")}
          >
            <ExternalLink className="h-5 w-5" /> Open Feedback Form
          </Button>
        </div>
        <Button variant="secondary" onClick={onComplete} className="w-full h-14 text-base gap-2 border border-border">
          <SkipForward className="h-5 w-5" /> Skip
        </Button>
      </motion.div>
    );
  }

  // Built-in feedback with large touch targets
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-foreground">How Was Your Visit?</h2>
        <p className="text-lg text-muted-foreground">Tap to rate each area</p>
      </div>

      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 kiosk-scroll-fade">
        {questions.map((q) => (
          <div key={q.id} className="rounded-2xl border-2 border-border bg-card p-5 space-y-3">
            <p className="text-lg font-semibold text-foreground">{q.question}</p>
            <div className="flex justify-between gap-2">
              {EMOJI_SCALE.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setRatings((prev) => ({ ...prev, [q.id]: e.value }))}
                  aria-label={`Rate ${e.label}`}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 min-h-[64px] min-w-[56px] rounded-xl transition-all active:scale-95 ${
                    ratings[q.id] === e.value
                      ? "bg-primary/10 border-2 border-primary scale-105"
                      : "border-2 border-border bg-secondary/50"
                  }`}
                >
                  <span className="text-3xl">{e.emoji}</span>
                  <span className="text-sm text-muted-foreground font-medium">{e.label}</span>
                </button>
              ))}
            </div>
            {ratings[q.id] && (
              <Textarea
                value={comments[q.id] || ""}
                onChange={(e) => setComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Any comments? (optional)"
                className="min-h-[60px] text-base rounded-xl resize-none"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onComplete} className="flex-1 h-14 text-base gap-2 border border-border">
          <SkipForward className="h-5 w-5" /> Skip
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(ratings).length === 0}
          className="flex-1 h-14 text-base gap-2"
        >
          Submit Feedback
        </Button>
      </div>
    </motion.div>
  );
}

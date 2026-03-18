import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFeedbackQuestions, useFeedbackMutations } from "@/hooks/useFeedback";
import { useToast } from "@/hooks/use-toast";
import { Star, MessageSquare, Send } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitorId?: string;
  visitorName: string;
  visitorType: string;
}

const emojis = ["😞", "😕", "😐", "🙂", "😊"];
const labels = ["Poor", "Fair", "Okay", "Good", "Excellent"];

export function FeedbackDialog({ open, onOpenChange, visitorId, visitorName, visitorType }: FeedbackDialogProps) {
  const { data: questions = [] } = useFeedbackQuestions(true);
  const { submitFeedback } = useFeedbackMutations();
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const responses = questions
      .filter((q) => ratings[q.id])
      .map((q) => ({
        visitor_id: visitorId,
        visitor_name: visitorName,
        visitor_type: visitorType,
        question_id: q.id,
        rating: ratings[q.id],
        comment: comments[q.id] || "",
      }));

    if (responses.length === 0) {
      toast({ title: "Please rate at least one question", variant: "destructive" });
      return;
    }

    try {
      await submitFeedback.mutateAsync(responses);
      setSubmitted(true);
      toast({ title: "Thank you for your feedback!" });
      setTimeout(() => {
        setSubmitted(false);
        setRatings({});
        setComments({});
        onOpenChange(false);
      }, 2000);
    } catch {
      toast({ title: "Error submitting feedback", variant: "destructive" });
    }
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <div className="text-center py-8 space-y-3">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold text-foreground">Thank You!</h2>
            <p className="text-sm text-muted-foreground">Your feedback has been recorded and helps us improve our care.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Visit Feedback
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Your feedback helps us provide the best possible care. All responses are anonymous and confidential.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2.5">
              <p className="text-sm font-medium text-foreground">{q.question}</p>

              {/* Emoji rating row */}
              <div className="flex gap-2 justify-center">
                {emojis.map((emoji, i) => {
                  const rating = i + 1;
                  const isSelected = ratings[q.id] === rating;
                  return (
                    <button
                      key={rating}
                      onClick={() => setRatings((prev) => ({ ...prev, [q.id]: rating }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[56px] ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm scale-110"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <span className={`text-2xl transition-transform ${isSelected ? "scale-110" : ""}`}>{emoji}</span>
                      <span className={`text-[9px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{labels[i]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Optional comment */}
              {ratings[q.id] && (
                <Textarea
                  value={comments[q.id] || ""}
                  onChange={(e) => setComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Add a comment (optional)..."
                  className="min-h-[50px] resize-none text-sm"
                />
              )}
            </div>
          ))}

          {questions.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No feedback questions configured.</div>
          )}
        </div>

        <div className="shrink-0 px-6 py-3 border-t border-border flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Skip</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitFeedback.isPending} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

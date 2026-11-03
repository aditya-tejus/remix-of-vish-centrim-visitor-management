import { cn } from "@/lib/utils";
import { RATING_LABEL, ratingBand } from "@/lib/feedbackView";

/** A rating as a number and a word, coloured by whether it needs follow-up. Never colour alone. */
export function RatingPill({ rating, className }: { rating: number; className?: string }) {
  const band = ratingBand(rating);
  return (
    <span className={cn("inline-flex shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1 text-center",
      band === "low" ? "bg-error-subtle text-destructive" : band === "okay" ? "bg-muted text-foreground" : "bg-success-subtle text-success-strong", className)}
      aria-label={`Rated ${rating} out of 5, ${RATING_LABEL[rating] ?? ""}`}>
      <span className="text-lg font-extrabold leading-6 tabular-nums">{rating}<span className="text-xs font-bold">/5</span></span>
      <span className="text-[11px] font-bold leading-4">{RATING_LABEL[rating]}</span>
    </span>
  );
}

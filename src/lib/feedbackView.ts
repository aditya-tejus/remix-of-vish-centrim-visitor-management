/**
 * Feedback reports — pure rules shared by the summary and the responses list.
 * A rating of 1 or 2 needs someone to follow up; that is the main job here.
 */
import { eachDayOfInterval, format, isSameDay, startOfDay, subDays } from "date-fns";
import type { FeedbackResponse } from "@/hooks/useFeedback";

export const RATING_LABEL = ["", "Very poor", "Poor", "Okay", "Good", "Very good"] as const;

export type RatingBand = "all" | "low" | "okay" | "good";
export const RATING_BANDS: { id: RatingBand; label: string }[] = [
  { id: "all", label: "All ratings" },
  { id: "low", label: "Needs follow-up" },
  { id: "okay", label: "Okay" },
  { id: "good", label: "Good" },
];
export const ratingBand = (rating: number): Exclude<RatingBand, "all"> => (rating <= 2 ? "low" : rating === 3 ? "okay" : "good");
export const needsFollowUp = (r: Pick<FeedbackResponse, "rating">) => r.rating >= 1 && r.rating <= 2;

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function feedbackSummary(all: FeedbackResponse[], from: Date, to: Date, surveys: { id: string; title: string }[] = []) {
  const start = startOfDay(from);
  const list = all.filter((r) => { const d = new Date(r.created_at); return d >= start && d <= to; });
  const days = eachDayOfInterval({ start, end: to });
  const byDay = days.map((d) => {
    const ratings = list.filter((r) => isSameDay(new Date(r.created_at), d)).map((r) => r.rating);
    return { key: format(d, "yyyy-MM-dd"), label: format(d, days.length > 14 ? "d MMM" : "EEE d"), count: ratings.length, average: avg(ratings) };
  });
  const byRating = [5, 4, 3, 2, 1].map((rating) => ({ rating, label: RATING_LABEL[rating], count: list.filter((r) => r.rating === rating).length }));
  const bySurvey = surveys
    .map((s) => { const rs = list.filter((r) => r.survey_id === s.id).map((r) => r.rating); return { id: s.id, title: s.title, count: rs.length, average: avg(rs) }; })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
  const followUps = list.filter(needsFollowUp).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    count: list.length,
    people: new Set(list.map((r) => r.visitor_id ?? r.visitor_name.trim().toLowerCase())).size,
    average: avg(list.map((r) => r.rating)),
    lowShare: list.length ? Math.round((followUps.length / list.length) * 100) : 0,
    byDay, byRating, bySurvey, followUps,
  };
}

export function filterResponses(all: FeedbackResponse[], f: { band: RatingBand; type: string; search: string }) {
  const q = f.search.trim().toLowerCase();
  return all.filter((r) =>
    (f.band === "all" || ratingBand(r.rating) === f.band) &&
    (f.type === "all" || r.visitor_type === f.type) &&
    (!q || (r.visitor_name ?? "").toLowerCase().includes(q) || (r.comment ?? "").toLowerCase().includes(q)));
}

/** Newest first, one group per day, labelled the way staff talk. */
export function groupResponsesByDay(list: FeedbackResponse[], now = new Date()) {
  const groups: { key: string; label: string; items: FeedbackResponse[] }[] = [];
  for (const r of [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const d = new Date(r.created_at);
    const key = format(d, "yyyy-MM-dd");
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const label = isSameDay(d, now) ? "Today" : isSameDay(d, subDays(now, 1)) ? "Yesterday" : format(d, "EEEE d MMMM");
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
}

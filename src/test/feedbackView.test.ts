import { describe, it, expect } from "vitest";
import { feedbackSummary, filterResponses, groupResponsesByDay } from "@/lib/feedbackView";
import type { FeedbackResponse } from "@/hooks/useFeedback";

let n = 0;
const r = (at: string, rating: number, p: Partial<FeedbackResponse> = {}): FeedbackResponse => ({
  id: `r${++n}`, visitor_id: null, visitor_name: `P${n}`, visitor_type: "visitor", question_id: "q", rating, comment: "", created_at: new Date(at).toISOString(), survey_id: "s1", ...p,
});
const now = new Date("2026-11-03T12:00:00");

describe("feedback view", () => {
  const all = [
    r("2026-11-03T10:00:00", 5), r("2026-11-03T11:00:00", 2, { comment: "Waited a long time" }),
    r("2026-11-01T09:00:00", 4, { visitor_type: "contractor" }), r("2026-10-01T09:00:00", 1),
  ];

  it("summarises only the chosen period, with gaps left empty", () => {
    const s = feedbackSummary(all, new Date("2026-10-28T00:00:00"), now, [{ id: "s1", title: "After your visit" }]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(3.7);
    expect(s.followUps.map((x) => x.comment)).toEqual(["Waited a long time"]);
    expect(s.lowShare).toBe(33);
    expect(s.byDay.at(-1)).toMatchObject({ count: 2, average: 3.5 });
    expect(s.byDay.find((d) => d.key === "2026-11-02")!.average).toBeNull();
    expect(s.byRating.map((b) => b.count)).toEqual([1, 1, 0, 1, 0]);
    expect(s.bySurvey).toEqual([{ id: "s1", title: "After your visit", count: 3, average: 3.7 }]);
  });

  it("filters by rating band, type and words", () => {
    expect(filterResponses(all, { band: "low", type: "all", search: "" })).toHaveLength(2);
    expect(filterResponses(all, { band: "good", type: "contractor", search: "" })).toHaveLength(1);
    expect(filterResponses(all, { band: "all", type: "all", search: "long time" })).toHaveLength(1);
  });

  it("groups by day, newest first", () => {
    expect(groupResponsesByDay(all, now).map((g) => [g.label, g.items.length])).toEqual([["Today", 2], ["Sunday 1 November", 1], ["Thursday 1 October", 1]]);
  });
});

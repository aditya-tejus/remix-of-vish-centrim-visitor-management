import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { isSameDay, subDays } from "date-fns";
import { useVisitViews } from "@/hooks/useVisitViews";
import { Visitor } from "@/types/visitor";

function makeVisitor(overrides: Partial<Visitor>): Visitor {
  return {
    id: "1",
    firstName: "Jane",
    surname: "Doe",
    mobile: "0400000000",
    email: "",
    type: "visitor",
    status: "checked-in",
    checkInTime: new Date(),
    checkOutTime: null,
    additionalVisitors: 0,
    ...overrides,
  } as Visitor;
}

describe("useVisitViews", () => {
  const today = new Date();
  const yesterday = subDays(today, 1);

  const carriedOver = makeVisitor({ id: "carried", checkInTime: yesterday, status: "checked-in" });
  const todayArrival = makeVisitor({ id: "today", checkInTime: today, status: "checked-in" });

  const dayVisitors = [todayArrival].filter((v) => isSameDay(v.checkInTime, today));
  const liveVisitors = [carriedOver, todayArrival];

  const setup = () =>
    renderHook(() =>
      useVisitViews({
        dayVisitors,
        liveVisitors,
        allVisitors: liveVisitors,
        selectedDate: today,
        scheduledAvailable: false,
      })
    );

  it("keeps a previous-day arrival in On site now", () => {
    const { result } = setup();
    const ids = result.current.rowsFor("on-site").map((v) => v.id);
    expect(ids).toContain("carried");
    expect(ids).toContain("today");
  });

  it("leaves the previous-day arrival out of today's recent activity", () => {
    const { result } = setup();
    const ids = result.current.rowsFor("recent").map((v) => v.id);
    expect(ids).not.toContain("carried");
    expect(ids).toContain("today");
  });

  it("counts the live views from the live list", () => {
    const { result } = setup();
    const onSite = result.current.views.find((v) => v.key === "on-site");
    expect(onSite?.count).toBe(2);
  });
});

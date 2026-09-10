import { describe, it, expect } from "vitest";
import { isOverstayedSync } from "@/hooks/useOverstayPolicy";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

describe("isOverstayedSync", () => {
  it("flags a visitor on site past the default threshold", () => {
    expect(isOverstayedSync({ type: "visitor", status: "checked-in", checkInTime: hoursAgo(30) })).toBe(true);
  });

  it("does not flag a recent arrival", () => {
    expect(isOverstayedSync({ type: "visitor", status: "checked-in", checkInTime: hoursAgo(1) })).toBe(false);
  });

  it("never treats a resident living on site as an overstay", () => {
    expect(isOverstayedSync({ type: "resident", status: "checked-in", checkInTime: hoursAgo(24 * 90) })).toBe(false);
  });

  it("ignores anyone already signed out", () => {
    expect(isOverstayedSync({ type: "visitor", status: "checked-out", checkInTime: hoursAgo(30) })).toBe(false);
  });
});

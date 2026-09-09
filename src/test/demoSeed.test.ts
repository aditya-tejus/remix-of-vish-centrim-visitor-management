import { describe, it, expect } from "vitest";
import {
  summariseCounts,
  totalCount,
  CLEANUP_ORDER,
  isSafeCleanupFilter,
  COUNT_LABELS,
  DEFAULT_SKIPPED,
} from "@/lib/demoSeed";

describe("demo seed counts", () => {
  it("labels and orders the counted groups, hiding empty ones", () => {
    const lines = summariseCounts({ keys: 3, wings: 2, food_register: 0, visitors: 10 });
    expect(lines.map((l) => l.key)).toEqual(["wings", "visitors", "keys"]);
    expect(lines[0].label).toBe(COUNT_LABELS.wings);
  });

  it("totals only real numbers", () => {
    expect(totalCount({ wings: 2, keys: 3, note: "x" })).toBe(5);
    expect(totalCount(null)).toBe(0);
  });

  it("keeps unknown keys visible rather than dropping them", () => {
    const lines = summariseCounts({ something_new: 4 });
    expect(lines).toEqual([{ key: "something_new", label: "something_new", value: 4 }]);
  });
});

describe("demo cleanup safety", () => {
  it("removes children before their parents", () => {
    const at = (t: string) => CLEANUP_ORDER.indexOf(t as never);
    expect(at("visit_parties")).toBeLessThan(at("visits"));
    expect(at("key_issues")).toBeLessThan(at("property_keys"));
    expect(at("contractor_documents")).toBeLessThan(at("contractor_people"));
    expect(at("contractor_people")).toBeLessThan(at("suppliers_min"));
    expect(at("resident_details")).toBeLessThan(at("visitors"));
    expect(at("visitors")).toBeLessThan(at("wings"));
    expect(at("feedback_responses")).toBeLessThan(at("feedback_questions"));
    expect(at("feedback_questions")).toBeLessThan(at("feedback_surveys"));
  });

  it("refuses a cleanup that is not scoped to one demo run", () => {
    expect(isSafeCleanupFilter(null)).toBe(false);
    expect(isSafeCleanupFilter("")).toBe(false);
    expect(isSafeCleanupFilter("   ")).toBe(false);
    expect(isSafeCleanupFilter("6f0a9f2e-0000-4000-8000-000000000000")).toBe(true);
  });

  it("names what is deliberately not created", () => {
    expect(DEFAULT_SKIPPED.length).toBe(4);
    expect(DEFAULT_SKIPPED.join(" ")).toMatch(/Emergency roll call/);
    expect(DEFAULT_SKIPPED.join(" ")).toMatch(/Kiosk devices/);
  });
});

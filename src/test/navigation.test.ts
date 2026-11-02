import { describe, it, expect } from "vitest";
import { buildNavigation, activeSection, activeChild, isEntryActive, MAX_SECTIONS } from "@/lib/navigation";

const bothOn = { foodRegister: true, keysRegister: true };

describe("left navigation", () => {
  it("has four sections at most, in the required order", () => {
    const nav = buildNavigation(bothOn);
    expect(nav.sections.length).toBeLessThanOrEqual(MAX_SECTIONS);
    expect(nav.sections.map((s) => s.title)).toEqual(["Today", "Visitors", "Residents", "Records"]);
  });

  it("puts visit pages under Visitors and registers, reports and logs under Records", () => {
    const nav = buildNavigation(bothOn);
    expect(nav.sections[1].children.map((c) => c.title)).toEqual(["On site and today", "Visitor profiles", "Calendar"]);
    expect(nav.sections[3].children.map((c) => c.title)).toEqual([
      "Food register", "Keys and fobs", "Reports", "Contractor documents", "Watchlist", "Privacy and compliance", "Audit log",
    ]);
  });

  it("keeps emergency roll call as its own action, and settings and kiosk as utilities", () => {
    const nav = buildNavigation(bothOn);
    expect(nav.emergency.path).toBe("/evacuation");
    expect(nav.utilities.map((u) => u.title)).toEqual(["Settings", "Kiosk mode"]);
    expect(nav.utilities.find((u) => u.title === "Kiosk mode")?.external).toBe(true);
  });

  it("honours the site's operating pack for registers", () => {
    const keysOnly = buildNavigation({ foodRegister: false, keysRegister: true });
    expect(keysOnly.sections[3].children.map((c) => c.title)).not.toContain("Food register");
    expect(keysOnly.sections[3].children.map((c) => c.title)).toContain("Keys and fobs");
    const none = buildNavigation({ foodRegister: false, keysRegister: false });
    expect(none.sections[3].children[0].title).toBe("Reports");
  });

  it("uses the site's own word for residents", () => {
    expect(buildNavigation(bothOn, "Homeowners").sections[2].title).toBe("Homeowners");
  });

  it("marks Today as current at the root address too", () => {
    const nav = buildNavigation(bothOn);
    expect(isEntryActive(nav.sections[0], "/")).toBe(true);
    expect(activeSection(nav, "/today")?.key).toBe("today");
  });

  it("finds the owning section for every page, including detail and report screens", () => {
    const nav = buildNavigation(bothOn);
    expect(activeSection(nav, "/visitors/abc")?.key).toBe("visitors");
    expect(activeSection(nav, "/calendar")?.key).toBe("visitors");
    expect(activeSection(nav, "/reports/presence")?.key).toBe("records");
    expect(activeSection(nav, "/keys")?.key).toBe("records");
    expect(activeSection(nav, "/watchlist")?.key).toBe("records");
    expect(activeSection(nav, "/evacuation")).toBeNull();
    expect(activeChild(nav.sections[1], "/visitors/abc")?.title).toBe("Visitor profiles");
  });

  it("has no duplicate destinations in the menu", () => {
    const nav = buildNavigation(bothOn);
    const paths = [
      ...nav.sections.flatMap((s) => (s.children.length ? s.children.map((c) => c.path) : [s.path])),
      nav.emergency.path,
      ...nav.utilities.map((u) => u.path),
    ];
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("uses plain sentence-case labels with no decorative symbols", () => {
    const nav = buildNavigation(bothOn);
    const titles = [...nav.sections, ...nav.sections.flatMap((s) => s.children), nav.emergency, ...nav.utilities].map((i) => i.title);
    for (const title of titles) expect(title).toMatch(/^[A-Z][a-z0-9 ]*( [A-Za-z0-9 ]+)*$/);
  });
});

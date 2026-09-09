import { describe, it, expect } from "vitest";
import { buildNavigation, isGroupOpen, isEntryActive, OFF_MENU_ROUTES } from "@/lib/navigation";

const bothOn = { foodRegister: true, keysRegister: true };

describe("left navigation", () => {
  it("lists the primary screens in the required order", () => {
    const nav = buildNavigation(bothOn);
    expect(nav.primary.map((i) => i.title)).toEqual([
      "Today", "Visitor List", "Residents", "Visitor Profiles",
    ]);
  });

  it("groups Registers then Reports, in that order", () => {
    const nav = buildNavigation(bothOn);
    expect(nav.groups.map((g) => g.label)).toEqual(["Registers", "Reports"]);
    expect(nav.groups[0].items.map((i) => i.title)).toEqual([
      "Food Register", "Keys & Fob Register",
    ]);
    expect(nav.groups[1].items.map((i) => i.title)).toEqual([
      "Visitor Report", "Feedback Responses", "Feedback Reports",
      "Safety & Compliance", "Presence Log", "Audit Log",
    ]);
  });

  it("ends with Settings, Emergency Roll Call and Kiosk Mode", () => {
    const nav = buildNavigation(bothOn);
    expect(nav.footer.map((i) => i.title)).toEqual([
      "Settings", "Emergency Roll Call", "Kiosk Mode",
    ]);
    expect(nav.footer.find((i) => i.title === "Kiosk Mode")?.external).toBe(true);
  });

  it("honours the site's operating pack for registers", () => {
    expect(buildNavigation({ foodRegister: false, keysRegister: true }).groups[0].items.map((i) => i.title))
      .toEqual(["Keys & Fob Register"]);
    const none = buildNavigation({ foodRegister: false, keysRegister: false });
    expect(none.groups.map((g) => g.label)).toEqual(["Reports"]);
  });

  it("uses the site's own word for residents", () => {
    expect(buildNavigation(bothOn, "Homeowners").primary[2].title).toBe("Homeowners");
  });

  it("marks Today as current at the root address too", () => {
    const nav = buildNavigation(bothOn);
    expect(isEntryActive(nav.primary[0], "/")).toBe(true);
    expect(isEntryActive(nav.primary[0], "/today")).toBe(true);
    expect(isEntryActive(nav.primary[1], "/today")).toBe(false);
  });

  it("opens the group holding the current page", () => {
    const nav = buildNavigation(bothOn);
    expect(isGroupOpen(nav.groups[1], "/audit-log")).toBe(true);
    expect(isGroupOpen(nav.groups[0], "/audit-log")).toBe(false);
  });

  it("has no duplicate destinations in the menu", () => {
    const nav = buildNavigation(bothOn);
    const paths = [
      ...nav.primary.map((i) => i.path),
      ...nav.groups.flatMap((g) => g.items.map((i) => i.path)),
      ...nav.footer.map((i) => i.path),
    ];
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps consolidated screens off the menu but still recorded as reachable", () => {
    const nav = buildNavigation(bothOn);
    const menuPaths = new Set([
      ...nav.primary.map((i) => i.path),
      ...nav.groups.flatMap((g) => g.items.map((i) => i.path)),
      ...nav.footer.map((i) => i.path),
    ]);
    for (const path of OFF_MENU_ROUTES.filter((p) => p !== "/visit-list")) {
      expect(menuPaths.has(path)).toBe(false);
    }
  });

  it("uses plain text labels only, with no decorative symbols", () => {
    const nav = buildNavigation(bothOn);
    const titles = [
      ...nav.primary, ...nav.groups.flatMap((g) => g.items), ...nav.footer,
    ].map((i) => i.title);
    for (const title of titles) {
      expect(title).toMatch(/^[A-Za-z0-9 &]+$/);
    }
  });
});

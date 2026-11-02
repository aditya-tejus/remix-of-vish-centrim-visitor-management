/**
 * The one description of the left-hand menu.
 *
 * Four sections only. A section's own pages appear beneath it while you are in
 * that section, so the menu never shows more than the place you are working.
 * Emergency roll call is an action, not a section, and stays visible on its own.
 * Settings and kiosk mode are utilities and sit with the site name in the footer.
 *
 * Pure data so the order, the labels and the routes can be tested without
 * rendering the sidebar. Presentation lives in AppSidebar.
 */

export interface NavEntry {
  title: string;
  path: string;
  /** Extra paths that should mark this entry as the current page. */
  match?: string[];
  /** Opens outside the app shell (kiosk). */
  external?: boolean;
}

export interface NavSection extends NavEntry {
  key: "today" | "visitors" | "residents" | "records";
  /** Pages shown beneath the section while it is current. Empty for single-page sections. */
  children: NavEntry[];
  /** Path prefixes that also belong to this section (e.g. every /reports/… screen). */
  prefixes?: string[];
}

export interface NavModel {
  sections: NavSection[];
  emergency: NavEntry;
  utilities: NavEntry[];
}

export interface NavModules {
  foodRegister: boolean;
  keysRegister: boolean;
}

export const MAX_SECTIONS = 4;

export function buildNavigation(modules: NavModules, residentLabel = "Residents"): NavModel {
  const registers: NavEntry[] = [
    ...(modules.foodRegister ? [{ title: "Food register", path: "/food-register" }] : []),
    ...(modules.keysRegister ? [{ title: "Keys and fobs", path: "/keys" }] : []),
  ];

  return {
    sections: [
      { key: "today", title: "Today", path: "/today", match: ["/today", "/"], children: [] },
      {
        key: "visitors",
        title: "Visitors",
        path: "/visit-list",
        children: [
          { title: "On site and today", path: "/visit-list" },
          { title: "Visitor profiles", path: "/visitors", match: ["/visitors"] },
          { title: "Calendar", path: "/calendar" },
        ],
        prefixes: ["/visitors/"],
      },
      { key: "residents", title: residentLabel, path: "/residents", children: [] },
      {
        key: "records",
        title: "Records",
        path: "/reports",
        children: [
          ...registers,
          { title: "Reports", path: "/reports" },
          { title: "Contractor documents", path: "/contractor-documents" },
          { title: "Watchlist", path: "/watchlist" },
          { title: "Privacy and compliance", path: "/gdpr" },
          { title: "Audit log", path: "/audit-log" },
        ],
        prefixes: ["/reports/"],
      },
    ],
    emergency: { title: "Emergency roll call", path: "/evacuation" },
    utilities: [
      { title: "Settings", path: "/settings" },
      { title: "Kiosk mode", path: "/kiosk", external: true },
    ],
  };
}

export function isEntryActive(entry: NavEntry, pathname: string): boolean {
  return (entry.match ?? [entry.path]).includes(pathname);
}

/** The section that owns the current page, if any. */
export function activeSection(model: NavModel, pathname: string): NavSection | null {
  return (
    model.sections.find(
      (s) =>
        isEntryActive(s, pathname) ||
        s.children.some((c) => isEntryActive(c, pathname)) ||
        (s.prefixes ?? []).some((p) => pathname.startsWith(p))
    ) ?? null
  );
}

/** The child page to highlight; profile detail pages highlight "Visitor profiles". */
export function activeChild(section: NavSection, pathname: string): NavEntry | null {
  return (
    section.children.find((c) => isEntryActive(c, pathname)) ??
    section.children.find((c) => c.path !== "/" && pathname.startsWith(`${c.path}/`)) ??
    null
  );
}

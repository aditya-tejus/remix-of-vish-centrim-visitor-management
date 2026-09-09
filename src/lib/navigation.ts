/**
 * Phase 8F — the one description of the left-hand menu.
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

export interface NavGroupModel {
  label: string;
  items: NavEntry[];
}

export interface NavModel {
  primary: NavEntry[];
  groups: NavGroupModel[];
  footer: NavEntry[];
}

export interface NavModules {
  foodRegister: boolean;
  keysRegister: boolean;
}

export const REPORTS_ITEMS: NavEntry[] = [
  { title: "Visitor Report", path: "/reports/visitor-report" },
  { title: "Feedback Responses", path: "/reports/feedback-responses" },
  { title: "Feedback Reports", path: "/reports/feedback-reports" },
  { title: "Safety & Compliance", path: "/gdpr" },
  { title: "Presence Log", path: "/reports/presence" },
  { title: "Audit Log", path: "/audit-log" },
];

/** Screens that stay reachable by address, card or profile link but are not in the menu. */
export const OFF_MENU_ROUTES = [
  "/reports",
  "/reports/analytics",
  "/reports/evacuation",
  "/reports/on-site",
  "/reports/trends",
  "/contractor-documents",
  "/calendar",
  "/visit-list",
];

export function buildNavigation(modules: NavModules, residentLabel = "Residents"): NavModel {
  const registers: NavEntry[] = [
    ...(modules.foodRegister ? [{ title: "Food Register", path: "/food-register" }] : []),
    ...(modules.keysRegister ? [{ title: "Keys & Fob Register", path: "/keys" }] : []),
  ];

  return {
    primary: [
      { title: "Today", path: "/today", match: ["/today", "/"] },
      { title: "Visitor List", path: "/visit-list", match: ["/visit-list"] },
      { title: residentLabel, path: "/residents", match: ["/residents"] },
      { title: "Visitor Profiles", path: "/visitors", match: ["/visitors"] },
    ],
    groups: [
      ...(registers.length ? [{ label: "Registers", items: registers }] : []),
      { label: "Reports", items: REPORTS_ITEMS },
    ],
    footer: [
      { title: "Settings", path: "/settings" },
      { title: "Emergency Roll Call", path: "/evacuation" },
      { title: "Kiosk Mode", path: "/kiosk", external: true },
    ],
  };
}

/** A group opens by itself while one of its screens is the current page. */
export function isGroupOpen(group: NavGroupModel, pathname: string): boolean {
  return group.items.some((item) => item.path === pathname);
}

export function isEntryActive(entry: NavEntry, pathname: string): boolean {
  return (entry.match ?? [entry.path]).includes(pathname);
}

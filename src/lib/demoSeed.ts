/**
 * Phase 8F Part 2 — pure helpers for the administrator-only demo data card.
 *
 * The database functions `seed_demo_data` and `clear_demo_data` are the
 * authority. Nothing here touches the network; it only turns the counts the
 * server returns into plain wording, and states the order rows are removed in
 * so the behaviour can be tested without a database.
 */

export interface DemoSeedRun {
  id: string;
  branchId: string;
  seedKey: string;
  status: "active" | "removed";
  counts: Record<string, unknown>;
  skipped: string[];
  createdAt: string;
  createdByLabel: string | null;
  removedAt: string | null;
}

/** Plain-language name for each counted group. */
export const COUNT_LABELS: Record<string, string> = {
  wings: "Wings or units",
  residents: "Residents",
  visitors: "People records",
  visits: "Visits",
  attendance_rows: "People listed on visits",
  suppliers: "Contractor companies",
  contractor_people: "Contractor people",
  contractor_documents: "Contractor documents",
  keys: "Keys and fobs",
  key_issues: "Key handovers",
  food_register: "Food register entries",
  feedback_records: "Feedback records",
  feedback_responses: "Feedback answers",
  feedback_questions: "Feedback questions",
  feedback_surveys: "Feedback surveys",
};

export interface CountLine {
  key: string;
  label: string;
  value: number;
}

/** Turns the server's counts object into ordered, labelled, non-zero lines. */
export function summariseCounts(counts: unknown): CountLine[] {
  if (!counts || typeof counts !== "object") return [];
  const order = Object.keys(COUNT_LABELS);
  return Object.entries(counts as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number" && (v as number) > 0)
    .map(([key, v]) => ({ key, label: COUNT_LABELS[key] ?? key, value: v as number }))
    .sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}

/** Total records in a counts object. */
export function totalCount(counts: unknown): number {
  return summariseCounts(counts).reduce((sum, line) => sum + line.value, 0);
}

/**
 * The order the server removes demo rows in. Children before parents, so no
 * foreign key is ever left dangling.
 */
export const CLEANUP_ORDER = [
  "feedback_responses",
  "feedback_questions",
  "feedback_surveys",
  "key_issues",
  "property_keys",
  "food_register",
  "contractor_document_reviews",
  "contractor_documents",
  "visit_parties",
  "visits",
  "resident_details",
  "visitors",
  "contractor_people",
  "suppliers_min",
  "wings",
] as const;

/** Cleanup is only ever allowed to match rows carrying a run id. */
export function isSafeCleanupFilter(runId: string | null | undefined): boolean {
  return typeof runId === "string" && runId.trim().length > 0;
}

/** Everything the demo loader deliberately does not create, and why. */
export const DEFAULT_SKIPPED: string[] = [
  "Emergency roll call — a demo drill would create misleading compliance evidence.",
  "Kiosk devices — real device binding must never be faked.",
  "Watchlist entries — safeguarding records are never invented.",
  "Document files — contractor document records are created without any file attached.",
];

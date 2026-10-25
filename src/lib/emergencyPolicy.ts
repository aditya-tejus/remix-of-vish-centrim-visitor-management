/** Canonical emergency evidence policy. Attendance is not a physical sighting. */
export type EmergencyOutcome = "attendance_unverified" | "location_unconfirmed" | "physically_safe" | "reported_safe" | "not_present_confirmed" | "assistance_required" | "cannot_locate";
export type ConfirmationMethod = "direct_sighting" | "staff_verification" | "self_report" | "remote_contact";
export interface EmergencyEvidence {
  status: string;
  outcome?: string | null;
  confirmation_method?: string | null;
  confirmed_at?: string | null;
  presence_basis?: string | null;
}
export const METHOD_LABELS: Record<ConfirmationMethod, string> = {
  direct_sighting: "Direct sighting",
  staff_verification: "Staff physical verification",
  self_report: "Self-report",
  remote_contact: "Remote contact",
};
export const OUTCOME_LABELS: Record<EmergencyOutcome, string> = {
  attendance_unverified: "Attendance indicated — unverified",
  location_unconfirmed: "Location / at home unconfirmed",
  physically_safe: "Physically confirmed safe",
  reported_safe: "Reported safe — not physically verified",
  not_present_confirmed: "Not present — confirmed",
  assistance_required: "Assistance required",
  cannot_locate: "Cannot locate — unresolved",
};
export const LEGACY_LABELS: Record<string, string> = {
  safe: "Safe (legacy — method not recorded)",
  safe_elsewhere: "Safe elsewhere (legacy — method not recorded)",
  evacuated_offsite: "Evacuated off-site (legacy — method not recorded)",
  unaccounted: "Not accounted for (legacy)",
  not_located: "Not located — unresolved",
  assistance_required: "Assistance required",
};
export function qualifyingPhysicalMethod(method?: string | null) {
  return method === "direct_sighting" || method === "staff_verification";
}
export function emergencyPolicy(row: EmergencyEvidence) {
  const outcome = row.outcome;
  const verified = Boolean(row.confirmed_at && row.confirmation_method && Object.prototype.hasOwnProperty.call(METHOD_LABELS, row.confirmation_method));
  const physical = outcome === "physically_safe" && verified && qualifyingPhysicalMethod(row.confirmation_method);
  const notPresent = outcome === "not_present_confirmed" && verified;
  const reported = outcome === "reported_safe" && verified;
  // Old records remain reported outcomes, never retrospectively physical evidence.
  const legacyAccounted = !outcome && ["safe", "safe_elsewhere", "evacuated_offsite"].includes(row.status);
  const accounted = physical || notPresent || reported || legacyAccounted;
  return {
    label: outcome ? OUTCOME_LABELS[outcome as EmergencyOutcome] || "Unknown — unresolved" : LEGACY_LABELS[row.status] || "Unknown — unresolved",
    accounted, physical, notPresent, reported: reported || legacyAccounted,
    unresolved: !accounted,
    cannotLocate: outcome === "cannot_locate" || (!outcome && row.status === "not_located"),
    assistance: outcome === "assistance_required" || (!outcome && row.status === "assistance_required"),
    methodLabel: row.confirmation_method ? METHOD_LABELS[row.confirmation_method as ConfirmationMethod] || "Unknown method" : "Method not recorded",
  };
}
export function emergencyCounts(rows: EmergencyEvidence[]) {
  const policies = rows.map(emergencyPolicy);
  return {
    total: rows.length,
    accounted: policies.filter(p => p.accounted).length,
    physical: policies.filter(p => p.physical).length,
    reported: policies.filter(p => p.reported).length,
    notPresent: policies.filter(p => p.notPresent).length,
    outstanding: policies.filter(p => p.unresolved).length,
    cannotLocate: policies.filter(p => p.cannotLocate).length,
    assistance: policies.filter(p => p.assistance).length,
  };
}
export function initialEmergencyOutcome(structure: string, type: string, offSite = false): EmergencyOutcome {
  if (offSite || (structure === "rv" && type === "resident")) return "location_unconfirmed";
  return "attendance_unverified";
}
export function legacyStatusFor(outcome: EmergencyOutcome): string {
  return ({ physically_safe: "safe", reported_safe: "safe_elsewhere", not_present_confirmed: "evacuated_offsite", assistance_required: "assistance_required", cannot_locate: "not_located", attendance_unverified: "unaccounted", location_unconfirmed: "unaccounted" })[outcome];
}
export function validOutcomeMethod(outcome: EmergencyOutcome, method?: string | null) {
  if (outcome === "physically_safe") return qualifyingPhysicalMethod(method);
  if (["reported_safe", "not_present_confirmed", "assistance_required", "cannot_locate"].includes(outcome)) return Boolean(method && Object.prototype.hasOwnProperty.call(METHOD_LABELS, method));
  return !method;
}
export function arrivalBasis(snapshotAt?: string | null, arrivalAt?: string | null, basis?: string | null) {
  if (basis === "later_arrival" || basis === "snapshot" || basis === "offsite_record") return basis;
  if (!snapshotAt || !arrivalAt) return "legacy_unknown";
  return Date.parse(arrivalAt) > Date.parse(snapshotAt) ? "later_arrival" : "snapshot";
}
export function canCloseEmergency(rows: EmergencyEvidence[], eventClass: string, reason: string, pending = 0) {
  return pending === 0 && (emergencyCounts(rows).outstanding === 0 && eventClass === "drill" || reason.trim().length > 0);
}
export function emergencyRegulatoryNote(segment: string) {
  if (segment === "rv") return "Operational emergency record for an Australian retirement village; applicable state law and the site emergency plan require separate assessment. Not proof of legal compliance.";
  if (segment === "england") return "Operational emergency record. In England, consider the Regulatory Reform (Fire Safety) Order 2005 and CQC Regulation 12 where applicable. This report is not proof of legal compliance.";
  if (segment === "other_uk") return "Operational emergency record. Nation-specific legal requirements require separate assessment. Not proof of legal compliance.";
  return "Operational emergency record. Aged Care Act 2024 and strengthened Aged Care Quality Standards effective 1 November 2025, where applicable. This report is not proof of legal compliance.";
}
export function outcomeExport(row: EmergencyEvidence) {
  const p = emergencyPolicy(row);
  return { Outcome: p.label, "Verification method": p.methodLabel, "Confirmed at": row.confirmed_at || "", "Presence basis": row.presence_basis || "legacy_unknown" };
}
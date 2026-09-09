/**
 * Phase 7F — shared status presentation model.
 *
 * One place that decides how an operational status looks and reads.
 * Every status carries a word, a Lucide icon and a colour token, so it can be
 * understood with colour ignored (colour is never the only signal).
 *
 * Presentation only: no data access, no business rules, no workflow.
 */
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock,
  Flag,
  LifeBuoy,
  LogOut,
  MapPin,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

/** Visual role for a status. Maps to design tokens, never to a raw colour. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "emergency" | "checkout";

export type StatusKey =
  // Visit / presence
  | "expected"
  | "on-site"
  | "overdue"
  | "checked-out"
  | "on-leave"
  | "returned"
  // Screening / safeguarding
  | "clear"
  | "flagged"
  | "blocked"
  | "pending"
  // Emergency roll call
  | "safe"
  | "safe-elsewhere"
  | "not-located"
  | "assistance-required"
  | "off-site"
  // Fallback
  | "unknown";

export interface StatusPresentation {
  /** Short visible word or phrase. Sentence case. Also used as screen-reader text. */
  label: string;
  /** Plain-language meaning, for tooltips, help text and longer descriptions. */
  description: string;
  icon: LucideIcon;
  tone: StatusTone;
}

export const STATUS_PRESENTATION: Record<StatusKey, StatusPresentation> = {
  expected: {
    label: "Expected",
    description: "Booked or anticipated today, not signed in yet.",
    icon: CalendarClock,
    tone: "info",
  },
  "on-site": {
    label: "On site",
    description: "Signed in and currently on site.",
    icon: UserCheck,
    tone: "success",
  },
  overdue: {
    label: "Overdue",
    description: "Past the expected sign-out time and still signed in.",
    icon: Clock,
    tone: "warning",
  },
  "checked-out": {
    label: "Signed out",
    description: "Signed out and no longer on site.",
    icon: LogOut,
    tone: "checkout",
  },
  "on-leave": {
    label: "Away",
    description: "Away from the site on approved leave.",
    icon: MapPin,
    tone: "info",
  },
  returned: {
    label: "Returned",
    description: "Back on site and marked as returned.",
    icon: ArrowRightLeft,
    tone: "success",
  },
  clear: {
    label: "Clear",
    description: "No screening answers need follow-up.",
    icon: ShieldCheck,
    tone: "success",
  },
  flagged: {
    label: "Needs review",
    description: "An answer or record needs a staff member to look at it.",
    icon: Flag,
    tone: "warning",
  },
  blocked: {
    label: "Blocked",
    description: "Sign-in is not allowed until this is resolved by staff.",
    icon: Ban,
    tone: "danger",
  },
  pending: {
    label: "Not provided",
    description: "This has not been given or confirmed yet.",
    icon: CircleHelp,
    tone: "neutral",
  },
  safe: {
    label: "Safe",
    description: "Accounted for at the assembly point.",
    icon: CheckCircle2,
    tone: "success",
  },
  "safe-elsewhere": {
    label: "Safe elsewhere",
    description: "Accounted for, but not at the assembly point.",
    icon: ShieldCheck,
    tone: "info",
  },
  "not-located": {
    label: "Not located",
    description: "Not yet accounted for. Highest priority.",
    icon: AlertTriangle,
    tone: "emergency",
  },
  "assistance-required": {
    label: "Assistance required",
    description: "Located, but needs help to move or evacuate.",
    icon: LifeBuoy,
    tone: "danger",
  },
  "off-site": {
    label: "Off site",
    description: "Away from the site at the time of the event.",
    icon: MapPin,
    tone: "neutral",
  },
  unknown: {
    label: "Unknown",
    description: "Status is not known.",
    icon: CircleHelp,
    tone: "neutral",
  },
};

/** Safe lookup: unrecognised keys fall back to "Unknown" rather than rendering nothing. */
export function getStatusPresentation(key: string | null | undefined): StatusPresentation {
  if (!key) return STATUS_PRESENTATION.unknown;
  const normalised = key.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return STATUS_PRESENTATION[normalised as StatusKey] ?? STATUS_PRESENTATION.unknown;
}

/** Token class pairs for each tone. Subtle = badges/pills, solid = high-emphasis totals. */
export const STATUS_TONE_CLASSES: Record<StatusTone, { subtle: string; solid: string; text: string }> = {
  neutral: {
    subtle: "border-border bg-muted text-muted-foreground",
    solid: "border-transparent bg-secondary text-secondary-foreground",
    text: "text-muted-foreground",
  },
  info: {
    subtle: "border-info/30 bg-info/10 text-info-strong",
    solid: "border-transparent bg-info-solid text-info-foreground",
    text: "text-info-strong",
  },
  success: {
    subtle: "border-success/30 bg-success/10 text-success-strong",
    solid: "border-transparent bg-success-solid text-success-foreground",
    text: "text-success-strong",
  },
  warning: {
    subtle: "border-warning/40 bg-warning/10 text-warning-strong",
    solid: "border-transparent bg-warning-solid text-warning-foreground",
    text: "text-warning-strong",
  },
  danger: {
    subtle: "border-destructive/30 bg-destructive/10 text-destructive-strong",
    solid: "border-transparent bg-destructive-solid text-destructive-foreground",
    text: "text-destructive-strong",
  },
  emergency: {
    subtle: "border-emergency/40 bg-emergency/10 text-emergency-strong",
    solid: "border-transparent bg-emergency-solid text-emergency-foreground",
    text: "text-emergency-strong",
  },
  checkout: {
    subtle: "border-checkout/30 bg-checkout/10 text-checkout-strong",
    solid: "border-transparent bg-checkout-solid text-checkout-foreground",
    text: "text-checkout-strong",
  },
};

/**
 * Companion details captured at check-in.
 *
 * Two sources feed one list:
 *  - companion-only fields configured per person type (`companion_` prefixed
 *    rows in `form_fields`), and
 *  - the fields already configured for the main visitor of that person type,
 *    minus the ones that only make sense once per visit.
 *
 * Nothing here changes what is stored: companion answers keep going into the
 * existing companion detail shape on the arrival.
 */

import type { FormField } from "@/hooks/useFormFields";
import type { Jurisdiction } from "@/lib/segmentPacks";

export const COMPANION_PREFIX = "companion_";

/** Asked once for the whole arrival, never per companion. */
export const PER_VISIT_KEYS = [
  "destination",
  "whom_to_visit",
  "select_person",
  "purpose",
  "visit_purpose",
  "comments",
  "leave_mode",
  "expected_return",
  "accompanied_by",
  "body_temperature",
  "organisation",
];

export interface CompanionFieldSpec {
  /** Stable id for React keys — the configured row, or a derived id. */
  id: string;
  /** Key used inside the companion record (no prefix). */
  key: string;
  label: string;
  /** text | tel | email | date | select | yesno | textarea */
  type: string;
  required: boolean;
  /** Read-only fields display a saved value but cannot be typed into. */
  editable: boolean;
  help?: string | null;
  choices?: string[];
  source: "companion" | "visitor";
  sortOrder: number;
}

export const stripPrefix = (key: string) =>
  key.startsWith(COMPANION_PREFIX) ? key.slice(COMPANION_PREFIX.length) : key;

function choicesOf(field: FormField): string[] | undefined {
  const raw = (field as any).options;
  if (Array.isArray(raw)) return raw.map((o) => String(typeof o === "string" ? o : o?.label ?? o?.value ?? ""));
  return undefined;
}

function toSpec(field: FormField, source: "companion" | "visitor"): CompanionFieldSpec {
  return {
    id: field.id,
    key: stripPrefix(field.field_key),
    label: field.label,
    type: field.field_type || "text",
    required: !!field.required,
    editable: (field as any).is_editable !== false,
    help: (field as any).help_text ?? null,
    choices: choicesOf(field),
    source,
    sortOrder: field.sort_order,
  };
}

/**
 * What reception is asked for each companion, in order. Companion-only fields
 * come first, then the mirrored main-visitor fields that still apply.
 */
export function mergeCompanionFields(
  companionFields: FormField[],
  visitorFields: FormField[]
): CompanionFieldSpec[] {
  const companion = companionFields
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => toSpec(f, "companion"));

  const seen = new Set(companion.map((f) => f.key));

  const mirrored = visitorFields
    .filter((f) => f.is_active)
    .filter((f) => !f.field_key.startsWith(COMPANION_PREFIX))
    .filter((f) => !PER_VISIT_KEYS.includes(f.field_key))
    .filter((f) => !seen.has(f.field_key))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => toSpec(f, "visitor"));

  return [...companion, ...mirrored];
}

/** Fields a companion needs filled in before anyone can be signed in. */
export function missingCompanionFields(
  companion: Record<string, string | undefined>,
  fields: CompanionFieldSpec[]
): CompanionFieldSpec[] {
  return fields.filter((f) => f.required && !String(companion[f.key] || "").trim());
}

export interface CompanionFieldSeed {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  is_editable: boolean;
  help_text: string | null;
}

/**
 * Enough detail for a companion to stand as a person in their own right.
 * Wording follows the country the site runs in.
 */
export function defaultCompanionSeeds(jurisdiction: Jurisdiction): CompanionFieldSeed[] {
  const uk = jurisdiction === "UK";
  return [
    { field_key: "companion_first_name", label: "First name", field_type: "text", required: true, is_editable: true, help_text: "Needed so this person can be accounted for in an evacuation." },
    { field_key: "companion_surname", label: uk ? "Surname" : "Last name", field_type: "text", required: true, is_editable: true, help_text: null },
    { field_key: "companion_mobile", label: uk ? "Mobile number" : "Mobile", field_type: "tel", required: false, is_editable: true, help_text: null },
    { field_key: "companion_email", label: "Email", field_type: "email", required: false, is_editable: true, help_text: null },
    { field_key: "companion_relationship", label: "Relationship to main visitor", field_type: "text", required: false, is_editable: true, help_text: null },
    { field_key: "companion_emergency_contact_name", label: uk ? "Emergency contact name" : "Next of kin name", field_type: "text", required: false, is_editable: true, help_text: null },
    { field_key: "companion_emergency_contact_phone", label: uk ? "Emergency contact number" : "Next of kin phone", field_type: "tel", required: false, is_editable: true, help_text: null },
  ];
}

export const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "tel", label: "Phone number" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice list" },
  { value: "yesno", label: "Yes or no" },
  { value: "textarea", label: "Long text" },
];

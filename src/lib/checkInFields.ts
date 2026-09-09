/**
 * One shared answer to "what does this site ask the person at the desk?".
 *
 * Reception and the kiosk both build their details step from this resolver, so
 * the two entry points can never drift apart. Nothing is asked, validated or
 * written unless it is configured for that person type — the only exceptions
 * are first name and surname, which are always required so anyone on site can
 * be accounted for in an evacuation.
 *
 * Stored history is untouched: values captured before a field was switched off
 * remain on the record and stay visible on the profile.
 */

import type { FormField } from "@/hooks/useFormFields";
import { COMPANION_PREFIX } from "@/lib/companionFields";

export interface CheckInFieldSpec {
  /** Stable id for React keys. */
  id: string;
  /** The configured key as stored in the field configuration. */
  fieldKey: string;
  /** Key used inside the check-in form state. */
  valueKey: string;
  label: string;
  /** text | tel | email | date | select | yesno | textarea */
  type: string;
  required: boolean;
  editable: boolean;
  help: string | null;
  choices?: string[];
  /** Name fields are always present and always required. */
  core: boolean;
  sortOrder: number;
}

/** Always asked, never configurable away. */
export const CORE_FIELD_KEYS = ["first_name", "surname"] as const;

/**
 * Handled by the "who are you visiting" part of the form, so they must not be
 * rendered a second time in personal details.
 */
export const VISIT_SECTION_KEYS = [
  "destination",
  "whom_to_visit",
  "select_person",
  "visit_purpose",
  "purpose",
];

const VALUE_KEY_OVERRIDES: Record<string, string> = {
  first_name: "firstName",
  firstname: "firstName",
  surname: "surname",
  last_name: "surname",
  mobile: "mobile",
  phone: "mobile",
  email: "email",
  address: "address",
  comments: "comments",
};

export function toValueKey(fieldKey: string): string {
  const mapped = VALUE_KEY_OVERRIDES[fieldKey];
  if (mapped) return mapped;
  return fieldKey.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function choicesOf(field: FormField): string[] | undefined {
  const raw = (field as unknown as { options?: unknown }).options;
  if (Array.isArray(raw)) {
    return raw.map((o) =>
      String(typeof o === "string" ? o : (o as { label?: string; value?: string })?.label ?? (o as { value?: string })?.value ?? "")
    );
  }
  return undefined;
}

function toSpec(field: FormField): CheckInFieldSpec {
  return {
    id: field.id,
    fieldKey: field.field_key,
    valueKey: toValueKey(field.field_key),
    label: field.label,
    type: field.field_type || "text",
    required: !!field.required,
    editable: (field as unknown as { is_editable?: boolean }).is_editable !== false,
    help: (field as unknown as { help_text?: string | null }).help_text ?? null,
    choices: choicesOf(field),
    core: false,
    sortOrder: field.sort_order,
  };
}

export const NAME_FIELDS: CheckInFieldSpec[] = [
  {
    id: "core-first-name",
    fieldKey: "first_name",
    valueKey: "firstName",
    label: "First name",
    type: "text",
    required: true,
    editable: true,
    help: null,
    core: true,
    sortOrder: -20,
  },
  {
    id: "core-surname",
    fieldKey: "surname",
    valueKey: "surname",
    label: "Surname",
    type: "text",
    required: true,
    editable: true,
    help: null,
    core: true,
    sortOrder: -10,
  },
];

export interface ResolveOptions {
  /** Keep the visit-destination keys out of the personal details list. */
  excludeVisitSection?: boolean;
}

/**
 * The exact list of questions to put on screen, in order: the two name fields
 * first, then whatever this site has configured for this person type.
 */
export function resolveCheckInFields(
  fields: FormField[],
  options: ResolveOptions = {}
): CheckInFieldSpec[] {
  const { excludeVisitSection = true } = options;
  const configured = (fields || [])
    .filter((f) => f.is_active)
    .filter((f) => !f.field_key.startsWith(COMPANION_PREFIX))
    .filter((f) => !(CORE_FIELD_KEYS as readonly string[]).includes(f.field_key))
    .filter((f) => !["firstName", "lastName"].includes(f.field_key))
    .filter((f) => !(excludeVisitSection && VISIT_SECTION_KEYS.includes(f.field_key)))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toSpec);

  const seen = new Set<string>();
  const unique = configured.filter((f) => {
    if (seen.has(f.valueKey)) return false;
    seen.add(f.valueKey);
    return true;
  });

  return [...NAME_FIELDS, ...unique];
}

/** True when this site asks for that detail at all. */
export function isFieldEnabled(specs: CheckInFieldSpec[], valueKey: string): boolean {
  return specs.some((s) => s.valueKey === valueKey);
}

/** Fields still needed before the person can be signed in. */
export function missingCheckInFields(
  values: Record<string, unknown>,
  specs: CheckInFieldSpec[]
): CheckInFieldSpec[] {
  return specs.filter((s) => s.required && !String(values?.[s.valueKey] ?? "").trim());
}

/** Plain wording shown under the Continue button. */
export function missingFieldsMessage(missing: CheckInFieldSpec[]): string | null {
  if (missing.length === 0) return null;
  const labels = missing.map((m) => m.label);
  if (labels.length === 1) return `${labels[0]} is needed before signing in`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]} are needed before signing in`;
}

/** Only configured details are written to the arrival record. */
export function pickEnabledValues(
  values: Record<string, unknown>,
  specs: CheckInFieldSpec[],
  keys: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  keys.forEach((k) => {
    out[k] = isFieldEnabled(specs, k) ? String(values?.[k] ?? "") : "";
  });
  return out;
}

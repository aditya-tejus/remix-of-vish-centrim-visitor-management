import { describe, it, expect } from "vitest";
import {
  resolveCheckInFields,
  missingCheckInFields,
  missingFieldsMessage,
  isFieldEnabled,
  pickEnabledValues,
} from "@/lib/checkInFields";
import type { FormField } from "@/hooks/useFormFields";

const field = (over: Partial<FormField>): FormField => ({
  id: over.field_key || "id",
  field_key: "mobile",
  label: "Mobile",
  field_type: "tel",
  required: false,
  sort_order: 1,
  is_active: true,
  visitor_type: "visitor",
  ...over,
});

describe("configuration-aware check-in fields", () => {
  it("always asks for first name and surname", () => {
    const specs = resolveCheckInFields([]);
    expect(specs.map((s) => s.valueKey)).toEqual(["firstName", "surname"]);
    expect(specs.every((s) => s.required)).toBe(true);
  });

  it("does not ask for email when it is not configured", () => {
    const specs = resolveCheckInFields([field({ field_key: "mobile" })]);
    expect(isFieldEnabled(specs, "email")).toBe(false);
    expect(pickEnabledValues({ email: "a@b.com", mobile: "0400" }, specs, ["email", "mobile"]))
      .toEqual({ email: "", mobile: "0400" });
  });

  it("does not ask for address when it is not configured", () => {
    const specs = resolveCheckInFields([field({ field_key: "mobile" })]);
    expect(isFieldEnabled(specs, "address")).toBe(false);
  });

  it("blocks continue with a field-specific message when a required field is empty", () => {
    const specs = resolveCheckInFields([field({ field_key: "mobile", required: true })]);
    const missing = missingCheckInFields({ firstName: "Ann", surname: "Lee", mobile: "" }, specs);
    expect(missing.map((m) => m.label)).toEqual(["Mobile"]);
    expect(missingFieldsMessage(missing)).toBe("Mobile is needed before signing in");
  });

  it("passes validation once required fields are filled", () => {
    const specs = resolveCheckInFields([field({ field_key: "mobile", required: true })]);
    expect(missingCheckInFields({ firstName: "Ann", surname: "Lee", mobile: "0400" }, specs)).toEqual([]);
  });

  it("keeps visitor-type-specific fields, ignoring companion and inactive rows", () => {
    const specs = resolveCheckInFields([
      field({ field_key: "organisation", label: "Organisation", field_type: "text", sort_order: 2 }),
      field({ field_key: "companion_name", label: "Companion", sort_order: 3 }),
      field({ field_key: "email", label: "Email", is_active: false, sort_order: 4 }),
    ]);
    expect(specs.map((s) => s.valueKey)).toEqual(["firstName", "surname", "organisation"]);
  });

  it("keeps the destination question out of personal details", () => {
    const specs = resolveCheckInFields([field({ field_key: "destination", label: "Destination" })]);
    expect(specs.map((s) => s.valueKey)).toEqual(["firstName", "surname"]);
  });

  it("shows only the name fields when nothing optional is configured", () => {
    const specs = resolveCheckInFields([]);
    expect(missingCheckInFields({ firstName: "Ann", surname: "Lee" }, specs)).toEqual([]);
    expect(missingFieldsMessage([])).toBeNull();
  });
});

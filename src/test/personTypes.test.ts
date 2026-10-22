import { describe, it, expect } from "vitest";
import { buildPersonTypeConfig } from "@/hooks/usePersonTypes";

describe("new person-type question defaults", () => {
  it.each(["visitor", "contractor", "volunteer", "staff", "resident", "other"])("leaves questions off for unconfigured %s", (type) => {
    expect(buildPersonTypeConfig({}, "site-a").find((row) => row.type === type)?.screeningApplies).toBe(false);
  });
  it("preserves existing account choices", () => {
    expect(buildPersonTypeConfig({ person_type_screening_visitor: "true" }, "site-a").find((row) => row.type === "visitor")?.screeningApplies).toBe(true);
  });
  it("preserves site overrides ahead of account choices", () => {
    const rows = buildPersonTypeConfig({ person_type_screening_visitor: "true", "person_type_screening_visitor@site-a": "false" }, "site-a");
    expect(rows.find((row) => row.type === "visitor")?.screeningApplies).toBe(false);
  });
});
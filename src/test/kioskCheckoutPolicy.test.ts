import { describe, expect, it } from "vitest";
import { normalizeCheckoutName, validCheckoutName, validCheckoutCode, normalizeCheckoutCode, validDepartureSelection } from "@/lib/kioskCheckoutPolicy";
describe("public departure input policy", () => {
  it("normalizes whitespace and unicode input", () => expect(normalizeCheckoutName("  Ａnn   O'Neil ")).toBe("ann o'neil"));
  it("requires 3 to 60 name characters", () => { expect(validCheckoutName("An")).toBe(false); expect(validCheckoutName("Ann")).toBe(true); expect(validCheckoutName("a".repeat(61))).toBe(false); });
  it("does not accept wildcard enumeration syntax", () => { expect(validCheckoutName("Ann%" )).toBe(false); expect(validCheckoutName("___")).toBe(false); });
  it("accepts only complete twelve-character cards", () => { expect(validCheckoutCode("abc123def456")).toBe(true); expect(normalizeCheckoutCode(" abc123def456 ")).toBe("ABC123DEF456"); expect(validCheckoutCode("ABC123")).toBe(false); expect(validCheckoutCode("ABC123DEF45%")).toBe(false); });
  const parties = [{ id: "self", label: "You", primary: true }, { id: "other", label: "Companion 1", primary: false }];
  it("allows an explicit partial departure", () => expect(validDepartureSelection(["self"], parties)).toBe(true));
  it("rejects empty, repeated or unrelated selections", () => { expect(validDepartureSelection([], parties)).toBe(false); expect(validDepartureSelection(["self", "self"], parties)).toBe(false); expect(validDepartureSelection(["foreign"], parties)).toBe(false); });
  it("caps party selection at 50", () => { const many = Array.from({ length: 51 }, (_, i) => ({ id: String(i), label: "Companion", primary: false })); expect(validDepartureSelection(many.map(p => p.id), many)).toBe(false); });
});
import { describe, it, expect } from "vitest";
import {
  resolvePack,
  packById,
  SEGMENT_PACKS,
  SELECTABLE_PACKS,
  SEGMENT_PACK_LIST,
  defaultTermsText,
  resolveTermsContent,
} from "@/lib/segmentPacks";

describe("segment pack resolution", () => {
  it("resolves Australian residential aged care", () => {
    const pack = resolvePack("AU", "rac");
    expect(pack.id).toBe("au_rac");
    expect(pack.terms.area).toBe("Wing");
    expect(pack.terms.place).toBe("Room");
    expect(pack.modules.clinicalSupportFields).toBe(true);
    expect(pack.modules.selfReportedAway).toBe(false);
  });

  it("resolves Australian retirement villages with household wording and optional away logging", () => {
    for (const structure of ["rv", "retirement_village", "village"]) {
      const pack = resolvePack("AU", structure);
      expect(pack.id).toBe("au_rv");
    }
    const pack = resolvePack("AU", "rv");
    expect(pack.terms.area).toBe("Stage");
    expect(pack.terms.place).toBe("Villa");
    expect(pack.terms.household).toBe("Household");
    expect(pack.modules.clinicalSupportFields).toBe(false);
    expect(pack.modules.selfReportedAway).toBe(true);
    expect(pack.modules.infectionControl).toBe(false);
  });

  it("resolves UK sites with no recorded nation to the England pack (legacy behaviour)", () => {
    const pack = resolvePack("UK", "care_home");
    expect(pack.id).toBe("uk_care");
    expect(pack.nation).toBe("England");
    expect(pack.label).toContain("England");
    expect(pack.regulatorNote).toContain("Regulation 9A");
  });

  it("resolves UK sites recorded as England to the England pack", () => {
    expect(resolvePack("UK", "care_home", "England").id).toBe("uk_care");
    expect(resolvePack("UK", "care_home", "england").id).toBe("uk_care");
  });

  it("guards Scotland, Wales and Northern Ireland with a not-configured pack", () => {
    for (const nation of ["Scotland", "Wales", "Northern Ireland", "scotland", "northern ireland"]) {
      const pack = resolvePack("UK", "care_home", nation);
      expect(pack.id).toBe("uk_unconfigured");
      expect(pack.nation).toBeNull();
    }
    const guard = resolvePack("UK", "care_home", "Wales");
    expect(guard.regulatorNote).toContain("No jurisdiction pack is configured");
    expect(guard.regulatorNote).not.toContain("Regulation 9A applies");
    expect(guard.modules.infectionControl).toBe(false);
  });

  it("never offers the guard pack as an administrator choice", () => {
    expect(SELECTABLE_PACKS.map((p) => p.id)).toEqual(["au_rac", "au_rv", "uk_care"]);
    expect(SEGMENT_PACK_LIST.length).toBe(4);
  });

  it("falls back to the legacy default for unrecognised values", () => {
    expect(resolvePack(undefined, undefined).id).toBe("au_rac");
    expect(resolvePack("AU", "something-new").id).toBe("au_rac");
    expect(packById("nonsense").id).toBe("au_rac");
  });

  it("gives each pack a regulator note that disclaims legal compliance", () => {
    for (const pack of SEGMENT_PACK_LIST) {
      expect(pack.regulatorNote.length).toBeGreaterThan(20);
    }
  });
});

describe("terms wording per pack", () => {
  it("references the correct privacy regime per jurisdiction", () => {
    expect(defaultTermsText(SEGMENT_PACKS.au_rac)).toContain("Australian Privacy Act 1988");
    expect(defaultTermsText(SEGMENT_PACKS.au_rv)).toContain("Australian Privacy Act 1988");
    expect(defaultTermsText(SEGMENT_PACKS.uk_care)).toContain("UK GDPR");
  });

  it("never shows UK wording on an Australian site", () => {
    const resolved = resolveTermsContent(null, "Handled under UK GDPR and the Data Protection Act 2018", "UK", SEGMENT_PACKS.au_rac);
    expect(resolved).toBe(defaultTermsText(SEGMENT_PACKS.au_rac));
    expect(resolved).not.toContain("UK GDPR");
  });

  it("never shows Australian wording on an English site", () => {
    const resolved = resolveTermsContent(null, "Handled under the Privacy Act 1988 and OAIC guidance", "AU", SEGMENT_PACKS.uk_care);
    expect(resolved).toBe(defaultTermsText(SEGMENT_PACKS.uk_care));
    expect(resolved).not.toContain("Privacy Act 1988");
  });

  it("keeps a site's own wording above everything else", () => {
    expect(resolveTermsContent("Our own wording", "Account wording", "AU", SEGMENT_PACKS.uk_care)).toBe("Our own wording");
  });
});

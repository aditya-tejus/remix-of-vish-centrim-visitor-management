import { describe, it, expect } from "vitest";
import { issuesBySection, sectionForIssue, shortIssue } from "@/lib/checkInSections";
import { staffCheckInIssues } from "@/lib/staffCheckInRules";

describe("check-in sections", () => {
  it("sends every readiness issue to the section that fixes it", () => {
    const issues = staffCheckInIssues({
      missingDetails: ["First name", "Surname"], destinationRequired: true, destination: "",
      companionsComplete: false, missingAnswers: ["Fever in the last 48 hours?"], foodApplies: true, foodComplete: false,
      privacyRequired: true, privacyAcknowledged: false, contractorBlocked: true, contractorReason: "Insurance has expired",
      screeningBlocked: true, screeningFlagged: true, overrideApproved: false, overrideValid: false,
      keyBlocked: true, otherReasonRequired: true, otherReason: "",
    } as Parameters<typeof staffCheckInIssues>[0]);
    const by = issuesBySection(["Loading check-in requirements…", ...issues]);
    expect(by.who).toEqual(["First name is required", "Surname is required"]);
    expect(by.visit).toHaveLength(4);
    expect(by.agree).toEqual(["Confirm the terms and privacy acknowledgement"]);
    expect(by.checks).toContain("Insurance has expired");
    expect(by.checks).toContain("Answer: Fever in the last 48 hours?");
    expect(by.general).toEqual(["Loading check-in requirements…"]);
    expect(sectionForIssue("Mobile number is required")).toBe("who");
    expect(sectionForIssue("Answer: Have you had food poisoning?")).toBe("checks");
  });

  it("says what is left in few words", () => {
    expect(shortIssue("First name is required")).toBe("First name");
    expect(shortIssue("Select a destination or host")).toBe("Who they are visiting");
    expect(shortIssue("Confirm the terms and privacy acknowledgement")).toBe("Terms and privacy");
    expect(shortIssue("Answer: Any symptoms?")).toBe("Any symptoms?");
  });
});

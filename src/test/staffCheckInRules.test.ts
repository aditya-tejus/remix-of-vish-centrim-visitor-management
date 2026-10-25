import { describe, expect, it } from "vitest";
import { missingRequiredAnswers, staffCheckInIssues, type StaffReadiness } from "@/lib/staffCheckInRules";

const ready: StaffReadiness = {
  missingDetails: [], destinationRequired: false, destination: "", companionsComplete: true,
  missingAnswers: [], foodApplies: false, foodComplete: false, privacyRequired: false,
  privacyAcknowledged: false, contractorBlocked: false, contractorReason: null,
  screeningBlocked: false, screeningFlagged: false, overrideApproved: false, overrideValid: false,
  keyBlocked: false, otherReasonRequired: false, otherReason: "",
};
describe("staff-only readiness", () => {
  it("allows a simple arrival without disabled declarations", () => expect(staffCheckInIssues(ready)).toEqual([]));
  it("requires configured destination", () => expect(staffCheckInIssues({ ...ready, destinationRequired: true })).toContain("Select a destination or host"));
  it("requires companion completeness", () => expect(staffCheckInIssues({ ...ready, companionsComplete: false })).toContain("Complete required companion details"));
  it("requires explicit configured consent", () => expect(staffCheckInIssues({ ...ready, privacyRequired: true })).toContain("Confirm the terms and privacy acknowledgement"));
  it("does not auto-approve flagged answers", () => expect(staffCheckInIssues({ ...ready, screeningFlagged: true })).toContain("Enter a staff reason of at least 10 characters"));
  it("does not replace supervisor approval with a staff reason", () => expect(staffCheckInIssues({ ...ready, screeningBlocked: true, screeningFlagged: true, overrideValid: true })).toContain("Supervisor approval is required for this check-in"));
  it("does not clear credential denial with screening approval", () => expect(staffCheckInIssues({ ...ready, contractorBlocked: true, contractorReason: "Expired document", overrideApproved: true })).toEqual(["Expired document"]));
  it("requires food only when configured and applicable", () => expect(staffCheckInIssues({ ...ready, foodApplies: true })).toContain("Complete the food declaration"));
  it("preserves the outstanding-key requirement", () => expect(staffCheckInIssues({ ...ready, keyBlocked: true })).toContain("Return the outstanding key or enter a reason of at least 3 characters"));
  it("preserves the Other reason minimum", () => expect(staffCheckInIssues({ ...ready, otherReasonRequired: true, otherReason: "ab" })).toContain("Enter a visit reason of at least 3 characters"));
  it("accepts an explicit No answer, not an unanswered required question", () => {
    const questions = [{ id: "q", question: "Any symptoms?", type: "yesno", required: true }];
    expect(missingRequiredAnswers(questions, {})).toEqual(["Any symptoms?"]);
    expect(missingRequiredAnswers(questions, { q: false })).toEqual([]);
  });
  it("requires a checked required acknowledgement", () => expect(missingRequiredAnswers([{ id: "terms", type: "checkbox", required: true }], { terms: false })).toEqual(["terms"]));
});
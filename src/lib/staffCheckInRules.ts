/** Staff-only guards. Shared kiosk policy and server decisions remain untouched. */
export interface RequiredAnswer {
  id: string;
  label?: string;
  question?: string;
  type?: string;
  required?: boolean;
}

export function missingRequiredAnswers(questions: RequiredAnswer[], answers: Record<string, unknown>): string[] {
  return questions.filter(q => {
    if (!q.required) return false;
    const value = answers[q.id];
    if (q.type === "yesno") return value !== true && value !== false;
    if (q.type === "checkbox") return value !== true;
    return value === undefined || value === null || (typeof value === "string" && !value.trim());
  }).map(q => q.label || q.question || q.id);
}

export interface StaffReadiness {
  missingDetails: string[];
  destinationRequired: boolean;
  destination: string;
  companionsComplete: boolean;
  missingAnswers: string[];
  foodApplies: boolean;
  foodComplete: boolean;
  privacyRequired: boolean;
  privacyAcknowledged: boolean;
  contractorBlocked: boolean;
  contractorReason: string | null;
  screeningBlocked: boolean;
  screeningFlagged: boolean;
  overrideApproved: boolean;
  overrideValid: boolean;
  keyBlocked: boolean;
  otherReasonRequired: boolean;
  otherReason: string;
}

export function staffCheckInIssues(state: StaffReadiness): string[] {
  return [
    ...state.missingDetails.map(label => `${label} is required`),
    ...(state.destinationRequired && !state.destination.trim() ? ["Select a destination or host"] : []),
    ...(!state.companionsComplete ? ["Complete required companion details"] : []),
    ...state.missingAnswers.map(label => `Answer: ${label}`),
    ...(state.foodApplies && !state.foodComplete ? ["Complete the food declaration"] : []),
    ...(state.privacyRequired && !state.privacyAcknowledged ? ["Confirm the terms and privacy acknowledgement"] : []),
    ...(state.contractorBlocked ? [state.contractorReason || "Contractor requirements need attention"] : []),
    ...(state.screeningBlocked && !state.overrideApproved ? ["Supervisor approval is required for this check-in"] : []),
    ...(state.screeningFlagged && !state.overrideApproved && !state.overrideValid ? ["Enter a staff reason of at least 10 characters"] : []),
    ...(state.keyBlocked ? ["Return the outstanding key or enter a reason of at least 3 characters"] : []),
    ...(state.otherReasonRequired && state.otherReason.trim().length < 3 ? ["Enter a visit reason of at least 3 characters"] : []),
  ];
}
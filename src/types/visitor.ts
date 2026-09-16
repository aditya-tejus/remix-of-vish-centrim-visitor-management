export type VisitorType = "visitor" | "resident" | "contractor" | "staff" | "volunteer" | "other";

export interface CompanionDetail {
  name?: string;
  phone?: string;
  email?: string;
  relation?: string;
  /** ISO time this companion left, when they leave separately from the main visitor. */
  checkedOutAt?: string;
  /** Chosen deliberately by reception from people already known at this site. */
  person_id?: string;
  /** "true" when reception asked for this companion to be remembered as a new person. */
  create_person?: string;
  [key: string]: string | undefined;
}



export interface Visitor {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
  type: VisitorType;
  checkInTime: Date;
  checkOutTime: Date | null;
  whomToVisit: string;
  address: string;
  status: "checked-in" | "checked-out";
  healthDeclaration: boolean;
  additionalVisitors: number;
  companionDetails?: CompanionDetail[];
  comments: string;
  bodyTemperature?: number;
  influenzaVaccineDate?: string;
  influenzaVaccineEvidence?: string;
  covidVaccineStatus?: boolean;
  covidDose1Date?: string;
  covidDose2Date?: string;
  covidVaccineEvidence?: string;
  retentionExpiry: Date;
  acknowledgedPrivacy: boolean;
  expectedReturnDate?: Date;
  checkoutReason?: string;
  /** True when the system closed the visit, so the real departure time is unknown. */
  autoCheckedOut?: boolean;
  leaveType?: string;
  returnNotificationOptIn?: boolean;
  accompaniedBy?: string;
  accompaniedByName?: string;
  healthAnswers?: Record<string, any>;
  /** Overall check-in question outcome: clear, flagged or blocked. */
  screeningOutcome?: "clear" | "flagged" | "blocked";
  /** Which questions raised a concern, and how serious — never the answers themselves. */
  screeningFlags?: { question_id: string; severity: string; action: string }[];
  contractorScreening?: Record<string, any>;
  supplierId?: string;
  qrCode?: string;
  personQr?: string;
  /** Stable per attempt, so a retry after a timeout cannot create a second arrival. */
  clientRequestId?: string;

  groupId?: string;
  /** Group arrivals: the shared group name, carried on every attendee's own record. */
  groupLabel?: string;
  groupOrganiserName?: string;
  groupOrganiserContact?: string;
  /** Who confirmed the terms, and whether they confirmed for themselves. */
  termsConfirmedBy?: string;
  termsConfirmationMode?: "self" | "organiser_declared";
  /** Volunteers only. */
  volunteerRole?: string;
  volunteerSupervisor?: string;
  volunteerExpectedEnd?: Date;
  /** "Other" person type: the plain-language reason for the visit. */
  visitReasonOther?: string;
  /** Residents this person came to see (proper link, not just free text). */
  visitedResidentIds?: string[];


}

export interface RetentionSettings {
  period: 30 | 60 | 90 | 180;
}

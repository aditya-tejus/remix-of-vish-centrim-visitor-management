export type VisitorType = "visitor" | "resident" | "contractor" | "staff" | "volunteer";

export interface CompanionDetail {
  name?: string;
  phone?: string;
  email?: string;
  relation?: string;
  /** ISO time this companion left, when they leave separately from the main visitor. */
  checkedOutAt?: string;
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
  leaveType?: string;
  returnNotificationOptIn?: boolean;
  accompaniedBy?: string;
  accompaniedByName?: string;
  healthAnswers?: Record<string, any>;
  contractorScreening?: Record<string, any>;
  supplierId?: string;
  qrCode?: string;
  personQr?: string;
  groupId?: string;

}

export interface RetentionSettings {
  period: 30 | 60 | 90 | 180;
}

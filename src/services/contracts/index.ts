/**
 * Centrim Life shared-module contracts.
 *
 * These interfaces are the ONLY boundary the visitor-management product should use
 * to reach data that another Centrim Life module owns. Nothing in this file should
 * assume a local table exists.
 *
 * Every implementation is registered in `src/services/registry.ts`.
 * Temporary implementations live in `src/services/adapters/local/` and are named
 * `LocalPrototype*` so they can never be mistaken for the real platform service.
 */

export interface SiteRef {
  id: string;
  name: string;
  code: string | null;
  organisationId: string | null;
  jurisdiction: "AU" | "UK" | string;
  /** rac | retirement_village | care_home | mixed */
  siteStructure: string | null;
  isLegacyPlaceholder: boolean;
}

export interface AreaRef {
  id: string;
  siteId: string | null;
  /** Wing (RAC/care home) or Stage (retirement village) — label comes from site structure. */
  name: string;
  sortOrder: number;
}

export interface ResidentRef {
  /** Stable resident identity in the owning module. */
  id: string;
  firstName: string;
  surname: string;
  room: string | null;
  areaName: string | null;
  siteId: string | null;
}

export interface ResidentSupportInfo {
  residentId: string;
  mobilityLevel: string | null;
  mobilityAids: string[];
  assistanceRequired: string | null;
  dolsLpsFlag: boolean;
  riskAssessmentLevel: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface StaffRef {
  id: string;
  firstName: string;
  surname: string;
  department: string | null;
  siteId: string | null;
}

export interface SupplierRef {
  id: string;
  name: string;
  siteId: string | null;
}

export interface ContractorWorkerRef {
  id: string;
  firstName: string;
  surname: string;
  supplierId: string | null;
  supplierName: string | null;
  /** Names of required checks that are missing or expired. Never the documents themselves. */
  outstandingCredentials: string[];
}

export interface StoredDocumentRef {
  path: string;
  signedUrl: string | null;
}

export interface NotificationRequest {
  event: string;
  siteId: string | null;
  subject: string;
  body: string;
  recipientEmails: string[];
  recipientStaffIds: string[];
}

export interface AuditEvent {
  action: string;
  performedBy: string;
  siteId?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
  recordsAffected?: number;
}

export interface PermissionContext {
  userId: string | null;
  role: "admin" | "staff" | "user" | null;
  siteIds: string[];
}

/* ---------------------------------------------------------------- services */

export interface SiteDirectoryService {
  listSites(): Promise<SiteRef[]>;
  listAreas(siteId?: string | null): Promise<AreaRef[]>;
}

export interface ResidentDirectoryService {
  /** Staff context. Returns identity plus location only. */
  listResidents(siteId?: string | null): Promise<ResidentRef[]>;
  /** Kiosk context. Search-only, minimum fields, no clinical data. */
  searchResidentsPublic(search: string, siteId?: string | null): Promise<ResidentRef[]>;
  /** Staff context only. Support/clinical information for evacuation and duty of care. */
  getSupportInfo(residentIds: string[]): Promise<ResidentSupportInfo[]>;
}

export interface StaffDirectoryService {
  listStaff(siteId?: string | null): Promise<StaffRef[]>;
  searchStaffPublic(search: string, siteId?: string | null): Promise<StaffRef[]>;
}

export interface SupplierDirectoryService {
  listSuppliers(siteId?: string | null): Promise<SupplierRef[]>;
  listSuppliersPublic(siteId?: string | null): Promise<SupplierRef[]>;
  findWorker(params: {
    firstName?: string;
    surname?: string;
    mobile?: string;
    qr?: string;
    /** Kiosk context: recognition never crosses sites. */
    siteId?: string | null;
  }): Promise<ContractorWorkerRef | null>;
}

export interface DocumentService {
  upload(bucketPath: string, file: File): Promise<StoredDocumentRef>;
  getSignedUrl(path: string): Promise<string | null>;
}

export interface NotificationService {
  /** Returns true when the message was accepted for delivery by the platform. */
  send(request: NotificationRequest): Promise<boolean>;
}

export interface AuditService {
  record(event: AuditEvent): Promise<void>;
}

export interface PermissionService {
  getContext(): Promise<PermissionContext>;
  canAccessSite(siteId: string | null): Promise<boolean>;
}

export interface CentrimServices {
  sites: SiteDirectoryService;
  residents: ResidentDirectoryService;
  staff: StaffDirectoryService;
  suppliers: SupplierDirectoryService;
  documents: DocumentService;
  notifications: NotificationService;
  audit: AuditService;
  permissions: PermissionService;
}

/**
 * TEMPORARY LOCAL ADAPTERS — NOT the source of truth.
 *
 * Each adapter below reads the visitor-management prototype's own tables because the
 * corresponding Centrim Life platform service is not yet available in this project.
 * They exist only so the product can be built against the contracts today.
 *
 * Replacement contract for every adapter is documented in
 * docs/INTEGRATION_CONTRACTS.md. Do not add business rules here — adapters map data,
 * nothing else.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  AreaRef,
  AuditEvent,
  AuditService,
  CentrimServices,
  ContractorWorkerRef,
  DocumentService,
  NotificationRequest,
  NotificationService,
  PermissionContext,
  PermissionService,
  ResidentDirectoryService,
  ResidentRef,
  ResidentSupportInfo,
  SiteDirectoryService,
  SiteRef,
  StaffDirectoryService,
  StaffRef,
  StoredDocumentRef,
  SupplierDirectoryService,
  SupplierRef,
} from "@/services/contracts";

/** Replaced by: Centrim Life Properties/Sites module. */
export const LocalPrototypeSiteDirectory: SiteDirectoryService = {
  async listSites() {
    const { data } = await supabase.from("branches").select("*").eq("is_active", true).order("name");
    return ((data as any[]) || []).map(
      (b): SiteRef => ({
        id: b.id,
        name: b.name,
        code: b.code ?? null,
        organisationId: b.organisation_id ?? null,
        jurisdiction: b.jurisdiction ?? "AU",
        siteStructure: b.site_structure ?? null,
        isLegacyPlaceholder: !!b.is_legacy_placeholder,
      })
    );
  },
  async listAreas(siteId) {
    let q = supabase.from("wings").select("*").eq("is_active", true).order("sort_order");
    if (siteId) q = q.eq("branch_id", siteId);
    const { data } = await q;
    return ((data as any[]) || []).map(
      (w): AreaRef => ({ id: w.id, siteId: w.branch_id ?? null, name: w.name, sortOrder: w.sort_order ?? 0 })
    );
  },
};

/** Replaced by: Centrim Life Residents / Clinical module (read-only). */
export const LocalPrototypeResidentDirectory: ResidentDirectoryService = {
  async listResidents(siteId) {
    let q = supabase
      .from("visitors")
      .select("id, first_name, surname, branch_id, resident_details(room, wing_id, wings(name))")
      .eq("type", "resident")
      .order("first_name");
    if (siteId) q = q.eq("branch_id", siteId);
    const { data } = await q;
    return ((data as any[]) || []).map((v): ResidentRef => {
      const rd = Array.isArray(v.resident_details) ? v.resident_details[0] : v.resident_details;
      const wing = Array.isArray(rd?.wings) ? rd?.wings[0] : rd?.wings;
      return {
        id: v.id,
        firstName: v.first_name,
        surname: v.surname,
        room: rd?.room ?? null,
        areaName: wing?.name ?? null,
        siteId: v.branch_id ?? null,
      };
    });
  },
  async searchResidentsPublic(search) {
    const { data } = await supabase.rpc("kiosk_resident_directory" as any, { p_search: search || null });
    return ((data as any[]) || []).map(
      (r): ResidentRef => ({
        id: r.visitor_id,
        firstName: r.first_name,
        surname: r.surname,
        room: r.room ?? null,
        areaName: r.area_name ?? null,
        siteId: null,
      })
    );
  },
  async getSupportInfo(residentIds) {
    if (!residentIds.length) return [];
    const { data } = await supabase
      .from("resident_details")
      .select(
        "visitor_id, mobility_level, mobility_aids, dols_lps_flag, risk_assessment_level, emergency_contact_name, emergency_contact_phone"
      )
      .in("visitor_id", residentIds);
    return ((data as any[]) || []).map(
      (r): ResidentSupportInfo => ({
        residentId: r.visitor_id,
        mobilityLevel: r.mobility_level ?? null,
        mobilityAids: r.mobility_aids ?? [],
        assistanceRequired: null,
        dolsLpsFlag: !!r.dols_lps_flag,
        riskAssessmentLevel: r.risk_assessment_level ?? null,
        emergencyContactName: r.emergency_contact_name ?? null,
        emergencyContactPhone: r.emergency_contact_phone ?? null,
      })
    );
  },
};

/** Replaced by: Centrim Life Staff/HR module. */
export const LocalPrototypeStaffDirectory: StaffDirectoryService = {
  async listStaff(siteId) {
    let q = supabase.from("staff_members").select("*").eq("is_active", true).order("first_name");
    if (siteId) q = q.eq("branch_id", siteId);
    const { data } = await q;
    return ((data as any[]) || []).map(
      (s): StaffRef => ({
        id: s.id,
        firstName: s.first_name,
        surname: s.surname,
        department: s.department ?? null,
        siteId: s.branch_id ?? null,
      })
    );
  },
  async searchStaffPublic(search) {
    const { data } = await supabase.rpc("kiosk_staff_directory" as any, { p_search: search || null });
    return ((data as any[]) || []).map(
      (s): StaffRef => ({
        id: s.id,
        firstName: s.first_name,
        surname: s.surname,
        department: s.department ?? null,
        siteId: null,
      })
    );
  },
};

/** Replaced by: Centrim Life Suppliers / Contractor compliance module. */
export const LocalPrototypeSupplierDirectory: SupplierDirectoryService = {
  async listSuppliers(siteId) {
    let q = supabase.from("suppliers_min").select("id, name, branch_id").eq("is_active", true).order("name");
    if (siteId) q = q.eq("branch_id", siteId);
    const { data } = await q;
    return ((data as any[]) || []).map(
      (s): SupplierRef => ({ id: s.id, name: s.name, siteId: s.branch_id ?? null })
    );
  },
  async listSuppliersPublic() {
    const { data } = await supabase.rpc("kiosk_supplier_directory" as any);
    return ((data as any[]) || []).map((s): SupplierRef => ({ id: s.id, name: s.name, siteId: null }));
  },
  async findWorker(params) {
    const { data } = await supabase.rpc("kiosk_contractor_lookup" as any, {
      p_mobile: params.mobile || null,
      p_qr: params.qr || null,
      p_first: params.firstName || null,
      p_last: params.surname || null,
    });
    const row = (data as any[])?.[0];
    if (!row) return null;
    const worker: ContractorWorkerRef = {
      id: row.person_id,
      firstName: row.first_name,
      surname: row.surname,
      supplierId: row.supplier_id ?? null,
      supplierName: row.supplier_name ?? null,
      outstandingCredentials: row.outstanding_credentials ?? [],
    };
    return worker;
  },
};

/** Replaced by: Centrim Life Files/Documents service. */
export const LocalPrototypeDocuments: DocumentService = {
  async upload(bucketPath, file) {
    const { error } = await supabase.storage.from("contractor-documents").upload(bucketPath, file, { upsert: true });
    if (error) throw error;
    const signed = await LocalPrototypeDocuments.getSignedUrl(bucketPath);
    const ref: StoredDocumentRef = { path: bucketPath, signedUrl: signed };
    return ref;
  },
  async getSignedUrl(path) {
    const { data } = await supabase.storage.from("contractor-documents").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  },
};

/**
 * Replaced by: Centrim Life Notifications service.
 * BLOCKER: there is no delivery channel in this project. This adapter records the
 * intended recipients in the audit trail and returns false — it never claims delivery.
 */
export const LocalPrototypeNotifications: NotificationService = {
  async send(request: NotificationRequest) {
    await supabase.from("audit_log").insert({
      action: "notification_not_delivered",
      performed_by: "System",
      records_affected: 0,
      change_reason: `${request.event}: ${request.subject}`,
      details: {
        site_id: request.siteId,
        recipients: [...request.recipientEmails, ...request.recipientStaffIds],
        body: request.body,
        reason: "No notification delivery channel is connected in this project.",
      } as any,
    });
    return false;
  },
};

/** Replaced by: Centrim Life Audit service. */
export const LocalPrototypeAudit: AuditService = {
  async record(event: AuditEvent) {
    await supabase.from("audit_log").insert({
      action: event.action,
      performed_by: event.performedBy,
      records_affected: event.recordsAffected ?? 0,
      change_reason: event.reason ?? null,
      details: { site_id: event.siteId ?? null, ...(event.details || {}) } as any,
    });
  },
};

/** Replaced by: Centrim Life Authentication / Permissions. */
export const LocalPrototypePermissions: PermissionService = {
  async getContext() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? null;
    if (!userId) {
      const empty: PermissionContext = { userId: null, role: null, siteIds: [] };
      return empty;
    }
    const [{ data: roles }, { data: sites }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).order("role").limit(1),
      supabase.from("user_site_access").select("branch_id").eq("user_id", userId),
    ]);
    return {
      userId,
      role: ((roles as any[])?.[0]?.role as PermissionContext["role"]) ?? null,
      siteIds: ((sites as any[]) || []).map((s) => s.branch_id),
    };
  },
  async canAccessSite(siteId) {
    if (!siteId) return true;
    const ctx = await LocalPrototypePermissions.getContext();
    return ctx.role === "admin" || ctx.siteIds.includes(siteId);
  },
};

export const localPrototypeServices: CentrimServices = {
  sites: LocalPrototypeSiteDirectory,
  residents: LocalPrototypeResidentDirectory,
  staff: LocalPrototypeStaffDirectory,
  suppliers: LocalPrototypeSupplierDirectory,
  documents: LocalPrototypeDocuments,
  notifications: LocalPrototypeNotifications,
  audit: LocalPrototypeAudit,
  permissions: LocalPrototypePermissions,
};

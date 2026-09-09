import { describe, it, expect } from "vitest";
import {
  ageInDays,
  daysUntil,
  documentStoragePath,
  filterQueue,
  isOutstanding,
  isVerified,
  statusDetail,
  summariseCompliance,
  validateDecision,
  type ComplianceRow,
  type QueueRow,
} from "@/lib/contractorDocuments";

const NOW = new Date("2026-09-09T09:00:00Z");

function row(p: Partial<ComplianceRow>): ComplianceRow {
  return {
    credential_type_id: "t1",
    credential_key: "insurance",
    label: "Public liability insurance",
    short_label: "Insurance",
    holder_scope: "company",
    mandatory: true,
    block_on_fail: false,
    grace_days: 0,
    status: "missing",
    expiry_date: null,
    grace_ends: null,
    blocking: false,
    document_id: null,
    version: null,
    submitted_at: null,
    reviewed_at: null,
    ...p,
  };
}

describe("document status meaning", () => {
  it("treats awaiting review as outstanding and never as verified", () => {
    expect(isOutstanding("pending")).toBe(true);
    expect(isVerified("pending")).toBe(false);
  });

  it("treats rejected, expired and missing as outstanding", () => {
    for (const s of ["rejected", "expired", "missing"] as const) {
      expect(isOutstanding(s)).toBe(true);
      expect(isVerified(s)).toBe(false);
    }
  });

  it("treats verified and expiring as satisfied, and not-required as no action", () => {
    expect(isVerified("valid")).toBe(true);
    expect(isVerified("expiring")).toBe(true);
    expect(isOutstanding("not_required")).toBe(false);
  });

  it("counts a document inside its grace period as still covered but visible", () => {
    expect(isVerified("grace")).toBe(true);
    expect(isOutstanding("grace")).toBe(true);
    const detail = statusDetail(
      row({ status: "grace", expiry_date: "2026-09-01", grace_ends: "2026-09-15" }),
      NOW
    );
    expect(detail).toContain("grace period ends 2026-09-15");
  });

  it("says how long is left before expiry", () => {
    expect(daysUntil("2026-09-19", NOW)).toBeGreaterThanOrEqual(10);
    expect(daysUntil(null, NOW)).toBeNull();
  });
});

describe("reception summary", () => {
  it("lists outstanding mandatory documents and blocks only when told to", () => {
    const s = summariseCompliance(
      [
        row({ credential_key: "insurance", status: "valid", expiry_date: "2027-01-01" }),
        row({ credential_key: "dbs", label: "DBS check", status: "pending", blocking: true }),
      ],
      NOW
    );
    expect(s.blocked).toBe(true);
    expect(s.blockedReason).toContain("DBS check");
    expect(s.outstanding).toEqual(["DBS check"]);
    expect(s.awaitingReview).toBe(1);
  });

  it("flags without blocking when the site has not chosen to stop work", () => {
    const s = summariseCompliance([row({ status: "expired", expiry_date: "2026-01-01" })], NOW);
    expect(s.blocked).toBe(false);
    expect(s.outstanding).toEqual(["Public liability insurance"]);
  });

  it("shows nothing outstanding when a document is not required at this site", () => {
    const s = summariseCompliance([row({ status: "not_required", mandatory: false })], NOW);
    expect(s.outstanding).toEqual([]);
    expect(s.blocked).toBe(false);
  });
});

describe("reviewer decisions", () => {
  it("refuses a second decision on the same version", () => {
    expect(validateDecision({ decision: "approved", alreadyDecided: true }).ok).toBe(false);
  });

  it("refuses a rejection with no reason and no notes", () => {
    expect(validateDecision({ decision: "rejected" }).ok).toBe(false);
    expect(validateDecision({ decision: "rejected", notes: "  " }).ok).toBe(false);
  });

  it("accepts a rejection with a reason code or written notes", () => {
    expect(validateDecision({ decision: "rejected", reasonCode: "illegible" }).ok).toBe(true);
    expect(validateDecision({ decision: "rejected", notes: "Cover too low" }).ok).toBe(true);
  });

  it("accepts approve and not required without notes", () => {
    expect(validateDecision({ decision: "approved" }).ok).toBe(true);
    expect(validateDecision({ decision: "not_required" }).ok).toBe(true);
  });
});

describe("review queue", () => {
  const rows: QueueRow[] = [
    {
      id: "a", branch_id: "s1", credential_type_id: "t1", holder_scope: "person",
      holder_name: "Alan Smith", company_name: "Acme", type_label: "DBS check",
      status: "pending", version: 2, submitted_by: "reception", submitted_at: "2026-09-01T09:00:00Z",
      expiry_date: null,
    },
    {
      id: "b", branch_id: "s1", credential_type_id: "t2", holder_scope: "company",
      holder_name: "Acme", company_name: "Acme", type_label: "Insurance",
      status: "verified", version: 1, submitted_by: "reception", submitted_at: "2026-09-08T09:00:00Z",
      expiry_date: "2027-01-01",
    },
  ];

  it("shows only awaiting review by default, oldest first", () => {
    const out = filterQueue(rows, { status: "pending" }, NOW);
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("filters by document type, age and free text", () => {
    expect(filterQueue(rows, { status: "all", credentialTypeId: "t2" }, NOW).map((r) => r.id)).toEqual(["b"]);
    expect(filterQueue(rows, { status: "all", minAgeDays: 5 }, NOW).map((r) => r.id)).toEqual(["a"]);
    expect(filterQueue(rows, { status: "all", search: "alan" }, NOW).map((r) => r.id)).toEqual(["a"]);
  });

  it("measures how long a document has waited", () => {
    expect(ageInDays("2026-09-01T09:00:00Z", NOW)).toBe(8);
  });
});

describe("document storage paths", () => {
  it("puts the site first so storage rules can check it, and never uses the file name", () => {
    const path = documentStoragePath({
      branchId: "11111111-1111-1111-1111-111111111111",
      holderScope: "person",
      holderId: "22222222-2222-2222-2222-222222222222",
      credentialKey: "dbs check",
      fileName: "Scan of my DBS.PDF",
      uid: "33333333-3333-3333-3333-333333333333",
    });
    expect(path).toBe(
      "11111111-1111-1111-1111-111111111111/person/22222222-2222-2222-2222-222222222222/dbs_check/33333333-3333-3333-3333-333333333333.pdf"
    );
    expect(path).not.toContain("Scan");
  });
});

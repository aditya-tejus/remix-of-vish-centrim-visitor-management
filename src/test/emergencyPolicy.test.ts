import { describe, expect, it } from "vitest";
import { arrivalBasis, canCloseEmergency, emergencyCounts, emergencyPolicy, initialEmergencyOutcome, legacyStatusFor, outcomeExport, validOutcomeMethod, type EmergencyOutcome } from "@/lib/emergencyPolicy";

const at = "2026-10-25T22:00:00Z";
describe("Emergency evidence policy", () => {
  it.each(["safe", "safe_elsewhere", "evacuated_offsite"])("preserves %s without inventing physical evidence", status => {
    expect(emergencyPolicy({ status })).toMatchObject({accounted: true, physical: false, reported: true});
  });
  it.each(["unaccounted", "not_located", "assistance_required", "unknown"])("does not count %s as safe", status => {
    expect(emergencyPolicy({status})).toMatchObject({accounted: false, physical: false, unresolved: true});
  });
  it.each(["self_report", "remote_contact", "unknown", null])("rejects physical safety by %s", confirmation_method => {
    expect(emergencyPolicy({status: "safe", outcome: "physically_safe", confirmation_method, confirmed_at: at}).accounted).toBe(false);
  });
  it.each(["direct_sighting", "staff_verification"])("accepts physical safety by %s", confirmation_method => {
    expect(emergencyPolicy({status: "safe", outcome: "physically_safe", confirmation_method, confirmed_at: at}).physical).toBe(true);
  });
  it("requires a recorded time", () => expect(emergencyPolicy({status: "safe",outcome: "physically_safe",confirmation_method: "direct_sighting"}).physical).toBe(false));
  it.each(["rac", "england"])("starts %s residents as attendance indicated, not safe", segment => {
    expect(initialEmergencyOutcome(segment, "resident")).toBe("attendance_unverified");
  });
  it("starts independent village residents as location unconfirmed", () => expect(initialEmergencyOutcome("rv", "resident")).toBe("location_unconfirmed"));
  it("keeps visitors distinct from villa residents", () => expect(initialEmergencyOutcome("rv", "visitor")).toBe("attendance_unverified"));
  it("never treats leave as physical verification", () => expect(initialEmergencyOutcome("rac", "resident", true)).toBe("location_unconfirmed"));
  it("distinguishes snapshot, arrivals and offsite provenance", () => {
    expect(arrivalBasis(at,"2026-10-25T22:01:00Z")).toBe("later_arrival");
    expect(arrivalBasis(at,"2026-10-25T21:59:00Z")).toBe("snapshot");
    expect(arrivalBasis(at,null,"offsite_record")).toBe("offsite_record");
    expect(arrivalBasis(null,null)).toBe("legacy_unknown");
  });
  it("counts partial evacuation and reports separately", () => {
    const rows = [
      {status:"safe",outcome:"physically_safe",confirmation_method:"direct_sighting",confirmed_at:at},
      {status:"safe_elsewhere",outcome:"reported_safe",confirmation_method:"remote_contact",confirmed_at:at},
      {status:"evacuated_offsite",outcome:"not_present_confirmed",confirmation_method:"staff_verification",confirmed_at:at},
      {status:"not_located"}, {status:"assistance_required"},
    ];
    expect(emergencyCounts(rows)).toEqual({total:5,accounted:3,physical:1,reported:1,notPresent:1,outstanding:2,cannotLocate:1,assistance:1});
    expect(rows.map(outcomeExport).filter(r => r.Outcome === "Not located — unresolved")).toHaveLength(1);
  });
  it("requires reasons for unresolved closure and live events and blocks pending replay", () => {
    expect(canCloseEmergency([{status:"not_located"}],"drill","")).toBe(false);
    expect(canCloseEmergency([{status:"not_located"}],"drill","Transferred to incident response")).toBe(true);
    expect(canCloseEmergency([{status:"safe"}],"real","")).toBe(false);
    expect(canCloseEmergency([{status:"safe"}],"drill","",1)).toBe(false);
  });
  it("corrections remove the accounted count", () => {
    expect(emergencyCounts([{status:"safe",outcome:"location_unconfirmed"}]).accounted).toBe(0);
  });
  it.each(["attendance_unverified", "location_unconfirmed", "physically_safe", "reported_safe", "not_present_confirmed", "assistance_required", "cannot_locate"] as EmergencyOutcome[])("maps %s into preserved legacy status vocabulary", outcome => {
    expect(["unaccounted","safe","safe_elsewhere","evacuated_offsite","not_located","assistance_required"]).toContain(legacyStatusFor(outcome));
  });
  it("does not accept unknown verification methods", () => expect(validOutcomeMethod("reported_safe","toString")).toBe(false));
});
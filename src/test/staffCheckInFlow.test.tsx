import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCheckInFlow } from "@/components/checkin/useCheckInFlow";
import { buildPersonTypeConfig } from "@/hooks/usePersonTypes";

const fixtures = vi.hoisted(() => ({
  settings: [] as { key: string; value: string }[],
  fields: [] as any[], questions: [] as any[], companions: [] as any[],
  people: [] as any[], queryCalls: [] as any[], types: [] as any[],
}));
vi.mock("@/contexts/SiteContext", () => ({ useSite: () => ({ currentSiteId: "site-a", isLegacySite: false }) }));
vi.mock("@/contexts/OperatingContext", () => ({
  useOperatingContext: () => ({ siteId: "site-a", pack: { jurisdiction: "AU" } }),
  siteScopedKey: (key: string, site: string) => `${key}@${site}`,
}));
vi.mock("@/lib/segmentPacks", () => ({ resolveTermsContent: () => "Site terms" }));
vi.mock("@/hooks/useResidents", () => ({ useResidents: () => ({ residents: [{ visitorId: "resident-a", name: "Rose Lee", room: "1", wing: "East" }] }) }));
vi.mock("@/hooks/useStaffMembers", () => ({ useStaffMembers: () => ({ staff: [] }) }));
vi.mock("@/hooks/useOpenKeyIssues", () => ({ useOpenKeyIssues: () => ({ overdueForName: () => [], policy: { enforcement: "warn" } }) }));
vi.mock("@/hooks/usePersonTypes", async (original) => ({
  ...await original<any>(),
  usePersonTypes: () => ({ personTypes: fixtures.types, deskTypes: fixtures.types.filter(t => t.type !== "resident"), extras: { volunteerRoleEnabled: true, volunteerSupervisorEnabled: true, volunteerExpectedEndEnabled: true } }),
}));
vi.mock("@/hooks/useHealthQuestions", () => ({
  useActiveHealthQuestions: () => ({ data: fixtures.questions }),
  useActiveVaccinationFields: () => ({ data: [] }),
}));
vi.mock("@/hooks/useFormFields", () => ({
  useFormFields: () => ({ data: fixtures.fields }),
  useCompanionFields: () => ({ data: fixtures.companions }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query: any = {};
    for (const name of ["select", "in", "or", "neq", "eq", "order", "limit"]) {
      query[name] = (...args: any[]) => { fixtures.queryCalls.push([table, name, ...args]); return query; };
    }
    query.then = (cb: any) => Promise.resolve(cb({ data: table === "settings" ? fixtures.settings : fixtures.people }));
    return query;
  },
  rpc: vi.fn(async () => ({ error: null })), auth: { getUser: async () => ({ data: { user: { email: "operator@example.test" } } }) },
} }));
afterEach(cleanup);
beforeEach(() => {
  fixtures.settings = []; fixtures.fields = []; fixtures.questions = []; fixtures.companions = [];
  fixtures.people = []; fixtures.queryCalls = []; fixtures.types = buildPersonTypeConfig({}, "site-a");
});

describe("staff check-in baseline payload and guards", () => {
  it.each(["visitor", "contractor", "volunteer", "staff", "other"] as const)("preserves %s type and required names", (type) => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.setSelectedType(type); result.current.setStep("details"); });
    expect(result.current.canProceed).toBe(false);
    act(() => { result.current.updateField("firstName", "Ann"); result.current.updateField("surname", "Lee"); });
    expect(result.current.buildVisitor()).toMatchObject({ firstName: "Ann", surname: "Lee", type, status: "checked-in", checkOutTime: null });
  });
  it("clears disabled contact fields and keeps the retry request key", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => result.current.selectProfile({ id: "old", firstName: "Ann", surname: "Lee", email: "old@example.test", mobile: "0400", address: "Old address" }));
    const first = result.current.buildVisitor();
    expect(first).toMatchObject({ email: "", mobile: "", address: "" });
    expect(result.current.buildVisitor().clientRequestId).toBe(first.clientRequestId);
    expect(result.current.isReturning).toBe(true);
  });
  it("preserves companion explicit identity and normalises names", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => result.current.setCompanions([{ first_name: "Ben", surname: "Lee", person_id: "person-b", mobile: "0401" }]));
    expect(result.current.buildVisitor()).toMatchObject({ additionalVisitors: 1, companionDetails: [{ name: "Ben Lee", phone: "0401", person_id: "person-b" }] });
  });
  it("requires configured privacy consent", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => result.current.setStep("confirm"));
    expect(result.current.canProceed).toBe(false);
    act(() => result.current.setPrivacyAcknowledged(true));
    expect(result.current.buildVisitor().acknowledgedPrivacy).toBe(true);
  });
  it("never clears a contractor credential block", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.setSelectedType("contractor"); result.current.setStep("screening"); result.current.setContractorGate({ blocked: true, reason: "Document expired" }); });
    expect(result.current.canProceed).toBe(false);
    expect(result.current.contractorBlockReason).toBe("Document expired");
  });
  it("scopes returning lookup to current site", async () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    await act(async () => result.current.setSearchQuery("Ann"));
    expect(fixtures.queryCalls).toContainEqual(["visitors", "eq", "branch_id", "site-a"]);
  });
  it("retains configured mobile and resident link in payload", () => {
    fixtures.fields = [{ id: "mobile", field_key: "mobile", field_type: "tel", label: "Mobile", required: true, is_active: true, sort_order: 1 }];
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.updateField("mobile", "0400"); result.current.updateField("selectPerson", "Rose Lee"); });
    expect(result.current.buildVisitor()).toMatchObject({ mobile: "0400", visitedResidentIds: ["resident-a"] });
  });
});
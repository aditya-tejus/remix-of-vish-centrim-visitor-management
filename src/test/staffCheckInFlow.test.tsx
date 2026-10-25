import { act, cleanup, renderHook, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCheckInFlow } from "@/components/checkin/useCheckInFlow";
import { buildPersonTypeConfig } from "@/hooks/usePersonTypes";
import { CheckInSheet } from "@/components/checkin/CheckInSheet";

const fixtures = vi.hoisted(() => ({
  settings: [] as { key: string; value: string }[],
  fields: [] as any[], questions: [] as any[], companions: [] as any[],
  people: [] as any[], queryCalls: [] as any[], types: [] as any[], site: "site-a" as string | null,
  pending: false, configError: false,
}));
vi.mock("@/contexts/SiteContext", () => ({ useSite: () => ({ currentSiteId: fixtures.site, currentSite: { name: "Test site" }, isLegacySite: false }) }));
vi.mock("@/hooks/usePeopleLookup", () => ({ usePeopleLookup: () => ({ matches: [], searching: false }) }));
vi.mock("@/components/ContractorScreening", () => ({ ContractorScreening: () => <div>Contractor requirements</div> }));
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
  useFormFields: () => ({ data: fixtures.fields, isPending: fixtures.pending, isError: fixtures.configError }),
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
  fixtures.site = "site-a"; fixtures.pending = false; fixtures.configError = false;
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
  it("preserves preset and profile prefill without skipping fresh consent", async () => {
    const { result } = renderHook(() => useCheckInFlow(true, "contractor", { firstName: "Ann", surname: "Lee", type: "volunteer" }));
    await act(async () => {});
    expect(result.current.selectedType).toBe("volunteer");
    expect(result.current.formData.firstName).toBe("Ann");
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.privacyAcknowledged).toBe(false);
  });
  it("retains contractor supplier and dedicated answer payload", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.setSelectedType("contractor"); result.current.setSelectedSupplier({ id: "supplier-a" } as any); result.current.setContractorScreeningAnswers({ access: false }); });
    expect(result.current.buildVisitor()).toMatchObject({ supplierId: "supplier-a", contractorScreening: { access: false }, healthAnswers: { access: false } });
  });
  it("records explicit consent attribution", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.updateField("firstName", "Ann"); result.current.updateField("surname", "Lee"); result.current.setPrivacyAcknowledged(true); });
    expect(result.current.buildVisitor()).toMatchObject({ termsConfirmedBy: "Ann Lee", termsConfirmationMode: "self", acknowledgedPrivacy: true });
  });
  it("uses configured blocked outcomes instead of silently accepting them", () => {
    fixtures.types = buildPersonTypeConfig({ person_type_screening_visitor: "true" }, "site-a");
    fixtures.questions = [{ id: "q", question: "Symptoms?", type: "yesno", required: true, warning_answers: ["yes"], outcome_action: "block", severity: "critical" }];
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => result.current.setHealthAnswers({ q: true }));
    expect(result.current.screeningBlocked).toBe(true);
    expect(result.current.validationIssues).toContain("Supervisor approval is required for this check-in");
  });
  it("blocks unanswered required questions and accepts explicit No", () => {
    fixtures.types = buildPersonTypeConfig({ person_type_screening_visitor: "true" }, "site-a");
    fixtures.questions = [{ id: "q", question: "Symptoms?", type: "yesno", required: true }];
    const { result } = renderHook(() => useCheckInFlow(true));
    expect(result.current.validationIssues).toContain("Answer: Symptoms?");
    act(() => result.current.setHealthAnswers({ q: false }));
    expect(result.current.validationIssues).not.toContain("Answer: Symptoms?");
  });
  it("reuses the deliberately selected returning personal code", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => result.current.selectProfile({ id: "old", firstName: "Ann", surname: "Lee", email: "", mobile: "", address: "", personQr: "ABC123DEF456" }));
    expect(result.current.buildVisitor().personQr).toBe("ABC123DEF456");
  });
  it("saves configured volunteer extras", () => {
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.setSelectedType("volunteer"); result.current.setVolunteerRole("Gardening"); result.current.setVolunteerSupervisor("Sam"); result.current.setVolunteerExpectedEnd("14:30"); });
    const payload = result.current.buildVisitor();
    expect(payload).toMatchObject({ volunteerRole: "Gardening", volunteerSupervisor: "Sam" });
    expect(payload.volunteerExpectedEnd?.getHours()).toBe(14);
    expect(payload.volunteerExpectedEnd?.getMinutes()).toBe(30);
  });
  it("blocks when requirements are loading or failed", () => {
    fixtures.pending = true;
    const { result, rerender } = renderHook(() => useCheckInFlow(true));
    expect(result.current.canSubmit).toBe(false);
    fixtures.pending = false; fixtures.configError = true; rerender();
    expect(result.current.configurationError).toBe(true);
    expect(result.current.canSubmit).toBe(false);
  });
  it("refuses to silently save a draft at a different site", () => {
    const { result, rerender } = renderHook(() => useCheckInFlow(true));
    fixtures.site = "site-b"; rerender();
    expect(result.current.validationIssues).toContain("The site changed. Close and reopen check-in for the selected site.");
    expect(result.current.canSubmit).toBe(false);
  });
  it("does not search other sites when no site is selected", async () => {
    fixtures.site = null;
    const { result } = renderHook(() => useCheckInFlow(true));
    await act(async () => result.current.setSearchQuery("Ann"));
    expect(fixtures.queryCalls.filter(call => call[0] === "visitors")).toEqual([]);
    expect(result.current.canSubmit).toBe(false);
  });
  it("invalidates supervisor approval when answers change", async () => {
    fixtures.types = buildPersonTypeConfig({ person_type_screening_visitor: "true" }, "site-a");
    fixtures.questions = [{ id: "q", question: "Symptoms?", type: "yesno", warning_answers: ["yes"], outcome_action: "block" }];
    const { result } = renderHook(() => useCheckInFlow(true));
    act(() => { result.current.setHealthAnswers({ q: true }); result.current.setOverrideReason("Reviewed by supervisor"); });
    await act(async () => { await result.current.approveBlockedScreening(); });
    expect(result.current.overrideApprovedBy).toBe("operator@example.test");
    act(() => result.current.setHealthAnswers({ q: false }));
    expect(result.current.overrideApprovedBy).toBeNull();
  });
});

describe("staff sheet mocked save and accessible interactions", () => {
  async function fillSimpleStaff() {
    await waitFor(() => expect(screen.queryByText("Loading check-in requirements…")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Staff" }));
    fireEvent.change(screen.getByRole("textbox", { name: "First name" }), { target: { value: "Ann" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Surname" }), { target: { value: "Lee" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Check In" })).toBeEnabled());
  }
  it("waits for confirmed save and prevents duplicate rapid submissions", async () => {
    let resolveSave: ((value: any) => void) | undefined;
    const onAdd = vi.fn((_visitor: any) => new Promise<any>(resolve => { resolveSave = resolve; }));
    render(<CheckInSheet open onOpenChange={vi.fn()} onAdd={onAdd} />);
    await fillSimpleStaff();
    const button = screen.getByRole("button", { name: "Check In" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ann Lee checked in!")).not.toBeInTheDocument();
    await act(async () => resolveSave?.({ ...onAdd.mock.calls[0][0], id: "saved-a" }));
    expect(screen.getByText("Ann Lee checked in!")).toBeInTheDocument();
  });
  it("preserves answers and request key on failed save and retry", async () => {
    const onAdd = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(async value => ({ ...value, id: "saved-a" }));
    render(<CheckInSheet open onOpenChange={vi.fn()} onAdd={onAdd} />);
    await fillSimpleStaff();
    fireEvent.click(screen.getByRole("button", { name: "Check In" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue("Ann");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Ann Lee checked in!");
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onAdd.mock.calls[1][0].clientRequestId).toBe(onAdd.mock.calls[0][0].clientRequestId);
  });
  it("does not submit invalid details and names the sheet and search", async () => {
    const onAdd = vi.fn();
    render(<CheckInSheet open onOpenChange={vi.fn()} onAdd={onAdd} />);
    expect(screen.getByRole("dialog", { name: "Check In" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Returning visitor lookup" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check In" }));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
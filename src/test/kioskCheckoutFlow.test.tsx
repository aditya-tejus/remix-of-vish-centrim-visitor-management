import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKioskCheckout, useKioskCheckoutName } from "@/hooks/useKioskCheckout";
import { KioskDepartureConfirmation } from "@/components/kiosk/KioskDepartureConfirmation";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/kioskRpc", () => ({ kioskRpc: rpc }));
vi.mock("@/components/kiosk/KioskFeedbackScreen", () => ({ KioskFeedbackScreen: () => <p>Feedback after saved departure</p> }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { rpc.mockReset(); });
describe("private kiosk departure interactions", () => {
  it("never requests a name directory below minimum length", async () => {
    vi.useFakeTimers(); renderHook(() => useKioskCheckoutName("An")); await act(async () => { vi.advanceTimersByTime(500); }); expect(rpc).not.toHaveBeenCalled();
  });
  it("discards stale name responses", async () => {
    vi.useFakeTimers(); let finish: ((v: any) => void) | undefined;
    rpc.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ name }) => useKioskCheckoutName(name), { initialProps: { name: "Ann" } });
    await act(async () => { vi.advanceTimersByTime(400); }); rerender({ name: "A" });
    await act(async () => { finish?.({ data: { names: ["must not render"] }, error: null }); });
    expect(result.current.message).toBe(""); expect(result.current.busy).toBe(false);
  });
  it("rejects invalid cards without a remote request", async () => {
    const { result } = renderHook(useKioskCheckout);
    expect(await result.current.lookup("short")).toEqual({ state: "invalid_input" }); expect(rpc).not.toHaveBeenCalled();
  });
  const match = { state: "ready" as const, visit_id: "visit", visitor_id: "visitor", visitor_type: "visitor", open_keys: 1, parties: [{ id: "self", label: "You", primary: true }, { id: "other", label: "Companion 1", primary: false }] };
  it("preserves choices on failed save and submits only selected parties on retry", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } }).mockResolvedValueOnce({ data: { saved: true }, error: null });
    render(<KioskDepartureConfirmation code="ABC123DEF456" match={match} onBack={vi.fn()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Only I am leaving" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm sign out" }));
    await screen.findByRole("alert"); expect(screen.queryByText("Feedback after saved departure")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Sign out You" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Sign out Companion 1" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Feedback after saved departure");
    expect(rpc.mock.calls[1]).toEqual(["kioskd_checkout_submit", { p_code: "ABC123DEF456", p_visit_id: "visit", p_party_ids: ["self"] }]);
  });
  it("prevents duplicate presses and waits for server success", async () => {
    let finish: ((v: any) => void) | undefined; rpc.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<KioskDepartureConfirmation code="ABC123DEF456" match={match} onBack={vi.fn()} onComplete={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Confirm sign out" }); fireEvent.click(button); fireEvent.click(button);
    expect(rpc).toHaveBeenCalledTimes(1); expect(screen.queryByText("Feedback after saved departure")).toBeNull();
    await act(async () => { finish?.({ data: { saved: true }, error: null }); }); await screen.findByText("Feedback after saved departure");
  });
  it("does not treat a false business result as saved", async () => {
    rpc.mockResolvedValue({ data: { saved: false }, error: null }); const { result } = renderHook(useKioskCheckout);
    await act(async () => { await expect(result.current.depart("ABC123DEF456", "visit", ["self"])).rejects.toThrow("departure_not_saved"); });
    await waitFor(() => expect(result.current.saving).toBe(false));
  });
});
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserPlus, LogOut } from "lucide-react";
import { QuickAction, AttentionRow, KioskActionTile } from "@/components/ui/reception-primitives";

afterEach(cleanup);

describe("shared reception actions preserve commands", () => {
  it("runs the existing check-in command once", () => {
    const openCheckIn = vi.fn();
    render(<QuickAction icon={UserPlus} onClick={openCheckIn}>Check In</QuickAction>);
    fireEvent.click(screen.getByRole("button", { name: "Check In" }));
    expect(openCheckIn).toHaveBeenCalledTimes(1);
  });

  it("does not run a disabled command", () => {
    const signOut = vi.fn();
    render(<QuickAction icon={LogOut} disabled onClick={signOut}>Check Out</QuickAction>);
    fireEvent.click(screen.getByRole("button", { name: "Check Out" }));
    expect(signOut).not.toHaveBeenCalled();
  });

  it("opens the existing attention destination", () => {
    const navigate = vi.fn();
    render(<AttentionRow label="Overdue visits" count={3} onClick={() => navigate("/visit-list")} />);
    fireEvent.click(screen.getByRole("button", { name: /Overdue visits/ }));
    expect(navigate).toHaveBeenCalledWith("/visit-list");
  });

  it("runs the kiosk sign-out command without starting another flow", () => {
    const navigate = vi.fn();
    render(<KioskActionTile icon={LogOut} onClick={() => navigate("/kiosk/checkout")}>Sign Out</KioskActionTile>);
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(navigate.mock.calls).toEqual([["/kiosk/checkout"]]);
  });
});
import { describe, it, expect } from "vitest";
import { currentDeliveryStatus, EXTERNAL_CHANNELS_CONFIGURED } from "@/lib/notificationDelivery";

describe("external notification delivery", () => {
  it("does not report delivery without a connected channel", () => {
    expect(EXTERNAL_CHANNELS_CONFIGURED).toBe(false);
    expect(currentDeliveryStatus().state).toBe("not_configured");
  });
});
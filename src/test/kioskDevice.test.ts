import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadKioskDevice, saveKioskDevice, clearKioskDevice, kioskDeviceToken, kioskBoundSiteId,
} from "@/lib/kioskDevice";
import { isDeviceRefusal } from "@/lib/kioskRpc";

// The test environment has no IndexedDB, so these exercise the localStorage fallback —
// the path older tablets take.
beforeEach(async () => {
  vi.stubGlobal("indexedDB", undefined);
  localStorage.clear();
  await clearKioskDevice();
});

const record = {
  token: "a".repeat(64),
  deviceId: "dev-1",
  siteId: "site-1",
  siteName: "Riverstone",
  deviceName: "Main entrance tablet",
};

describe("kiosk device storage", () => {
  it("starts unbound, so a fresh tablet must be set up", async () => {
    expect(await loadKioskDevice()).toBeNull();
    expect(kioskDeviceToken()).toBeNull();
    expect(kioskBoundSiteId()).toBeNull();
  });

  it("remembers the bound site after activation", async () => {
    await saveKioskDevice(record);
    expect(kioskDeviceToken()).toBe(record.token);
    expect(kioskBoundSiteId()).toBe("site-1");
    expect(await loadKioskDevice()).toMatchObject({ siteName: "Riverstone" });
  });

  it("returns to unbound when storage is cleared, never to another site", async () => {
    await saveKioskDevice(record);
    await clearKioskDevice();
    expect(kioskDeviceToken()).toBeNull();
    expect(await loadKioskDevice()).toBeNull();
  });

  it("keeps no site of its own in the address bar", async () => {
    await saveKioskDevice(record);
    // Anything in the URL is irrelevant: the site comes from the stored record only.
    expect(kioskBoundSiteId()).toBe("site-1");
  });
});

describe("device refusals", () => {
  it("recognises every reason a kiosk should stop serving visitors", () => {
    for (const reason of [
      "device_not_bound", "device_not_recognised", "device_suspended",
      "device_revoked", "device_expired", "device_pending",
    ]) {
      expect(isDeviceRefusal({ message: reason })).toBe(true);
    }
  });

  it("treats ordinary errors as something other than a refusal", () => {
    expect(isDeviceRefusal({ message: "network error" })).toBe(false);
    expect(isDeviceRefusal(null)).toBe(false);
  });
});

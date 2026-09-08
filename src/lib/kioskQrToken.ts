/**
 * Rotating token for the "check in from your phone" QR code shown on the kiosk
 * attract screen. The code changes every 5 minutes so a photo of the screen
 * cannot be reused later.
 */
export const KIOSK_QR_WINDOW_MS = 5 * 60 * 1000;

export function currentKioskQrSlot(at: number = Date.now()) {
  return Math.floor(at / KIOSK_QR_WINDOW_MS);
}

export function createKioskQrToken(at: number = Date.now()) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${currentKioskQrSlot(at).toString(36)}-${rand}`;
}

/** A token is valid for its own 5-minute window plus the previous one (grace). */
export function isKioskQrTokenValid(token: string | null | undefined, at: number = Date.now()) {
  if (!token) return true; // no token supplied — treat as a direct visit, not an expired scan
  const slot = parseInt(token.split("-")[0] ?? "", 36);
  if (!Number.isFinite(slot)) return false;
  const now = currentKioskQrSlot(at);
  return slot === now || slot === now - 1;
}

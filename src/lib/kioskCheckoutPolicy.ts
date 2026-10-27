/** Name input never establishes identity or authorises a departure. */
export const CHECKOUT_NAME_MIN = 3;
export const CHECKOUT_NAME_MAX = 60;
export const CHECKOUT_PARTY_MAX = 50;
export function normalizeCheckoutName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function validCheckoutName(value: string) {
  const name = normalizeCheckoutName(value);
  return name.length >= CHECKOUT_NAME_MIN && name.length <= CHECKOUT_NAME_MAX && /^[\p{L} .'-]+$/u.test(name);
}
export function normalizeCheckoutCode(value: string) { return value.trim().toUpperCase(); }
export function validCheckoutCode(value: string) { return /^[A-Z0-9]{12}$/.test(normalizeCheckoutCode(value)); }
export interface CheckoutParty { id: string; label: string; primary: boolean }
export interface CheckoutLookup {
  state: "ready" | "staff_required" | "no_match" | "invalid_input";
  visitor_id?: string;
  visit_id?: string;
  visitor_type?: string;
  parties?: CheckoutParty[];
  open_keys?: number;
}
export function validDepartureSelection(ids: string[], parties: CheckoutParty[]) {
  return ids.length > 0 && ids.length <= CHECKOUT_PARTY_MAX && new Set(ids).size === ids.length && ids.every(id => parties.some(p => p.id === id));
}
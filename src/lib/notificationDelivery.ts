/**
 * Honest delivery states.
 *
 * Nothing in this product sends email, SMS, push or Teams messages. There is no
 * delivery adapter configured, so every alert this system raises is created and
 * shown in the app, and written to the audit trail. It is never "delivered" to
 * anyone outside the app.
 *
 * When a real channel is wired up later it should set `channel` and move a
 * notification through queued -> delivered / failed. Until then the only honest
 * state to display is "In-app only".
 */
export type DeliveryState = "created" | "queued" | "delivered" | "failed" | "not_configured";

export interface DeliveryStatus {
  state: DeliveryState;
  label: string;
  detail: string;
}

/** No external channel exists yet — this is the single source of that truth. */
export const EXTERNAL_CHANNELS_CONFIGURED = false;

export const DELIVERY_LABELS: Record<DeliveryState, string> = {
  created: "Raised in app",
  queued: "Waiting to send",
  delivered: "Sent",
  failed: "Failed to send",
  not_configured: "In-app only",
};

/**
 * The delivery status for an alert raised now. While no channel is configured
 * this always reports in-app only, so no screen can imply someone was emailed.
 */
export function currentDeliveryStatus(): DeliveryStatus {
  if (!EXTERNAL_CHANNELS_CONFIGURED) {
    return {
      state: "not_configured",
      label: DELIVERY_LABELS.not_configured,
      detail:
        "No email, text or messaging channel is connected. Alerts appear in the app and are written to the record — nobody is contacted outside the app.",
    };
  }
  return { state: "created", label: DELIVERY_LABELS.created, detail: "Raised in the app." };
}

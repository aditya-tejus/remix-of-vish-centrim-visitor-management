/**
 * Service registry.
 *
 * Application code should import `services` from here and never talk to a
 * platform-owned table directly. Swapping in the real Centrim Life modules means
 * replacing entries in this object — nothing else in the app should need to change.
 */
import type { CentrimServices } from "@/services/contracts";
import { localPrototypeServices } from "@/services/adapters/local";

/** All entries are currently temporary local adapters — see docs/INTEGRATION_CONTRACTS.md. */
export const services: CentrimServices = localPrototypeServices;

export const serviceProvenance: Record<keyof CentrimServices, "centrim-life" | "local-prototype-adapter"> = {
  sites: "local-prototype-adapter",
  residents: "local-prototype-adapter",
  staff: "local-prototype-adapter",
  suppliers: "local-prototype-adapter",
  documents: "local-prototype-adapter",
  notifications: "local-prototype-adapter",
  audit: "local-prototype-adapter",
  permissions: "local-prototype-adapter",
};

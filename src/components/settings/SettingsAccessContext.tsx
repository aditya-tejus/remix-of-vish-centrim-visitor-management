/**
 * Phase 7E hardening — one answer to "may this person change the settings
 * section that is open?", shared by the page and every control inside it.
 *
 * This is a clarity and safety gate in the app. The database is the real
 * boundary: it only accepts settings writes from the administrator role.
 */
import { createContext, useContext, ReactNode } from "react";

export interface SettingsAccessValue {
  canEdit: boolean;
  audience: string;
  deniedReason: string;
}

const SettingsAccessContext = createContext<SettingsAccessValue>({
  canEdit: true,
  audience: "",
  deniedReason: "",
});

export function SettingsAccessProvider({
  value,
  children,
}: {
  value: SettingsAccessValue;
  children: ReactNode;
}) {
  return <SettingsAccessContext.Provider value={value}>{children}</SettingsAccessContext.Provider>;
}

/** Read the access decision for the settings section currently open. */
export function useSectionAccess() {
  return useContext(SettingsAccessContext);
}

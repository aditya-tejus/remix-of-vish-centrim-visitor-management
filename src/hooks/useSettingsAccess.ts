import { usePermissions, Permission, PERMISSION_LABELS } from "@/hooks/usePermissions";
import type { SettingsSection } from "@/components/settings/SettingsNav";

/**
 * Phase 7E — one place that answers "may this person change this settings
 * section?". It reuses the existing granular permissions; no new permission is
 * introduced and no permission is widened.
 */
const SECTION_PERMISSION: Record<SettingsSection, Permission> = {
  context: "settings.administer",
  "person-types": "settings.administer",
  visitor: "settings.administer",
  contractor: "settings.administer",
  volunteer: "settings.administer",
  staff: "settings.administer",
  resident: "settings.administer",
  presence: "settings.administer",
  printing: "settings.administer",
  keys: "keys.manage",
  feedback: "settings.administer",
  compliance: "privacy.manage",
  governance: "settings.administer",
  audit: "settings.administer",
  integration: "settings.administer",
};

/** Plain-language description of who may change each section. */
const SECTION_AUDIENCE: Record<SettingsSection, string> = {
  context: "Administrators only.",
  "person-types": "Administrators only.",
  visitor: "Administrators and senior reception staff.",
  contractor: "Administrators and senior reception staff.",
  volunteer: "Administrators and senior reception staff.",
  staff: "Administrators only.",
  resident: "Administrators and care leads.",
  presence: "Administrators only.",
  printing: "Administrators and senior reception staff.",
  keys: "Anyone who manages the keys and fobs register.",
  feedback: "Administrators only.",
  compliance: "The person responsible for privacy at your organisation.",
  governance: "Administrators only.",
  audit: "Administrators only.",
  integration: "Administrators only.",
};

export function useSettingsAccess(section: SettingsSection) {
  const { can, loading } = usePermissions();
  const permission = SECTION_PERMISSION[section];
  const canEdit = can(permission);
  return {
    loading,
    canEdit,
    permission,
    audience: SECTION_AUDIENCE[section],
    /** Shown when the page is read-only. */
    deniedReason: `You can see these settings but not change them. Changing them needs the "${PERMISSION_LABELS[permission]}" permission. ${SECTION_AUDIENCE[section]}`,
  };
}

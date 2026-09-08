/**
 * Scoped settings helpers (Stage 1E).
 *
 * A setting can be recorded at six levels. The most specific value wins:
 *
 *   area (wing/stage) > site > person type > role > organisation > jurisdiction > global
 *
 * The legacy flat `settings` table is the final fallback so nothing breaks while
 * settings are migrated across. No new toggles are introduced here — this only
 * establishes scope and inheritance.
 */
import { supabase } from "@/integrations/supabase/client";

export type SettingScope =
  | "global"
  | "jurisdiction"
  | "organisation"
  | "site"
  | "area"
  | "person_type"
  | "role";

export interface SettingSelector {
  branchId?: string | null;
  wingId?: string | null;
  personType?: string | null;
  role?: string | null;
  jurisdiction?: string | null;
}

export const SCOPE_PRECEDENCE: SettingScope[] = [
  "area",
  "site",
  "person_type",
  "role",
  "organisation",
  "jurisdiction",
  "global",
];

/** Resolves one setting through the inheritance chain (server side, so RLS applies). */
export async function resolveSetting(
  key: string,
  selector: SettingSelector = {}
): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_setting" as any, {
    p_key: key,
    p_branch_id: selector.branchId ?? null,
    p_wing_id: selector.wingId ?? null,
    p_person_type: selector.personType ?? null,
    p_role: selector.role ?? null,
    p_jurisdiction: selector.jurisdiction ?? null,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function resolveSettings(
  keys: string[],
  selector: SettingSelector = {}
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    keys.map(async (k) => [k, await resolveSetting(k, selector)] as const)
  );
  return Object.fromEntries(entries);
}

/** Writes a value at an explicit scope. Admin only — enforced by database policy. */
export async function writeScopedSetting(params: {
  key: string;
  value: string;
  scope: SettingScope;
  branchId?: string | null;
  wingId?: string | null;
  organisationId?: string | null;
  personType?: string | null;
  role?: string | null;
  jurisdiction?: string | null;
}) {
  const { error } = await supabase.from("settings_scoped" as any).upsert(
    {
      key: params.key,
      value: params.value,
      scope_type: params.scope,
      branch_id: params.branchId ?? null,
      wing_id: params.wingId ?? null,
      organisation_id: params.organisationId ?? null,
      person_type: params.personType ?? null,
      role: params.role ?? null,
      jurisdiction: params.jurisdiction ?? null,
    } as any,
    { onConflict: "key,scope_type" } as any
  );
  if (error) throw error;
}

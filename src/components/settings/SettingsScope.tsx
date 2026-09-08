/**
 * Shows administrators which level a settings page applies at, so they know
 * how far a change reaches before they make it. Presentation only.
 */
import { Globe, Building2, MapPin, Layers, Users, ShieldCheck } from "lucide-react";

export type SettingsScopeLevel =
  | "global"
  | "jurisdiction"
  | "organisation"
  | "site"
  | "area"
  | "person-type"
  | "role";

const SCOPE_META: Record<SettingsScopeLevel, { label: string; help: string; icon: typeof Globe }> = {
  global: { label: "All sites", help: "Applies everywhere in this account.", icon: Globe },
  jurisdiction: { label: "Country rules", help: "Applies to every site in this country.", icon: ShieldCheck },
  organisation: { label: "Organisation", help: "Applies to every site in this organisation.", icon: Building2 },
  site: { label: "This site", help: "Applies to the site you are working in.", icon: MapPin },
  area: { label: "Area", help: "Applies to a wing, stage or property.", icon: Layers },
  "person-type": { label: "Per visitor type", help: "Set separately for each type of person.", icon: Users },
  role: { label: "Per role", help: "Set separately for each staff role.", icon: ShieldCheck },
};

export function SettingsScopeBadge({ scope }: { scope: SettingsScopeLevel }) {
  const meta = SCOPE_META[scope];
  const Icon = meta.icon;
  return (
    <span
      title={meta.help}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function SettingsPageHeading({
  title,
  description,
  scopes,
}: {
  title: string;
  description?: string;
  scopes: SettingsScopeLevel[];
}) {
  return (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {scopes.map((s) => (
          <SettingsScopeBadge key={s} scope={s} />
        ))}
      </div>
      {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
    </div>
  );
}

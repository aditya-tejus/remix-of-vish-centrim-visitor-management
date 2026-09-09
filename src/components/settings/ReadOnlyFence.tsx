/**
 * Phase 7E hardening — wraps a settings section so that someone without the
 * section's permission can still read every value but cannot change anything.
 *
 * A disabled fieldset switches off every control inside it in one step:
 * inputs, switches, dropdowns, dialog triggers and save buttons. Values stay
 * on screen. The explanation itself is shown once, above, by the section header.
 */
import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useSectionAccess } from "./SettingsAccessContext";

export function ReadOnlyFence({ children }: { children: ReactNode }) {
  const { canEdit } = useSectionAccess();

  if (canEdit) return <>{children}</>;

  return (
    <div className="space-y-3">
      <p className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Read only
      </p>
      <fieldset
        disabled
        aria-label="These settings are read only for you"
        className="m-0 min-w-0 border-0 p-0 opacity-90"
      >
        {children}
      </fieldset>
    </div>
  );
}

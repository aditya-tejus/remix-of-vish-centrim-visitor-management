/**
 * Phase 7E — one honest row per decision.
 *
 * Shows what the setting does, where the value is actually stored, what it
 * changes on the kiosk or staff screens, and whether it can be put back.
 * Storage wording must describe the real storage, never an implied override.
 */
import { ReactNode } from "react";
import { RotateCcw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingStorage =
  | "site"          // saved against this site only
  | "account"       // one shared value for the whole account
  | "inherited"     // no value saved here; a wider level is being used
  | "overridden"    // a wider value exists and this level replaces it
  | "record";       // stored on the record itself (e.g. the site record)

const STORAGE_TEXT: Record<SettingStorage, string> = {
  site: "Saved for this site",
  account: "One value for the whole account",
  inherited: "Using the wider default — nothing saved here",
  overridden: "Changed here, replacing the wider default",
  record: "Saved on the site record",
};

export interface SettingRowProps {
  label: string;
  /** Plain language: what this decides. */
  help?: string;
  /** What changes on the kiosk, the front desk or reports. */
  effect?: string;
  /** Whether past records are affected. Defaults to the honest "no". */
  pastRecords?: string;
  storage?: SettingStorage;
  /** Text of the default so an administrator knows what "back to normal" is. */
  defaultText?: string;
  readOnly?: boolean;
  /** Shown only when a reset is genuinely possible. */
  onReset?: () => void;
  resetLabel?: string;
  error?: string | null;
  children: ReactNode;
}

export function SettingRow({
  label,
  help,
  effect,
  pastRecords = "Records already saved are not changed.",
  storage,
  defaultText,
  readOnly,
  onReset,
  resetLabel = "Reset to default",
  error,
  children,
}: SettingRowProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-2.5", error && "border-destructive")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {storage && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {STORAGE_TEXT[storage]}
              </span>
            )}
            {readOnly && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" /> Read only
              </span>
            )}
          </div>
          {help && <p className="text-[13px] text-muted-foreground">{help}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>

      {(effect || defaultText) && (
        <dl className="space-y-1 pt-1">
          {effect && (
            <div className="grid grid-cols-[86px_1fr] gap-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Effect</dt>
              <dd className="text-[12px] text-foreground">{effect}</dd>
            </div>
          )}
          {defaultText && (
            <div className="grid grid-cols-[86px_1fr] gap-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Default</dt>
              <dd className="text-[12px] text-foreground">{defaultText}</dd>
            </div>
          )}
          <div className="grid grid-cols-[86px_1fr] gap-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Past records</dt>
            <dd className="text-[12px] text-muted-foreground">{pastRecords}</dd>
          </div>
        </dl>
      )}

      {error && <p className="text-[12px] font-medium text-destructive">{error}</p>}

      {onReset && !readOnly && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-[12px]" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          {resetLabel}
        </Button>
      )}
    </div>
  );
}

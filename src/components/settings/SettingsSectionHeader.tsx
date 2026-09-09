/**
 * Phase 7E — the header every settings section shares: what it is for, who may
 * change it, and a read-only explanation when the person cannot.
 */
import { Lock, Info } from "lucide-react";

interface Props {
  purpose: string;
  audience: string;
  canEdit: boolean;
  deniedReason?: string;
  /** Optional honest note about where these values live. */
  storageNote?: string;
}

export function SettingsSectionHeader({ purpose, audience, canEdit, deniedReason, storageNote }: Props) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-[13px] text-foreground">{purpose}</p>
          <p className="text-[12px] text-muted-foreground">Who can change this: {audience}</p>
          {storageNote && <p className="text-[12px] text-muted-foreground">{storageNote}</p>}
        </div>
      </div>
      {!canEdit && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3"
        >
          <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-[13px] text-muted-foreground">{deniedReason}</p>
        </div>
      )}
    </div>
  );
}

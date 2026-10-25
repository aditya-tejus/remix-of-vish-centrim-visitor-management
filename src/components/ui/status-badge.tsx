/**
 * Phase 7F — StatusBadge.
 *
 * Renders an operational status as icon + word so it is readable with colour
 * ignored. The icon is always decorative (aria-hidden); the word is the
 * accessible text. Presentation only.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  getStatusPresentation,
  STATUS_TONE_CLASSES,
  type StatusKey,
  type StatusPresentation,
} from "@/lib/statusPresentation";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Status key, e.g. "on-site", "overdue", "not-located". Unknown keys fall back safely. */
  status: StatusKey | string;
  /** "subtle" for lists and tables, "solid" for high-emphasis totals. */
  emphasis?: "subtle" | "solid";
  size?: "sm" | "md";
  /** Hide the icon (rare — only where an icon would be visual noise). Word always stays. */
  hideIcon?: boolean;
  /** Override the visible word without losing the tone and icon. */
  label?: string;
}

export function StatusBadge({
  status,
  emphasis = "subtle",
  size = "sm",
  hideIcon = false,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  const preset: StatusPresentation = getStatusPresentation(status);
  const Icon = preset.icon;
  const tone = STATUS_TONE_CLASSES[preset.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        emphasis === "solid" ? tone.solid : tone.subtle,
        className,
      )}
      {...props}
    >
      {!hideIcon && <Icon aria-hidden="true" className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      <span>{label ?? preset.label}</span>
    </span>
  );
}

export default StatusBadge;

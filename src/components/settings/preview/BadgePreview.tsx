/**
 * Phase 7E — a badge rendered by the same code that prints the real badge, so
 * what an administrator sees here is what comes out of the printer.
 * Sample details only; no real person is used.
 */
import { useEffect, useState } from "react";
import { badgePreviewHtml, getBadgeConfig, BadgeConfig } from "@/lib/printBadge";
import { useSiteStructure } from "@/hooks/useSiteStructure";

export function BadgePreview({ personType }: { personType: string }) {
  const { roomLabel } = useSiteStructure();
  const [html, setHtml] = useState<string>("");
  const [config, setConfig] = useState<BadgeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getBadgeConfig();
        const markup = await badgePreviewHtml(
          {
            name: "Sample Person",
            type: personType,
            visiting: "Sample Resident",
            room: `${roomLabel} 12`,
            mobile: "0400 000 000",
            qrValue: "SAMPLEPREVIEW",
            date: new Date(),
          },
          cfg
        );
        if (cancelled) return;
        setConfig(cfg);
        setHtml(markup);
      } catch {
        if (!cancelled) setError("The badge preview could not be built. The badge settings could not be read.");
      }
    })();
    return () => { cancelled = true; };
  }, [personType, roomLabel]);

  if (error) return <p className="text-[13px] text-destructive">{error}</p>;

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">
        {config?.mode === "label"
          ? `Label roll ${config.labelSize} — printed at exact size.`
          : "Office printer — badge centred on an A4 page."}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
        <iframe
          title="Badge preview"
          srcDoc={html}
          className="h-[420px] w-full border-0 bg-white"
        />
      </div>
      <p className="text-[12px] text-muted-foreground">Sample details. Nothing is printed or saved.</p>
    </div>
  );
}

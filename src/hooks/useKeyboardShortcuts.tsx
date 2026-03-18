import { useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface ShortcutActions {
  onNewVisit: () => void;
  onQuickCheckOut: () => void;
  onQRScan: () => void;
}

export function useKeyboardShortcuts({ onNewVisit, onQuickCheckOut, onQRScan }: ShortcutActions) {
  const { toast } = useToast();

  const handler = useCallback((e: KeyboardEvent) => {
    // Don't fire in inputs/textareas
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key.toLowerCase()) {
      case "n":
        e.preventDefault();
        onNewVisit();
        toast({ title: "⌨️ New Visit", description: "Shortcut: N", duration: 1500 });
        break;
      case "c":
        e.preventDefault();
        onQuickCheckOut();
        toast({ title: "⌨️ Quick Check-Out", description: "Shortcut: C", duration: 1500 });
        break;
      case "q":
        e.preventDefault();
        onQRScan();
        toast({ title: "⌨️ QR Scan", description: "Shortcut: Q", duration: 1500 });
        break;
    }
  }, [onNewVisit, onQuickCheckOut, onQRScan, toast]);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

export function KeyboardShortcutBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-6 bg-card/95 backdrop-blur border-t border-border px-4 py-1.5">
      {[
        { key: "N", label: "New Visit" },
        { key: "C", label: "Check-Out" },
        { key: "Q", label: "QR Scan" },
      ].map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <kbd className="h-5 min-w-[20px] px-1.5 rounded bg-muted border border-border text-[10px] font-mono font-semibold flex items-center justify-center text-foreground">
            {s.key}
          </kbd>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

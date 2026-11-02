import { useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { shortcutAllowed } from "@/lib/presence";

interface ShortcutActions {
  onNewVisit: () => void;
  onQuickCheckOut: () => void;
  onQRScan: () => void;
}

export function useKeyboardShortcuts({ onNewVisit, onQuickCheckOut, onQRScan }: ShortcutActions) {
  const { toast } = useToast();

  const handler = useCallback((e: KeyboardEvent) => {
    // Never while typing, inside a menu, or while a dialog or sheet is open.
    if (!shortcutAllowed(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key.toLowerCase()) {
      case "n":
        e.preventDefault();
        onNewVisit();
        toast({ title: "Check in", description: "Shortcut: N", duration: 1500 });
        break;
      case "c":
        e.preventDefault();
        onQuickCheckOut();
        toast({ title: "Check out", description: "Shortcut: C", duration: 1500 });
        break;
      case "q":
        e.preventDefault();
        onQRScan();
        toast({ title: "Check-in QR code", description: "Shortcut: Q", duration: 1500 });
        break;
    }
  }, [onNewVisit, onQuickCheckOut, onQRScan, toast]);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

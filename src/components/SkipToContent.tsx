/**
 * Phase 7F — first focusable control in the staff shell.
 * Hidden until focused, then jumps keyboard users straight to the page content.
 */
export function SkipToContent({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(targetId);
        if (el) {
          el.focus();
          el.scrollIntoView({ block: "start" });
        }
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
    >
      Skip to content
    </a>
  );
}

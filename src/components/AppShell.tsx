/**
 * Phase 7F — one shared shell for every signed-in staff screen.
 *
 * Guarantees per route: one skip link, one labelled main navigation, one page
 * heading (rendered by AppHeader) and exactly one <main> landmark.
 * Presentation only — no data access, no workflow, no permission logic.
 */
import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SkipToContent } from "@/components/SkipToContent";
import { cn } from "@/lib/utils";

interface AppShellProps {
  /** The page heading. Rendered once, as the route's only h1. */
  title: string;
  subtitle?: string;
  /** Page-specific header actions. */
  actions?: ReactNode;
  overstayedCount?: number;
  overdueCount?: number;
  draftCount?: number;
  pendingCount?: number;
  /** Anything that must sit between the header and the content, e.g. a command bar. */
  beforeMain?: ReactNode;
  /** Padding/spacing for the <main> element, so pages keep their existing layout. */
  mainClassName?: string;
  children: ReactNode;
}

export function AppShell({
  title,
  subtitle,
  actions,
  overstayedCount,
  overdueCount,
  draftCount,
  pendingCount,
  beforeMain,
  mainClassName,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full">
        <SkipToContent />
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <AppHeader
            title={title}
            subtitle={subtitle}
            actions={actions}
            overstayedCount={overstayedCount}
            overdueCount={overdueCount}
            draftCount={draftCount}
            pendingCount={pendingCount}
          />
          {beforeMain}
          <main id="main-content" tabIndex={-1} className={cn("min-w-0 focus:outline-none", mainClassName)}>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

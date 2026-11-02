/**
 * One shared shell for every signed-in staff screen.
 *
 * Guarantees per route: one skip link, one labelled main navigation, one page
 * heading and exactly one <main> landmark. The page names itself in the body
 * with the design system's page header card (eyebrow, title, description,
 * actions), because the Centrim Life app's own top bar does not carry the page
 * name; the bar here only shows which section you are in.
 * Presentation only — no data access, no workflow, no permission logic.
 */
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SkipToContent } from "@/components/SkipToContent";
import { PageHeader } from "@/components/ui/page-header";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { activeSection, buildNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface AppShellProps {
  /** The page name, shown as the page's h1 in the header card. */
  title: string;
  /** One plain-language line under the title. */
  subtitle?: ReactNode;
  /** Overline above the title. Defaults to the menu section the page sits in. */
  eyebrow?: string;
  /** Kept for older callers; the design system header carries no icon. */
  titleIcon?: LucideIcon;
  titleIconClassName?: string;
  /** Page actions, shown on the right of the header card. */
  actions?: ReactNode;
  /** Tabs, totals or filters that belong inside the header card. */
  headerContent?: ReactNode;
  /** Emergency pages colour the eyebrow red. */
  tone?: "default" | "emergency";
  /** False when the page draws its own header card (it must render the h1). */
  pageHeader?: boolean;
  overstayedCount?: number;
  overdueCount?: number;
  draftCount?: number;
  pendingCount?: number;
  /** Anything that must sit between the header and the content, e.g. a command bar. */
  beforeMain?: ReactNode;
  /** Padding/spacing for the page content, so pages keep their existing layout. */
  mainClassName?: string;
  children: ReactNode;
}

const OTHER_SECTIONS: [RegExp, string][] = [
  [/^\/settings/, "Settings"],
  [/^\/evacuation/, "Emergency"],
  [/^\/coverage/, "Settings"],
  [/^\/person-type/, "Visitors"],
];

export function AppShell({
  title,
  subtitle,
  eyebrow,
  actions,
  headerContent,
  tone = "default",
  pageHeader = true,
  overstayedCount,
  overdueCount,
  draftCount,
  pendingCount,
  beforeMain,
  mainClassName,
  children,
}: AppShellProps) {
  const { pathname } = useLocation();
  const { modules, terms } = useOperatingContext();
  const model = buildNavigation(
    { foodRegister: !!modules.foodRegister, keysRegister: !!modules.keysRegister },
    terms.residentPlural,
  );
  const section = activeSection(model, pathname)?.title ?? OTHER_SECTIONS.find(([re]) => re.test(pathname))?.[1] ?? "Centrim Life";
  const overline = eyebrow ?? section;

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full">
        <SkipToContent />
        <AppSidebar />
        {/* Content column. A plain div, not SidebarInset, so the route has exactly one <main>. */}
        <div className="relative flex min-h-svh flex-1 min-w-0 flex-col bg-background">
          <AppHeader
            title={section}
            overstayedCount={overstayedCount}
            overdueCount={overdueCount}
            draftCount={draftCount}
            pendingCount={pendingCount}
          />
          {beforeMain}
          <main id="main-content" tabIndex={-1} className="min-w-0 focus:outline-none">
            {pageHeader && (
              <div className="px-4 pt-4 sm:px-6 sm:pt-6">
                <PageHeader id="page-title" title={title} description={subtitle} eyebrow={overline} actions={actions} tone={tone}>
                  {headerContent}
                </PageHeader>
              </div>
            )}
            <div className={cn("min-w-0", mainClassName)}>{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

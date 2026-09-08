/**
 * Current site context for staff screens (Stage 2 shell).
 * Shows which home/village the person is working in and lets them switch
 * when they have access to more than one. Read-only context — no data changes.
 */
import { Building2, Check, ChevronDown } from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteSwitcher({ compact = false }: { compact?: boolean }) {
  const { sites, currentSite, currentSiteId, setCurrentSiteId, loading } = useSite();

  if (loading) {
    return <span className="text-[13px] text-muted-foreground">Loading site…</span>;
  }

  const label = currentSite?.name ?? "No site selected";

  if (sites.length <= 1) {
    return (
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-h-[36px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Current site: ${label}. Change site`}
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className={compact ? "max-w-[140px] truncate" : ""}>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Your sites
        </DropdownMenuLabel>
        {sites.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => setCurrentSiteId(s.id)}
            className="flex items-center justify-between gap-2 text-[13px]"
          >
            <span className="truncate">{s.name}</span>
            {s.id === currentSiteId && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

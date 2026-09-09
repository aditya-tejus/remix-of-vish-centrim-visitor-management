/**
 * Phase 7E — the tile row a person sees on the kiosk, built from the same
 * person-type configuration the kiosk reads. Sample only; nothing is saved.
 */
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { KioskPersonCard } from "@/components/kiosk/KioskPersonCard";
import { Users, HardHat, Heart, UserCog, Home, UserPlus } from "lucide-react";

const ICONS: Record<string, typeof Users> = {
  visitor: Users,
  contractor: HardHat,
  volunteer: Heart,
  staff: UserCog,
  resident: Home,
  other: UserPlus,
};

export function PersonTypesPreview() {
  const { personTypes, loading } = usePersonTypes();
  const shown = personTypes.filter((p) => p.kioskEnabled);

  if (loading) return <p className="text-[13px] text-muted-foreground">Loading preview…</p>;

  if (shown.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No type is switched on for the kiosk, so nobody could sign in at the kiosk with these settings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">
        This is the choice shown on the kiosk welcome screen.
      </p>
      <div className="space-y-2">
        {shown.map((p) => {
          const Icon = ICONS[p.type] || Users;
          return (
            <KioskPersonCard
              key={p.type}
              name={p.kioskLabel || p.label}
              subtitle={p.description}
              rightIcon={<Icon className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />}
            />
          );
        })}
      </div>
      <p className="text-[12px] text-muted-foreground">
        Types switched off do not appear. Front desk sign-in is set separately.
      </p>
    </div>
  );
}

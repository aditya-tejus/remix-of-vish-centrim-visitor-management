/**
 * Phase 7E — the kiosk sign-in as it would run with the current settings,
 * shown as steps. Non-interactive; built from the same configuration the
 * kiosk itself reads.
 */
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { usePersonTypesDraft } from "./personTypesDraft";
import { useActiveHealthQuestions, VisitorType } from "@/hooks/useHealthQuestions";
import { useSiteStructure } from "@/hooks/useSiteStructure";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { KioskProgressStepper } from "@/components/kiosk/KioskProgressStepper";
import { UserSearch, ClipboardList, Stethoscope, ScrollText, BadgeCheck, MapPin } from "lucide-react";

export function KioskPreview({ personType }: { personType: string }) {
  const { personTypes, loading } = usePersonTypes();
  const { data: questions = [] } = useActiveHealthQuestions(personType as VisitorType);
  const { areaLabel, roomLabel } = useSiteStructure();
  const { siteName, pack } = useOperatingContext();

  const { draft } = usePersonTypesDraft();
  const unsaved = !!draft?.dirty;
  const cfg = (unsaved ? draft.rows : personTypes).find((p) => p.type === personType);
  if (loading) return <p className="text-[13px] text-muted-foreground">Loading preview…</p>;
  if (!cfg) return <p className="text-[13px] text-muted-foreground">This type is not configured for the kiosk.</p>;

  if (!cfg.kioskEnabled) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {cfg.kioskLabel || cfg.label} is switched off for the kiosk, so this sign-in is not offered there.
      </p>
    );
  }

  const steps = [
    { id: "identify", label: "Who you are", icon: UserSearch, detail: "Name and contact details, or a scan of a personal code." },
    ...(cfg.destinationRequired
      ? [{ id: "destination", label: "Who you are here for", icon: MapPin, detail: `Person, ${areaLabel.toLowerCase()} or ${roomLabel.toLowerCase()}.` }]
      : []),
    { id: "details", label: "Visit details", icon: ClipboardList, detail: "Extra details configured for this type." },
    ...(cfg.screeningApplies
      ? [{ id: "questions", label: "Check-in questions", icon: Stethoscope, detail: `${questions.length} question${questions.length === 1 ? "" : "s"} switched on.` }]
      : []),
    ...(cfg.privacyApplies
      ? [{ id: "terms", label: "Privacy and terms", icon: ScrollText, detail: "The person confirms this themselves." }]
      : []),
    { id: "done", label: "Signed in", icon: BadgeCheck, detail: cfg.badgeApplies ? "A badge and personal code are issued." : "No badge is issued for this type." },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[12px] uppercase tracking-wide text-muted-foreground">Kiosk welcome</p>
        <p className="text-lg font-semibold text-foreground">
          Welcome to {siteName || "this site"}
        </p>
        <p className="text-[13px] text-muted-foreground">
          Wording follows the {pack.label} setting.
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {unsaved
            ? "Preview of your unsaved visitor type changes. Check-in questions shown are the saved ones."
            : "Shows your saved settings. Save a change before it appears here."}
        </p>
      </div>

      <KioskProgressStepper steps={steps.map((s) => ({ id: s.id, label: s.label }))} currentIndex={0} />

      <ol className="space-y-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  Step {i + 1} — {s.label}
                </p>
                <p className="text-[12px] text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="text-[12px] text-muted-foreground">
        Preview only. Nobody is signed in and nothing is saved.
      </p>
    </div>
  );
}

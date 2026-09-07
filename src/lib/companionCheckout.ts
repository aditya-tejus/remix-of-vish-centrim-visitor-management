import { CompanionDetail, Visitor } from "@/types/visitor";

/**
 * Works out what a visit record should look like after some (or all) of the
 * people on it leave. Companions who leave get a departure time stamped on
 * their entry; anyone still on site keeps the visit open so the roll call and
 * occupancy count stay honest.
 */
export interface CompanionCheckoutResult {
  companionDetails: CompanionDetail[];
  /** How many companions are still on site after this departure. */
  remainingCompanions: number;
  /** True when nobody from this visit remains on site. */
  everyoneLeft: boolean;
  /** Human-readable note for the audit trail / comments. */
  note: string;
}

export function companionsStillOnSite(visitor: Visitor | null | undefined): CompanionDetail[] {
  return (visitor?.companionDetails || []).filter((c) => !c.checkedOutAt);
}

export function planCompanionCheckout(
  visitor: Visitor,
  leavingIndexes: number[],
  primaryLeaving: boolean,
  at: Date
): CompanionCheckoutResult {
  const all = visitor.companionDetails || [];
  const stamp = at.toISOString();
  const leaving = new Set(leavingIndexes);

  const companionDetails = all.map((c, i) =>
    !c.checkedOutAt && leaving.has(i) ? { ...c, checkedOutAt: stamp } : c
  );

  const remainingCompanions = companionDetails.filter((c) => !c.checkedOutAt).length;
  const everyoneLeft = primaryLeaving && remainingCompanions === 0;

  const leftNames = all
    .map((c, i) => (!c.checkedOutAt && leaving.has(i) ? c.name || `Companion ${i + 1}` : null))
    .filter(Boolean) as string[];

  const parts: string[] = [];
  if (primaryLeaving) parts.push(`${visitor.firstName} ${visitor.surname} left`);
  if (leftNames.length) parts.push(`${leftNames.join(", ")} left`);
  if (remainingCompanions > 0) parts.push(`${remainingCompanions} still on site`);

  return { companionDetails, remainingCompanions, everyoneLeft, note: parts.join(" · ") };
}

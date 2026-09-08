import { Visitor } from "@/types/visitor";
import type { Resident } from "@/hooks/useResidents";

/**
 * Builds the roll call list a fire warden actually needs: every *person* on the
 * property (companions included), with how much help they need to get out and
 * someone to phone if things go wrong.
 */

export type AssistanceLevel =
  | "full-assist"
  | "wheelchair"
  | "walking-aid"
  | "independent"
  | "unknown";

export interface Assistance {
  level: AssistanceLevel;
  label: string;
  /** Higher = needs more help = evacuate first / check first. */
  rank: number;
  aids: string[];
  flags: string[];
}

export interface RollCallPerson {
  /** Stable identity for a person, including companions on a shared visit. */
  key: string;
  visitorId: string;
  companionIndex: number | null;
  name: string;
  type: string;
  /** "Resident", "Visitor", "Companion" … used for the person-type grouping. */
  typeLabel: string;
  area: string;
  /** Display form, e.g. "Villa 14" / "Room 14". */
  room: string;
  /** Bare unit identifier used to group everyone sharing one property. */
  unit: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  assistance: Assistance;
  checkInTime: Date | null;
  host: string;
  workLocation: string;
  offSite: boolean;
  expectedReturn: Date | null;
  accompaniedBy: string;
  /** Who this person is with right now — family, visitors, or the resident visited. */
  associatedWith: string[];
  /** Key worker / warden responsible for this person or their property. */
  responsibleStaff: string;
}


export const UNASSIGNED_AREA = "No area recorded";

const ASSISTANCE_META: Record<AssistanceLevel, { label: string; rank: number }> = {
  "full-assist": { label: "Full assistance", rank: 4 },
  wheelchair: { label: "Wheelchair", rank: 3 },
  "walking-aid": { label: "Walking aid", rank: 2 },
  independent: { label: "Independent", rank: 1 },
  unknown: { label: "Assistance not recorded", rank: 5 },
};

export function assistanceFor(resident?: Resident): Assistance {
  const aids = resident?.mobilityAids || [];
  const raw = (resident?.mobilityLevel || "").toLowerCase().trim();
  const aidText = aids.join(" ").toLowerCase();

  let level: AssistanceLevel = "unknown";
  if (!resident) {
    level = "independent"; // non-residents walk out on their own
  } else if (!raw) {
    level = "unknown";
  } else if (/bed|hoist|full|dependent|two[- ]person/.test(raw)) {
    level = "full-assist";
  } else if (/wheel/.test(raw) || /wheel/.test(aidText)) {
    level = "wheelchair";
  } else if (/aid|frame|walker|stick|assist|supervis/.test(raw) || /frame|walker|stick/.test(aidText)) {
    level = "walking-aid";
  } else if (/independ|mobile/.test(raw)) {
    level = "independent";
  } else {
    level = "walking-aid";
  }

  const flags: string[] = [];
  if (resident?.dolsLpsFlag) flags.push("DoLS/LPS");
  const risk = (resident?.riskAssessmentLevel || "").toLowerCase();
  if (risk === "high") flags.push("High risk");

  const meta = ASSISTANCE_META[level];
  return { level, label: meta.label, rank: meta.rank, aids, flags };
}

export const ASSISTANCE_ORDER: AssistanceLevel[] = [
  "unknown",
  "full-assist",
  "wheelchair",
  "walking-aid",
  "independent",
];

export function assistanceLabel(level: AssistanceLevel) {
  return ASSISTANCE_META[level].label;
}

function typeLabelOf(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

interface BuildArgs {
  visitors: Visitor[];
  residents: Resident[];
  /** "Room" in a care home, "Villa" in a retirement village. */
  roomLabel?: string;
}

export interface RollCall {
  onSite: RollCallPerson[];
  offSite: RollCallPerson[];
}

/** "Room 14" / "14" -> bare "14" so a couple in one property groups together. */
export function unitOf(room: string) {
  return (room || "").replace(/^(room|villa|unit|apartment|apt)\s*/i, "").trim();
}

function roomDisplay(room: string, label: string) {
  const unit = unitOf(room);
  return unit ? `${label} ${unit}` : "";
}

export function buildRollCall({ visitors, residents, roomLabel = "Room" }: BuildArgs): RollCall {
  const residentMap = new Map(residents.map((r) => [r.visitorId, r]));
  const residentByName = new Map(
    residents.map((r) => [r.name.toLowerCase().trim(), r])
  );
  const onSite: RollCallPerson[] = [];
  const offSite: RollCallPerson[] = [];

  const residentNameById = (id: string) => residentMap.get(id)?.name || "";

  /** The resident whose property a non-resident is standing in. */
  const hostResidentOf = (v: Visitor): Resident | undefined => {
    const first = (v.visitedResidentIds || []).find((id) => residentMap.has(id));
    if (first) return residentMap.get(first);
    const named = (v.whomToVisit || "").toLowerCase().trim();
    return named ? residentByName.get(named) : undefined;
  };

  /** Everyone currently in a resident's property, other than the resident. */
  const companionsWith = new Map<string, string[]>();

  visitors.forEach((v) => {
    const resident = v.type === "resident" ? residentMap.get(v.id) : undefined;
    const hostNames = (v.visitedResidentIds || []).map(residentNameById).filter(Boolean);
    const host = hostNames.join(", ") || v.whomToVisit || "";
    const hostResident = resident ? undefined : hostResidentOf(v);
    const locationSource = resident || hostResident;
    const selfName = `${v.firstName} ${v.surname}`.trim();

    if (hostResident && v.status === "checked-in") {
      const list = companionsWith.get(hostResident.visitorId) || [];
      list.push(selfName);
      companionsWith.set(hostResident.visitorId, list);
    }

    const base: RollCallPerson = {
      key: `${v.id}:self`,
      visitorId: v.id,
      companionIndex: null,
      name: selfName,
      type: v.type,
      typeLabel: typeLabelOf(v.type),
      area: locationSource ? locationSource.wing || UNASSIGNED_AREA : "",
      room: roomDisplay(locationSource?.room || "", roomLabel),
      unit: unitOf(locationSource?.room || ""),
      phone: v.mobile || "",
      emergencyContactName: resident?.emergencyContactName || "",
      emergencyContactPhone: resident?.emergencyContactPhone || "",
      assistance: assistanceFor(resident),
      checkInTime: v.checkInTime ? new Date(v.checkInTime) : null,
      host,
      workLocation: (v as any).workLocation || "",
      offSite: false,
      expectedReturn: v.expectedReturnDate ? new Date(v.expectedReturnDate) : null,
      accompaniedBy: v.accompaniedByName || v.accompaniedBy || "",
      associatedWith: hostResident
        ? [`Visiting ${hostResident.name}${hostResident.room ? ` (${roomDisplay(hostResident.room, roomLabel)})` : ""}`]
        : host
          ? [`Visiting ${host}`]
          : [],
      responsibleStaff: locationSource?.keyWorker || "",
    };

    if (v.type === "resident" && v.status !== "checked-in") {
      offSite.push({
        ...base,
        offSite: true,
        associatedWith: base.accompaniedBy ? [`Out with ${base.accompaniedBy}`] : [],
      });
      return;
    }
    if (v.status !== "checked-in") return;

    onSite.push(base);

    // Companions are people too — each gets their own line.
    const companions = v.companionDetails || [];
    const companionLine = (i: number, name: string, phone: string): RollCallPerson => ({
      ...base,
      key: `${v.id}:${i}`,
      companionIndex: i,
      name,
      type: "companion",
      typeLabel: "Companion",
      phone,
      emergencyContactName: base.name,
      emergencyContactPhone: v.mobile || "",
      assistance: assistanceFor(undefined),
      accompaniedBy: base.name,
      associatedWith: [`With ${base.name}`, ...base.associatedWith],
    });

    if (companions.length > 0) {
      companions.forEach((c, i) => {
        if (c.checkedOutAt) return;
        const name = c.name?.trim() || `Companion ${i + 1} of ${base.name}`;
        onSite.push(companionLine(i, name, c.phone || ""));
        if (hostResident) {
          const list = companionsWith.get(hostResident.visitorId) || [];
          list.push(name);
          companionsWith.set(hostResident.visitorId, list);
        }
      });
    } else if ((v.additionalVisitors || 0) > 0) {
      // No names captured (kiosk) — still list them so the count is honest.
      for (let i = 0; i < (v.additionalVisitors || 0); i++) {
        onSite.push(companionLine(i, `Companion ${i + 1} of ${base.name}`, ""));
      }
    }
  });

  // Residents learn who is with them right now.
  const withResident = (p: RollCallPerson) => {
    if (p.type !== "resident") return p;
    const guests = companionsWith.get(p.visitorId) || [];
    if (guests.length === 0) return p;
    return { ...p, associatedWith: [`With ${guests.join(", ")}`] };
  };

  return { onSite: onSite.map(withResident), offSite };
}


/** Matches an attendance row back to a person on the roll call. */
export function attendanceKey(row: {
  visitor_id: string | null;
  parent_visitor_id?: string | null;
  companion_index?: number | null;
}) {
  if (row.companion_index != null && row.parent_visitor_id) {
    return `${row.parent_visitor_id}:${row.companion_index}`;
  }
  return row.visitor_id ? `${row.visitor_id}:self` : "";
}

export function sortPeople(people: RollCallPerson[]) {
  return [...people].sort((a, b) => {
    if (a.assistance.rank !== b.assistance.rank) return b.assistance.rank - a.assistance.rank;
    const ra = parseInt(a.room.replace(/\D/g, "")) || 0;
    const rb = parseInt(b.room.replace(/\D/g, "")) || 0;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

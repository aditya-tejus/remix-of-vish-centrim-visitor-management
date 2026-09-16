import { useMemo } from "react";
import { isSameDay } from "date-fns";
import { Visitor } from "@/types/visitor";
import { useOverstayPolicy } from "@/hooks/useOverstayPolicy";

export type VisitViewKey = "on-site" | "overdue" | "recent" | "scheduled";

export interface VisitViewDef {
  key: VisitViewKey;
  label: string;
  count: number;
  /** Shown under an empty list so the desk knows why it is empty. */
  emptyTitle: string;
  emptyDescription: string;
}

interface Args {
  /** Non-resident arrivals for the selected day, already searched and type-filtered. */
  dayVisitors: Visitor[];
  /**
   * Non-resident people regardless of arrival day, already searched and
   * type-filtered. The live views use this so anyone still signed in from an
   * earlier day never disappears from reception's list.
   */
  liveVisitors: Visitor[];
  /** Everyone loaded for this site, used for the limited scheduled view. */
  allVisitors: Visitor[];
  selectedDate: Date;
  /** True when the site has no pre-registration data source. */
  scheduledAvailable: boolean;
}

/**
 * The four ways reception looks at the same day. Every view is derived from the
 * one visitor list and the one status model — there is no second query and no
 * second set of statuses.
 */
export function useVisitViews({ dayVisitors, liveVisitors, allVisitors, selectedDate, scheduledAvailable }: Args) {
  const { isOverstayed } = useOverstayPolicy();

  const onSite = useMemo(
    () =>
      liveVisitors
        .filter((v) => v.status === "checked-in")
        .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime()),
    [liveVisitors]
  );

  const overdue = useMemo(
    () =>
      liveVisitors
        .filter((v) => v.status === "checked-in" && isOverstayed(v))
        .sort((a, b) => a.checkInTime.getTime() - b.checkInTime.getTime()),
    [liveVisitors, isOverstayed]
  );

  const recent = useMemo(
    () =>
      [...dayVisitors].sort((a, b) => {
        const last = (v: Visitor) => (v.checkOutTime ?? v.checkInTime).getTime();
        return last(b) - last(a);
      }),
    [dayVisitors]
  );

  /**
   * Limited on purpose: the only expectation this system holds today is a
   * resident who is away with an expected return. There is no pre-registration
   * of visitors, so nothing else can honestly be listed here.
   */
  const scheduled = useMemo(
    () =>
      allVisitors
        .filter(
          (v) =>
            v.type === "resident" &&
            v.status === "checked-out" &&
            v.expectedReturnDate &&
            isSameDay(v.expectedReturnDate, selectedDate)
        )
        .sort(
          (a, b) =>
            (a.expectedReturnDate?.getTime() ?? 0) - (b.expectedReturnDate?.getTime() ?? 0)
        ),
    [allVisitors, selectedDate]
  );

  const views = useMemo<VisitViewDef[]>(() => {
    const list: VisitViewDef[] = [
      {
        key: "on-site",
        label: "On site now",
        count: onSite.length,
        emptyTitle: "Nobody is on site",
        emptyDescription: "Everyone recorded for this day has already left.",
      },
      {
        key: "overdue",
        label: "Overdue",
        count: overdue.length,
        emptyTitle: "Nobody is overdue",
        emptyDescription: "Everyone on site is still within the expected time for their type.",
      },
      {
        key: "recent",
        label: "Recent activity",
        count: recent.length,
        emptyTitle: "No movement recorded",
        emptyDescription: "No arrivals or departures have been recorded for this day.",
      },
    ];
    if (scheduledAvailable) {
      list.push({
        key: "scheduled",
        label: "Expected back",
        count: scheduled.length,
        emptyTitle: "Nobody is expected back",
        emptyDescription:
          "This view only shows residents who are away with an expected return time. Visitor pre-registration is not configured, so expected arrivals cannot be listed.",
      });
    }
    return list;
  }, [onSite.length, overdue.length, recent.length, scheduled.length, scheduledAvailable]);

  const rowsFor = (key: VisitViewKey): Visitor[] => {
    switch (key) {
      case "on-site":
        return onSite;
      case "overdue":
        return overdue;
      case "scheduled":
        return scheduled;
      default:
        return recent;
    }
  };

  return { views, rowsFor };
}

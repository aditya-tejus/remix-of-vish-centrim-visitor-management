import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { useVisitors } from "@/hooks/useVisitors";
import { useWatchlist } from "@/hooks/useWatchlist";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { usePermissions } from "@/hooks/usePermissions";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { WatchlistAlertDialog } from "@/components/WatchlistAlertDialog";
import { useToast } from "@/hooks/use-toast";
import {
  UsersRound, Plus, Trash2, CheckCircle2, Loader2, AlertTriangle, Printer, ShieldCheck,
} from "lucide-react";
import { issueBadge } from "@/lib/badgeIssue";
import type { Visitor } from "@/types/visitor";

type AttendeeState = "pending" | "saving" | "saved" | "failed" | "blocked";

interface Attendee {
  id: string;
  firstName: string;
  surname: string;
  phone: string;
  /** The attendee confirmed the terms themselves. */
  confirmedSelf: boolean;
  /** The organiser confirmed on this person's behalf (assisted or child process only). */
  organiserDeclared: boolean;
  state: AttendeeState;
  error?: string;
  visitorId?: string;
}

const blankAttendee = (): Attendee => ({
  id: crypto.randomUUID(),
  firstName: "",
  surname: "",
  phone: "",
  confirmedSelf: false,
  organiserDeclared: false,
  state: "pending",
});

export default function GroupCheckIn() {
  const { submitVisitor } = useVisitors();
  const { checkVisitor } = useWatchlist();
  const { extras } = usePersonTypes();
  const { can, loading: permissionsLoading } = usePermissions();
  const { siteId, siteName, loading: siteLoading } = useOperatingContext();
  const { toast } = useToast();

  const [groupLabel, setGroupLabel] = useState("");
  const [organiserName, setOrganiserName] = useState("");
  const [organiserContact, setOrganiserContact] = useState("");
  const [whomToVisit, setWhomToVisit] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([blankAttendee(), blankAttendee()]);
  const [groupId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [watchlistEntry, setWatchlistEntry] = useState<any>(null);
  const [watchlistMatchType, setWatchlistMatchType] = useState<"confirmed" | "near">("confirmed");
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [blockedName, setBlockedName] = useState("");

  const named = attendees.filter((a) => a.firstName.trim() && a.surname.trim());
  const savedCount = attendees.filter((a) => a.state === "saved").length;
  const outstanding = named.filter((a) => a.state !== "saved");

  const acknowledged = (a: Attendee) => a.confirmedSelf || (extras.organiserDeclaredTermsEnabled && a.organiserDeclared);

  const ready = useMemo(
    () =>
      organiserName.trim().length > 1 &&
      organiserContact.trim().length > 4 &&
      !siteLoading &&
      named.length > 0 &&
      outstanding.length > 0 &&
      outstanding.every(acknowledged),
    [organiserName, organiserContact, named.length, outstanding, siteLoading, extras.organiserDeclaredTermsEnabled],
  );

  const update = (id: string, patch: Partial<Attendee>) =>
    setAttendees((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addRow = () => setAttendees((prev) => [...prev, blankAttendee()]);

  const removeRow = (id: string) =>
    setAttendees((prev) => (prev.length <= 1 ? prev : prev.filter((a) => a.id !== id || a.state === "saved")));

  const handleSubmit = async () => {
    setSubmitting(true);
    // Everyone who still needs saving — people already saved are never sent twice.
    for (const attendee of outstanding) {
      const match = checkVisitor(attendee.firstName, attendee.surname);
      if (match) {
        setWatchlistEntry(match.entry);
        setWatchlistMatchType(match.matchType);
        setBlockedName(`${attendee.firstName} ${attendee.surname}`);
        setWatchlistOpen(true);
        update(attendee.id, { state: "blocked", error: "Needs a manager check before signing in" });
        continue;
      }

      update(attendee.id, { state: "saving", error: undefined });
      const payload: Omit<Visitor, "id"> = {
        firstName: attendee.firstName.trim(),
        surname: attendee.surname.trim(),
        email: "",
        mobile: attendee.phone.trim(),
        type: "visitor",
        checkInTime: new Date(),
        checkOutTime: null,
        whomToVisit: whomToVisit.trim(),
        address: "",
        status: "checked-in",
        healthDeclaration: true,
        additionalVisitors: 0,
        comments: "",
        retentionExpiry: new Date(Date.now() + 86400000 * 60),
        acknowledgedPrivacy: true,
        groupId,
        groupLabel: groupLabel.trim() || undefined,
        groupOrganiserName: organiserName.trim(),
        groupOrganiserContact: organiserContact.trim(),
        termsConfirmedBy: attendee.confirmedSelf
          ? `${attendee.firstName} ${attendee.surname}`.trim()
          : organiserName.trim(),
        termsConfirmationMode: attendee.confirmedSelf ? "self" : "organiser_declared",
      };

      try {
        const { saved } = submitVisitor(payload);
        const stored = await saved;
        update(attendee.id, { state: "saved", visitorId: stored.id });
      } catch {
        update(attendee.id, { state: "failed", error: "Not saved — try again" });
      }
    }
    setSubmitting(false);
  };

  const printAllBadges = async () => {
    for (const a of attendees.filter((x) => x.state === "saved")) {
      await issueBadge(
        {
          name: `${a.firstName} ${a.surname}`.trim(),
          type: "visitor",
          visiting: whomToVisit || undefined,
          date: new Date(),
          mobile: a.phone || undefined,
        },
        { visitorId: a.visitorId, siteId, siteName },
      );
    }
  };

  if (!permissionsLoading && !can("checkin.create")) {
    return (
      <AppShell
        title="Group arrival"
        subtitle="Everyone gets their own record, so the roll call is right"
        titleIcon={UsersRound}
        titleIconClassName="h-5 w-5 shrink-0 text-primary"
        mainClassName="p-6 max-w-lg"
      >
        <Card className="p-6 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">You cannot sign people in</p>
            <p className="text-sm text-muted-foreground">Ask an administrator if you need this.</p>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Group arrival"
      subtitle="Everyone gets their own record, so the roll call is right"
      titleIcon={UsersRound}
      titleIconClassName="h-5 w-5 shrink-0 text-primary"
      mainClassName="p-4 sm:p-6 space-y-5 max-w-3xl"
    >
            <Card className="p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Organiser</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[12px]">Group name (optional)</Label>
                  <Input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="e.g. Church choir" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Visiting (optional)</Label>
                  <Input value={whomToVisit} onChange={(e) => setWhomToVisit(e.target.value)} placeholder="Who or where they are going" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Organiser name</Label>
                  <Input value={organiserName} onChange={(e) => setOrganiserName(e.target.value)} placeholder="Person responsible for the group" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px]">Organiser contact number</Label>
                  <Input value={organiserContact} onChange={(e) => setOrganiserContact(e.target.value)} placeholder="Reachable during the visit" />
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              {attendees.map((a, i) => (
                <Card key={a.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Person {i + 1}</span>
                    <div className="flex items-center gap-2">
                      {a.state === "saved" && (
                        <Badge className="bg-success text-success-foreground gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Signed in
                        </Badge>
                      )}
                      {a.state === "failed" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Not saved
                        </Badge>
                      )}
                      {a.state === "blocked" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Needs a check
                        </Badge>
                      )}
                      {a.state !== "saved" && attendees.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeRow(a.id)} aria-label="Remove person">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      value={a.firstName}
                      disabled={a.state === "saved"}
                      onChange={(e) => update(a.id, { firstName: e.target.value })}
                      placeholder="First name"
                    />
                    <Input
                      value={a.surname}
                      disabled={a.state === "saved"}
                      onChange={(e) => update(a.id, { surname: e.target.value })}
                      placeholder="Surname"
                    />
                    {extras.groupAttendeePhoneEnabled && (
                      <Input
                        value={a.phone}
                        disabled={a.state === "saved"}
                        onChange={(e) => update(a.id, { phone: e.target.value })}
                        placeholder="Phone (optional)"
                      />
                    )}
                  </div>

                  {a.state !== "saved" && (
                    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                      <label className="flex items-start gap-2 text-[13px]">
                        <Checkbox
                          checked={a.confirmedSelf}
                          onCheckedChange={(v) => update(a.id, { confirmedSelf: v === true, organiserDeclared: false })}
                        />
                        <span>This person has read and agreed to the visitor terms themselves.</span>
                      </label>
                      {extras.organiserDeclaredTermsEnabled && (
                        <label className="flex items-start gap-2 text-[13px]">
                          <Checkbox
                            checked={a.organiserDeclared}
                            onCheckedChange={(v) => update(a.id, { organiserDeclared: v === true, confirmedSelf: false })}
                          />
                          <span>
                            Organiser-declared for an assisted or child attendee. This is the organiser's confirmation, not this
                            person's own.
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {a.error && <p className="text-[12px] text-destructive">{a.error}</p>}
                </Card>
              ))}

              <Button variant="outline" onClick={addRow} className="gap-2">
                <Plus className="h-4 w-4" /> Add another person
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button onClick={handleSubmit} disabled={!ready || submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {savedCount > 0 ? "Sign in the rest" : "Sign everyone in"}
              </Button>
              {savedCount > 0 && (
                <Button variant="outline" onClick={printAllBadges} className="gap-2">
                  <Printer className="h-4 w-4" /> Print badges ({savedCount})
                </Button>
              )}
              <span className="text-[13px] text-muted-foreground">
                {savedCount} of {named.length} signed in
              </span>
            </div>

            {savedCount > 0 && outstanding.length > 0 && (
              <p className="text-[13px] text-warning-foreground bg-warning/10 rounded-lg p-3">
                Some people are not signed in yet. Fix their details and press the button again — nobody is signed in twice.
              </p>
            )}
          </main>
        </SidebarInset>
      </div>

      {watchlistEntry && (
      <WatchlistAlertDialog
        open={watchlistOpen}
        onOpenChange={setWatchlistOpen}
        entry={watchlistEntry}
        matchType={watchlistMatchType}
        onProceed={() => setWatchlistOpen(false)}
        onDeny={() => setWatchlistOpen(false)}
      />
      )}
    </SidebarProvider>
  );
}

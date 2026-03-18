import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Visitor } from "@/types/visitor";
import { useResidents } from "@/hooks/useResidents";
import { Search, MapPin, Clock, Users, DoorOpen, Check } from "lucide-react";

interface QuickAwayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (visitor: Omit<Visitor, "id">) => void;
  preselectedResident?: { id: string; name: string; room: string; wing: string } | null;
}

const destinationCategories = [
  { value: "garden", label: "Garden / Grounds", emoji: "🌳" },
  { value: "local-shops", label: "Local Shops", emoji: "🛒" },
  { value: "walk", label: "Walk / Fresh Air", emoji: "🚶" },
  { value: "cafe", label: "Café / Restaurant", emoji: "☕" },
  { value: "appointment", label: "Appointment (nearby)", emoji: "📋" },
  { value: "family-visit", label: "Family Visit (day)", emoji: "👨‍👩‍👧" },
  { value: "other", label: "Other", emoji: "📍" },
];

const escortTypes = [
  { value: "alone", label: "Going Alone" },
  { value: "family", label: "Family Member" },
  { value: "friend", label: "Friend" },
  { value: "staff", label: "Staff Member" },
  { value: "group", label: "Group Outing" },
];

export function QuickAwayDialog({ open, onOpenChange, onSubmit, preselectedResident }: QuickAwayDialogProps) {
  const { residents: dbResidents } = useResidents();
  const residentItems = useMemo(() => dbResidents.map(r => ({ id: r.visitorId, name: r.name, room: r.room, wing: r.wing })), [dbResidents]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResident, setSelectedResident] = useState(preselectedResident || null);
  const [destination, setDestination] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [returnHours, setReturnHours] = useState("2");
  const [escortType, setEscortType] = useState("");
  const [escortName, setEscortName] = useState("");
  const [escortPhone, setEscortPhone] = useState("");
  const [notes, setNotes] = useState("");

  const filteredResidents = useMemo(() => {
    if (!searchQuery.trim()) return residentItems.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return residentItems.filter(r => r.name.toLowerCase().includes(q) || r.room.toLowerCase().includes(q));
  }, [searchQuery, residentItems]);

  const needsEscortContact = escortType && escortType !== "alone" && escortType !== "staff" && escortType !== "group";

  const resetForm = () => {
    setSearchQuery("");
    setSelectedResident(preselectedResident || null);
    setDestination("");
    setCustomDestination("");
    setReturnHours("2");
    setEscortType("");
    setEscortName("");
    setEscortPhone("");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!selectedResident) return;
    const [firstName, ...rest] = selectedResident.name.split(" ");
    const returnDate = new Date(Date.now() + Number(returnHours) * 3600000);
    const destLabel = destination === "other" ? customDestination : destinationCategories.find(d => d.value === destination)?.label || destination;

    const visitor: Omit<Visitor, "id"> = {
      firstName: firstName || "",
      surname: rest.join(" ") || "",
      email: "",
      mobile: "",
      type: "resident",
      checkInTime: new Date(),
      checkOutTime: new Date(),
      whomToVisit: "",
      address: `${selectedResident.room}, ${selectedResident.wing}`,
      status: "checked-out",
      healthDeclaration: false,
      additionalVisitors: 0,
      comments: [
        notes,
        escortName ? `Escort: ${escortName}${escortPhone ? ` (${escortPhone})` : ""}` : "",
      ].filter(Boolean).join("\n"),
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: true,
      expectedReturnDate: returnDate,
      checkoutReason: destLabel || undefined,
      leaveType: "Away",
      returnNotificationOptIn: true,
      accompaniedBy: escortType || undefined,
      accompaniedByName: escortName || undefined,
    };
    onSubmit(visitor);
    resetForm();
    onOpenChange(false);
  };

  const canSubmit = !!selectedResident && !!destination && !!escortType && (destination !== "other" || !!customDestination);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <DoorOpen className="h-5 w-5 text-warning" />
            Quick Away — Short Outing
          </DialogTitle>
          <DialogDescription className="text-xs">
            For same-day outings like walks, shops, or visits. For overnight/planned leave, use "Plan Leave".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Resident Selection */}
          {!selectedResident ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Resident</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name or room..." className="pl-9 h-9 text-sm" autoFocus />
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {filteredResidents.map(r => (
                  <button key={r.id} onClick={() => setSelectedResident(r)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {r.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.room} • {r.wing}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm font-semibold">{selectedResident.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedResident.room} • {selectedResident.wing}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedResident(null)}>Change</Button>
            </div>
          )}

          {selectedResident && (
            <>
              {/* Destination */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Destination
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {destinationCategories.map(d => (
                    <button key={d.value} onClick={() => setDestination(d.value)}
                      className={`rounded-lg border p-2 text-left transition-all text-xs flex items-center gap-2 ${
                        destination === d.value ? "border-primary bg-primary/5 font-semibold" : "border-border hover:border-primary/30"
                      }`}>
                      <span>{d.emoji}</span> {d.label}
                    </button>
                  ))}
                </div>
                {destination === "other" && (
                  <Input value={customDestination} onChange={e => setCustomDestination(e.target.value)}
                    placeholder="Where are they going?" className="h-9 text-sm mt-1" />
                )}
              </div>

              {/* Return Time */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Expected Return
                </Label>
                <div className="flex items-center gap-2">
                  <Select value={returnHours} onValueChange={setReturnHours}>
                    <SelectTrigger className="h-9 text-sm w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">30 minutes</SelectItem>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="3">3 hours</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="8">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Back by ~<span className="font-semibold text-foreground">
                      {new Date(Date.now() + Number(returnHours) * 3600000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </p>
                </div>
              </div>

              {/* Escort */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Escort
                </Label>
                <Select value={escortType} onValueChange={(v) => { setEscortType(v); if (v === "alone" || v === "staff" || v === "group") { setEscortName(""); setEscortPhone(""); } }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Who is with them?" /></SelectTrigger>
                  <SelectContent>
                    {escortTypes.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {needsEscortContact && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Escort Contact Details</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Name</Label>
                        <Input value={escortName} onChange={e => setEscortName(e.target.value)}
                          placeholder="Escort name" className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Phone</Label>
                        <Input value={escortPhone} onChange={e => setEscortPhone(e.target.value)}
                          placeholder="07700..." className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                )}

                {escortType === "alone" && (
                  <div className="rounded-lg bg-warning/10 border border-warning/30 p-2.5 flex items-start gap-2">
                    <span className="text-sm">⚠️</span>
                    <p className="text-[11px] text-warning">Confirm this resident is assessed for independent outings.</p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional info..." rows={2} className="text-sm resize-none" />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            <DoorOpen className="h-4 w-4" /> Mark Away
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, MessageSquare } from "lucide-react";
import type { CheckInFieldSpec } from "@/lib/checkInFields";
import type { CheckInFormData } from "./useCheckInFlow";

export function Destination({ formData, updateField, residentItems, staffItems, activeFields }: {
 formData: CheckInFormData; updateField: (field: string, value: string | number | boolean) => void;
 residentItems: { id: string; name: string; room: string; wing: string }[];
 staffItems: { id: string; name: string; role: string; department: string }[];
 activeFields: CheckInFieldSpec[];
}) {
 return (
      {/* Visit details */}
      <div className="border-t border-border pt-4 space-y-4">
        <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Destination / host
        </p>
        <Select value={formData.whomToVisit} onValueChange={(val) => { updateField("whomToVisit", val); updateField("selectPerson", ""); }}>
          <SelectTrigger aria-label="Destination type" className="rounded-control min-h-touch text-base"><SelectValue placeholder="Visiting a..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Resident">Resident</SelectItem>
            <SelectItem value="Staff">Staff Member</SelectItem>
          </SelectContent>
        </Select>

        {formData.whomToVisit === "Resident" && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Select Resident</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger aria-label="Select resident" className="rounded-control min-h-touch text-base"><SelectValue placeholder="Search or select resident..." /></SelectTrigger>
              <SelectContent>
                {residentItems.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No residents recorded for this site yet
                  </div>
                )}
                {residentItems.map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-muted-foreground text-sm">•</span>
                      <span className="text-muted-foreground text-sm">{r.room || "No room"}</span>
                      {r.wing && (
                        <>
                          <span className="text-muted-foreground text-sm">•</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{r.wing}</span>
                        </>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {formData.whomToVisit === "Staff" && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Select Staff Member</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger aria-label="Select staff member" className="rounded-control min-h-touch text-base"><SelectValue placeholder="Select staff member..." /></SelectTrigger>
              <SelectContent>
                {staffItems.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted-foreground text-sm">• {s.role}</span>
                      {s.department && <span className="text-muted-foreground text-sm">• {s.department}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!activeFields.some(f => f.valueKey === "comments") && (
        <div className="space-y-1">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3" /> Comments <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea aria-label="Visit comments" value={formData.comments} onChange={(e) => updateField("comments", e.target.value)}
            placeholder="Any notes about this visit..." className="min-h-[50px] resize-none rounded-control text-base" />
        </div>
        )}
      </div>


 );
}

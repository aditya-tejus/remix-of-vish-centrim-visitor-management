import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import type { CheckInFieldSpec } from "@/lib/checkInFields";
import type { CheckInFormData } from "./useCheckInFlow";

export function Destination({ formData, updateField, residentItems, staffItems, activeFields }: {
 formData: CheckInFormData; updateField: (field: string, value: string | number | boolean) => void;
 residentItems: { id: string; name: string; room: string; wing: string }[];
 staffItems: { id: string; name: string; role: string; department: string }[];
 activeFields: CheckInFieldSpec[];
}) {
 return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p id="staff-destination-label" className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <MapPin aria-hidden className="h-4 w-4 text-muted-foreground" /> Who are they visiting?
          </p>
          <div role="group" aria-labelledby="staff-destination-label" className="grid grid-cols-2 gap-2 sm:max-w-sm">
            {[["Resident", "A resident"], ["Staff", "A staff member"]].map(([value, label]) => {
              const on = formData.whomToVisit === value;
              return (
                <button key={value} type="button" aria-pressed={on}
                  onClick={() => { updateField("whomToVisit", value); updateField("selectPerson", ""); }}
                  className={`min-h-11 rounded-lg border px-3 text-sm font-bold transition-colors ${on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {formData.whomToVisit === "Resident" && (
          <div className="space-y-1.5">
            <Label className="text-sm font-bold">Resident</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger aria-label="Select resident" className="rounded-control min-h-touch text-base"><SelectValue placeholder="Choose a resident" /></SelectTrigger>
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
                          <span className="text-xs font-semibold text-muted-foreground">{r.wing}</span>
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
            <Label className="text-sm font-bold">Staff member</Label>
            <Select value={formData.selectPerson} onValueChange={(val) => updateField("selectPerson", val)}>
              <SelectTrigger aria-label="Select staff member" className="rounded-control min-h-touch text-base"><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
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
          <Label className="text-sm font-bold">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea aria-label="Visit comments" value={formData.comments} onChange={(e) => updateField("comments", e.target.value)}
            placeholder="Anything reception should know about this visit" className="min-h-[72px] resize-none" />
        </div>
        )}
      </div>


 );
}

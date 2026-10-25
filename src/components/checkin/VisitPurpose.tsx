import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { useCheckInFlow } from "./useCheckInFlow";

/** The legacy staff extras, using the existing type settings and save fields. */
export function VisitPurpose({ flow }: { flow: ReturnType<typeof useCheckInFlow> }) {
  return <>
    {flow.selectedType === "volunteer" && <div className="grid gap-3 sm:grid-cols-2">
      {flow.extras.volunteerRoleEnabled && <div className="space-y-1"><Label htmlFor="volunteer-role">Role / programme</Label><Input id="volunteer-role" className="min-h-touch text-base" value={flow.volunteerRole} onChange={e => flow.setVolunteerRole(e.target.value)} /></div>}
      {flow.extras.volunteerSupervisorEnabled && <div className="space-y-1"><Label htmlFor="volunteer-supervisor">Supervisor</Label><Input id="volunteer-supervisor" className="min-h-touch text-base" value={flow.volunteerSupervisor} onChange={e => flow.setVolunteerSupervisor(e.target.value)} /></div>}
      {flow.extras.volunteerExpectedEndEnabled && <div className="space-y-1"><Label htmlFor="volunteer-end">Expected finish</Label><Input id="volunteer-end" type="time" className="min-h-touch text-base" value={flow.volunteerExpectedEnd} onChange={e => flow.setVolunteerExpectedEnd(e.target.value)} /></div>}
    </div>}
    {flow.selectedType === "other" && <div className="space-y-1"><Label htmlFor="other-reason">Visit reason</Label><Textarea id="other-reason" aria-required="true" className="text-base" value={flow.otherReason} onChange={e => flow.setOtherReason(e.target.value)} /></div>}
  </>;
}
/**
 * Phase 7E — "see it before you save it". A read-only panel showing what the
 * current configuration produces on the kiosk, on a badge, in the type chooser
 * and in the check-in questions.
 */
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, Monitor, IdCard, Users, ClipboardList } from "lucide-react";
import { KioskPreview } from "./KioskPreview";
import { BadgePreview } from "./BadgePreview";
import { PersonTypesPreview } from "./PersonTypesPreview";
import { ScreeningPreview } from "./ScreeningPreview";

const TYPES = [
  { id: "visitor", label: "Visitor" },
  { id: "contractor", label: "Contractor" },
  { id: "volunteer", label: "Volunteer" },
  { id: "staff", label: "Staff" },
];

export function PreviewPanel({ defaultType = "visitor" }: { defaultType?: string }) {
  const [type, setType] = useState(defaultType);

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Configuration preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Preview
        </h3>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-[170px]" aria-label="Preview person type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="kiosk">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="kiosk" className="text-[12px]">
            <Monitor className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Kiosk
          </TabsTrigger>
          <TabsTrigger value="badge" className="text-[12px]">
            <IdCard className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Badge
          </TabsTrigger>
          <TabsTrigger value="types" className="text-[12px]">
            <Users className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Types
          </TabsTrigger>
          <TabsTrigger value="questions" className="text-[12px]">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Questions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kiosk" className="pt-3"><KioskPreview personType={type} /></TabsContent>
        <TabsContent value="badge" className="pt-3"><BadgePreview personType={type} /></TabsContent>
        <TabsContent value="types" className="pt-3"><PersonTypesPreview /></TabsContent>
        <TabsContent value="questions" className="pt-3"><ScreeningPreview personType={type} /></TabsContent>
      </Tabs>
    </section>
  );
}

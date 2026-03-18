import { useState } from "react";
import { HealthQuestionsManager } from "@/components/settings/HealthQuestionsManager";
import { VaccinationFieldsManager } from "@/components/settings/VaccinationFieldsManager";
import { FormFieldsManager } from "@/components/settings/FormFieldsManager";
import { CompanionFieldsManager } from "@/components/settings/CompanionFieldsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, HardHat, Home, UserCog } from "lucide-react";
import type { VisitorType } from "@/hooks/useHealthQuestions";

const visitorTypes: { value: VisitorType; label: string; icon: typeof Users }[] = [
  { value: "visitor", label: "Visitors", icon: Users },
  { value: "contractor", label: "Contractors", icon: HardHat },
  { value: "resident", label: "Residents", icon: Home },
  { value: "staff", label: "Staff", icon: UserCog },
];

export function HealthScreeningTab() {
  const [activeType, setActiveType] = useState<VisitorType>("visitor");

  return (
    <div className="space-y-6">
      <Tabs value={activeType} onValueChange={(v) => setActiveType(v as VisitorType)}>
        <TabsList className="grid w-full grid-cols-4">
          {visitorTypes.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 text-xs">
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {visitorTypes.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-6 mt-4">
            <FormFieldsManager visitorType={t.value} />
            <CompanionFieldsManager visitorType={t.value} />
            <HealthQuestionsManager visitorType={t.value} />
            <VaccinationFieldsManager visitorType={t.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

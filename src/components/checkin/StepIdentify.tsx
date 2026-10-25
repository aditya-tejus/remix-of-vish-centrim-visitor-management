import { VisitorType } from "@/types/visitor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Search, Check, Phone, QrCode, UserPlus, User, Wrench, HeartHandshake, Briefcase } from "lucide-react";
import { VisitorProfile } from "./useCheckInFlow";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { useEffect } from "react";

const allTypeChips: { type: VisitorType; label: string; Icon: React.ElementType; desc: string }[] = [
  { type: "visitor", label: "Visitor", Icon: User, desc: "Family, friends, guests" },
  { type: "contractor", label: "Contractor", Icon: Wrench, desc: "Trades, maintenance" },
  { type: "volunteer", label: "Volunteer", Icon: HeartHandshake, desc: "Activities, support" },
  { type: "other", label: "Other", Icon: UserPlus, desc: "Other visit" },
  { type: "staff", label: "Staff", Icon: Briefcase, desc: "Employees, agency" },
];

interface StepIdentifyProps {
  selectedType: VisitorType;
  onTypeChange: (type: VisitorType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: VisitorProfile[];
  selectedProfile: VisitorProfile | null;
  onSelectProfile: (profile: VisitorProfile) => void;
  onNewPerson: () => void;
}

export function StepIdentify({
  selectedType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  searchResults,
  selectedProfile,
  onSelectProfile,
  onNewPerson,
}: StepIdentifyProps) {
  const { deskTypes } = usePersonTypes();
  const enabled = new Set(deskTypes.map((t) => t.type as string));
  const typeChips = allTypeChips.filter((tc) => enabled.has(tc.type));
  const onlyType = typeChips.length === 1 ? typeChips[0] : null;

  // When the site only uses one visitor type, don't make staff choose it.
  useEffect(() => {
    if (onlyType && selectedType !== onlyType.type) onTypeChange(onlyType.type);
  }, [onlyType, selectedType, onTypeChange]);

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="space-y-2">
        <Label htmlFor="staff-returning-search">Returning visitor lookup</Label>
        <div className="relative mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="staff-returning-search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or phone (optional)"
            className="pl-11 pr-11 h-12 rounded-xl text-base border-2 border-border focus:border-primary bg-card shadow-sm"
            autoFocus
          />

        </div>
      </div>

      {/* Type chips — hidden when the site only has one type enabled */}
      <div className={`space-y-3 ${onlyType ? "hidden" : ""}`}>
        <p className="text-sm font-semibold text-muted-foreground">Visitor Type</p>
        <div className="flex flex-wrap gap-2">
          {typeChips.map((tc) => (
            <Button variant="outline" type="button"
              key={tc.type}
              onClick={() => onTypeChange(tc.type)}
              aria-pressed={selectedType === tc.type}
              className={`min-h-touch flex items-center gap-2 px-3 rounded-control text-center group ${
                selectedType === tc.type
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
              }`}
            >
              <tc.Icon className="h-4 w-4 text-primary" aria-hidden />
              <span className={`text-sm font-bold ${selectedType === tc.type ? "text-primary" : "text-foreground"}`}>
                {tc.label}
              </span>

            </Button>
          ))}
        </div>
      </div>

      {/* Returning visitors */}
      {searchQuery.trim().length >= 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              {searchResults.length > 0 ? `Returning Visitors (${searchResults.length})` : "No matches found"}
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {searchResults.map((profile) => (
                <Button variant="outline" type="button"
                  key={profile.id}
                  onClick={() => onSelectProfile(profile)}
                  className={`h-auto min-h-touch w-full justify-start text-left p-3 rounded-control border transition-all duration-150 group ${
                    selectedProfile?.id === profile.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex min-w-0 w-full items-center gap-3.5">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                      selectedProfile?.id === profile.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {profile.firstName[0]}{profile.surname[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">
                        {profile.firstName} {profile.surname}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {profile.mobile && (
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{profile.mobile}
                          </span>
                        )}
                        {profile.email && (
                          <span className="text-sm text-muted-foreground truncate">{profile.email}</span>
                        )}
                      </div>
                    </div>
                    {selectedProfile?.id === profile.id && (
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}

          {/* New person button */}
          <Button variant="outline" type="button"
            onClick={onNewPerson}
            className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
          >
            <UserPlus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              New person — not in system
            </span>
          </Button>
        </div>
      )}

    </div>
  );
}

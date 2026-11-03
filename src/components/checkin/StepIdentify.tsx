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
    <div className="space-y-5">
      {/* Search input */}
      <div className="space-y-1.5">
        <Label htmlFor="staff-returning-search" className="text-sm font-bold">Returning visitor lookup</Label>
        <p className="text-[13px] text-muted-foreground">Been here before? Search to fill in their details. Leave empty for someone new.</p>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="staff-returning-search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Name or phone number"
            className="pl-10"
            autoFocus
          />

        </div>
      </div>

      {/* Type chips — hidden when the site only has one type enabled */}
      <div className={`space-y-2 ${onlyType ? "hidden" : ""}`}>
        <p id="staff-type-label" className="text-sm font-bold text-foreground">Type of visit</p>
        <div role="group" aria-labelledby="staff-type-label" className="flex flex-wrap gap-2">
          {typeChips.map((tc) => (
            <Button variant="outline" type="button"
              key={tc.type}
              onClick={() => onTypeChange(tc.type)}
              aria-pressed={selectedType === tc.type}
              className={`h-11 gap-2 rounded-full px-4 ${
                selectedType === tc.type
                  ? "border-primary bg-accent text-accent-foreground hover:bg-accent"
                  : "border-input text-foreground hover:border-primary/60 hover:bg-card"
              }`}
            >
              <tc.Icon className={`h-4 w-4 ${selectedType === tc.type ? "text-accent-foreground" : "text-muted-foreground"}`} aria-hidden />
              <span className="text-sm font-bold">
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
              {searchResults.length > 0 ? `${searchResults.length} returning ${searchResults.length === 1 ? "match" : "matches"}` : "Nobody matches. Fill in their details below."}
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((profile) => (
                <Button variant="outline" type="button"
                  key={profile.id}
                  onClick={() => onSelectProfile(profile)}
                  className={`h-auto min-h-touch w-full justify-start rounded-xl p-3 text-left ${
                    selectedProfile?.id === profile.id
                      ? "border-primary bg-accent hover:bg-accent"
                      : "border-border hover:border-primary/60 hover:bg-card"
                  }`}
                >
                  <div className="flex min-w-0 w-full items-center gap-3.5">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 transition-colors ${
                      selectedProfile?.id === profile.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-accent-foreground"
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
          <Button variant="ghost" type="button" onClick={onNewPerson} className="gap-2 text-primary-hover">
            <UserPlus aria-hidden className="h-4 w-4" />
            Someone new — enter their details
          </Button>
        </div>
      )}

    </div>
  );
}

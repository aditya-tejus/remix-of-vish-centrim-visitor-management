import { VisitorType } from "@/types/visitor";
import { Input } from "@/components/ui/input";
import { Search, Check, Phone, QrCode } from "lucide-react";
import { VisitorProfile } from "./useCheckInFlow";

const typeChips: { type: VisitorType; label: string; emoji: string }[] = [
  { type: "visitor", label: "Visitor", emoji: "👋" },
  { type: "contractor", label: "Contractor", emoji: "🔧" },
  { type: "volunteer", label: "Volunteer", emoji: "🤝" },
  { type: "staff", label: "Staff", emoji: "💼" },
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
  return (
    <div className="space-y-5">
      {/* Search input — accepts QR scanner input naturally */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, phone, or scan QR..."
            className="pl-10 pr-10 h-12 rounded-xl text-[15px] border-2 border-border focus:border-primary"
            autoFocus
          />
          <QrCode className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
        </div>
      </div>

      {/* Type chips */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visitor Type</p>
        <div className="grid grid-cols-4 gap-2">
          {typeChips.map((tc) => (
            <button
              key={tc.type}
              onClick={() => onTypeChange(tc.type)}
              className={`flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-xl border-2 text-center transition-all duration-150 ${
                selectedType === tc.type
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <span className="text-xl">{tc.emoji}</span>
              <span className={`text-[11px] font-bold ${selectedType === tc.type ? "text-primary" : "text-foreground"}`}>
                {tc.label}
              </span>
              {selectedType === tc.type && (
                <div className="h-0.5 w-6 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Returning visitors */}
      {searchQuery.trim().length >= 2 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {searchResults.length > 0 ? "Returning Visitors" : "No matches found"}
          </p>

          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {searchResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => onSelectProfile(profile)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-150 ${
                    selectedProfile?.id === profile.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      selectedProfile?.id === profile.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {profile.firstName[0]}{profile.surname[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground truncate">
                        {profile.firstName} {profile.surname}
                      </p>
                      <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />{profile.mobile || profile.email}
                      </span>
                    </div>
                    {selectedProfile?.id === profile.id && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* New person button */}
          <button
            onClick={onNewPerson}
            className="w-full p-3.5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
          >
            <span className="text-[13px] font-medium text-muted-foreground">
              + New person (not in system)
            </span>
          </button>
        </div>
      )}

      {/* Selected confirmation */}
      {selectedProfile && (
        <div className="rounded-xl border border-success/30 bg-success/5 p-3.5 flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-success" />
          </div>
          <p className="text-[13px] text-foreground">
            <span className="font-bold">{selectedProfile.firstName} {selectedProfile.surname}</span>
            <span className="text-muted-foreground"> — details will be pre-filled</span>
          </p>
        </div>
      )}
    </div>
  );
}

import { VisitorType } from "@/types/visitor";
import { Input } from "@/components/ui/input";
import { Search, Check, Phone, QrCode, UserPlus } from "lucide-react";
import { VisitorProfile } from "./useCheckInFlow";

const allTypeChips: { type: VisitorType; label: string; emoji: string; desc: string }[] = [
  { type: "visitor", label: "Visitor", emoji: "👋", desc: "Family, friends, guests" },
  { type: "contractor", label: "Contractor", emoji: "🔧", desc: "Trades, maintenance" },
  { type: "volunteer", label: "Volunteer", emoji: "🤝", desc: "Activities, support" },
  { type: "staff", label: "Staff", emoji: "💼", desc: "Employees, agency" },
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
    <div className="space-y-6">
      {/* Search input */}
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-foreground">Find or create a visitor</h3>
        <p className="text-[12px] text-muted-foreground">Search for a returning visitor or start a new record.</p>
        <div className="relative mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, phone, or scan QR..."
            className="pl-11 pr-11 h-12 rounded-xl text-[15px] border-2 border-border focus:border-primary bg-card shadow-sm"
            autoFocus
          />
          <QrCode className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
        </div>
      </div>

      {/* Type chips */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Visitor Type</p>
        <div className="grid grid-cols-4 gap-3">
          {typeChips.map((tc) => (
            <button
              key={tc.type}
              onClick={() => onTypeChange(tc.type)}
              className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 text-center transition-all duration-150 group ${
                selectedType === tc.type
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
              }`}
            >
              <span className="text-2xl">{tc.emoji}</span>
              <span className={`text-[12px] font-bold ${selectedType === tc.type ? "text-primary" : "text-foreground"}`}>
                {tc.label}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">{tc.desc}</span>
              {selectedType === tc.type && (
                <div className="h-0.5 w-8 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Returning visitors */}
      {searchQuery.trim().length >= 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {searchResults.length > 0 ? `Returning Visitors (${searchResults.length})` : "No matches found"}
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {searchResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => onSelectProfile(profile)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 group ${
                    selectedProfile?.id === profile.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 transition-colors ${
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
                      <div className="flex items-center gap-3 mt-0.5">
                        {profile.mobile && (
                          <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />{profile.mobile}
                          </span>
                        )}
                        {profile.email && (
                          <span className="text-[12px] text-muted-foreground truncate">{profile.email}</span>
                        )}
                      </div>
                    </div>
                    {selectedProfile?.id === profile.id && (
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
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
            className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 group"
          >
            <UserPlus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-[13px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              New person — not in system
            </span>
          </button>
        </div>
      )}

      {/* Selected confirmation */}
      {selectedProfile && (
        <div className="rounded-xl border-2 border-success/30 bg-success/5 p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <Check className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground">
              {selectedProfile.firstName} {selectedProfile.surname}
            </p>
            <p className="text-[12px] text-muted-foreground">Details will be pre-filled — click Next to continue</p>
          </div>
        </div>
      )}
    </div>
  );
}

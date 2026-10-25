import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Search, UserCheck, UserPlus } from "lucide-react";
import { usePeopleLookup } from "@/hooks/usePeopleLookup";
import type { CompanionDetail } from "@/types/visitor";
import type { CompanionFieldSpec } from "@/lib/companionFields";

export function AdditionalPeople({ companions, setCompanions, activeCompanionFields }: {
 companions: CompanionDetail[];
 setCompanions: React.Dispatch<React.SetStateAction<CompanionDetail[]>>;
 activeCompanionFields: CompanionFieldSpec[];
}) {
 const addCompanion = () => {
   const empty: CompanionDetail = {};
   activeCompanionFields.forEach(f => { empty[f.key] = ""; });
   setCompanions(prev => [...prev, empty]);
 };
 return <>
      {/* Companions */}
      {activeCompanionFields.length > 0 && (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Companions ({companions.length})
            </p>
            <Button variant="outline" size="sm" className="min-h-touch text-sm gap-1.5 rounded-lg" onClick={addCompanion}>
              <Plus className="h-3 w-3" /> Add Companion
            </Button>
          </div>
          {companions.map((companion, cIdx) => (
            <div key={cIdx} className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {cIdx + 1}
                  </div>
                  <span className="text-sm font-semibold text-foreground">Companion {cIdx + 1}</span>
                </div>
                <Button variant="ghost" size="icon" className="min-h-touch min-w-touch text-destructive hover:bg-destructive/10"
                  aria-label={`Remove companion ${cIdx + 1}`} onClick={() => setCompanions((prev) => prev.filter((_, i) => i !== cIdx))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeCompanionFields.map((f) => {
                  const key = f.key;
                  const value = companion[key] || "";
                  const missing = f.required && !String(value).trim();
                  const setValue = (v: string) =>
                    setCompanions((prev) => prev.map((c, i) => (i === cIdx ? { ...c, [key]: v } : c)));
                  const inputType = f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text";
                  return (
                    <div key={`${f.source}-${f.id}`} className="space-y-1">
                      <Label className="text-sm font-medium">{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                      {f.type === "select" || f.type === "yesno" ? (
                        <Select value={String(value)} onValueChange={setValue} disabled={!f.editable}>
                          <SelectTrigger className="rounded-lg min-h-touch text-base" aria-label={`${f.label}, companion ${cIdx + 1}`}>
                            <SelectValue placeholder={f.label} />
                          </SelectTrigger>
                          <SelectContent>
                            {(f.type === "yesno" ? ["Yes", "No"] : f.choices || []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === "textarea" ? (
                        <Textarea aria-label={`${f.label}, companion ${cIdx + 1}`} value={String(value)} onChange={(e) => setValue(e.target.value)} readOnly={!f.editable}
                          placeholder={f.label} className="rounded-lg text-base min-h-[60px] resize-none" />
                      ) : (
                        <Input aria-label={`${f.label}, companion ${cIdx + 1}`} type={inputType} value={String(value)} onChange={(e) => setValue(e.target.value)} readOnly={!f.editable}
                          placeholder={f.label} className="rounded-lg min-h-touch text-base" />
                      )}
                      {f.help && <p className="text-sm text-muted-foreground">{f.help}</p>}
                      {missing && <p className="text-sm text-destructive">{f.label} is needed before signing in</p>}
                    </div>
                  );
                })}
              </div>
              <CompanionIdentity
                companion={companion}
                onChange={(patch) => setCompanions((prev) => prev.map((c, i) => (i === cIdx ? { ...c, ...patch } : c)))}
              />
            </div>
          ))}

        </div>
      )}
 </>;
}

/**
 * Lets reception recognise a companion who is already known at this site, or
 * deliberately record them as a new person. A name on its own never links
 * anyone automatically.
 */
function CompanionIdentity({
  companion,
  onChange,
}: {
  companion: CompanionDetail;
  onChange: (patch: CompanionDetail) => void;
}) {
  const [query, setQuery] = useState("");
  const { matches, searching } = usePeopleLookup(query);

  if (companion.person_id) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          <UserCheck className="h-3.5 w-3.5" aria-hidden /> Linked to someone already known here
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-sm"
          onClick={() => onChange({ person_id: undefined })}
        >
          Unlink
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people already known here (optional)"
          aria-label="Search people already known at this site"
          className="rounded-lg min-h-touch pl-8 text-base"
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {searching && <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>}
          {!searching && matches.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No one here matches that. Enter their details above.</p>
          )}
          {matches.map((m) => (
            <Button variant="ghost"
              key={m.id}
              type="button"
              onClick={() => {
                onChange({
                  person_id: m.id,
                  name: `${m.firstName} ${m.surname}`.trim(),
                  phone: m.mobile || companion.phone,
                  email: m.email || companion.email,
                  create_person: undefined,
                });
                setQuery("");
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span>
                {m.firstName} {m.surname}
                {m.mobile ? ` · ${m.mobile}` : ""}
              </span>
              <span className="text-muted-foreground">{m.strongMatch ? "Contact matches" : "Name matches"}</span>
            </Button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={companion.create_person === "true"}
          onCheckedChange={(checked) => onChange({ create_person: checked ? "true" : undefined })}
        />
        <span className="flex items-center gap-1.5">
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> Remember this companion for future visits
        </span>
      </label>
    </div>
  );
}

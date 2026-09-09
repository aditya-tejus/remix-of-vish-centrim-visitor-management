import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanionFields, useFormFields, useFormFieldMutations, FormField } from "@/hooks/useFormFields";
import { useToast } from "@/hooks/use-toast";
import { useOperatingContext } from "@/contexts/OperatingContext";
import {
  defaultCompanionSeeds,
  mergeCompanionFields,
  FIELD_TYPE_OPTIONS,
  COMPANION_PREFIX,
} from "@/lib/companionFields";
import { ArrowUp, ArrowDown, Save, Users, Plus, Trash2, Eye, Lock, AlertCircle } from "lucide-react";
import type { VisitorType } from "@/hooks/useHealthQuestions";

interface Props {
  visitorType: VisitorType;
}

/**
 * Where staff decide what reception is asked for each companion of a person
 * type: what is shown, what must be filled in, what can be changed at the desk,
 * and in what order. Wording follows the country the site runs in.
 */
export function CompanionFieldsManager({ visitorType }: Props) {
  const { data: fields = [], isLoading } = useCompanionFields(visitorType);
  const { data: mainFields = [] } = useFormFields(visitorType, "");
  const { update, create, remove } = useFormFieldMutations();
  const { toast } = useToast();
  const { jurisdiction, terms } = useOperatingContext();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [seeding, setSeeding] = useState(false);

  const sorted = useMemo(() => [...fields].sort((a, b) => a.sort_order - b.sort_order), [fields]);
  const preview = useMemo(() => mergeCompanionFields(fields, mainFields), [fields, mainFields]);

  // A person type with nothing configured gets a sensible starting set once.
  useEffect(() => {
    if (isLoading || seeding || fields.length > 0) return;
    setSeeding(true);
    (async () => {
      try {
        const seeds = defaultCompanionSeeds(jurisdiction);
        for (let i = 0; i < seeds.length; i++) {
          await create.mutateAsync({
            ...seeds[i],
            sort_order: 100 + i,
            is_active: true,
            visitor_type: visitorType,
          } as any);
        }
      } catch {
        /* leave the screen empty rather than block the page */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, fields.length, visitorType, jurisdiction]);

  const patch = async (f: FormField, changes: Partial<FormField>) => {
    try {
      await update.mutateAsync({ id: f.id, ...changes } as any);
    } catch {
      toast({ title: "Could not save that change", variant: "destructive" });
    }
  };

  const moveField = async (f: FormField, direction: "up" | "down") => {
    const idx = sorted.findIndex((x) => x.id === f.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    try {
      await Promise.all([
        update.mutateAsync({ id: sorted[idx].id, sort_order: sorted[swapIdx].sort_order }),
        update.mutateAsync({ id: sorted[swapIdx].id, sort_order: sorted[idx].sort_order }),
      ]);
    } catch {
      toast({ title: "Could not reorder the fields", variant: "destructive" });
    }
  };

  const handleAddField = async () => {
    if (!newLabel.trim()) {
      toast({ title: "Give the field a label first", variant: "destructive" });
      return;
    }
    const key = COMPANION_PREFIX + newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const maxOrder = fields.reduce((max, f) => Math.max(max, f.sort_order), 99);
    try {
      await create.mutateAsync({
        label: newLabel.trim(),
        field_key: key,
        field_type: newType,
        required: false,
        sort_order: maxOrder + 1,
        is_active: true,
        is_editable: true,
        visitor_type: visitorType,
      } as any);
      toast({ title: "Companion field added" });
      setNewLabel("");
      setNewType("text");
      setShowAddForm(false);
    } catch {
      toast({ title: "Could not add that field", variant: "destructive" });
    }
  };

  const handleDelete = async (f: FormField) => {
    try {
      await remove.mutateAsync(f.id);
      toast({ title: "Field removed" });
    } catch {
      toast({ title: "Could not remove that field", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading companion fields...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Companion details</h2>
              <p className="text-xs text-muted-foreground">
                What reception is asked for each person arriving with a{" "}
                <span className="font-medium text-foreground capitalize">{visitorType}</span> at your{" "}
                {terms.site.toLowerCase()}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add field
          </Button>
        </div>

        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden />
          <p className="text-xs text-muted-foreground">
            A required field must be filled in before anyone on the visit can be signed in. A read-only field shows a
            detail already saved for a known companion but cannot be changed at the desk.
          </p>
        </div>

        {showAddForm && (
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px] space-y-1">
              <Label className="text-xs font-medium text-muted-foreground" htmlFor="companion-new-label">
                Field label
              </Label>
              <Input
                id="companion-new-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Photo ID number"
                className="h-9 text-sm"
              />
            </div>
            <div className="w-[170px] space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Answer type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-9 text-sm" aria-label="Answer type for the new companion field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="gap-1.5" onClick={handleAddField} disabled={create.isPending}>
              <Save className="h-3.5 w-3.5" aria-hidden /> {create.isPending ? "Adding..." : "Add field"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>
        )}

        <div className="divide-y divide-border">
          {sorted.map((f, idx) => (
            <div key={f.id} className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={idx === 0}
                    onClick={() => moveField(f, "up")}
                    aria-label={`Move ${f.label} up`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={idx === sorted.length - 1}
                    onClick={() => moveField(f, "down")}
                    aria-label={`Move ${f.label} down`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>

                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label className="text-[11px] text-muted-foreground" htmlFor={`label-${f.id}`}>
                    Label shown at the desk
                  </Label>
                  <Input
                    id={`label-${f.id}`}
                    defaultValue={f.label}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== f.label && patch(f, { label: e.target.value.trim() })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="w-[160px] space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Answer type</Label>
                  <Select value={f.field_type || "text"} onValueChange={(v) => patch(f, { field_type: v })}>
                    <SelectTrigger className="h-9 text-sm" aria-label={`Answer type for ${f.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 gap-1.5"
                  onClick={() => handleDelete(f)}
                  aria-label={`Remove ${f.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground" htmlFor={`help-${f.id}`}>
                  Help text (optional)
                </Label>
                <Input
                  id={`help-${f.id}`}
                  defaultValue={f.help_text || ""}
                  onBlur={(e) => e.target.value !== (f.help_text || "") && patch(f, { help_text: e.target.value.trim() || null })}
                  placeholder="Short guidance shown under the field"
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-[13px] text-foreground">
                  <Switch checked={f.is_active} onCheckedChange={() => patch(f, { is_active: !f.is_active })} aria-label={`Show ${f.label} at check-in`} />
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> Visible
                  </span>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-foreground">
                  <Switch checked={f.required} onCheckedChange={() => patch(f, { required: !f.required })} aria-label={`Make ${f.label} required`} />
                  <span>Required</span>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-foreground">
                  <Switch
                    checked={f.is_editable !== false}
                    onCheckedChange={() => patch(f, { is_editable: f.is_editable === false })}
                    aria-label={`Allow staff to edit ${f.label}`}
                  />
                  <span className="flex items-center gap-1.5">
                    {f.is_editable === false && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                    {f.is_editable === false ? "Read-only" : "Editable"}
                  </span>
                </label>
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No companion fields yet. Add one above.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">What reception will see</h3>
          <p className="text-xs text-muted-foreground">
            Companion-only fields first, then the details already configured for the main {visitorType}.
          </p>
        </div>
        <div className="px-5 py-4 grid gap-3 sm:grid-cols-2">
          {preview.map((f) => (
            <div key={`${f.source}-${f.key}`} className="space-y-1">
              <Label className="text-[11px] font-medium flex items-center gap-1.5">
                {f.label}
                {f.required && <span className="text-destructive">*</span>}
                {!f.editable && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Lock className="h-3 w-3" aria-hidden /> Read-only
                  </Badge>
                )}
                {f.source === "visitor" && (
                  <Badge variant="secondary" className="text-[10px]">
                    From {visitorType} fields
                  </Badge>
                )}
              </Label>
              <Input disabled placeholder={f.label} className="h-9 text-sm" />
              {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
            </div>
          ))}
          {preview.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing is asked for companions of this person type yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

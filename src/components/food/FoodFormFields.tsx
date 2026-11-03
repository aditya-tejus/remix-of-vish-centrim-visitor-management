import { FoodPrivacyNotice } from "@/components/FoodPrivacyNotice";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FOOD_TYPES } from "@/lib/foodRegister";
import { X } from "lucide-react";

export interface FoodFormState {
  foodDescription: string;
  foodType: string;
  sharedWithOthers: boolean;
  sharedResidentIds: string[];
  notes: string;
}

export const emptyFoodForm: FoodFormState = {
  foodDescription: "",
  foodType: "homemade",
  sharedWithOthers: false,
  sharedResidentIds: [],
  notes: "",
};

export function isFoodFormValid(state: FoodFormState) {
  return state.foodDescription.trim().length > 0;
}

interface ResidentOption {
  id: string; // resident visitor id
  name: string;
  room?: string;
}

interface FoodFormFieldsProps {
  state: FoodFormState;
  onChange: (next: FoodFormState) => void;
  residents: ResidentOption[];
  /** Resident the food is for — excluded from the "shared with" list */
  primaryResidentId?: string | null;
  /** Larger controls for kiosk use */
  size?: "default" | "kiosk";
}

export function FoodFormFields({ state, onChange, residents, primaryResidentId, size = "default" }: FoodFormFieldsProps) {
  const kiosk = size === "kiosk";
  const controlH = kiosk ? "h-14 text-base" : "";
  const labelCls = kiosk ? "text-sm font-medium" : "text-sm font-bold";
  const choice = (on: boolean) => `rounded-lg border font-bold transition-colors ${kiosk ? "h-14 text-base" : "min-h-11 px-3 text-sm"} ${
    on ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card text-foreground hover:border-primary/60"}`;

  const set = (patch: Partial<FoodFormState>) => onChange({ ...state, ...patch });

  const shareOptions = residents.filter((r) => r.id !== primaryResidentId);
  const selected = shareOptions.filter((r) => state.sharedResidentIds.includes(r.id));

  return (
    <div className={kiosk ? "space-y-5" : "space-y-4"}>
      <div className="space-y-1.5">
        <Label htmlFor="food-description" className={labelCls}>What food is it?<span aria-hidden className="ml-1 text-destructive">*</span></Label>
        <Input
          id="food-description"
          value={state.foodDescription}
          onChange={(e) => set({ foodDescription: e.target.value })}
          placeholder="For example, home-cooked lasagne or a box of biscuits"
          className={controlH}
        />
      </div>

      <div className="space-y-1.5">
        <p id="food-type-label" className={labelCls}>Type of food</p>
        <div role="group" aria-labelledby="food-type-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FOOD_TYPES.map((t) => (
            <button key={t.value} type="button" aria-pressed={state.foodType === t.value} onClick={() => set({ foodType: t.value })} className={choice(state.foodType === t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p id="food-shared-label" className={labelCls}>Will it be shared with other residents?</p>
        <div role="group" aria-labelledby="food-shared-label" className="grid grid-cols-2 gap-2 sm:max-w-xs">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => set({ sharedWithOthers: val, sharedResidentIds: val ? state.sharedResidentIds : [] })}
              aria-pressed={state.sharedWithOthers === val}
              className={choice(state.sharedWithOthers === val)}
            >
              {val ? "Yes, shared" : "No, just them"}
            </button>
          ))}
        </div>
      </div>

      {state.sharedWithOthers && (
        <div className="space-y-1.5">
          <Label className={labelCls}>Which other residents? (optional)</Label>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {selected.map((r) => (
                <Badge key={r.id} variant="secondary" className="gap-1 text-xs">
                  {r.name}
                  <button
                    type="button"
                    onClick={() => set({ sharedResidentIds: state.sharedResidentIds.filter((id) => id !== r.id) })}
                    aria-label={`Remove ${r.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Select
            value=""
            onValueChange={(v) => {
              if (!state.sharedResidentIds.includes(v)) set({ sharedResidentIds: [...state.sharedResidentIds, v] });
            }}
          >
            <SelectTrigger aria-label="Add a resident it is shared with" className={controlH}>
              <SelectValue placeholder="Add a resident" />
            </SelectTrigger>
            <SelectContent>
              {shareOptions
                .filter((r) => !state.sharedResidentIds.includes(r.id))
                .map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}{r.room ? ` • ${r.room}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="food-notes" className={labelCls}>Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea
          id="food-notes"
          value={state.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="For example, where it is stored, or allergy information"
          className={kiosk ? "min-h-[96px] text-base" : "min-h-[72px]"}
        />
      </div>

      <FoodPrivacyNotice size={kiosk ? "kiosk" : "default"} />
    </div>
  );
}

export function FoodFormClearButton({ onClear }: { onClear: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClear} className="text-[12px]">
      Clear
    </Button>
  );
}

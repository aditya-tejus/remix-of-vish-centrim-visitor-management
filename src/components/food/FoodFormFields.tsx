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
  const controlH = kiosk ? "h-14 text-base" : "h-10 text-[14px]";
  const labelCls = kiosk ? "text-sm font-medium" : "text-[12px] font-medium";

  const set = (patch: Partial<FoodFormState>) => onChange({ ...state, ...patch });

  const shareOptions = residents.filter((r) => r.id !== primaryResidentId);
  const selected = shareOptions.filter((r) => state.sharedResidentIds.includes(r.id));

  return (
    <div className={kiosk ? "space-y-5" : "space-y-4"}>
      <div className="space-y-1.5">
        <Label className={labelCls}>What food are you bringing? *</Label>
        <Input
          value={state.foodDescription}
          onChange={(e) => set({ foodDescription: e.target.value })}
          placeholder="e.g. Home-cooked lasagne, box of biscuits"
          className={`rounded-xl ${controlH}`}
        />
      </div>

      <div className="space-y-1.5">
        <Label className={labelCls}>Food type</Label>
        <Select value={state.foodType} onValueChange={(v) => set({ foodType: v })}>
          <SelectTrigger className={`rounded-xl ${controlH}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {FOOD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className={labelCls}>Is this being shared with other residents?</Label>
        <div className="flex gap-3">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => set({ sharedWithOthers: val, sharedResidentIds: val ? state.sharedResidentIds : [] })}
              className={`flex-1 rounded-xl border font-semibold transition-all active:scale-[0.98] ${
                kiosk ? "h-14 text-base" : "h-10 text-[13px]"
              } ${
                state.sharedWithOthers === val
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border"
              }`}
            >
              {val ? "Yes" : "No"}
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
                <Badge key={r.id} variant="secondary" className="gap-1 text-[12px]">
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
            <SelectTrigger className={`rounded-xl ${controlH}`}>
              <SelectValue placeholder="Add a resident..." />
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
        <Label className={labelCls}>Notes (optional)</Label>
        <Textarea
          value={state.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Anything staff should know"
          className={`rounded-xl ${kiosk ? "min-h-[96px] text-base" : "min-h-[70px] text-[13px]"}`}
        />
      </div>
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

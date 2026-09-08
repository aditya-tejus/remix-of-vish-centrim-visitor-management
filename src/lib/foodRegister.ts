import { supabase } from "@/integrations/supabase/client";

export const FOOD_TYPES = [
  { value: "homemade", label: "Homemade" },
  { value: "packaged", label: "Packaged" },
  { value: "takeaway", label: "Takeaway / Delivered" },
  { value: "other", label: "Other" },
] as const;

export type FoodTypeValue = (typeof FOOD_TYPES)[number]["value"];

export function foodTypeLabel(value: string) {
  return FOOD_TYPES.find((t) => t.value === value)?.label || "Other";
}

export interface FoodRecord {
  id: string;
  residentVisitorId: string | null;
  residentName: string;
  visitorId: string | null;
  broughtByName: string;
  foodDescription: string;
  foodType: string;
  sharedWithOthers: boolean;
  sharedResidentIds: string[];
  sharedResidentNames: string[];
  notes: string | null;
  recordedAt: Date;
  source: string;
  createdBy: string | null;
}

export interface FoodRecordInput {
  residentVisitorId: string | null;
  residentName: string;
  visitorId?: string | null;
  broughtByName: string;
  foodDescription: string;
  foodType: string;
  sharedWithOthers: boolean;
  sharedResidentIds?: string[];
  sharedResidentNames?: string[];
  notes?: string | null;
  recordedAt?: Date;
  source?: "check_in" | "manual";
  createdBy?: string | null;
  /** Site the record belongs to. Keeps the register scoped like every other register. */
  branchId?: string | null;
}

export function mapFoodRow(row: any): FoodRecord {
  return {
    id: row.id,
    residentVisitorId: row.resident_visitor_id,
    residentName: row.resident_name,
    visitorId: row.visitor_id,
    broughtByName: row.brought_by_name,
    foodDescription: row.food_description,
    foodType: row.food_type,
    sharedWithOthers: row.shared_with_others,
    sharedResidentIds: row.shared_resident_ids || [],
    sharedResidentNames: row.shared_resident_names || [],
    notes: row.notes,
    recordedAt: new Date(row.recorded_at),
    source: row.source,
    createdBy: row.created_by,
  };
}

export async function insertFoodRecord(input: FoodRecordInput) {
  return supabase.from("food_register").insert({
    resident_visitor_id: input.residentVisitorId,
    resident_name: input.residentName,
    visitor_id: input.visitorId ?? null,
    brought_by_name: input.broughtByName,
    food_description: input.foodDescription,
    food_type: input.foodType,
    shared_with_others: input.sharedWithOthers,
    shared_resident_ids: input.sharedResidentIds ?? [],
    shared_resident_names: input.sharedResidentNames ?? [],
    notes: input.notes ?? null,
    recorded_at: (input.recordedAt ?? new Date()).toISOString(),
    source: input.source ?? "check_in",
    created_by: input.createdBy ?? null,
    branch_id: input.branchId ?? null,
  });
}

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { KEY_TYPES } from "./AddKeyDialog";

export interface KeyFilterValues {
  q: string;
  status: string;
  type: string;
  holder: string;
  area: string;
  wing: string;
  age: string;
}

export const EMPTY_FILTERS: KeyFilterValues = {
  q: "", status: "all", type: "all", holder: "all", area: "all", wing: "all", age: "all",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "issued", label: "Issued out" },
  { value: "overdue", label: "Overdue" },
  { value: "lost", label: "Lost" },
  { value: "retired", label: "Retired" },
];

const HOLDER_OPTIONS = [
  { value: "all", label: "Anyone holding" },
  { value: "staff", label: "Held by staff" },
  { value: "contractor", label: "Held by contractor" },
  { value: "visitor", label: "Held by visitor" },
  { value: "family", label: "Held by family" },
  { value: "resident", label: "Held by resident" },
  { value: "other", label: "Held by other" },
];

const AGE_OPTIONS = [
  { value: "all", label: "Any time out" },
  { value: "due_today", label: "Due back today" },
  { value: "overdue", label: "Past due" },
  { value: "over_24h", label: "Out over 24 hours" },
  { value: "over_week", label: "Out over a week" },
];

interface Props {
  values: KeyFilterValues;
  onChange: (patch: Partial<KeyFilterValues>) => void;
  onClear: () => void;
  areas: string[];
  wings: { id: string; name: string }[];
  resultCount: number;
}

export function KeyFilters({ values, onChange, onClear, areas, wings, resultCount }: Props) {
  const label = (key: keyof KeyFilterValues): string | null => {
    const v = values[key];
    if (!v || v === "all" || v === "") return null;
    switch (key) {
      case "q": return `“${v}”`;
      case "status": return STATUS_OPTIONS.find((o) => o.value === v)?.label || v;
      case "type": return KEY_TYPES.find((o) => o.value === v)?.label || v;
      case "holder": return HOLDER_OPTIONS.find((o) => o.value === v)?.label || v;
      case "age": return AGE_OPTIONS.find((o) => o.value === v)?.label || v;
      case "wing": return wings.find((w) => w.id === v)?.name || v;
      default: return v;
    }
  };

  const activeKeys = (Object.keys(values) as (keyof KeyFilterValues)[]).filter((k) => label(k));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={values.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search key, area, resident or holder"
            className="pl-9"
          />
        </div>

        <Select value={values.status} onValueChange={(v) => onChange({ status: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={values.type} onValueChange={(v) => onChange({ type: v })}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any kind of key</SelectItem>
            {KEY_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={values.holder} onValueChange={(v) => onChange({ holder: v })}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HOLDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={values.area} onValueChange={(v) => onChange({ area: v })}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any resident or area</SelectItem>
            {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>

        {wings.length > 0 && (
          <Select value={values.wing} onValueChange={(v) => onChange({ wing: v })}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any wing</SelectItem>
              {wings.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={values.age} onValueChange={(v) => onChange({ age: v })}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {resultCount} {resultCount === 1 ? "key" : "keys"} shown
        </span>
        {activeKeys.map((k) => (
          <Badge key={k} variant="outline" className="gap-1 rounded-full font-normal">
            {label(k)}
            <button onClick={() => onChange({ [k]: k === "q" ? "" : "all" } as Partial<KeyFilterValues>)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {activeKeys.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>Clear all</Button>
        )}
      </div>
    </div>
  );
}

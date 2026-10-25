import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CheckInFieldSpec } from "@/lib/checkInFields";

/** Presentation only: field order and requiredness come from the existing resolver. */
export function ConfiguredDetails({ fields, values, onChange }: {
  fields: CheckInFieldSpec[]; values: Record<string, unknown>;
  onChange: (key: string, value: string) => void;
}) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {fields.map(field => {
      const value = String(values[field.valueKey] ?? "");
      const id = `staff-detail-${field.id}`;
      const wide = field.type === "textarea" || field.valueKey === "address";
      return <div key={field.id} className={`min-w-0 space-y-1 ${wide ? "sm:col-span-2" : ""}`}>
        <Label htmlFor={id} className="text-sm">{field.label}{field.required && <span aria-hidden="true" className="ml-1 text-destructive">*</span>}</Label>
        {field.type === "select" || field.type === "yesno" ?
          <Select value={value} onValueChange={v => onChange(field.valueKey, v)} disabled={!field.editable}>
            <SelectTrigger id={id} aria-required={field.required} className="min-h-touch rounded-control text-base"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{(field.type === "yesno" ? ["Yes", "No"] : field.choices || []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
          </Select> : field.type === "textarea" ?
          <Textarea id={id} value={value} onChange={e => onChange(field.valueKey, e.target.value)} readOnly={!field.editable} aria-required={field.required} aria-describedby={field.help ? `${id}-help` : undefined} className="min-h-16 rounded-control text-base" /> :
          <Input id={id} type={["date", "email", "tel"].includes(field.type) ? field.type : "text"} value={value} onChange={e => onChange(field.valueKey, e.target.value)} readOnly={!field.editable} aria-required={field.required} aria-describedby={field.help ? `${id}-help` : undefined} autoComplete={field.valueKey === "firstName" ? "given-name" : field.valueKey === "surname" ? "family-name" : field.valueKey === "mobile" ? "tel" : field.valueKey === "email" ? "email" : "off"} className="min-h-touch rounded-control text-base" />}
        {field.help && <p id={`${id}-help`} className="text-sm text-muted-foreground">{field.help}</p>}
      </div>;
    })}
  </div>;
}
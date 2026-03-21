import { useState } from "react";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface TimeOverrideProps {
  /** The override time value (HH:mm format). Null = use current time. */
  value: string | null;
  onChange: (time: string | null) => void;
  label?: string;
}

export function TimeOverride({ value, onChange, label = "Adjust actual time" }: TimeOverrideProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!expanded) {
      // When expanding, pre-fill with current time
      if (!value) {
        onChange(format(new Date(), "HH:mm"));
      }
      setExpanded(true);
    } else {
      // When collapsing, reset to null (use current time)
      onChange(null);
      setExpanded(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Clock className="h-3 w-3" />
        <span>{label}</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="flex items-center gap-2 pl-4.5">
          <Input
            type="time"
            value={value || format(new Date(), "HH:mm")}
            onChange={(e) => onChange(e.target.value)}
            className="w-[140px] h-9 text-sm"
          />
          <span className="text-[10px] text-muted-foreground">
            Leave as-is to use current time
          </span>
        </div>
      )}
    </div>
  );
}

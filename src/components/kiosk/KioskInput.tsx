import * as React from "react";
import { cn } from "@/lib/utils";

interface KioskInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
}

const KioskInput = React.forwardRef<HTMLInputElement, KioskInputProps>(
  ({ className, label, required, id, value, ...props }, ref) => {
    const inputId = id || `kiosk-${label.toLowerCase().replace(/\s+/g, "-")}`;
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    return (
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          value={value}
          className={cn(
            "peer w-full h-14 px-4 pt-5 pb-2 text-lg rounded-xl border-2 border-border bg-card text-foreground placeholder-transparent transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20",
            className
          )}
          placeholder={label}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "absolute left-4 transition-all duration-200 pointer-events-none text-muted-foreground",
            hasValue || props.autoFocus
              ? "top-1.5 text-xs font-medium text-primary"
              : "top-1/2 -translate-y-1/2 text-base peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-primary"
          )}
        >
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      </div>
    );
  }
);

KioskInput.displayName = "KioskInput";

export { KioskInput };

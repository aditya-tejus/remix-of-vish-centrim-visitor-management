import * as React from "react";
import { cn } from "@/lib/utils";

interface KioskInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
}

const KioskInput = React.forwardRef<HTMLInputElement, KioskInputProps>(
  ({ className, label, required, id, value, ...props }, ref) => {
    const inputId = id || `kiosk-${label.toLowerCase().replace(/\s+/g, "-")}`;
    const [focused, setFocused] = React.useState(false);
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const isFloated = focused || hasValue;

    return (
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
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
            "absolute left-4 transition-all duration-200 pointer-events-none",
            isFloated
              ? "top-1.5 text-xs font-medium text-primary"
              : "top-1/2 -translate-y-1/2 text-base text-muted-foreground"
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

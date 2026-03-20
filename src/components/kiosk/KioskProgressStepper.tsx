import { Check } from "lucide-react";

interface Step {
  id: string;
  label: string;
}

interface KioskProgressStepperProps {
  steps: Step[];
  currentIndex: number;
  accentColor?: "primary" | "warning" | "success" | "info";
}

export function KioskProgressStepper({
  steps,
  currentIndex,
  accentColor = "primary",
}: KioskProgressStepperProps) {
  const dotActive = {
    primary: "bg-primary text-primary-foreground",
    warning: "bg-warning text-warning-foreground",
    success: "bg-success text-success-foreground",
    info: "bg-info text-info-foreground",
  };
  const dotActiveRing = {
    primary: "bg-primary text-primary-foreground ring-4 ring-primary/20",
    warning: "bg-warning text-warning-foreground ring-4 ring-warning/20",
    success: "bg-success text-success-foreground ring-4 ring-success/20",
    info: "bg-info text-info-foreground ring-4 ring-info/20",
  };
  const lineActive = {
    primary: "bg-primary",
    warning: "bg-warning",
    success: "bg-success",
    info: "bg-info",
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-center gap-1">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0
                ${i < currentIndex ? dotActive[accentColor] : ""}
                ${i === currentIndex ? dotActiveRing[accentColor] : ""}
                ${i > currentIndex ? "bg-muted text-muted-foreground" : ""}
              `}
            >
              {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-[2px] w-8 sm:w-12 mx-1 rounded-full transition-colors ${i < currentIndex ? lineActive[accentColor] : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Step {currentIndex + 1} of {steps.length} — <span className="font-medium text-foreground">{steps[currentIndex]?.label}</span>
      </p>
    </div>
  );
}

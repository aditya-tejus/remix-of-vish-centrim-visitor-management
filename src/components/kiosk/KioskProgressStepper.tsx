import { motion } from "framer-motion";

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
  const dotColor = {
    primary: "bg-primary",
    warning: "bg-warning",
    success: "bg-success",
    info: "bg-info",
  };
  const ringColor = {
    primary: "ring-primary/25",
    warning: "ring-warning/25",
    success: "ring-success/25",
    info: "ring-info/25",
  };
  const lineColor = {
    primary: "bg-primary",
    warning: "bg-warning",
    success: "bg-success",
    info: "bg-info",
  };

  return (
    <div className="flex items-center justify-center gap-0.5 py-1">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <motion.div
            layout
            className={`rounded-full transition-colors shrink-0
              ${i < currentIndex ? `${dotColor[accentColor]} h-2 w-2` : ""}
              ${i === currentIndex ? `${dotColor[accentColor]} h-3 w-3 ring-[3px] ${ringColor[accentColor]}` : ""}
              ${i > currentIndex ? "bg-border h-2 w-2" : ""}
            `}
          />
          {i < steps.length - 1 && (
            <div className={`h-[1.5px] w-6 sm:w-8 mx-1 rounded-full transition-colors ${i < currentIndex ? lineColor[accentColor] : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

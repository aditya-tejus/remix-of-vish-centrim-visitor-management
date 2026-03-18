import { ChevronRight } from "lucide-react";

interface KioskPersonCardProps {
  name: string;
  subtitle?: string;
  initials?: string;
  rightIcon?: React.ReactNode;
  accentColor?: "primary" | "warning" | "success" | "info";
  onClick?: () => void;
}

const accentBorderMap = {
  primary: "hover:border-l-primary",
  warning: "hover:border-l-warning",
  success: "hover:border-l-success",
  info: "hover:border-l-info",
};
const accentBgMap = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
};

export function KioskPersonCard({
  name,
  subtitle,
  initials,
  rightIcon,
  accentColor = "primary",
  onClick,
}: KioskPersonCardProps) {
  const fallbackInitials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 min-h-[72px] p-5 rounded-xl border-2 border-border border-l-4 border-l-transparent bg-card transition-all duration-150 text-left active:scale-[0.98] ${accentBorderMap[accentColor]}`}
    >
      <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${accentBgMap[accentColor]}`}>
        {initials || fallbackInitials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-semibold text-foreground truncate">{name}</p>
        {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {rightIcon || <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
    </button>
  );
}

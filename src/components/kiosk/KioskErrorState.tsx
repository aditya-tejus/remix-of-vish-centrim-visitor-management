import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface KioskErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function KioskErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: KioskErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-5 py-12 px-6" role="alert">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <p className="text-xl font-semibold text-foreground">Oops!</p>
        <p className="text-lg text-muted-foreground mt-1">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" className="h-14 px-6 text-base gap-2 border border-border">
          <RefreshCw className="h-5 w-5" /> Try Again
        </Button>
      )}
    </div>
  );
}

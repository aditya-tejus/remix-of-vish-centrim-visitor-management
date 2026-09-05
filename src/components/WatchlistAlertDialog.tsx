import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, X, UserSearch } from "lucide-react";
import { WatchlistEntry, WATCHLIST_REASON_CATEGORIES } from "@/hooks/useWatchlist";

interface WatchlistAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: WatchlistEntry;
  /** "near" = name matched but date of birth did not — staff must confirm identity first */
  matchType?: "confirmed" | "near";
  onProceed?: () => void;
  onDeny?: () => void;
}

export function WatchlistAlertDialog({ open, onOpenChange, entry, matchType = "confirmed", onProceed, onDeny }: WatchlistAlertDialogProps) {
  const isHard = entry.alert_type === "hard";
  const [identityConfirmed, setIdentityConfirmed] = useState(matchType === "confirmed");

  useEffect(() => {
    if (open) setIdentityConfirmed(matchType === "confirmed");
  }, [open, matchType]);

  const categoryLabel = WATCHLIST_REASON_CATEGORIES.find((c) => c.value === entry.reason_category)?.label;

  if (!identityConfirmed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserSearch className="h-5 w-5 text-warning" />
              <span className="text-warning">Possible watchlist match — confirm identity</span>
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border-2 border-warning bg-warning/5 p-4 space-y-2">
            <p className="text-sm text-foreground">
              The name <span className="font-semibold">{entry.first_name} {entry.surname}</span> matches a watchlist entry,
              but the date of birth was not confirmed.
            </p>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Recorded date of birth</p>
              <p className="text-sm text-foreground">{entry.date_of_birth || "Not recorded on the entry"}</p>
            </div>
            <p className="text-[12px] text-muted-foreground">
              Check identification before continuing. Only confirm if this is the same person.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { onProceed?.(); onOpenChange(false); }} className="text-[13px]">
              Different person — allow entry
            </Button>
            <Button onClick={() => setIdentityConfirmed(true)} className="text-[13px] bg-warning hover:bg-warning/90 text-warning-foreground">
              Confirm match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHard ? (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-warning" />
            )}
            <span className={isHard ? "text-destructive" : "text-warning"}>
              {isHard ? "Entry Denied — Watchlist Alert" : "Watchlist Alert — Review Required"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className={`rounded-lg border-2 p-4 ${isHard ? "border-destructive bg-destructive/5" : "border-warning bg-warning/5"}`}>
          <p className="text-sm font-semibold text-foreground mb-1">
            {entry.first_name} {entry.surname} is on the visitor watchlist
          </p>
          <div className="space-y-2 mt-3">
            {categoryLabel && (
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Category</p>
                <p className="text-sm text-foreground">{categoryLabel}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reason</p>
              <p className="text-sm text-foreground">{entry.reason}</p>
            </div>
            {entry.instructions && (
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Instructions</p>
                <p className="text-sm text-foreground">{entry.instructions}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Added By</p>
              <p className="text-sm text-muted-foreground">{entry.added_by}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isHard ? (
            <Button onClick={() => { onDeny?.(); onOpenChange(false); }} className="bg-destructive hover:bg-destructive/90 text-[13px]">
              <X className="h-4 w-4 mr-1.5" />
              Deny Entry
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { onDeny?.(); onOpenChange(false); }} className="text-[13px]">
                Deny Entry
              </Button>
              <Button onClick={() => { onProceed?.(); onOpenChange(false); }} className="text-[13px] bg-warning hover:bg-warning/90 text-warning-foreground">
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                Proceed with Caution
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, LogIn, Clock, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Visitor } from "@/types/visitor";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { TimeOverride } from "@/components/TimeOverride";

interface MarkReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  awayResidents: Visitor[];
  onReturn: (id: string, comment?: string, timeOverride?: string) => Promise<void>;
}

export function MarkReturnDialog({ open, onOpenChange, awayResidents, onReturn }: MarkReturnDialogProps) {
  const [search, setSearch] = useState("");
  const [returningId, setReturningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [timeOverride, setTimeOverride] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return awayResidents;
    const q = search.toLowerCase();
    return awayResidents.filter(r =>
      `${r.firstName} ${r.surname}`.toLowerCase().includes(q) ||
      (r.checkoutReason || "").toLowerCase().includes(q)
    );
  }, [awayResidents, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aOverdue = a.expectedReturnDate && isPast(a.expectedReturnDate) ? 0 : 1;
      const bOverdue = b.expectedReturnDate && isPast(b.expectedReturnDate) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      if (a.expectedReturnDate && b.expectedReturnDate) {
        return a.expectedReturnDate.getTime() - b.expectedReturnDate.getTime();
      }
      return 0;
    });
  }, [filtered]);

  const handleReturn = async (id: string) => {
    setLoading(true);
    setReturningId(id);
    try {
      await onReturn(id, comment.trim() || undefined, timeOverride || undefined);
      setComment("");
      setTimeOverride(null);
      setExpandedId(null);
    } finally {
      setLoading(false);
      setReturningId(null);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSearch("");
      setExpandedId(null);
      setComment("");
      setTimeOverride(null);
    }
    onOpenChange(o);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Mark Return
          </SheetTitle>
          <SheetDescription>
            {awayResidents.length} resident{awayResidents.length !== 1 ? "s" : ""} currently away
          </SheetDescription>
        </SheetHeader>

        {awayResidents.length > 5 && (
          <div className="px-6 pt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
          {sorted.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">
                {awayResidents.length === 0 ? "All residents are in the building" : "No matching residents"}
              </p>
            </div>
          ) : (
            sorted.map(resident => {
              const isOverdue = resident.expectedReturnDate && isPast(resident.expectedReturnDate);
              const isExpanded = expandedId === resident.id;

              return (
                <div
                  key={resident.id}
                  className={`rounded-lg border p-3 transition-all ${
                    isOverdue
                      ? "border-destructive/30 bg-destructive/[0.04]"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {resident.firstName[0]}{resident.surname[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">
                          {resident.firstName} {resident.surname}
                        </span>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[9px] shrink-0 gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {resident.checkoutReason && (
                          <span className="truncate">{resident.checkoutReason}</span>
                        )}
                        {resident.expectedReturnDate && (
                          <span className={`flex items-center gap-0.5 shrink-0 ${isOverdue ? "text-destructive font-medium" : ""}`}>
                            <Clock className="h-3 w-3" />
                            {isOverdue
                              ? `${formatDistanceToNow(resident.expectedReturnDate)} overdue`
                              : `Due ${format(resident.expectedReturnDate, "HH:mm")}`
                            }
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setExpandedId(isExpanded ? null : resident.id);
                          setComment("");
                          setTimeOverride(null);
                        }}
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        disabled={loading && returningId === resident.id}
                        onClick={() => handleReturn(resident.id)}
                      >
                        {loading && returningId === resident.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <LogIn className="h-3 w-3" />
                        )}
                        Return
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border space-y-2">
                      <Textarea
                        placeholder="Optional return notes..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        className="h-16 text-sm resize-none"
                      />
                      <TimeOverride
                        value={timeOverride}
                        onChange={setTimeOverride}
                        label="Adjust return time"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, Download, User, Loader2 } from "lucide-react";
import { Visitor } from "@/types/visitor";
import { exportVisitorsToCSV, exportVisitorToPDF } from "@/lib/exportVisitors";
import { format } from "date-fns";

interface SARDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitors: Visitor[];
  loading: boolean;
}

/** Deduplicate visitors by name+email to get unique people */
function getUniqueResidents(visitors: Visitor[]) {
  const map = new Map<string, { visitor: Visitor; visitCount: number }>();
  for (const v of visitors) {
    const key = `${v.firstName.toLowerCase()}-${v.surname.toLowerCase()}-${v.email.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.visitCount++;
      // Keep latest visit
      if (v.checkInTime > existing.visitor.checkInTime) {
        existing.visitor = v;
      }
    } else {
      map.set(key, { visitor: v, visitCount: 1 });
    }
  }
  return Array.from(map.values());
}

/** Get all visits for a specific person */
function getVisitsForPerson(visitors: Visitor[], person: Visitor) {
  return visitors.filter(
    (v) =>
      v.firstName.toLowerCase() === person.firstName.toLowerCase() &&
      v.surname.toLowerCase() === person.surname.toLowerCase() &&
      v.email.toLowerCase() === person.email.toLowerCase()
  );
}

export function SARDialog({ open, onOpenChange, visitors, loading }: SARDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Visitor | null>(null);

  const residents = useMemo(() => getUniqueResidents(visitors), [visitors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return residents;
    const q = search.toLowerCase();
    return residents.filter(
      ({ visitor: v }) =>
        v.firstName.toLowerCase().includes(q) ||
        v.surname.toLowerCase().includes(q) ||
        v.email.toLowerCase().includes(q) ||
        v.mobile.includes(q)
    );
  }, [residents, search]);

  const personVisits = useMemo(
    () => (selectedPerson ? getVisitsForPerson(visitors, selectedPerson) : []),
    [visitors, selectedPerson]
  );

  const handleExportCSV = () => {
    if (!selectedPerson || personVisits.length === 0) return;
    exportVisitorsToCSV(
      personVisits,
      `SAR-${selectedPerson.firstName}-${selectedPerson.surname}-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
  };

  const handleExportPDF = () => {
    if (!selectedPerson || personVisits.length === 0) return;
    // Export the most recent visit as the primary SAR PDF
    exportVisitorToPDF(personVisits[0]);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSearch("");
      setSelectedPerson(null);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Subject Access Request
          </DialogTitle>
          <DialogDescription>
            Search for a visitor and export all their records as CSV or PDF.
          </DialogDescription>
        </DialogHeader>

        {!selectedPerson ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No visitors found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map(({ visitor, visitCount }) => (
                    <button
                      key={visitor.id}
                      type="button"
                      onClick={() => setSelectedPerson(visitor)}
                      className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {visitor.firstName[0]}{visitor.surname[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {visitor.firstName} {visitor.surname}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{visitor.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {visitCount} visit{visitCount !== 1 ? "s" : ""}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {selectedPerson.firstName[0]}{selectedPerson.surname[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selectedPerson.firstName} {selectedPerson.surname}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedPerson.email} • {selectedPerson.mobile}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md bg-background p-2">
                  <p className="text-lg font-bold text-foreground">{personVisits.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total Visits</p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <p className="text-lg font-bold text-foreground">
                    {personVisits.filter((v) => v.status === "checked-in").length}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Active</p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <p className="text-lg font-bold text-foreground">
                    {format(personVisits[0]?.checkInTime || new Date(), "dd MMM")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Latest Visit</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleExportCSV} variant="outline" className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={handleExportPDF} className="flex-1 gap-2">
                <FileText className="h-4 w-4" />
                Export PDF
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setSelectedPerson(null)}
            >
              ← Select a different visitor
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

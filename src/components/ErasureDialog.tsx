import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, User, Loader2, AlertTriangle, Eraser, Clock } from "lucide-react";
import { Visitor } from "@/types/visitor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ErasureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitors: Visitor[];
  loading: boolean;
}

interface PersonEntry {
  visitor: Visitor;
  visitCount: number;
  allVisitIds: string[];
}

const ERASABLE_FIELDS = [
  { key: "email", label: "Email Address", dbCol: "email" },
  { key: "mobile", label: "Phone Number", dbCol: "mobile" },
  { key: "address", label: "Address", dbCol: "address" },
  { key: "comments", label: "Comments", dbCol: "comments" },
  { key: "body_temperature", label: "Body Temperature", dbCol: "body_temperature" },
  { key: "health_answers", label: "Health Answers", dbCol: "health_answers" },
  { key: "whom_to_visit", label: "Whom to Visit", dbCol: "whom_to_visit" },
] as const;

function getUniqueResidents(visitors: Visitor[]): PersonEntry[] {
  const map = new Map<string, PersonEntry>();
  for (const v of visitors) {
    const key = `${v.firstName.toLowerCase()}-${v.surname.toLowerCase()}-${v.email.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.visitCount++;
      existing.allVisitIds.push(v.id);
      if (v.checkInTime > existing.visitor.checkInTime) {
        existing.visitor = v;
      }
    } else {
      map.set(key, { visitor: v, visitCount: 1, allVisitIds: [v.id] });
    }
  }
  return Array.from(map.values());
}

export function ErasureDialog({ open, onOpenChange, visitors, loading }: ErasureDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<PersonEntry | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([]);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteVisits, setConfirmDeleteVisits] = useState(false);
  const [confirmPartial, setConfirmPartial] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

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

  const personVisits = useMemo(() => {
    if (!selectedPerson) return [];
    return visitors
      .filter((v) => selectedPerson.allVisitIds.includes(v.id))
      .sort((a, b) => b.checkInTime.getTime() - a.checkInTime.getTime());
  }, [visitors, selectedPerson]);

  const handleDeleteAll = async () => {
    if (!selectedPerson) return;
    setDeleting(true);
    const { error } = await supabase
      .from("visitors")
      .delete()
      .in("id", selectedPerson.allVisitIds);

    setDeleting(false);
    setConfirmDeleteAll(false);

    if (error) {
      toast({ title: "Error", description: "Failed to delete records. You may need admin permissions.", variant: "destructive" });
    } else {
      await supabase.from("audit_log").insert({
        action: "right_to_erasure_full_delete",
        performed_by: "admin",
        details: {
          visitor_name: `${selectedPerson.visitor.firstName} ${selectedPerson.visitor.surname}`,
          records_deleted: selectedPerson.allVisitIds.length,
        },
        records_affected: selectedPerson.allVisitIds.length,
      });
      toast({
        title: "Records Deleted",
        description: `All ${selectedPerson.allVisitIds.length} record(s) for ${selectedPerson.visitor.firstName} ${selectedPerson.visitor.surname} have been permanently deleted.`,
      });
      handleClose(false);
    }
  };

  const handlePartialErase = async () => {
    if (!selectedPerson || selectedFields.length === 0) return;
    setDeleting(true);

    const updates: Record<string, unknown> = {};
    for (const field of selectedFields) {
      const def = ERASABLE_FIELDS.find((f) => f.key === field);
      if (!def) continue;
      if (def.dbCol === "body_temperature") {
        updates[def.dbCol] = null;
      } else if (def.dbCol === "health_answers") {
        updates[def.dbCol] = {};
      } else {
        updates[def.dbCol] = "";
      }
    }

    const { error } = await supabase
      .from("visitors")
      .update(updates)
      .in("id", selectedPerson.allVisitIds);

    setDeleting(false);
    setConfirmPartial(false);

    if (error) {
      toast({ title: "Error", description: "Failed to erase data. You may need admin permissions.", variant: "destructive" });
    } else {
      await supabase.from("audit_log").insert({
        action: "right_to_erasure_partial",
        performed_by: "admin",
        details: {
          visitor_name: `${selectedPerson.visitor.firstName} ${selectedPerson.visitor.surname}`,
          fields_erased: selectedFields,
          records_affected: selectedPerson.allVisitIds.length,
        },
        records_affected: selectedPerson.allVisitIds.length,
      });
      toast({
        title: "Data Erased",
        description: `${selectedFields.length} field(s) cleared across ${selectedPerson.allVisitIds.length} record(s).`,
      });
      handleClose(false);
    }
  };

  const handleDeleteVisits = async () => {
    if (!selectedPerson || selectedVisitIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase
      .from("visitors")
      .delete()
      .in("id", selectedVisitIds);

    setDeleting(false);
    setConfirmDeleteVisits(false);

    if (error) {
      toast({ title: "Error", description: "Failed to delete visit records. You may need admin permissions.", variant: "destructive" });
    } else {
      await supabase.from("audit_log").insert({
        action: "right_to_erasure_visit_delete",
        performed_by: "admin",
        details: {
          visitor_name: `${selectedPerson.visitor.firstName} ${selectedPerson.visitor.surname}`,
          visits_deleted: selectedVisitIds.length,
        },
        records_affected: selectedVisitIds.length,
      });
      toast({
        title: "Visits Deleted",
        description: `${selectedVisitIds.length} visit record(s) permanently deleted.`,
      });
      handleClose(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSearch("");
      setSelectedPerson(null);
      setSelectedFields([]);
      setSelectedVisitIds([]);
    }
    onOpenChange(val);
  };

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Right to Erasure
            </DialogTitle>
            <DialogDescription>
              Search for a visitor to delete all records or erase specific personal data (Art. 17).
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
                    {filtered.map(({ visitor, visitCount, allVisitIds }) => (
                      <button
                        key={visitor.id}
                        type="button"
                        onClick={() => setSelectedPerson({ visitor, visitCount, allVisitIds })}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-destructive">
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
                          {visitCount} record{visitCount !== 1 ? "s" : ""}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Person summary */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-destructive">
                      {selectedPerson.visitor.firstName[0]}{selectedPerson.visitor.surname[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPerson.visitor.firstName} {selectedPerson.visitor.surname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPerson.visitor.email} • {selectedPerson.allVisitIds.length} record(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Delete all */}
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold text-foreground">Delete Entire Profile</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Permanently delete all {selectedPerson.allVisitIds.length} visit record(s) for this person. This cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setConfirmDeleteAll(true)}
                >
                  Delete All Records
                </Button>
              </div>

              {/* Delete specific visits */}
              {personVisits.length > 1 && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Delete Specific Visits</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select individual visit records to remove while keeping the rest.
                  </p>
                  <ScrollArea className="max-h-[160px]">
                    <div className="space-y-1.5">
                      {personVisits.map((v) => (
                        <label
                          key={v.id}
                          className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedVisitIds.includes(v.id)}
                            onCheckedChange={() =>
                              setSelectedVisitIds((prev) =>
                                prev.includes(v.id) ? prev.filter((id) => id !== v.id) : [...prev, v.id]
                              )
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              {format(v.checkInTime, "dd MMM yyyy, HH:mm")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {v.whomToVisit ? `Visiting ${v.whomToVisit}` : v.type} •{" "}
                              {v.status === "checked-in" ? "Active" : "Checked out"}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={selectedVisitIds.length === 0}
                    onClick={() => setConfirmDeleteVisits(true)}
                  >
                    Delete {selectedVisitIds.length} Visit{selectedVisitIds.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}

              {/* Partial erase */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Eraser className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Erase Specific Data</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clear specific fields across all records while keeping the visit history intact.
                </p>
                <div className="space-y-2">
                  {ERASABLE_FIELDS.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedFields.includes(field.key)}
                        onCheckedChange={() => toggleField(field.key)}
                      />
                      <span className="text-sm text-foreground">{field.label}</span>
                    </label>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={selectedFields.length === 0}
                  onClick={() => setConfirmPartial(true)}
                >
                  Erase {selectedFields.length} Selected Field{selectedFields.length !== 1 ? "s" : ""}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  setSelectedPerson(null);
                  setSelectedFields([]);
                }}
              >
                ← Select a different visitor
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm full delete */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Permanent Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {selectedPerson?.allVisitIds.length} record(s) for{" "}
              <span className="font-semibold text-foreground">
                {selectedPerson?.visitor.firstName} {selectedPerson?.visitor.surname}
              </span>
              . This action cannot be undone and will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm visit deletion */}
      <AlertDialog open={confirmDeleteVisits} onOpenChange={setConfirmDeleteVisits}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visit Records</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedVisitIds.length} visit record(s) for{" "}
              <span className="font-semibold text-foreground">
                {selectedPerson?.visitor.firstName} {selectedPerson?.visitor.surname}
              </span>
              . This action cannot be undone and will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVisits}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Visits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    
      {/* Confirm partial erase */}
      <AlertDialog open={confirmPartial} onOpenChange={setConfirmPartial}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Data Erasure</AlertDialogTitle>
            <AlertDialogDescription>
              This will erase {selectedFields.length} field(s) across{" "}
              {selectedPerson?.allVisitIds.length} record(s) for{" "}
              <span className="font-semibold text-foreground">
                {selectedPerson?.visitor.firstName} {selectedPerson?.visitor.surname}
              </span>
              . This action will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePartialErase} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Erase Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

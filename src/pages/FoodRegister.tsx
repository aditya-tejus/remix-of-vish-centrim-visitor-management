import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useResidents } from "@/hooks/useResidents";
import { useFoodRegister } from "@/hooks/useFoodRegister";
import { AddFoodDialog } from "@/components/food/AddFoodDialog";
import { exportCsvAudited } from "@/lib/exportAudit";
import { ErrorState } from "@/components/states";
import { useSite } from "@/contexts/SiteContext";

import { FoodRecord, foodTypeLabel } from "@/lib/foodRegister";
import { format } from "date-fns";
import { Download, Plus, Search, UtensilsCrossed, X } from "lucide-react";

export default function FoodRegisterPage() {
  const { residents } = useResidents();
  const { currentSite, currentSiteId } = useSite();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [residentVisitorId, setResidentVisitorId] = useState("all");
  const [visitorName, setVisitorName] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<FoodRecord | null>(null);

  const filters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      residentVisitorId: residentVisitorId === "all" ? undefined : residentVisitorId,
      visitorName: visitorName || undefined,
      search: search || undefined,
    }),
    [from, to, residentVisitorId, visitorName, search]
  );

  const { records, loading, error, refetch } = useFoodRegister(filters);

  const hasFilters = !!(from || to || residentVisitorId !== "all" || visitorName || search);
  const clearFilters = () => {
    setFrom(""); setTo(""); setResidentVisitorId("all"); setVisitorName(""); setSearch("");
  };

  // Export respects whichever filters are currently applied (exports exactly what's listed).
  const exportCsv = async () => {
    await exportCsvAudited(
      ["Date & Time", "Resident", "Food", "Food Type", "Brought By", "Shared With", "Notes", "Source"],
      records.map((r) => [
        format(r.recordedAt, "hh:mm a dd MMM yyyy"),
        r.residentName,
        r.foodDescription,
        foodTypeLabel(r.foodType),
        r.broughtByName,
        r.sharedWithOthers ? (r.sharedResidentNames.join("; ") || "Yes") : "No",
        r.notes || "",
        r.source === "manual" ? "Added by staff" : "Check-in",
      ]),
      {
        filenamePrefix: "food-register",
        auditAction: "food_register_export",
        siteId: currentSiteId,
        siteName: currentSite?.name ?? null,
        scopeNote: hasFilters ? "Filtered view" : "All records in view",
      }
    );
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <AppHeader
            title="Food Register"
            subtitle="A record of food brought into the home for residents."
            actions={
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={records.length === 0}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Food
                </Button>
              </>
            }
          />

          <main className="p-6 space-y-4">
            <Card className="rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[12px]">From</Label>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-[13px] rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">To</Label>
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-[13px] rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Resident</Label>
                    <Select value={residentVisitorId} onValueChange={setResidentVisitorId}>
                      <SelectTrigger className="h-9 text-[13px] rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All residents</SelectItem>
                        {residents.map((r) => (
                          <SelectItem key={r.visitorId} value={r.visitorId}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Brought by</Label>
                    <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Visitor name" className="h-9 text-[13px] rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px]">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Food or notes" className="h-9 text-[13px] rounded-lg pl-8" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-muted-foreground">
                    {loading ? "Loading..." : `${records.length} record${records.length === 1 ? "" : "s"} match${records.length === 1 ? "es" : ""} your filters`}
                  </p>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="gap-1 text-[12px]" onClick={clearFilters}>
                      <X className="h-3 w-3" /> Clear filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>



            {error && <ErrorState description={error} onRetry={refetch} />}

            <Card className="rounded-xl">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[12px]">Date &amp; Time</TableHead>
                      <TableHead className="text-[12px]">Resident</TableHead>
                      <TableHead className="text-[12px]">Food</TableHead>
                      <TableHead className="text-[12px]">Brought By</TableHead>
                      <TableHead className="text-[12px]">Shared With</TableHead>
                      <TableHead className="text-[12px]">Notes</TableHead>
                      <TableHead className="text-[12px] w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.length === 0 && !loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-[13px] text-muted-foreground">
                          <UtensilsCrossed className="h-6 w-6 mx-auto mb-2 opacity-40" />
                          No food records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-[13px] whitespace-nowrap">{format(r.recordedAt, "hh:mm a dd MMM yyyy")}</TableCell>
                          <TableCell className="text-[13px] font-medium">{r.residentName}</TableCell>
                          <TableCell className="text-[13px]">
                            {r.foodDescription}
                            <Badge variant="outline" className="ml-2 text-[10px]">{foodTypeLabel(r.foodType)}</Badge>
                          </TableCell>
                          <TableCell className="text-[13px]">{r.broughtByName}</TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">
                            {r.sharedWithOthers ? (r.sharedResidentNames.join(", ") || "Yes") : "—"}
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground max-w-[220px] truncate">{r.notes || "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-[12px]" onClick={() => setSelected(r)}>Open</Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </div>

      <AddFoodDialog open={addOpen} onOpenChange={setAddOpen} onSaved={refetch} />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-primary" /> Food Record
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {selected ? format(selected.recordedAt, "hh:mm a dd MMM yyyy") : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-[13px]">
              {[
                ["Resident", selected.residentName],
                ["Food", selected.foodDescription],
                ["Food type", foodTypeLabel(selected.foodType)],
                ["Brought by", selected.broughtByName],
                ["Shared with others", selected.sharedWithOthers ? (selected.sharedResidentNames.join(", ") || "Yes") : "No"],
                ["Notes", selected.notes || "—"],
                ["Recorded via", selected.source === "manual" ? `Added by ${selected.createdBy || "staff"}` : "Visitor check-in"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

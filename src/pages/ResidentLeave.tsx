import { useState, useMemo } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useVisitors } from "@/hooks/useVisitors";
import { useResidents } from "@/hooks/useResidents";
import { ResidentLeaveDialog } from "@/components/ResidentLeaveDialog";
import { format, isPast, differenceInHours } from "date-fns";
import {
  DoorOpen, Search, ArrowLeftRight, AlertTriangle, Clock,
  MapPin, Phone, CheckCircle2, Calendar, Users, Home, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Visitor } from "@/types/visitor";

const DESTINATION_CATEGORIES = [
  { value: "home_visit", label: "Home Visit", emoji: "🏠" },
  { value: "medical", label: "Medical Appointment", emoji: "🏥" },
  { value: "day_trip", label: "Day Trip", emoji: "🚗" },
  { value: "hospital", label: "Hospital Transfer", emoji: "🏨" },
  { value: "other", label: "Other", emoji: "📋" },
];

export default function ResidentLeave() {
  const { visitors, addVisitor, checkOutVisitor, checkInReturn } = useVisitors();
  const { residents, loading } = useResidents();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [markAwayOpen, setMarkAwayOpen] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");

  const awayResidents = useMemo(
    () => visitors.filter((v) => v.type === "resident" && v.status === "checked-out"),
    [visitors]
  );

  const overdueResidents = useMemo(
    () => awayResidents.filter((v) => v.expectedReturnDate && isPast(v.expectedReturnDate)),
    [awayResidents]
  );

  const filteredAway = useMemo(() => {
    if (!search.trim()) return awayResidents;
    const q = search.toLowerCase();
    return awayResidents.filter((v) =>
      `${v.firstName} ${v.surname}`.toLowerCase().includes(q)
    );
  }, [awayResidents, search]);

  const handleReturn = async (id: string) => {
    await checkInReturn(id, returnComment || undefined);
    toast({ title: "Resident Returned", description: "Resident has been marked as returned." });
    setReturningId(null);
    setReturnComment("");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 bg-card border-b border-border">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight flex items-center gap-2">
                    <DoorOpen className="h-5 w-5 text-info" /> Resident Leave
                  </h1>
                  <p className="text-[13px] text-muted-foreground">Manage resident departures & returns</p>
                </div>
              </div>
              <Button onClick={() => setMarkAwayOpen(true)} className="gap-1.5">
                <DoorOpen className="h-4 w-4" /> Mark Away
              </Button>
            </div>
          </header>

          <main className="p-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{awayResidents.length}</p>
                <p className="text-xs text-muted-foreground">Currently Away</p>
              </div>
              <div className={`rounded-xl border p-4 text-center ${overdueResidents.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}>
                <p className={`text-2xl font-bold ${overdueResidents.length > 0 ? "text-destructive" : "text-foreground"}`}>{overdueResidents.length}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{residents.length}</p>
                <p className="text-xs text-muted-foreground">Total Residents</p>
              </div>
            </div>

            <Tabs defaultValue="away">
              <TabsList className="bg-muted rounded-lg p-1 h-auto">
                <TabsTrigger value="away" className="rounded-md h-8 px-4 text-[13px] gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Away Now
                  {awayResidents.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{awayResidents.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="returned" className="rounded-md h-8 px-4 text-[13px] gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Returned
                </TabsTrigger>
              </TabsList>

              <TabsContent value="away" className="mt-4 space-y-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search residents..." className="pl-10 h-9" />
                </div>

                {loading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : filteredAway.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-border rounded-xl">
                    <DoorOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No residents currently away</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setMarkAwayOpen(true)}>Mark Away</Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[11px] uppercase tracking-wider">Resident</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Left</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Expected Return</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Leave Type</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAway.map((v) => {
                          const isOverdue = v.expectedReturnDate && isPast(v.expectedReturnDate);
                          return (
                            <TableRow key={v.id} className={isOverdue ? "bg-destructive/5" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary/10 text-primary text-[11px]">{v.firstName[0]}{v.surname[0]}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm font-semibold">{v.firstName} {v.surname}</p>
                                    {v.address && <p className="text-[11px] text-muted-foreground">{v.address}</p>}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{format(v.checkInTime, "dd MMM HH:mm")}</TableCell>
                              <TableCell className="text-sm">
                                {v.expectedReturnDate ? format(v.expectedReturnDate, "dd MMM HH:mm") : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">{v.leaveType || "General"}</Badge>
                              </TableCell>
                              <TableCell>
                                {isOverdue ? (
                                  <Badge variant="destructive" className="text-[10px] gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Overdue
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">Away</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleReturn(v.id)}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Return
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="returned" className="mt-4">
                <div className="text-center py-16 border border-dashed border-border rounded-xl">
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Select a resident from the "Away Now" tab to mark as returned</p>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>
      <ResidentLeaveDialog open={markAwayOpen} onOpenChange={setMarkAwayOpen} onSubmit={() => {}} />
    </SidebarProvider>
  );
}

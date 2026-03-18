import { useVisitors } from "@/hooks/useVisitors";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Phone, Mail, MapPin, LogIn, ShieldAlert, Plus, AlertTriangle, Users, User, Truck, Home } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWatchlist } from "@/hooks/useWatchlist";
import { AddWatchlistDialog } from "@/components/AddWatchlistDialog";
import { VisitorProfile } from "@/components/VisitorProfile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Visitor } from "@/types/visitor";

export default function Visitors() {
  const { visitors, addVisitor } = useVisitors();
  const [search, setSearch] = useState("");
  const [addWatchlistOpen, setAddWatchlistOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toast } = useToast();
  const { data: watchlist = [], addEntry, removeEntry } = useWatchlist();

  const handleVisitorClick = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setProfileOpen(true);
  };

  const handleQuickCheckIn = (e: React.MouseEvent, v: typeof visitors[0]) => {
    e.stopPropagation();
    addVisitor({
      firstName: v.firstName,
      surname: v.surname,
      email: v.email,
      mobile: v.mobile,
      type: v.type,
      checkInTime: new Date(),
      checkOutTime: null,
      whomToVisit: v.whomToVisit || "",
      address: v.address || "",
      status: "checked-in",
      healthDeclaration: false,
      additionalVisitors: 0,
      comments: "",
      retentionExpiry: new Date(Date.now() + 86400000 * 60),
      acknowledgedPrivacy: false,
    });
    toast({ title: "Checked In", description: `${v.firstName} ${v.surname} has been checked in.` });
  };

  const uniqueVisitors = useMemo(() => {
    const seen = new Map<string, typeof visitors[0]>();
    visitors.forEach((v) => {
      const key = v.email || v.mobile;
      if (!seen.has(key)) seen.set(key, v);
    });
    return Array.from(seen.values());
  }, [visitors]);

  const byType = useMemo(() => ({
    visitor: uniqueVisitors.filter(v => v.type === "visitor"),
    staff: uniqueVisitors.filter(v => v.type === "staff"),
    contractor: uniqueVisitors.filter(v => v.type === "contractor"),
    resident: uniqueVisitors.filter(v => v.type === "resident"),
  }), [uniqueVisitors]);

  const filterList = (list: typeof visitors) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(v =>
      v.firstName.toLowerCase().includes(q) ||
      v.surname.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      v.mobile.includes(q)
    );
  };

  const VisitorCard = ({ visitor }: { visitor: typeof visitors[0] }) => (
    <Card className="cursor-pointer hover:shadow-card-hover hover:border-primary/30 transition-all duration-150 hover:-translate-y-0.5" onClick={() => handleVisitorClick(visitor)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{visitor.firstName[0]}{visitor.surname[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{visitor.firstName} {visitor.surname}</p>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{visitor.type}</Badge>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Phone className="h-3 w-3 shrink-0" /><span>{visitor.mobile || "—"}</span></div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{visitor.email}</span></div>
        </div>
        {visitor.type !== "resident" && (
          <div className="pt-2 mt-2 border-t border-border">
            <Button size="sm" className="w-full h-7 text-xs gap-1.5" onClick={(e) => handleQuickCheckIn(e, visitor)}>
              <LogIn className="h-3.5 w-3.5" />Quick Check-In
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const EmptyState = ({ type }: { type: string }) => (
    <div className="col-span-full text-center py-16">
      <p className="text-sm text-muted-foreground">No {type} found</p>
    </div>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">Visitor Profiles</h1>
                  <p className="text-[13px] text-muted-foreground">All contacts by type & watchlist</p>
                </div>
              </div>
            </div>
          </header>

          <main className="p-6 space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." className="pl-10 h-9 text-[13px]" />
            </div>

            <Tabs defaultValue="visitors">
              <TabsList className="inline-flex items-center bg-muted rounded-lg p-1 gap-0.5 h-auto">
                <TabsTrigger value="visitors" className="rounded-md h-8 px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5">
                  <User className="h-3.5 w-3.5" />Visitors
                  <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold">{byType.visitor.length}</span>
                </TabsTrigger>
                <TabsTrigger value="staff" className="rounded-md h-8 px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5">
                  <Users className="h-3.5 w-3.5" />Staff
                  <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold">{byType.staff.length}</span>
                </TabsTrigger>
                <TabsTrigger value="contractors" className="rounded-md h-8 px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5">
                  <Truck className="h-3.5 w-3.5" />Contractors
                  <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold">{byType.contractor.length}</span>
                </TabsTrigger>
                <TabsTrigger value="residents" className="rounded-md h-8 px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5">
                  <Home className="h-3.5 w-3.5" />Residents
                  <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold">{byType.resident.length}</span>
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="rounded-md h-8 px-4 text-[13px] font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />Watchlist
                  {watchlist.length > 0 && (
                    <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-destructive/10 text-destructive">{watchlist.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Visitors Tab */}
              <TabsContent value="visitors" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterList(byType.visitor).map(v => <VisitorCard key={v.id} visitor={v} />)}
                  {filterList(byType.visitor).length === 0 && <EmptyState type="visitors" />}
                </div>
              </TabsContent>

              {/* Staff Tab */}
              <TabsContent value="staff" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterList(byType.staff).map(v => <VisitorCard key={v.id} visitor={v} />)}
                  {filterList(byType.staff).length === 0 && <EmptyState type="staff" />}
                </div>
              </TabsContent>

              {/* Contractors Tab */}
              <TabsContent value="contractors" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterList(byType.contractor).map(v => <VisitorCard key={v.id} visitor={v} />)}
                  {filterList(byType.contractor).length === 0 && <EmptyState type="contractors" />}
                </div>
              </TabsContent>

              {/* Residents Tab */}
              <TabsContent value="residents" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterList(byType.resident).map(v => <VisitorCard key={v.id} visitor={v} />)}
                  {filterList(byType.resident).length === 0 && <EmptyState type="residents" />}
                </div>
              </TabsContent>

              {/* Watchlist Tab */}
              <TabsContent value="watchlist" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-muted-foreground">Manage restricted visitors. Alerts are shown during check-in.</p>
                  <Button size="sm" className="h-[34px] text-[13px] gap-1.5 bg-destructive hover:bg-destructive/90" onClick={() => setAddWatchlistOpen(true)}>
                    <Plus className="h-4 w-4" />Add to Watchlist
                  </Button>
                </div>

                <div className="rounded-[10px] border border-border bg-card overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/50">
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Name</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reason</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Alert Type</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Added By</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Date Added</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {watchlist.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16">
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground">No watchlist entries</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        watchlist.map((entry) => (
                          <TableRow key={entry.id} className="group">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-destructive/10 text-destructive text-[11px] font-semibold">
                                    {entry.first_name[0]}{entry.surname[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">{entry.first_name} {entry.surname}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-foreground max-w-[200px] truncate">{entry.reason}</TableCell>
                            <TableCell>
                              <Badge variant={entry.alert_type === "hard" ? "destructive" : "outline"} className="text-[10px] gap-1">
                                {entry.alert_type === "hard" ? (
                                  <><ShieldAlert className="h-3 w-3" />Hard Block</>
                                ) : (
                                  <><AlertTriangle className="h-3 w-3" />Soft Alert</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{entry.added_by}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(entry.created_at), "dd MMM yyyy")}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeEntry.mutate(entry.id)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>

      {/* Visitor Profile Slide-over */}
      <VisitorProfile
        visitor={selectedVisitor}
        allVisitors={visitors}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />

      <AddWatchlistDialog
        open={addWatchlistOpen}
        onOpenChange={setAddWatchlistOpen}
        onAdd={(entry) => addEntry.mutate(entry)}
      />
    </SidebarProvider>
  );
}

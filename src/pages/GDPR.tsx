import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileText, Trash2, Download, Clock } from "lucide-react";
import { DataRetentionTab } from "@/components/settings/DataRetentionTab";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useVisitors } from "@/hooks/useVisitors";
import { SARDialog } from "@/components/SARDialog";
import { ErasureDialog } from "@/components/ErasureDialog";
import { exportVisitorsToCSV } from "@/lib/exportVisitors";
import { useJurisdiction } from "@/hooks/useJurisdiction";

export default function GDPRPage() {
  const navigate = useNavigate();
  const { visitors, loading } = useVisitors();
  const [sarOpen, setSarOpen] = useState(false);
  const [erasureOpen, setErasureOpen] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const { toast } = useToast();
  const { isUK, regimeName, regimeShort, subjectAccessTerm, accessDeadline, erasureRef, portabilityRef } = useJurisdiction();

  const handleConfirmExport = () => {
    exportVisitorsToCSV(visitors);
    toast({ title: "Export Complete", description: `${visitors.length} visitor records exported as CSV.` });
    setExportConfirmOpen(false);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-4 px-6 py-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-semibold text-foreground">{isUK ? "GDPR & Privacy" : "Privacy & Compliance"}</h1>
                <p className="text-xs text-muted-foreground">Data protection compliance tools</p>
              </div>
            </div>
          </header>
          <main className="p-6">
            <Tabs defaultValue="tools" className="space-y-6">
              <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
                <TabsTrigger value="tools" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <Shield className="h-3.5 w-3.5" />
                  Privacy Tools
                </TabsTrigger>
                <TabsTrigger value="sar" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <FileText className="h-3.5 w-3.5" />
                  Subject Access
                </TabsTrigger>
                <TabsTrigger value="erasure" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <Trash2 className="h-3.5 w-3.5" />
                  Right to Erasure
                </TabsTrigger>
                <TabsTrigger value="retention" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <Clock className="h-3.5 w-3.5" />
                  Data Retention
                </TabsTrigger>
                <TabsTrigger value="portability" className="gap-1.5 rounded-lg text-xs data-[state=active]:shadow-sm">
                  <Download className="h-3.5 w-3.5" />
                  Data Portability
                </TabsTrigger>
              </TabsList>

              {/* Privacy Tools Overview */}
              <TabsContent value="tools">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { icon: FileText, label: "Subject Access Requests", desc: "Export visitor data on request", action: "Process SAR", tab: "sar" },
                      { icon: Trash2, label: "Right to Erasure", desc: "Delete visitor records", action: "Manage", tab: "erasure" },
                      { icon: Clock, label: "Data Retention", desc: "Auto-delete after retention period", action: "Configure", tab: "retention" as const },
                      { icon: Download, label: "Data Portability", desc: "Export data in machine-readable format", action: "Export All", tab: "portability" },
                    ].map(({ icon: Icon, label, desc, action, tab }) => (
                      <Card key={label}>
                        <CardContent className="p-4 space-y-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              const tabEl = document.querySelector(`[data-state][value="${tab}"]`) as HTMLElement;
                              tabEl?.click();
                            }}
                          >
                            {action}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-foreground">{regimeName} Compliance Status</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isUK
                          ? "This system processes visitor data in accordance with UK GDPR. Privacy notices are displayed at check-in, consent is recorded, and data retention policies are enforced."
                          : "This system handles personal information in accordance with the Australian Privacy Act 1988 and the Australian Privacy Principles. Collection notices are shown at check-in, consent is recorded, and retention limits are enforced (APP 1, 3, 5 and 11)."}
                        {" "}Visit the Settings page to configure retention periods and compliance requirements.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Subject Access Requests Tab */}
              <TabsContent value="sar">
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-foreground">{subjectAccessTerm}</h2>
                          <p className="text-xs text-muted-foreground">{`Search and export visitor data to fulfil access requests within the ${accessDeadline}.`}</p>
                        </div>
                      </div>
                      <Button className="gap-1.5" onClick={() => setSarOpen(true)}>
                        <FileText className="h-4 w-4" />
                        {isUK ? "Process New SAR" : "Process New Access Request"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Right to Erasure Tab */}
              <TabsContent value="erasure">
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-foreground">{isUK ? "Right to Erasure" : "Destruction & De-identification"}</h2>
                          <p className="text-xs text-muted-foreground">{`Delete individual visitor records, anonymise personal information, or remove specific visit entries (${erasureRef}).`}</p>
                        </div>
                      </div>
                      <Button variant="destructive" className="gap-1.5" onClick={() => setErasureOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                        Open Erasure Toolkit
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Data Retention Tab */}
              <TabsContent value="retention">
                <DataRetentionTab />
              </TabsContent>

              {/* Data Portability Tab */}
              <TabsContent value="portability">
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Download className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-foreground">Data Portability</h2>
                          <p className="text-xs text-muted-foreground">{`Export all visitor data in machine-readable CSV format (${portabilityRef}). Handle exported files in accordance with the ${regimeShort}.`}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/50 border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{visitors.length}</span> visitor record{visitors.length !== 1 ? "s" : ""} available for export.
                        </p>
                      </div>
                      <Button
                        className="gap-1.5"
                        onClick={() => {
                          if (visitors.length === 0) {
                            toast({ title: "No Data", description: "There are no visitor records to export.", variant: "destructive" });
                            return;
                          }
                          setExportConfirmOpen(true);
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Export All Records (CSV)
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </SidebarInset>
      </div>

      <SARDialog open={sarOpen} onOpenChange={setSarOpen} visitors={visitors} loading={loading} />
      <ErasureDialog open={erasureOpen} onOpenChange={setErasureOpen} visitors={visitors} loading={loading} />

      <AlertDialog open={exportConfirmOpen} onOpenChange={setExportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export All Visitor Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to export <span className="font-semibold text-foreground">{visitors.length}</span> visitor record(s) as a CSV file. This file will contain personal information — handle it in accordance with the {regimeShort}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExport}>
              Export CSV
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

import { useState } from "react";
import { useLeaveRequests, useLeaveRequestMutations } from "@/hooks/useLeaveRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, ExternalLink, User, CalendarDays, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function LeaveRequestsReview() {
  const { data: allRequests = [], isLoading } = useLeaveRequests();
  const { approve, reject } = useLeaveRequestMutations();
  const { toast } = useToast();
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [tab, setTab] = useState("pending");

  const pending = allRequests.filter((r) => r.status === "pending");
  const approved = allRequests.filter((r) => r.status === "approved");
  const rejected = allRequests.filter((r) => r.status === "rejected");

  const handleApprove = async (id: string) => {
    await approve.mutateAsync({ id, reviewed_by: "Staff", review_notes: reviewNotes || undefined });
    toast({ title: "Checkout request approved" });
    setReviewItem(null);
    setReviewNotes("");
  };

  const handleReject = async (id: string) => {
    await reject.mutateAsync({ id, reviewed_by: "Staff", review_notes: reviewNotes || undefined });
    toast({ title: "Checkout request rejected" });
    setReviewItem(null);
    setReviewNotes("");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
      case "approved": return <Badge className="text-[10px] gap-1 bg-success/15 text-success border-success/30"><CheckCircle className="h-2.5 w-2.5" /> Approved</Badge>;
      case "rejected": return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>;
      default: return null;
    }
  };

  const renderRequestCard = (req: any) => (
    <div
      key={req.id}
      className="rounded-xl border border-border p-4 hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={() => { setReviewItem(req); setReviewNotes(""); }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{req.resident_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {[req.resident_room, req.resident_wing].filter(Boolean).join(" • ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {req.source === "external" && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <ExternalLink className="h-2.5 w-2.5" /> External
            </Badge>
          )}
          {statusBadge(req.status)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {req.leave_type && (
          <div className="rounded-lg bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground">Reason</p>
            <p className="text-xs font-medium text-foreground">{req.leave_type}</p>
          </div>
        )}
        {req.reason && (
          <div className="rounded-lg bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground">Reason</p>
            <p className="text-xs font-medium text-foreground truncate">{req.reason}</p>
          </div>
        )}
        {req.expected_return && (
          <div className="rounded-lg bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground">Return</p>
            <p className="text-xs font-medium text-foreground">{format(new Date(req.expected_return), "dd MMM HH:mm")}</p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2">
        {format(new Date(req.created_at), "dd MMM yyyy HH:mm")}
      </p>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Checkout Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="text-xs gap-1.5">
                <Clock className="h-3 w-3" /> Pending
                {pending.length > 0 && (
                  <Badge variant="destructive" className="h-4 w-4 p-0 text-[9px] flex items-center justify-center rounded-full ml-1">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs gap-1.5">
                <CheckCircle className="h-3 w-3" /> Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs gap-1.5">
                <XCircle className="h-3 w-3" /> Rejected
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : pending.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-2">{pending.map(renderRequestCard)}</div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              {approved.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No approved requests</p>
              ) : (
                <div className="space-y-2">{approved.map(renderRequestCard)}</div>
              )}
            </TabsContent>

            <TabsContent value="rejected">
              {rejected.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No rejected requests</p>
              ) : (
                <div className="space-y-2">{rejected.map(renderRequestCard)}</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewItem} onOpenChange={(o) => { if (!o) setReviewItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Review Checkout Request</DialogTitle>
          </DialogHeader>
          {reviewItem && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">{reviewItem.resident_name}</p>
                  {statusBadge(reviewItem.status)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {[reviewItem.resident_room, reviewItem.resident_wing].filter(Boolean).join(" • ")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {reviewItem.leave_type && (
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground">Leave Type</p>
                    <p className="text-xs font-semibold text-foreground">{reviewItem.leave_type}</p>
                  </div>
                )}
                {reviewItem.reason && (
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground">Reason</p>
                    <p className="text-xs font-semibold text-foreground">{reviewItem.reason}</p>
                  </div>
                )}
                {reviewItem.expected_departure && (
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground">Departure</p>
                    <p className="text-xs font-semibold text-foreground">{format(new Date(reviewItem.expected_departure), "dd MMM HH:mm")}</p>
                  </div>
                )}
                {reviewItem.expected_return && (
                  <div className="rounded-lg bg-muted/30 p-2.5">
                    <p className="text-[10px] text-muted-foreground">Return</p>
                    <p className="text-xs font-semibold text-foreground">{format(new Date(reviewItem.expected_return), "dd MMM HH:mm")}</p>
                  </div>
                )}
              </div>

              {reviewItem.source === "external" && reviewItem.external_reference && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 flex items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">External Reference</p>
                    <p className="text-xs font-medium text-foreground">{reviewItem.external_reference}</p>
                  </div>
                </div>
              )}

              {reviewItem.comments && (
                <div className="rounded-lg bg-muted/30 p-2.5">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MessageSquare className="h-2.5 w-2.5" /> Comments</p>
                  <p className="text-xs text-foreground mt-1">{reviewItem.comments}</p>
                </div>
              )}

              {reviewItem.status === "pending" && (
                <>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-foreground">Review Notes (optional)</p>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes about this decision..."
                      className="min-h-[60px] resize-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleReject(reviewItem.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => handleApprove(reviewItem.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </div>
                </>
              )}

              {reviewItem.status !== "pending" && reviewItem.reviewed_by && (
                <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground">
                  <p>Reviewed by <span className="font-semibold text-foreground">{reviewItem.reviewed_by}</span></p>
                  {reviewItem.reviewed_at && <p>{format(new Date(reviewItem.reviewed_at), "dd MMM yyyy HH:mm")}</p>}
                  {reviewItem.review_notes && <p className="mt-1 text-foreground">{reviewItem.review_notes}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

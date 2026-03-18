import { useState } from "react";
import { useLeaveTypes, useLeaveTypeMutations, LeaveType } from "@/hooks/useLeaveTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function LeaveTypesTab() {
  const { data: leaveTypes = [], isLoading } = useLeaveTypes();
  const { add, update, remove } = useLeaveTypeMutations();
  const { toast } = useToast();
  const [editItem, setEditItem] = useState<LeaveType | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "📋", description: "" });

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await add.mutateAsync({
      name: form.name,
      emoji: form.emoji || "📋",
      description: form.description,
      color: "amber",
      is_active: true,
      sort_order: leaveTypes.length,
    });
    toast({ title: "Leave type added" });
    setForm({ name: "", emoji: "📋", description: "" });
    setShowAdd(false);
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    await update.mutateAsync({
      id: editItem.id,
      name: editItem.name,
      emoji: editItem.emoji,
      description: editItem.description,
    });
    toast({ title: "Leave type updated" });
    setEditItem(null);
  };

  const handleToggle = async (lt: LeaveType) => {
    await update.mutateAsync({ id: lt.id, is_active: !lt.is_active });
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast({ title: "Leave type removed" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Reasons for Checkout</CardTitle>
            <CardDescription className="text-xs">
              Manage checkout reason categories available during resident check-out.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Reason
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            {leaveTypes.map((lt) => (
              <div
                key={lt.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  lt.is_active ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
                }`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                <span className="text-lg shrink-0">{lt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{lt.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{lt.description}</p>
                </div>
                <Badge variant={lt.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                  {lt.is_active ? "Active" : "Disabled"}
                </Badge>
                <Switch checked={lt.is_active} onCheckedChange={() => handleToggle(lt)} />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditItem(lt)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(lt.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {leaveTypes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No leave types configured.</p>
            )}
          </div>
        )}
      </CardContent>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Leave Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="space-y-1 w-20">
                <Label className="text-xs">Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))} className="text-center text-lg h-10" maxLength={4} />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Day Trip" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Short description..." />
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={!form.name.trim()}>Add Leave Type</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Leave Type</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="space-y-1 w-20">
                  <Label className="text-xs">Emoji</Label>
                  <Input value={editItem.emoji} onChange={(e) => setEditItem((p) => p ? { ...p, emoji: e.target.value } : p)} className="text-center text-lg h-10" maxLength={4} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={editItem.name} onChange={(e) => setEditItem((p) => p ? { ...p, name: e.target.value } : p)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={editItem.description} onChange={(e) => setEditItem((p) => p ? { ...p, description: e.target.value } : p)} />
              </div>
              <Button className="w-full" onClick={handleUpdate}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

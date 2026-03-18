import { useState } from "react";
import { Wing } from "@/hooks/useWings";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface ResidentFilterBarProps {
  wings: Wing[];
  selectedWings: string[];
  onWingsChange: (wings: string[]) => void;
  careLevel: string;
  onCareLevelChange: (level: string) => void;
  leaveStatus: string;
  onLeaveStatusChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const careLevels = [
  { value: "all", label: "All Levels" },
  { value: "standard", label: "Standard" },
  { value: "high", label: "High" },
  { value: "memory", label: "Memory Care" },
  { value: "palliative", label: "Palliative" },
  { value: "respite", label: "Respite" },
];

const leaveStatuses = [
  { value: "all", label: "All Status" },
  { value: "on-leave", label: "On Leave" },
  { value: "overdue", label: "Overdue" },
  { value: "returned", label: "Returned" },
  { value: "pending", label: "Pending" },
];

export function ResidentFilterBar({
  wings, selectedWings, onWingsChange,
  careLevel, onCareLevelChange,
  leaveStatus, onLeaveStatusChange,
  searchQuery, onSearchChange,
}: ResidentFilterBarProps) {
  const toggleWing = (wingId: string) => {
    if (wingId === "all") {
      onWingsChange([]);
      return;
    }
    const next = selectedWings.includes(wingId)
      ? selectedWings.filter((w) => w !== wingId)
      : [...selectedWings, wingId];
    onWingsChange(next);
  };

  return (
    <div className="space-y-3 px-5 py-3 border-b border-border bg-card">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, room, or key worker..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-[13px]"
          />
        </div>

        <Select value={careLevel} onValueChange={onCareLevelChange}>
          <SelectTrigger className="h-8 w-[140px] text-[13px]">
            <SelectValue placeholder="Care Level" />
          </SelectTrigger>
          <SelectContent>
            {careLevels.map((l) => (
              <SelectItem key={l.value} value={l.value} className="text-[13px]">{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={leaveStatus} onValueChange={onLeaveStatusChange}>
          <SelectTrigger className="h-8 w-[140px] text-[13px]">
            <SelectValue placeholder="Leave Status" />
          </SelectTrigger>
          <SelectContent>
            {leaveStatuses.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-[13px]">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Wing pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => toggleWing("all")}
          className={`h-7 px-3 rounded-md text-[12px] font-medium transition-all duration-150 border ${
            selectedWings.length === 0
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          All Wings
        </button>
        {wings.map((wing) => {
          const active = selectedWings.includes(wing.id);
          return (
            <button
              key={wing.id}
              onClick={() => toggleWing(wing.id)}
              className={`h-7 px-3 rounded-md text-[12px] font-medium transition-all duration-150 border ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {wing.name}
              {wing.floor && <span className="ml-1 text-[10px] opacity-70">· {wing.floor}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

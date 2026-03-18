import { Button } from "@/components/ui/button";
import { Plus, Search, Bell, CalendarDays, RefreshCw, Users, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface DashboardHeaderProps {
  onAddVisit: () => void;
  onCheckOut: () => void;
}

export function DashboardHeader({ onAddVisit, onCheckOut }: DashboardHeaderProps) {
  const today = new Date();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Welcome Back</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                {format(today, "EEEE, MMMM d")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your facility at a glance. Monitor visits, safety, and compliance in real time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-border rounded-lg px-1 py-0.5 mr-2">
            <Button variant="secondary" size="sm" className="h-7 text-[11px] font-semibold rounded-md gap-1">
              <CalendarDays className="h-3 w-3" />
              AM Shift
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 font-semibold" onClick={onCheckOut}>
            <LogOut className="h-3.5 w-3.5" />
            Check Out
          </Button>
          <Button size="sm" className="h-9 text-xs gap-1.5 font-semibold shadow-lg shadow-primary/25" onClick={onAddVisit}>
            <Plus className="h-3.5 w-3.5" />
            New Check-In
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          </Button>
          <Avatar className="h-8 w-8 ml-1">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              <Users className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

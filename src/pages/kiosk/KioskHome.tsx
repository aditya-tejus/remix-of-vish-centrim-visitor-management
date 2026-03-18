import { useNavigate } from "react-router-dom";
import { UserPlus, LogOut, DoorOpen } from "lucide-react";

const KIOSK_TILES = [
  { label: "Check In", description: "Register your visit", icon: UserPlus, path: "/kiosk/checkin", color: "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground" },
  { label: "Check Out", description: "Sign out your visit", icon: LogOut, path: "/kiosk/checkout", color: "bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground" },
  { label: "Resident Leave", description: "Leaving or returning", icon: DoorOpen, path: "/kiosk/resident-leave", color: "bg-info/10 text-info hover:bg-info hover:text-info-foreground" },
];

export default function KioskHome() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Welcome</h1>
        <p className="text-lg text-muted-foreground mt-2">How can we help you today?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {KIOSK_TILES.map((tile) => (
          <button
            key={tile.path}
            onClick={() => navigate(tile.path)}
            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-border p-8 min-h-[200px] transition-all duration-200 active:scale-[0.97] ${tile.color}`}
          >
            <tile.icon className="h-12 w-12" />
            <div className="text-center">
              <span className="text-xl font-bold block">{tile.label}</span>
              <span className="text-sm opacity-80 mt-1 block">{tile.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

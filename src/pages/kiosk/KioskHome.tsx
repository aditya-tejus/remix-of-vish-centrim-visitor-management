import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserRoundPlus, LogOut, DoorOpen, QrCode } from "lucide-react";
import { KioskActionTile } from "@/components/ui/reception-primitives";
import { format } from "date-fns";
import centrimLogo from "@/assets/centrim-life-logo.png";

import { usePersonTypes } from "@/hooks/usePersonTypes";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { useKioskFastLane } from "@/hooks/useKioskFastLane";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function KioskHome() {
  const navigate = useNavigate();
  const { residentKioskEnabled } = usePersonTypes();
  const { siteName } = useOperatingContext();
  const { fastLaneEnabled } = useKioskFastLane();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="kiosk-surface w-full max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="text-center space-y-3">
        <img src={centrimLogo} alt="Centrim Life" className="h-12 sm:h-14 max-w-full object-contain mx-auto" />
        <p className="text-xl text-muted-foreground">{getGreeting()}</p>
        <h1 className="text-3xl font-semibold break-words">{siteName ? `Welcome to ${siteName}` : "Welcome"}</h1>
        <p className="text-lg text-muted-foreground tabular-nums">{format(currentTime, "EEEE, d MMMM yyyy · h:mm a")}</p>
      </div>
      <div className="grid gap-4">
        <KioskActionTile primary icon={UserRoundPlus} onClick={() => navigate("/kiosk/checkin")}>Sign In</KioskActionTile>
        <KioskActionTile icon={LogOut} onClick={() => navigate("/kiosk/checkout")}>Sign Out</KioskActionTile>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {residentKioskEnabled && <KioskActionTile icon={DoorOpen} onClick={() => navigate("/kiosk/resident-leave")}>Leaving or returning</KioskActionTile>}
        {fastLaneEnabled && <KioskActionTile icon={QrCode} onClick={() => navigate("/kiosk/qr-scan")}>Scan visitor card</KioskActionTile>}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserRoundPlus, LogOut, DoorOpen, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import centrimLogo from "@/assets/centrim-life-logo.png";
import kioskBg from "@/assets/kiosk-bg.jpg";
import { usePersonTypes } from "@/hooks/usePersonTypes";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { useKioskFastLane } from "@/hooks/useKioskFastLane";

const KIOSK_TILES = [
  {
    label: "Check In",
    description: "Register your visit",
    icon: UserRoundPlus,
    path: "/kiosk/checkin",
    hero: true,
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    tileBg: "bg-primary/10 border-primary/30",
    tileActive: "active:scale-[0.97] active:bg-primary active:text-primary-foreground",
  },
  {
    label: "Check Out",
    description: "Sign out your visit",
    icon: LogOut,
    path: "/kiosk/checkout",
    hero: false,
    iconBg: "bg-warning/20",
    iconColor: "text-warning",
    tileBg: "bg-warning/10 border-warning/30",
    tileActive: "active:scale-[0.96] active:bg-warning active:text-warning-foreground",
  },
  {
    label: "Resident Leave",
    description: "Leaving or returning",
    icon: DoorOpen,
    path: "/kiosk/resident-leave",
    hero: false,
    iconBg: "bg-info/20",
    iconColor: "text-info",
    tileBg: "bg-info/10 border-info/30",
    tileActive: "active:scale-[0.96] active:bg-info active:text-info-foreground",
  },
  {
    label: "Scan QR",
    description: "Use your visitor card",
    icon: QrCode,
    path: "/kiosk/qr-scan",
    hero: false,
    iconBg: "bg-secondary",
    iconColor: "text-secondary-foreground",
    tileBg: "bg-secondary/80 border-secondary",
    tileActive: "active:scale-[0.96] active:bg-foreground active:text-background",
  },
];

const tileVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

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
  const heroTile = KIOSK_TILES.find((t) => t.hero)!;
  const secondaryTiles = KIOSK_TILES.filter(
    (t) =>
      !t.hero &&
      (t.path !== "/kiosk/resident-leave" || residentKioskEnabled) &&
      // No dead ends: the card tile only appears where cards/codes are issued.
      (t.path !== "/kiosk/qr-scan" || fastLaneEnabled)
  );

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-10">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${kioskBg})` }}
      />
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-2xl space-y-8">
          {/* Header: Logo + Greeting + Facility + Time */}
          <motion.div
            className="text-center space-y-3"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src={centrimLogo}
              alt="Centrim Life"
              className="h-12 sm:h-14 object-contain mx-auto"
            />
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              {getGreeting()}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              {siteName ? `Welcome to ${siteName}` : "Welcome"}
            </p>
            <p className="text-sm text-muted-foreground/70 font-medium tabular-nums">
              {format(currentTime, "EEEE, d MMMM yyyy · h:mm a")}
            </p>
          </motion.div>

          {/* Hero tile — Check In */}
          <motion.button
            custom={0}
            variants={tileVariants}
            initial="hidden"
            animate="visible"
            onClick={() => navigate(heroTile.path)}
            className={`w-full flex items-center gap-6 rounded-2xl border-2 p-7 sm:p-8 min-h-[140px] transition-all duration-200 backdrop-blur-md bg-card/90 shadow-lg ${heroTile.tileBg} ${heroTile.tileActive} group`}
          >
            <div className={`h-20 w-20 sm:h-24 sm:w-24 rounded-2xl flex items-center justify-center shrink-0 ${heroTile.iconBg} transition-colors`}>
              <heroTile.icon className={`h-10 w-10 sm:h-12 sm:w-12 ${heroTile.iconColor}`} strokeWidth={2.25} />
            </div>
            <div className="text-left">
              <span className="text-2xl sm:text-3xl font-bold block text-foreground">
                {heroTile.label}
              </span>
              <span className="text-base sm:text-lg mt-1 block text-muted-foreground">
                {heroTile.description}
              </span>
            </div>
          </motion.button>

          {/* Secondary tiles */}
          <div className="grid grid-cols-3 gap-4 sm:gap-5">
            {secondaryTiles.map((tile, i) => (
              <motion.button
                key={tile.path}
                custom={i + 1}
                variants={tileVariants}
                initial="hidden"
                animate="visible"
                onClick={() => navigate(tile.path)}
                className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 sm:p-8 min-h-[180px] sm:min-h-[200px] transition-all duration-200 backdrop-blur-md bg-card/90 shadow-lg ${tile.tileBg} ${tile.tileActive} group`}
              >
                <div className={`h-16 w-16 sm:h-18 sm:w-18 rounded-2xl flex items-center justify-center ${tile.iconBg} transition-colors`}>
                  <tile.icon className={`h-8 w-8 sm:h-9 sm:w-9 ${tile.iconColor}`} strokeWidth={2.25} />
                </div>
                <div className="text-center">
                  <span className="text-lg sm:text-xl font-bold block text-foreground">
                    {tile.label}
                  </span>
                  <span className="text-xs sm:text-sm mt-1 block text-muted-foreground">
                    {tile.description}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { UserRoundPlus, LogOut, DoorOpen, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import kioskBg from "@/assets/kiosk-bg.jpg";

const KIOSK_TILES = [
  {
    label: "Check In",
    description: "Register your visit",
    icon: UserRoundPlus,
    path: "/kiosk/checkin",
    hero: true,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    idle: "bg-primary/10 border-primary/20",
    hover: "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-xl",
  },
  {
    label: "Check Out",
    description: "Sign out your visit",
    icon: LogOut,
    path: "/kiosk/checkout",
    hero: false,
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    idle: "bg-warning/10 border-warning/20",
    hover: "hover:bg-warning hover:text-warning-foreground hover:border-warning hover:shadow-xl",
  },
  {
    label: "Resident Leave",
    description: "Leaving or returning",
    icon: DoorOpen,
    path: "/kiosk/resident-leave",
    hero: false,
    iconBg: "bg-info/15",
    iconColor: "text-info",
    idle: "bg-info/10 border-info/20",
    hover: "hover:bg-info hover:text-info-foreground hover:border-info hover:shadow-xl",
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
  const heroTile = KIOSK_TILES.find((t) => t.hero)!;
  const secondaryTiles = KIOSK_TILES.filter((t) => !t.hero);

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
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              {getGreeting()}
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              How can we help you today?
            </p>
          </motion.div>

          {/* Hero tile — Check In */}
          <motion.button
            custom={0}
            variants={tileVariants}
            initial="hidden"
            animate="visible"
            onClick={() => navigate(heroTile.path)}
            className={`w-full flex items-center gap-6 rounded-2xl border-2 p-7 sm:p-8 min-h-[140px] transition-all duration-200 active:scale-[0.97] backdrop-blur-md bg-card/80 ${heroTile.idle} ${heroTile.hover} group`}
          >
            <div className={`h-20 w-20 sm:h-24 sm:w-24 rounded-2xl flex items-center justify-center shrink-0 ${heroTile.iconBg} transition-colors group-hover:bg-primary-foreground/20`}>
              <heroTile.icon className={`h-10 w-10 sm:h-12 sm:w-12 ${heroTile.iconColor} group-hover:text-primary-foreground`} strokeWidth={2.25} />
            </div>
            <div className="text-left">
              <span className="text-2xl sm:text-3xl font-bold block text-foreground group-hover:text-primary-foreground">
                {heroTile.label}
              </span>
              <span className="text-base sm:text-lg opacity-80 mt-1 block text-muted-foreground group-hover:text-primary-foreground/80">
                {heroTile.description}
              </span>
            </div>
          </motion.button>

          {/* Secondary tiles — Check Out & Resident Leave */}
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            {secondaryTiles.map((tile, i) => (
              <motion.button
                key={tile.path}
                custom={i + 1}
                variants={tileVariants}
                initial="hidden"
                animate="visible"
                onClick={() => navigate(tile.path)}
                className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 sm:p-8 min-h-[180px] sm:min-h-[200px] transition-all duration-200 active:scale-[0.96] backdrop-blur-md bg-card/80 ${tile.idle} ${tile.hover} group`}
              >
                <div className={`h-16 w-16 sm:h-18 sm:w-18 rounded-2xl flex items-center justify-center ${tile.iconBg} transition-colors`}>
                  <tile.icon className={`h-8 w-8 sm:h-9 sm:w-9 ${tile.iconColor} group-hover:text-inherit`} strokeWidth={2.25} />
                </div>
                <div className="text-center">
                  <span className="text-lg sm:text-xl font-bold block text-foreground group-hover:text-inherit">
                    {tile.label}
                  </span>
                  <span className="text-xs sm:text-sm opacity-80 mt-1 block text-muted-foreground group-hover:text-inherit/80">
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

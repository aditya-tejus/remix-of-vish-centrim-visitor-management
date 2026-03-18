import { useNavigate } from "react-router-dom";
import { UserPlus, LogOut, DoorOpen, QrCode } from "lucide-react";
import { motion } from "framer-motion";

const KIOSK_TILES = [
  {
    label: "Check In",
    description: "Register your visit",
    icon: UserPlus,
    path: "/kiosk/checkin",
    idle: "bg-primary/10 text-primary border-primary/20",
    hover: "hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg",
  },
  {
    label: "Check Out",
    description: "Sign out your visit",
    icon: LogOut,
    path: "/kiosk/checkout",
    idle: "bg-warning/10 text-warning border-warning/20",
    hover: "hover:bg-warning hover:text-warning-foreground hover:border-warning hover:shadow-lg",
  },
  {
    label: "QR Code",
    description: "I have a QR code",
    icon: QrCode,
    path: "/kiosk/qr",
    idle: "bg-success/10 text-success border-success/20",
    hover: "hover:bg-success hover:text-success-foreground hover:border-success hover:shadow-lg",
  },
  {
    label: "Resident Leave",
    description: "Leaving or returning",
    icon: DoorOpen,
    path: "/kiosk/resident-leave",
    idle: "bg-info/10 text-info border-info/20",
    hover: "hover:bg-info hover:text-info-foreground hover:border-info hover:shadow-lg",
  },
];

const tileVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: "easeOut" },
  }),
};

export default function KioskHome() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-xl space-y-8 px-2">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Welcome</h1>
        <p className="text-lg text-muted-foreground mt-2">How can we help you today?</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {KIOSK_TILES.map((tile, i) => (
          <motion.button
            key={tile.path}
            custom={i}
            variants={tileVariants}
            initial="hidden"
            animate="visible"
            onClick={() => navigate(tile.path)}
            className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 sm:p-8 min-h-[180px] sm:min-h-[200px] transition-all duration-200 active:scale-[0.96] ${tile.idle} ${tile.hover}`}
          >
            <tile.icon className="h-11 w-11 sm:h-12 sm:w-12" />
            <div className="text-center">
              <span className="text-lg sm:text-xl font-bold block">{tile.label}</span>
              <span className="text-xs sm:text-sm opacity-80 mt-1 block">{tile.description}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

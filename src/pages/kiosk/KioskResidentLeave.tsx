import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useOperatingContext } from "@/contexts/OperatingContext";
import { ArrowLeft, HandHelping } from "lucide-react";

/** Deliberately no resident lookup, directory or mutation on a public device. */
export default function KioskResidentLeave() {
  const navigate = useNavigate();
  const { modules } = useOperatingContext();
  return <section className="w-full space-y-6 text-center">
    <HandHelping aria-hidden="true" className="h-12 w-12 mx-auto text-primary" />
    <h1 className="text-3xl font-semibold">Resident departures and returns</h1>
    <p className="text-xl text-muted-foreground">Please speak with reception to record your departure or return.</p>
    {modules.selfReportedAway && <p className="text-xl text-muted-foreground">Reporting time away is your choice.</p>}
    <Button variant="secondary" onClick={() => navigate("/kiosk/home")} className="w-full min-h-kiosk text-xl gap-2 whitespace-normal"><ArrowLeft aria-hidden="true" className="h-5 w-5" /> Back to home</Button>
  </section>;
}

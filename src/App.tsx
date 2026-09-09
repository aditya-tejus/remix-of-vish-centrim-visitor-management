import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { SiteProvider } from "@/contexts/SiteContext";
import { OperatingContextProvider, useOperatingContext } from "@/contexts/OperatingContext";
import { RequireAuth } from "@/components/RequireAuth";
import AuthPage from "./pages/Auth";
import VisitList from "./pages/VisitList";
import HomeWorkbench from "./pages/HomeWorkbench";
import Settings from "./pages/Settings";
import Visitors from "./pages/Visitors";
import VisitorProfilePage from "./pages/VisitorProfilePage";

import CalendarPage from "./pages/Calendar";
import GDPRPage from "./pages/GDPR";
import AuditLogPage from "./pages/AuditLog";
import PublicCheckIn from "./pages/PublicCheckIn";
import Evacuation from "./pages/Evacuation";
import FeedbackResponses from "./pages/FeedbackResponses";
import FeedbackAnalytics from "./pages/FeedbackAnalytics";
import NotFound from "./pages/NotFound";
// Phase 6-7 new pages
import Residents from "./pages/Residents";
import FoodRegister from "./pages/FoodRegister";
import KeysRegister from "./pages/KeysRegister";

import ReportsHome from "./pages/ReportsHome";
import OperationsReport from "./pages/OperationsReport";
import EvacuationReport from "./pages/EvacuationReport";
import PresenceLog from "./pages/PresenceLog";
import VisitorReport from "./pages/VisitorReport";
import VisitTrends from "./pages/VisitTrends";
import ReportsPage from "./pages/Reports";
import CoverageChecklist from "./pages/CoverageChecklist";
// Kiosk
import KioskLayout from "./pages/kiosk/KioskLayout";
import { KioskDeviceProvider } from "@/contexts/KioskDeviceContext";
import KioskAttract from "./pages/kiosk/KioskAttract";
import KioskHome from "./pages/kiosk/KioskHome";
import KioskCheckIn from "./pages/kiosk/KioskCheckIn";
import KioskCheckOut from "./pages/kiosk/KioskCheckOut";
import KioskResidentLeave from "./pages/kiosk/KioskResidentLeave";
import KioskQRScan from "./pages/kiosk/KioskQRScan";
import KioskEvacuation from "./pages/kiosk/KioskEvacuation";
import GroupCheckIn from "./pages/GroupCheckIn";
import PersonTypeSelector from "./pages/PersonTypeSelector";


const queryClient = new QueryClient();

const Staff = ({ children }: { children: ReactNode }) => <RequireAuth>{children}</RequireAuth>;

/** A register that is switched off for this kind of site disappears entirely. */
const Module = ({ name, children }: { name: "keysRegister" | "foodRegister"; children: ReactNode }) => {
  const { modules, loading } = useOperatingContext();
  if (loading) return null;
  return modules[name] ? <>{children}</> : <Navigate to="/" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SiteProvider>
          <KioskDeviceProvider>
          <OperatingContextProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />

            <Route path="/" element={<Staff><VisitList /></Staff>} />
            <Route path="/dashboard" element={<Navigate to="/today" replace />} />
            <Route path="/workbench" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<Staff><HomeWorkbench /></Staff>} />
            <Route path="/visit-list" element={<Staff><VisitList /></Staff>} />
            <Route path="/visitors" element={<Staff><Visitors /></Staff>} />
            <Route path="/visitors/:id" element={<Staff><VisitorProfilePage /></Staff>} />
            <Route path="/check-in" element={<Navigate to="/" replace />} />
            <Route path="/person-type" element={<PersonTypeSelector />} />
            <Route path="/group-checkin" element={<GroupCheckIn />} />
            <Route path="/qr-fast-lane" element={<Navigate to="/" replace />} />
            <Route path="/residents" element={<Staff><Residents /></Staff>} />
            <Route path="/food-register" element={<Staff><Module name="foodRegister"><FoodRegister /></Module></Staff>} />
            <Route path="/keys" element={<Staff><Module name="keysRegister"><KeysRegister /></Module></Staff>} />

            <Route path="/resident-leave" element={<Navigate to="/residents" replace />} />
            <Route path="/calendar" element={<Staff><CalendarPage /></Staff>} />
            <Route path="/gdpr" element={<Staff><GDPRPage /></Staff>} />
            <Route path="/reports" element={<Staff><ReportsHome /></Staff>} />
            <Route path="/reports/analytics" element={<Staff><ReportsPage /></Staff>} />
            <Route path="/reports/evacuation" element={<Staff><EvacuationReport /></Staff>} />
            <Route path="/reports/on-site" element={<Staff><OperationsReport /></Staff>} />
            <Route path="/reports/presence" element={<Staff><PresenceLog /></Staff>} />
            <Route path="/reports/visitor-report" element={<Staff><VisitorReport /></Staff>} />
            <Route path="/reports/trends" element={<Staff><VisitTrends /></Staff>} />
            <Route path="/reports/feedback-responses" element={<Staff><FeedbackResponses /></Staff>} />
            <Route path="/reports/feedback-reports" element={<Staff><FeedbackAnalytics /></Staff>} />
            <Route path="/audit-log" element={<Staff><AuditLogPage /></Staff>} />
            <Route path="/evacuation" element={<Staff><Evacuation /></Staff>} />
            <Route path="/feedback" element={<Navigate to="/reports/feedback-responses" replace />} />
            <Route path="/visitor-analytics" element={<Navigate to="/reports/analytics" replace />} />
            <Route path="/settings" element={<Staff><Settings /></Staff>} />
            <Route path="/leave-requests" element={<Navigate to="/residents" replace />} />
            <Route path="/checkout-requests" element={<Navigate to="/residents" replace />} />
            <Route path="/coverage" element={<Staff><CoverageChecklist /></Staff>} />

            {/* Public / kiosk routes */}
            <Route path="/public-checkin" element={<PublicCheckIn />} />
            <Route path="/kiosk" element={<KioskLayout />}>
              <Route index element={<KioskAttract />} />
              <Route path="home" element={<KioskHome />} />
              <Route path="checkin" element={<KioskCheckIn />} />
              <Route path="checkout" element={<KioskCheckOut />} />
              <Route path="resident-leave" element={<KioskResidentLeave />} />
              <Route path="qr-scan" element={<KioskQRScan />} />
              <Route path="evacuation" element={<KioskEvacuation />} />

            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </OperatingContextProvider>
          </KioskDeviceProvider>
          </SiteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

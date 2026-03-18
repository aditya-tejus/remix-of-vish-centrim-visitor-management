import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VisitList from "./pages/VisitList";
import Settings from "./pages/Settings";
import Visitors from "./pages/Visitors";
import VisitorProfilePage from "./pages/VisitorProfilePage";
import CheckIn from "./pages/CheckIn";
import CalendarPage from "./pages/Calendar";
import GDPRPage from "./pages/GDPR";
import AuditLogPage from "./pages/AuditLog";
import PublicCheckIn from "./pages/PublicCheckIn";
import Evacuation from "./pages/Evacuation";
import Feedback from "./pages/Feedback";
import VisitorAnalytics from "./pages/VisitorAnalytics";
import LeaveRequests from "./pages/LeaveRequests";
import NotFound from "./pages/NotFound";
// Phase 6-7 new pages
import Residents from "./pages/Residents";
import PersonTypeSelector from "./pages/PersonTypeSelector";
import GroupCheckIn from "./pages/GroupCheckIn";
import QRFastLane from "./pages/QRFastLane";
import ReportsHome from "./pages/ReportsHome";
import EvacuationReport from "./pages/EvacuationReport";
import PresenceLog from "./pages/PresenceLog";
import VisitTrends from "./pages/VisitTrends";
import ReportsPage from "./pages/Reports";
import CoverageChecklist from "./pages/CoverageChecklist";
// Kiosk
import KioskLayout from "./pages/kiosk/KioskLayout";
import KioskHome from "./pages/kiosk/KioskHome";
import KioskCheckIn from "./pages/kiosk/KioskCheckIn";
import KioskCheckOut from "./pages/kiosk/KioskCheckOut";
import KioskResidentLeave from "./pages/kiosk/KioskResidentLeave";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<VisitList />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/visit-list" element={<Navigate to="/" replace />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/visitors/:id" element={<VisitorProfilePage />} />
          <Route path="/check-in" element={<Navigate to="/person-type" replace />} />
          <Route path="/person-type" element={<PersonTypeSelector />} />
          <Route path="/group-checkin" element={<GroupCheckIn />} />
          <Route path="/qr-fast-lane" element={<QRFastLane />} />
          <Route path="/residents" element={<Residents />} />
          <Route path="/resident-leave" element={<Navigate to="/residents" replace />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/gdpr" element={<GDPRPage />} />
          <Route path="/reports" element={<ReportsHome />} />
          <Route path="/reports/analytics" element={<ReportsPage />} />
          <Route path="/reports/evacuation" element={<EvacuationReport />} />
          <Route path="/reports/presence" element={<PresenceLog />} />
          <Route path="/reports/trends" element={<VisitTrends />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/evacuation" element={<Evacuation />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/visitor-analytics" element={<Navigate to="/reports/analytics" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/leave-requests" element={<LeaveRequests />} />
          <Route path="/checkout-requests" element={<LeaveRequests />} />
          <Route path="/public-checkin" element={<PublicCheckIn />} />
          <Route path="/coverage" element={<CoverageChecklist />} />
          {/* Kiosk routes */}
          <Route path="/kiosk" element={<KioskLayout />}>
            <Route index element={<KioskHome />} />
            <Route path="checkin" element={<KioskCheckIn />} />
            <Route path="checkout" element={<KioskCheckOut />} />
            <Route path="resident-leave" element={<KioskResidentLeave />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

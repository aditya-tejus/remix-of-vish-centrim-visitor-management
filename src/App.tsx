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
import ReportsPage from "./pages/Reports";
import AuditLogPage from "./pages/AuditLog";
import PublicCheckIn from "./pages/PublicCheckIn";
import Evacuation from "./pages/Evacuation";
import Feedback from "./pages/Feedback";
import VisitorAnalytics from "./pages/VisitorAnalytics";
import LeaveRequests from "./pages/LeaveRequests";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/visit-list" replace />} />
          <Route path="/dashboard" element={<Navigate to="/visit-list" replace />} />
          <Route path="/visit-list" element={<VisitList />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/visitors/:id" element={<VisitorProfilePage />} />
          <Route path="/check-in" element={<CheckIn />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/gdpr" element={<GDPRPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/evacuation" element={<Evacuation />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/visitor-analytics" element={<VisitorAnalytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/leave-requests" element={<LeaveRequests />} />
          <Route path="/checkout-requests" element={<LeaveRequests />} />
          <Route path="/public-checkin" element={<PublicCheckIn />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

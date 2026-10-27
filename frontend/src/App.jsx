import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ModernDashboard from './pages/ModernDashboard';
import BeneficiaryListPage from './pages/BeneficiaryListPage';
import ProgramListPage from './pages/ProgramListPage';
import ProgramDetailsPage from './pages/ProgramDetailsPage';
import BarangayListPage from './pages/BarangayListPage';
import DistributionPage from './pages/DistributionPage';
import AttendancePage from './pages/AttendancePage';
import RfidScannerPage from './pages/RfidScannerPage';
import RfidAttendancePage from './pages/RfidAttendancePage';
import SmsPage from './pages/SmsPage';
import LogsPage from './pages/LogsPage';
import ReportsPage from './pages/ReportsPage';
import UserListPage from './pages/UserListPage';
import NotFoundPage from './pages/NotFoundPage';
import MessagesPage from './pages/MessagesPage';
import BeneficiaryProfilePage from './pages/BeneficiaryProfilePage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import MyBenefitsPage from './pages/MyBenefitsPage';
import BeneficiaryAttendancePage from './pages/BeneficiaryAttendancePage';
import AnnouncementManagementPage from './pages/AnnouncementManagementPage';
import NotificationsPage from './pages/NotificationsPage';
import RfidAnnouncementScannerPage from './pages/RfidAnnouncementScannerPage';
import ComingSoonPage from './pages/ComingSoonPage';
import RequestAssistancePage from './pages/RequestAssistancePage';
import AssistanceRequestsManagementPage from './pages/AssistanceRequestsManagementPage';
import MyInterventionsPage from './pages/MyInterventionsPage';
import InterventionsManagementPage from './pages/InterventionsManagementPage';
import SeniorCitizenAdminPage from './pages/SeniorCitizenAdminPage';
import PwdAdminPage from './pages/PwdAdminPage';
import MainLayout from './components/layout/MainLayout';
import InactiveBeneficiaryScreen from './components/InactiveBeneficiaryScreen';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Dashboard Router Component - Shows different dashboard based on role
const DashboardRouter = () => {
  const { user, loading } = useAuth();
  
  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
        <p className="text-xs text-slate-500 font-medium">Loading portal...</p>
      </div>
    );
  }

  // Beneficiaries see the application portal dashboard (or Inactive notice if account is inactive)
  if (user?.role === 'beneficiary') {
    if (user?.status === 'inactive') {
      return <InactiveBeneficiaryScreen />;
    }
    return <DashboardPage />;
  }

  // Staff and Admin (including MSWDO, Senior Citizen, and PWD admins) see the modern dashboard
  return <ModernDashboard />;
};

// Attendance Router Component - Beneficiaries see their meeting attendance history
const AttendanceRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'beneficiary') {
    return <BeneficiaryAttendancePage />;
  }
  return <AttendancePage />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/beneficiaries" element={<Navigate to="/dashboard/beneficiaries" replace />} />
    <Route path="/programs" element={<Navigate to="/dashboard/programs" replace />} />
    <Route path="/barangays" element={<Navigate to="/dashboard/barangays" replace />} />
    <Route path="/baranggays" element={<Navigate to="/dashboard/barangays" replace />} />
    <Route path="/attendance" element={<Navigate to="/dashboard/attendance" replace />} />
    <Route path="/Attendance" element={<Navigate to="/dashboard/attendance" replace />} />
    <Route path="/reports" element={<Navigate to="/dashboard/reports" replace />} />
    <Route path="/senior-citizen-admin" element={<Navigate to="/dashboard/senior-citizen-admin" replace />} />
    <Route path="/pwd-admin" element={<Navigate to="/dashboard/pwd-admin" replace />} />
    <Route path="/senior-citizens" element={<Navigate to="/dashboard/senior-citizen-admin" replace />} />
    <Route path="/pwd" element={<Navigate to="/dashboard/pwd-admin" replace />} />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DashboardRouter />} />
      <Route path="senior-citizen-admin" element={<SeniorCitizenAdminPage />} />
      <Route path="pwd-admin" element={<PwdAdminPage />} />
      <Route path="senior-citizens" element={<Navigate to="/dashboard/senior-citizen-admin" replace />} />
      <Route path="pwd" element={<Navigate to="/dashboard/pwd-admin" replace />} />
      <Route path="beneficiaries" element={<BeneficiaryListPage />} />
      <Route path="programs" element={<ProgramListPage />} />
      <Route path="programs/:id" element={<ProgramDetailsPage />} />
      <Route path="barangays" element={<BarangayListPage />} />
      <Route path="distributions" element={<DistributionPage />} />
      <Route path="announcements" element={<AnnouncementManagementPage />} />
      <Route path="attendance" element={<AttendanceRouter />} />
      <Route path="my-attendance" element={<BeneficiaryAttendancePage />} />
      <Route path="rfid-scanner" element={<RfidScannerPage />} />
      <Route path="rfid-attendance" element={<RfidAttendancePage />} />
      <Route path="announcement-scanner" element={<RfidAnnouncementScannerPage />} />
       <Route path="sms" element={<LogsPage defaultTab="sms" />} />
      <Route path="sms-logs" element={<LogsPage defaultTab="sms" />} />
      <Route path="system-logs" element={<LogsPage defaultTab="system" />} />
      <Route path="audit-logs" element={<LogsPage defaultTab="audit" />} />
      <Route path="logs" element={<LogsPage defaultTab="system" />} />
      <Route path="logs/system" element={<LogsPage defaultTab="system" />} />
      <Route path="logs/sms" element={<LogsPage defaultTab="sms" />} />
      <Route path="logs/audit" element={<LogsPage defaultTab="audit" />} />
      <Route path="users" element={<UserListPage />} />
      <Route path="messages" element={<MessagesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      {/* Beneficiary Routes */}
      <Route path="my-profile" element={<BeneficiaryProfilePage />} />
      <Route path="my-applications" element={<MyApplicationsPage />} />
      <Route path="my-benefits" element={<MyBenefitsPage />} />
      <Route path="documents" element={<Navigate to="/dashboard/attendance" replace />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="request-assistance" element={<RequestAssistancePage />} />
      <Route path="my-interventions" element={<MyInterventionsPage />} />
      <Route path="medical-assistance" element={<Navigate to="/dashboard/request-assistance" replace />} />
      <Route path="medical-assistance-admin" element={<Navigate to="/dashboard/assistance-requests" replace />} />
      <Route path="assistance-requests" element={<AssistanceRequestsManagementPage />} />
      <Route path="interventions-management" element={<InterventionsManagementPage />} />
      <Route path="help-center" element={<ComingSoonPage />} />
      <Route path="settings" element={<ComingSoonPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

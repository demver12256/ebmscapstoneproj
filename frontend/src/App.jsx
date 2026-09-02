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
import ReportsPage from './pages/ReportsPage';
import UserListPage from './pages/UserListPage';
import NotFoundPage from './pages/NotFoundPage';
import MessagesPage from './pages/MessagesPage';
import BeneficiaryProfilePage from './pages/BeneficiaryProfilePage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import MyBenefitsPage from './pages/MyBenefitsPage';
import MyDocumentsPage from './pages/MyDocumentsPage';
import AnnouncementManagementPage from './pages/AnnouncementManagementPage';
import NotificationsPage from './pages/NotificationsPage';
import RfidAnnouncementScannerPage from './pages/RfidAnnouncementScannerPage';
import ComingSoonPage from './pages/ComingSoonPage';
import RequestAssistancePage from './pages/RequestAssistancePage';
import AssistanceRequestsManagementPage from './pages/AssistanceRequestsManagementPage';
import MainLayout from './components/layout/MainLayout';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Dashboard Router Component - Shows different dashboard based on role
const DashboardRouter = () => {
  const { user } = useAuth();
  
  // Beneficiaries see the application portal dashboard
  if (user?.role === 'beneficiary') {
    return <DashboardPage />;
  }
  
  // Staff and Admin see the modern dashboard
  return <ModernDashboard />;
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
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DashboardRouter />} />
      <Route path="beneficiaries" element={<BeneficiaryListPage />} />
      <Route path="programs" element={<ProgramListPage />} />
      <Route path="programs/:id" element={<ProgramDetailsPage />} />
      <Route path="barangays" element={<BarangayListPage />} />
      <Route path="distributions" element={<DistributionPage />} />
      <Route path="announcements" element={<AnnouncementManagementPage />} />
      <Route path="attendance" element={<AttendancePage />} />
      <Route path="rfid-scanner" element={<RfidScannerPage />} />
      <Route path="rfid-attendance" element={<RfidAttendancePage />} />
      <Route path="announcement-scanner" element={<RfidAnnouncementScannerPage />} />
      <Route path="sms" element={<SmsPage />} />
      <Route path="users" element={<UserListPage />} />
      <Route path="messages" element={<MessagesPage />} />
      <Route path="reports" element={<ReportsPage />} />
      {/* Beneficiary Routes */}
      <Route path="my-profile" element={<BeneficiaryProfilePage />} />
      <Route path="my-applications" element={<MyApplicationsPage />} />
      <Route path="my-benefits" element={<MyBenefitsPage />} />
      <Route path="documents" element={<MyDocumentsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="request-assistance" element={<RequestAssistancePage />} />
      <Route path="medical-assistance" element={<Navigate to="/dashboard/request-assistance" replace />} />
      <Route path="medical-assistance-admin" element={<Navigate to="/dashboard/assistance-requests" replace />} />
      <Route path="assistance-requests" element={<AssistanceRequestsManagementPage />} />
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

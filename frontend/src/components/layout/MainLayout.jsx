import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import StaffMswdoNotificationPopupModal from '../StaffMswdoNotificationPopupModal';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1">
          <Header />
          <main className="p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <StaffMswdoNotificationPopupModal />
    </div>
  );
}


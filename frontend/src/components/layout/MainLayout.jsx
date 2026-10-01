import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import StaffMswdoNotificationPopupModal from '../StaffMswdoNotificationPopupModal';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Header />
          <main className="w-full overflow-x-hidden p-3 pb-24 md:p-4 md:pb-24 lg:p-5 lg:pb-5">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <StaffMswdoNotificationPopupModal />
    </div>
  );
}


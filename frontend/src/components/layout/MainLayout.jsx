import { Outlet } from 'react-router-dom';
import { useCallback, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import StaffMswdoNotificationPopupModal from '../StaffMswdoNotificationPopupModal';
import BeniAidBot from '../BeniAidBot';
import InactiveBeneficiaryScreen from '../InactiveBeneficiaryScreen';
import { useAuth } from '../../context/AuthContext';

export default function MainLayout() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const isInactiveBeneficiary = user?.role === 'beneficiary' && user?.status === 'inactive';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar mobileOpen={mobileMenuOpen} onClose={closeMobileMenu} />
        <div className="flex-1 min-w-0">
          <Header mobileMenuOpen={mobileMenuOpen} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main className="w-full overflow-x-hidden p-3 pb-24 md:p-4 md:pb-24 lg:p-5 lg:pb-5">
            {isInactiveBeneficiary ? <InactiveBeneficiaryScreen /> : <Outlet />}
          </main>
        </div>
      </div>
      {!isInactiveBeneficiary && <MobileBottomNav />}
      {!isInactiveBeneficiary && <StaffMswdoNotificationPopupModal />}
      {!isInactiveBeneficiary && <BeniAidBot />}
    </div>
  );
}

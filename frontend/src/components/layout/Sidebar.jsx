import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, Users, MapPin, ListChecks, BarChart3, UserCog, MessageSquare, LogOut, 
  Smartphone, Package, User, FileText, Award, FileCheck, Bell, HelpCircle, Settings 
} from 'lucide-react';

const staffNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'staff', 'barangay'] },
  { path: '/dashboard/beneficiaries', label: 'Beneficiaries', icon: Users, roles: ['admin', 'staff', 'barangay'] },
  { path: '/dashboard/programs', label: 'Programs', icon: ListChecks, roles: ['admin', 'staff', 'barangay'] },
  { path: '/dashboard/barangays', label: 'Barangays', icon: MapPin, roles: ['admin'] },
  { path: '/dashboard/distributions', label: 'Distributions', icon: Package, roles: ['admin', 'staff', 'barangay'] },
  { path: '/dashboard/rfid-scanner', label: 'RFID Scanner', icon: Smartphone, roles: ['staff', 'barangay'] },
  { path: '/dashboard/messages', label: 'Messages', icon: MessageSquare, roles: ['admin', 'staff'] },
  { path: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'staff', 'barangay'] },
  { path: '/dashboard/users', label: 'Users', icon: UserCog, roles: ['admin', 'staff'] },
];

const beneficiaryNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home, requiresApproval: false },
  { path: '/dashboard/my-profile', label: 'My Profile', icon: User, requiresApproval: true },
  { path: '/dashboard/my-applications', label: 'My Applications', icon: FileText, requiresApproval: true },
  { path: '/dashboard/my-benefits', label: 'My Benefits', icon: Award, requiresApproval: true },
  { path: '/dashboard/documents', label: 'Documents', icon: FileCheck, requiresApproval: true },
  { path: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: true, requiresApproval: true },
  { path: '/dashboard/help-center', label: 'Help Center', icon: HelpCircle, requiresApproval: true },
  { path: '/dashboard/settings', label: 'Settings', icon: Settings, requiresApproval: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [beneficiaryStatus, setBeneficiaryStatus] = React.useState(null);

  // Fetch beneficiary status if user is a beneficiary
  React.useEffect(() => {
    const fetchBeneficiaryStatus = async () => {
      if (user?.role === 'beneficiary') {
        try {
          const { beneficiaryApi } = await import('../../services/api');
          const res = await beneficiaryApi.getMe();
          setBeneficiaryStatus(res.data.data?.status);
        } catch (error) {
          console.error('Failed to fetch beneficiary status:', error);
        }
      }
    };
    fetchBeneficiaryStatus();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/?login=true');
  };

  const isBeneficiary = user?.role === 'beneficiary';
  const isApprovedBeneficiary = isBeneficiary && beneficiaryStatus === 'Approved';
  
  // Filter beneficiary nav items based on approval status
  const beneficiaryNav = isApprovedBeneficiary 
    ? beneficiaryNavItems 
    : beneficiaryNavItems.filter(item => !item.requiresApproval);
  
  const navItems = isBeneficiary 
    ? beneficiaryNav
    : staffNavItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col lg:justify-between h-screen sticky top-0">
      <div className="space-y-8 overflow-y-auto pr-1">
        {/* DSWD Brand Header */}
        <div className="flex items-center gap-3">
          <svg className="w-10 h-10 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 20C10 20 50 10 50 10C50 10 90 20 90 20V60C90 75 70 88 50 92C30 88 10 75 10 60V20Z" fill="#00338D" />
            <path d="M10 50C10 50 30 55 50 55C70 55 90 50 90 50V60C90 75 70 88 50 92C30 88 10 75 10 60V50Z" fill="#E30613" />
            <circle cx="50" cy="45" r="18" fill="#FFD100" />
            <path d="M40 45C40 38 45 35 50 35C55 35 60 38 60 45C60 52 55 55 50 55C45 55 40 52 40 45Z" fill="#00338D" />
            <circle cx="50" cy="40" r="5" fill="#FFD100" />
            <circle cx="45" cy="48" r="4" fill="#FFD100" />
            <circle cx="55" cy="48" r="4" fill="#FFD100" />
          </svg>
          <div>
            <span className="text-2xl font-black tracking-tighter text-dswd-blue block leading-none">DSWD</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">Beneficiary System</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition relative ${isActive
                    ? 'bg-dswd-lightBlue text-white shadow-lg shadow-blue-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    3
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="mt-8 space-y-4 pt-4 border-t border-slate-100">
        {/* DSWD Tagline Badge */}
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-4 text-center space-y-3 shadow-sm">
          <div className="flex justify-center">
            <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" fill="#00338D" opacity="0.1"/>
              <path d="M50 85C50 85 82 62 82 40C82 18 60 8 50 28C40 8 18 18 18 40C18 62 50 85 50 85Z" fill="#FFD100" />
              <path d="M50 25C40 25 32 32 32 45C32 60 50 75 50 75C50 75 68 60 68 45C68 32 60 25 50 25Z" fill="#E30613" />
              <circle cx="50" cy="42" r="8" fill="#00338D" />
              <circle cx="43" cy="52" r="6" fill="#00338D" />
              <circle cx="57" cy="52" r="6" fill="#00338D" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-extrabold text-slate-800 leading-tight">
              Maagap at Mapagkalingang<br/>Serbisyo!
            </p>
            <div className="w-10 h-1 bg-gradient-to-r from-dswd-blue via-dswd-red to-dswd-yellow mx-auto rounded-full" />
          </div>
        </div>

        {/* Logout Trigger */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}

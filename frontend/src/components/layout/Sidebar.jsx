import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, Users, MapPin, ListChecks, BarChart3, UserCog, MessageSquare,
  Smartphone, Package, FileText, Award, FileCheck, Bell, HelpCircle, Settings, Megaphone, HandHeart,
  Stethoscope, CalendarCheck, FileHeart, ScrollText, Server, ShieldCheck, ChevronDown, X, Accessibility
} from 'lucide-react';

const staffNavItems = [
  // ── Overview ──
  { path: '/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },

  // ── Community Master Records ──
  { path: '/dashboard/beneficiaries', label: 'Beneficiaries', icon: Users, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },
  { path: '/dashboard/barangays', label: 'Barangays', icon: MapPin, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'senior_citizen_staff', 'pwd_staff', 'staff', 'barangay'] },

  // ── Social Welfare & Assistance Services ──
  { path: '/dashboard/programs', label: 'Programs', icon: ListChecks, roles: ['admin', 'staff', 'barangay'] },
  { path: '/dashboard/distributions', label: 'Distributions', icon: Package, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },
  { path: '/dashboard/rfid-scanner', label: 'Distribution Scanner', icon: Smartphone, roles: ['staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },
  { path: '/dashboard/rfid-attendance', label: 'Attendance Scanner', icon: Smartphone, roles: ['staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },
  { path: '/dashboard/assistance-requests', label: 'Assistance Requests', icon: HandHeart, roles: ['admin', 'mswdo_admin', 'mswdo_staff', 'staff', 'barangay'] },
  { path: '/dashboard/interventions-management', label: 'Interventions', icon: FileHeart, roles: ['admin', 'staff', 'barangay'] },

  // ── Communication & Community ──
  { path: '/dashboard/announcements', label: 'Announcements', icon: Megaphone, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },
  { path: '/dashboard/messages', label: 'Messages', icon: MessageSquare, badge: 'messages', roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },

  // ── Analytics & System Administration ──
  { path: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'barangay'] },
  { path: '/dashboard/users', label: 'Users', icon: UserCog, roles: ['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'staff', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'] },
  { 
    path: '/dashboard/logs', 
    label: 'Logs', 
    icon: ScrollText, 
    roles: ['admin'],
    subItems: [
      { path: '/dashboard/logs/system', label: 'System Log', icon: Server },
      { path: '/dashboard/logs/sms', label: 'SMS Log', icon: Smartphone },
      { path: '/dashboard/logs/audit', label: 'Audit Logs', icon: ShieldCheck },
    ]
  },
];

const beneficiaryNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home, requiresApproval: false, section: 'main' },
  { path: '/dashboard/attendance', label: 'My Attendance', icon: CalendarCheck, requiresApproval: true, section: 'main' },
  { path: '/dashboard/my-benefits', label: 'My Assistance', icon: HandHeart, requiresApproval: true, section: 'main' },
  { path: '/dashboard/request-assistance', label: 'Request Assistance', icon: FileText, requiresApproval: true, section: 'main' },
  { path: '/dashboard/my-interventions', label: 'My Interventions', icon: FileHeart, requiresApproval: true, section: 'main' },
  { path: '/dashboard/messages', label: 'Messages', icon: MessageSquare, badge: 'messages', requiresApproval: true, section: 'main' },
  { path: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: 'notifications', requiresApproval: true, section: 'main' },
];

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLogsActive = location.pathname.startsWith('/dashboard/logs') || 
                       location.pathname.startsWith('/dashboard/sms') || 
                       location.pathname.startsWith('/dashboard/system') || 
                       location.pathname.startsWith('/dashboard/audit');
  const [logsOpen, setLogsOpen] = React.useState(true);

  React.useEffect(() => {
    if (!mobileOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  React.useEffect(() => {
    if (isLogsActive) {
      setLogsOpen(true);
    }
  }, [isLogsActive]);

  const [beneficiaryStatus, setBeneficiaryStatus] = React.useState(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = React.useState(0);

  // Fetch unread notification and message counts
  React.useEffect(() => {
    const fetchCounts = async () => {
      if (user) {
        try {
          const { notificationApi, messageApi } = await import('../../services/api');
          const [notifRes, msgRes] = await Promise.allSettled([
            notificationApi.unreadCount(),
            messageApi.unreadCount(),
          ]);
          if (notifRes.status === 'fulfilled') {
            setUnreadCount(notifRes.value.data?.data?.count || 0);
          }
          if (msgRes.status === 'fulfilled') {
            setUnreadMessageCount(msgRes.value.data?.data?.count || 0);
          }
        } catch (err) {
          console.error('Failed to fetch unread counts in sidebar:', err);
        }
      }
    };

    if (user) {
      fetchCounts();
      const handleNotifUpdate = () => fetchCounts();
      const handleMsgUpdate = () => fetchCounts();
      window.addEventListener('notificationsUpdated', handleNotifUpdate);
      window.addEventListener('messagesUpdated', handleMsgUpdate);
      const interval = setInterval(fetchCounts, 15000);
      return () => {
        window.removeEventListener('notificationsUpdated', handleNotifUpdate);
        window.removeEventListener('messagesUpdated', handleMsgUpdate);
        clearInterval(interval);
      };
    }
  }, [user]);

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

  const isBeneficiary = user?.role === 'beneficiary';
  const isInactiveBeneficiary = isBeneficiary && user?.status === 'inactive';
  const isApprovedBeneficiary = isBeneficiary && beneficiaryStatus === 'Approved' && !isInactiveBeneficiary;
  
  // Filter beneficiary nav items based on approval status and inactivity
  let beneficiaryNav;
  if (isInactiveBeneficiary) {
    beneficiaryNav = [
      { path: '/dashboard', label: 'Account Inactive', icon: Home, requiresApproval: false, section: 'main' }
    ];
  } else if (isApprovedBeneficiary) {
    beneficiaryNav = beneficiaryNavItems.filter(item => !item.hideWhenApproved);
  } else {
    beneficiaryNav = beneficiaryNavItems.filter(item => !item.requiresApproval);
  }
  
  const navItems = isBeneficiary 
    ? beneficiaryNav
    : staffNavItems.filter(item => item.roles.includes(user?.role));

  const renderBadge = (item) => {
    if (item.badge === 'messages' || item.path === '/dashboard/messages') {
      if (unreadMessageCount > 0) {
        return (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
          </span>
        );
      }
    } else if (item.badge === 'notifications' || item.badge === true || item.path === '/dashboard/notifications') {
      if (unreadCount > 0) {
        return (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        );
      }
    }
    return null;
  };

  return (
    <>
    {mobileOpen && (
      <button
        type="button"
        onClick={onClose}
        aria-label="Close navigation menu"
        className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
      />
    )}
    <aside
      id="mobile-navigation-panel"
      role={mobileOpen ? 'dialog' : undefined}
      aria-modal={mobileOpen ? 'true' : undefined}
      aria-label="Main navigation"
      className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 max-w-[90vw] shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 shadow-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:bottom-auto lg:left-auto lg:z-auto lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-none ${mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'}`}
    >
      <div className="space-y-8 pr-1">
        {/* DSWD Brand Header */}
        <div className="flex items-center gap-3">
          <img src="/beniaid-logo.png" alt="BeniAid logo" className="w-10 h-10 shrink-0 rounded-full object-contain bg-white shadow-xs" />
          <div>
            <span className="text-2xl font-black tracking-tighter text-dswd-blue block leading-none">BeniAid</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">Beneficiary System</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="ml-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        {isBeneficiary ? (
          <>
            {/* MAIN Section */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">MAIN</h3>
              <nav className="space-y-1">
                {navItems.filter(item => item.section === 'main').map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/dashboard'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition relative ${isActive
                          ? 'bg-dswd-lightBlue text-white shadow-lg shadow-blue-100'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.label}
                      {renderBadge(item)}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* ACCOUNT Section */}
            {navItems.filter(item => item.section === 'account').length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">ACCOUNT</h3>
                <nav className="space-y-1">
                  {navItems.filter(item => item.section === 'account').map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive
                            ? 'bg-dswd-lightBlue text-white shadow-lg shadow-blue-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          }`
                        }
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {item.label}
                        {renderBadge(item)}
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            )}
          </>
        ) : (
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;

              if (item.subItems && item.subItems.length > 0) {
                const isChildActive = item.subItems.some(sub => location.pathname === sub.path) || 
                                      location.pathname.startsWith('/dashboard/logs') ||
                                      location.pathname.startsWith('/dashboard/system-logs') ||
                                      location.pathname.startsWith('/dashboard/sms-logs') ||
                                      location.pathname.startsWith('/dashboard/audit-logs');
                return (
                  <div key={item.path} className="space-y-1 pt-1">
                    <div
                      onClick={() => setLogsOpen(!logsOpen)}
                      className={`flex items-center justify-between gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition cursor-pointer select-none ${
                        isChildActive
                          ? 'bg-blue-50 text-dswd-blue font-bold border border-blue-100'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 text-slate-400 ${
                          logsOpen ? 'rotate-180 text-dswd-blue' : ''
                        }`}
                      />
                    </div>
                    {logsOpen && (
                      <div className="pl-4 pr-1 space-y-1 border-l-2 border-slate-100 ml-5 my-1">
                        {item.subItems.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = location.pathname === sub.path || 
                            (sub.path === '/dashboard/logs/system' && (location.pathname === '/dashboard/system-logs' || (location.pathname === '/dashboard/logs' && !location.search.includes('tab=')))) ||
                            (sub.path === '/dashboard/logs/sms' && (location.pathname === '/dashboard/sms' || location.pathname === '/dashboard/sms-logs' || location.search.includes('tab=sms'))) ||
                            (sub.path === '/dashboard/logs/audit' && (location.pathname === '/dashboard/audit-logs' || location.search.includes('tab=audit')));
                          return (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              onClick={onClose}
                              className={() =>
                                `flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  isSubActive
                                    ? 'bg-dswd-lightBlue text-white shadow-md shadow-blue-100 font-bold'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`
                              }
                            >
                              <SubIcon className="h-4 w-4 shrink-0" />
                              <span>{sub.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition relative ${isActive
                      ? 'bg-dswd-lightBlue text-white shadow-lg shadow-blue-100'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                  {renderBadge(item)}
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>

      {/* Footer Area */}
      <div className="mt-8 pt-4 border-t border-slate-100">
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
      </div>
    </aside>
    </>
  );
}

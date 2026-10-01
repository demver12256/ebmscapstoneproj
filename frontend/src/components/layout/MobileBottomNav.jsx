import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  CalendarCheck,
  HandHeart,
  FileHeart,
  MessageSquare,
  Bell,
  Users,
  BarChart3,
} from 'lucide-react';

const beneficiaryItems = [
  { path: '/dashboard', label: 'Home', icon: Home, end: true },
  { path: '/dashboard/attendance', label: 'Attendance', icon: CalendarCheck },
  { path: '/dashboard/my-benefits', label: 'Assistance', icon: HandHeart },
  { path: '/dashboard/my-interventions', label: 'Intervention', icon: FileHeart },
  { path: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { path: '/dashboard/notifications', label: 'Alerts', icon: Bell },
];

const staffItems = [
  { path: '/dashboard', label: 'Home', icon: Home, end: true },
  { path: '/dashboard/beneficiaries', label: 'People', icon: Users },
  { path: '/dashboard/assistance-requests', label: 'Assistance', icon: HandHeart },
  { path: '/dashboard/interventions-management', label: 'Intervention', icon: FileHeart },
  { path: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { path: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const items = user?.role === 'beneficiary' ? beneficiaryItems : staffItems;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between overflow-x-auto">
        {items.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex min-w-[62px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                <span className="whitespace-nowrap">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

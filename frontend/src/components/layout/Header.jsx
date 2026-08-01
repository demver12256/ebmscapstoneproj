import { useAuth } from '../../context/AuthContext';
import { Search, Bell, Moon, ChevronDown } from 'lucide-react';

export default function Header() {
  const { user } = useAuth();

  // Generate initials for avatar
  const getInitials = () => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  };

  const getUserRoleLabel = () => {
    if (!user) return '';
    if (user.role === 'admin') return 'Administrator';
    if (user.role === 'staff') return 'Barangay Staff';
    if (user.role === 'barangay') return 'Barangay Captain';
    if (user.role === 'beneficiary') return 'Beneficiary Member';
    return user.role;
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Search Input Bar (DSWD dashboard inspired) */}
      <div className="relative w-80 max-w-xs sm:max-w-md hidden sm:block">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400" />
        </span>
        <input
          type="text"
          placeholder="Search anything..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-700 outline-none transition focus:bg-white focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100"
        />
        <kbd className="absolute right-3.5 top-2.5 hidden md:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-400">
          ⌘K
        </kbd>
      </div>
      <div className="sm:hidden text-lg font-bold text-dswd-blue tracking-tight">
        DSWD EBMS
      </div>

      {/* Right Side Header Items */}
      <div className="flex items-center gap-5 ml-auto">
        {/* Notifications Icon with count badge */}
        <button className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-dswd-red text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            3
          </span>
        </button>

        {/* Dark Mode Moon Icon */}
        <button className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition">
          <Moon className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Details & Avatar */}
        <div className="flex items-center gap-3">
          {/* Avatar (CSS styled as circular letter block or fallback) */}
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-dswd-blue to-dswd-lightBlue text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-slate-100 uppercase">
            {getInitials()}
          </div>
          <div className="hidden md:block text-left">
            <span className="text-sm font-bold text-slate-900 block leading-tight">
              {user ? `${user.first_name} ${user.last_name}` : 'Guest User'}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
              {getUserRoleLabel()}
            </span>
          </div>
          <button className="text-slate-400 hover:text-slate-600 transition">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

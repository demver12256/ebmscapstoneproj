import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { dashboardApi, beneficiaryApi, announcementApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, TrendingUp, FileText, 
  Clock, CheckCircle, XCircle,
  Activity, Target, Zap, Megaphone, Smartphone, HandHeart,
  ChevronRight, RefreshCw, Award, MapPin, Package
} from 'lucide-react';

const PesoIcon = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 3h6a5 5 0 0 1 0 10H6V3z" />
    <path d="M6 13v8" />
    <path d="M4 7.5h11" />
    <path d="M4 11.5h11" />
  </svg>
);

export default function ModernDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const isSeniorAdmin = user?.role === 'senior_citizen_admin' || user?.role === 'senior_citizen_staff';
  const isPwdAdmin = user?.role === 'pwd_admin' || user?.role === 'pwd_staff';
  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const isMswdoStaff = user?.role === 'mswdo_staff';
  const isAnyMswdo = isMswdoAdmin || isMswdoStaff;
  const isSectorAdmin = isAnyMswdo || isSeniorAdmin || isPwdAdmin;
  const canAccessPending = ['admin', 'senior_citizen_admin', 'pwd_admin', 'senior_citizen_staff', 'pwd_staff'].includes(user?.role);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const promises = [
        dashboardApi.summary(),
        dashboardApi.monthlyDistribution(),
        announcementApi.list(),
      ];
      if (canAccessPending) {
        promises.push(beneficiaryApi.listApplications());
      }
      if (canAccessPending) {
        promises.push(barangayApi.list());
      }
      const results = await Promise.all(promises);
      const summaryData = results[0].data?.data || results[0].data || {};
      const monthlyData = results[1].data?.data || results[1].data || [];
      const annData = results[2].data?.data || results[2].data || [];
      const appsData = (canAccessPending && results[3]) 
        ? (results[3].data?.data || results[3].data || []) 
        : [];
      const brgysData = (canAccessPending && results[4])
        ? (results[4].data?.data || results[4].data || [])
        : [];

      setSummary(summaryData);
      setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
      setAnnouncements(Array.isArray(annData) ? annData : []);
      setApplications(Array.isArray(appsData) ? appsData : []);
      setBarangays(Array.isArray(brgysData) ? brgysData : []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-blue-600 border-t-transparent"></div>
        <p className="text-xs font-medium text-slate-500">Loading overview...</p>
      </div>
    );
  }

  // Calculate trends
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: '+0%', isPositive: true };
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;
    return {
      value: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      isPositive
    };
  };

  const currentMonthData = monthly[monthly.length - 1] || {};
  const previousMonthData = monthly[monthly.length - 2] || {};
  
  const distributionTrend = calculateTrend(
    parseFloat(currentMonthData.total || 0),
    parseFloat(previousMonthData.total || 0)
  );

  const totalBeneficiaries = isSeniorAdmin
    ? (summary?.seniorCitizensCount || summary?.approvedCount || 0)
    : isPwdAdmin
      ? (summary?.pwdCount || summary?.approvedCount || 0)
      : isAnyMswdo
        ? ((summary?.seniorCitizensCount || 0) + (summary?.pwdCount || 0) || summary?.approvedCount || 0)
        : summary
          ? ((summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0) || summary.totalBeneficiaries || 0)
          : 0;
  const totalDistributedFunds = summary?.totalDistributedFunds || 0;

  const pendingApplicationsList = applications.filter(a => {
    const isPending = a.status === 'Pending Review' ||
      a.status === 'Under Review' ||
      a.status === 'pending' ||
      a.status === 'Pending' ||
      (a.status !== 'Approved' && a.status !== 'Rejected' && a.status !== 'Pending Submission');
    if (!isPending) return false;
    if (isSeniorAdmin) {
      return String(a.category || '').toLowerCase().includes('senior');
    }
    if (isPwdAdmin) {
      const c = String(a.category || '').toLowerCase();
      return c.includes('pwd') || c.includes('disabilit');
    }
    if (isAnyMswdo) {
      return false; // MSWDO does not manage applications
    }
    // DSWD Admin (admin): strictly 4Ps applications
    const c = String(a.category || '').toLowerCase();
    return c.includes('4ps') || c.includes('pantawid');
  });
  const pendingCount = (summary?.pendingApplications !== undefined && summary?.pendingApplications > 0)
    ? summary.pendingApplications
    : pendingApplicationsList.length;

  // Minimalist KPI Stat Cards Config
  const stats = isSeniorAdmin ? [
    {
      title: 'Senior Citizens',
      value: summary?.seniorCitizensCount || totalBeneficiaries,
      badge: 'Verified OSCA',
      trend: 'up',
      icon: Users,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      badgeBg: 'bg-rose-50 text-rose-700',
      onClick: () => navigate('/dashboard/beneficiaries?category=senior')
    },
    {
      title: 'Pension Distributions',
      value: summary?.totalDistributionEvents || 0,
      badge: summary?.totalDistributedFunds ? `₱${Number(summary.totalDistributedFunds).toLocaleString('en-PH')} released` : 'Social Pension',
      trend: 'up',
      icon: Package,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      badgeBg: 'bg-blue-50 text-blue-700',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Assembly Attendance',
      value: `${summary?.totalAttendanceRecords || 0}`,
      badge: `${summary?.attendanceTurnoutRate !== undefined ? summary.attendanceTurnoutRate : 100}% turnout`,
      trend: 'up',
      icon: Award,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      badgeBg: 'bg-emerald-50 text-emerald-700',
      onClick: () => navigate('/dashboard/attendance')
    },
    {
      title: 'Covered Barangays',
      value: barangays.length || 36,
      badge: 'Municipal Scope',
      trend: 'neutral',
      icon: MapPin,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      badgeBg: 'bg-purple-50 text-purple-700',
      onClick: () => navigate('/dashboard/barangays')
    }
  ] : isPwdAdmin ? [
    {
      title: 'PWD Beneficiaries',
      value: summary?.pwdCount || totalBeneficiaries,
      badge: 'Verified PDAO',
      trend: 'up',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      badgeBg: 'bg-blue-50 text-blue-700',
      onClick: () => navigate('/dashboard/beneficiaries?category=pwd')
    },
    {
      title: 'Disability Aid Events',
      value: summary?.totalDistributionEvents || 0,
      badge: summary?.totalDistributedFunds ? `₱${Number(summary.totalDistributedFunds).toLocaleString('en-PH')} released` : 'PDAO Aid',
      trend: 'up',
      icon: Package,
      iconBg: 'bg-teal-50 text-teal-600 border border-teal-100',
      badgeBg: 'bg-teal-50 text-teal-700',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Meeting Attendance',
      value: `${summary?.totalAttendanceRecords || 0}`,
      badge: `${summary?.attendanceTurnoutRate !== undefined ? summary.attendanceTurnoutRate : 100}% turnout`,
      trend: 'up',
      icon: Award,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      badgeBg: 'bg-emerald-50 text-emerald-700',
      onClick: () => navigate('/dashboard/attendance')
    },
    {
      title: 'Covered Barangays',
      value: barangays.length || 36,
      badge: 'Municipal Scope',
      trend: 'neutral',
      icon: MapPin,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      badgeBg: 'bg-purple-50 text-purple-700',
      onClick: () => navigate('/dashboard/barangays')
    }
  ] : isMswdoAdmin ? [
    {
      title: 'Municipal Beneficiaries',
      value: totalBeneficiaries,
      badge: `${totalBeneficiaries} approved`,
      trend: 'up',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      badgeBg: 'bg-blue-50 text-blue-700',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Aid Distributions',
      value: summary?.totalDistributionEvents || 0,
      badge: summary?.totalDistributedFunds ? `₱${Number(summary.totalDistributedFunds).toLocaleString('en-PH')} released` : `${summary?.completedEvents || 0} completed`,
      trend: 'up',
      icon: Package,
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      badgeBg: 'bg-indigo-50 text-indigo-700',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Event Attendance',
      value: `${summary?.totalAttendanceRecords || 0}`,
      badge: `${summary?.attendanceTurnoutRate !== undefined ? summary.attendanceTurnoutRate : 100}% turnout`,
      trend: 'up',
      icon: Award,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      badgeBg: 'bg-emerald-50 text-emerald-700',
      onClick: () => navigate('/dashboard/attendance')
    },
    {
      title: 'Covered Barangays',
      value: barangays.length || 36,
      badge: 'Municipal Scope',
      trend: 'neutral',
      icon: MapPin,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      badgeBg: 'bg-purple-50 text-purple-700',
      onClick: () => navigate('/dashboard/barangays')
    },
    {
      title: 'Assistance Requests',
      value: summary?.totalAssistanceRequests || 0,
      badge: summary?.pendingAssistanceRequests > 0 ? `${summary.pendingAssistanceRequests} pending` : (summary?.completedAssistanceRequests > 0 ? `${summary.completedAssistanceRequests} completed` : 'Municipal Aid'),
      trend: 'neutral',
      icon: HandHeart,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      badgeBg: 'bg-amber-50 text-amber-700',
      onClick: () => navigate('/dashboard/assistance-requests')
    }
  ] : isMswdoStaff ? [
    {
      title: 'Municipal Beneficiaries',
      value: totalBeneficiaries,
      badge: `${totalBeneficiaries} verified`,
      trend: 'up',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      badgeBg: 'bg-blue-50 text-blue-700',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Aid Distributions',
      value: summary?.totalDistributionEvents || 0,
      badge: `${summary?.completedEvents || 0} completed`,
      trend: 'up',
      icon: Package,
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      badgeBg: 'bg-indigo-50 text-indigo-700',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Event Attendance',
      value: `${summary?.totalAttendanceRecords || 0}`,
      badge: `${summary?.attendanceTurnoutRate !== undefined ? summary.attendanceTurnoutRate : 100}% turnout`,
      trend: 'up',
      icon: Award,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      badgeBg: 'bg-emerald-50 text-emerald-700',
      onClick: () => navigate('/dashboard/rfid-attendance')
    },
    {
      title: 'Covered Barangays',
      value: barangays.length || 36,
      badge: 'Municipal Scope',
      trend: 'neutral',
      icon: MapPin,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      badgeBg: 'bg-purple-50 text-purple-700',
      onClick: () => navigate('/dashboard/barangays')
    },
    {
      title: 'Assistance Requests',
      value: summary?.totalAssistanceRequests || 0,
      badge: summary?.pendingAssistanceRequests > 0 ? `${summary.pendingAssistanceRequests} pending` : 'Municipal Aid',
      trend: 'neutral',
      icon: HandHeart,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      badgeBg: 'bg-amber-50 text-amber-700',
      onClick: () => navigate('/dashboard/assistance-requests')
    }
  ] : [
    {
      title: 'Total Beneficiaries',
      value: totalBeneficiaries,
      badge: summary?.approvedCount !== undefined ? `${summary.approvedCount} approved` : '+0%',
      trend: 'up',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
      badgeBg: 'bg-blue-50 text-blue-700',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Active Programs',
      value: summary?.totalPrograms || 0,
      badge: summary?.totalDistributionEvents !== undefined ? `${summary.totalDistributionEvents} events` : '0',
      trend: 'up',
      icon: Target,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
      badgeBg: 'bg-purple-50 text-purple-700',
      onClick: () => navigate('/dashboard/programs')
    },
    {
      title: 'Total Distributed',
      value: `₱${Number(totalDistributedFunds || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`,
      badge: distributionTrend.value,
      trend: distributionTrend.isPositive ? 'up' : 'down',
      icon: PesoIcon,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      badgeBg: distributionTrend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Approved Beneficiaries',
      value: summary?.approvedCount || totalBeneficiaries,
      badge: 'Verified',
      trend: 'up',
      icon: CheckCircle,
      iconBg: 'bg-teal-50 text-teal-600 border border-teal-100',
      badgeBg: 'bg-teal-50 text-teal-700',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    ...(['admin'].includes(user?.role) ? [{
      title: 'Pending Beneficiaries',
      value: pendingCount,
      badge: pendingApplicationsList.length > 0 ? `${pendingApplicationsList.length} queued` : 'None',
      trend: 'neutral',
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      badgeBg: 'bg-amber-50 text-amber-700',
      onClick: () => navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } })
    }] : [{
      title: 'Assistance Requests',
      value: summary?.pendingAssistanceRequests || 0,
      badge: 'Barangay aid',
      trend: 'neutral',
      icon: HandHeart,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      badgeBg: 'bg-amber-50 text-amber-700',
      onClick: () => navigate('/dashboard/assistance-requests')
    }])
  ];

  const categoryData = isSeniorAdmin ? [
    { name: 'Senior Pensioners', value: summary?.seniorCitizensCount || summary?.approvedCount || 1, color: '#E11D48' },
    { name: 'Pending Applications', value: pendingApplicationsList.length, color: '#F59E0B' }
  ] : isPwdAdmin ? [
    { name: 'PWD Beneficiaries', value: summary?.pwdCount || summary?.approvedCount || 1, color: '#2563EB' },
    { name: 'Pending Applications', value: pendingApplicationsList.length, color: '#F59E0B' }
  ] : isAnyMswdo ? [
    { name: 'Senior Citizens (OSCA)', value: summary?.seniorCitizensCount || 0, color: '#E11D48' },
    { name: 'Persons with Disabilities (PDAO)', value: summary?.pwdCount || 0, color: '#F59E0B' },
    ...(pendingApplicationsList.length > 0 ? [{ name: 'Pending Applications', value: pendingApplicationsList.length, color: '#3B82F6' }] : [])
  ] : [
    { name: '4Ps Program', value: summary?.fourPsCount || 0, color: '#2563EB' },
    { name: 'Senior Citizens', value: summary?.seniorCitizensCount || 0, color: '#E11D48' },
    { name: 'PWD Program', value: summary?.pwdCount || 0, color: '#F59E0B' }
  ];

  const totalCategorySum = categoryData.reduce((acc, cur) => acc + cur.value, 0) || 1;

  // Filtered applications by sector
  const filteredAppsForActivity = applications.filter(app => {
    if (isSeniorAdmin) return String(app.category || '').toLowerCase().includes('senior');
    if (isPwdAdmin) {
      const c = String(app.category || '').toLowerCase();
      return c.includes('pwd') || c.includes('disabilit');
    }
    if (isAnyMswdo) {
      const c = String(app.category || '').toLowerCase();
      return (c.includes('senior') || c.includes('pwd') || c.includes('disabilit')) && !c.includes('4ps') && !c.includes('pantawid');
    }
    return true;
  });

  // Recent applications activity
  const recentActivity = filteredAppsForActivity.slice(0, 5).map(app => {
    if (app.status === 'Approved') {
      return {
        type: 'approval',
        name: `${app.first_name || ''} ${app.last_name || ''}`,
        action: 'Application Approved',
        time: formatTimeAgo(app.updated_at),
        icon: CheckCircle,
        iconBg: 'bg-emerald-50 text-emerald-600',
        id: app.id
      };
    } else if (app.status === 'Rejected') {
      return {
        type: 'rejection',
        name: `${app.first_name || ''} ${app.last_name || ''}`,
        action: 'Application Rejected',
        time: formatTimeAgo(app.updated_at),
        icon: XCircle,
        iconBg: 'bg-rose-50 text-rose-600',
        id: app.id
      };
    } else {
      return {
        type: 'pending',
        name: `${app.first_name || ''} ${app.last_name || ''}`,
        action: 'New Application Submitted',
        time: formatTimeAgo(app.created_at),
        icon: Clock,
        iconBg: 'bg-amber-50 text-amber-600',
        id: app.id
      };
    }
  });

  const monthlyDistributionData = monthly.map(item => ({
    month: item.month || '',
    amount: parseFloat(item.total || 0),
    count: item.count || 0
  }));

  const defaultBarangaysList = [
    { id: 1, barangay_name: 'Poblacion 1' },
    { id: 2, barangay_name: 'Poblacion 2' },
    { id: 3, barangay_name: 'Poblacion 3' },
    { id: 4, barangay_name: 'Poblacion 4' },
    { id: 5, barangay_name: 'Balateros' },
    { id: 6, barangay_name: 'Dulangan' },
    { id: 7, barangay_name: 'Palangan' },
    { id: 8, barangay_name: 'Sabang' },
    { id: 9, barangay_name: 'San Isidro' },
    { id: 10, barangay_name: 'Tabinay' },
  ];

  const barangayChartData = (barangays.length > 0 ? barangays : defaultBarangaysList).map(b => {
    const match = (summary?.barangayCounts || []).find(bc => Number(bc.barangay_id) === Number(b.id));
    return {
      barangay: (b.barangay_name || '').replace('Barangay ', 'Brgy. '),
      count: match ? Number(match.count) : 0,
    };
  });

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-slate-800">
          <p className="font-semibold text-slate-200 mb-0.5">{label}</p>
          <p className="text-white font-mono font-bold">
            ₱{payload[0].value.toLocaleString()}
          </p>
          {payload[0].payload.count > 0 && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Distributions: {payload[0].payload.count}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const processedAppsCount = Math.max(0, applications.length - (summary?.pendingApplications || 0));
  const progressPercent = applications.length > 0 
    ? Math.max(0, Math.min(100, Math.round((processedAppsCount / applications.length) * 100))) 
    : 100;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-[1600px] mx-auto">
      {/* ━━━ Minimalist Page Header ━━━ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
              {isSeniorAdmin ? 'OSCA Focus' : isPwdAdmin ? 'PDAO Focus' : isMswdoStaff ? 'MSWDO Staff' : isMswdoAdmin ? 'MSWDO Focus' : ['admin'].includes(user?.role) ? 'Admin Console' : 'Staff Portal'}
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user?.first_name || 'System'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSeniorAdmin
              ? 'Office of Senior Citizens Affairs (OSCA) — Social Pension, Welfare, and Assembly Overview.'
              : isPwdAdmin
                ? 'Persons with Disability Affairs Office (PDAO) — Disability Welfare, Inclusion, and Assistive Services.'
                : isMswdoStaff
                  ? 'Municipal Social Welfare Operations — Field verification, physical claiming & attendance.'
                  : isMswdoAdmin 
                    ? 'Senior Citizens and Persons with Disabilities (PWD) social protection overview.' 
                    : 'Real-time overview of municipal beneficiaries, programs, and aid distributions.'}
          </p>
        </div>

        {/* Minimalist Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs active:scale-95"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs active:scale-95"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Reports</span>
          </button>
        </div>
      </div>

      {/* ━━━ Optional Announcements Alert Banner (Minimalist) ━━━ */}
      {!canAccessPending && announcements.filter(a => a.status === 'published').length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Megaphone className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs font-medium truncate">
              <span className="font-bold text-blue-900">Upcoming Announcements:</span>{' '}
              {announcements.filter(a => a.status === 'published')[0]?.title}
            </p>
          </div>
          <Link
            to="/dashboard/announcements"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 shrink-0 inline-flex items-center gap-1"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ━━━ Minimalist KPI Metric Cards ━━━ */}
      <div className={`grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 ${stats.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-3 sm:gap-4`}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <button
              key={index}
              onClick={stat.onClick}
              className="group flex min-w-0 flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:p-4"
            >
              {/* Top Row: Icon + Badge */}
              <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stat.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`inline-flex min-w-0 max-w-[70%] items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ${stat.badgeBg}`}>
                  {stat.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                  {stat.trend === 'down' && <TrendingUp className="w-3 h-3 rotate-180" />}
                  <span className="truncate">{stat.badge}</span>
                </span>
              </div>

              {/* Bottom Row: Large Value + Title */}
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors truncate">
                  {stat.value}
                </p>
                <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs font-medium text-slate-500">
                  {stat.title}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ━━━ Middle Grid: Distribution Trend Chart & Category Breakdown ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Monthly Trend Area Chart or Barangay Beneficiary Chart for MSWDO */}
        <div className="lg:col-span-8 p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isSeniorAdmin 
                  ? 'Senior Citizens Registry by Barangay' 
                  : isPwdAdmin 
                    ? 'PWD Registry by Barangay' 
                    : isAnyMswdo 
                      ? 'Municipal Beneficiary Registry by Barangay' 
                      : 'Monthly Distribution Trend'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSeniorAdmin
                  ? 'Verified senior citizen social pension beneficiaries across barangays'
                  : isPwdAdmin
                    ? 'Verified persons with disabilities across barangays'
                    : isAnyMswdo
                      ? 'Verified Senior Citizen and PWD municipal beneficiaries across barangays'
                      : 'Disbursement volume and history over time'}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>{isSectorAdmin ? 'Beneficiaries' : 'Amount'}</span>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {isSectorAdmin ? (
                <BarChart data={barangayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis 
                    dataKey="barangay" 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94A3B8" 
                    style={{ fontSize: '10px', fontWeight: 500 }}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94A3B8" 
                    style={{ fontSize: '11px', fontWeight: 500 }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl border border-slate-800">
                          <p className="font-bold text-slate-200">{data.barangay}</p>
                          <p className="text-blue-300 font-semibold mt-0.5">{data.count} Beneficiaries</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={monthlyDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="minimalColorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94A3B8" 
                    style={{ fontSize: '11px', fontWeight: 500 }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    stroke="#94A3B8" 
                    style={{ fontSize: '11px', fontWeight: 500 }} 
                    tickFormatter={(val) => `₱${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#2563EB" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#minimalColorAmount)" 
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Donut Chart */}
        <div className="lg:col-span-4 p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isSeniorAdmin ? 'OSCA Sector Demographics' : isPwdAdmin ? 'PDAO Sector Demographics' : isAnyMswdo ? 'MSWDO Sector Demographics' : 'Category Distribution'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSeniorAdmin ? 'Senior citizen social pension status' : isPwdAdmin ? 'PWD registry status' : isAnyMswdo ? 'Senior Citizen (OSCA) & PWD (PDAO) roster breakdown' : 'Beneficiary roster breakdown'}
            </p>
          </div>

          <div className="h-[170px] w-full my-1 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={categoryData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={52} 
                  outerRadius={72} 
                  paddingAngle={4} 
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center metric */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-black text-slate-900 leading-none">{totalBeneficiaries}</span>
              <span className="text-[10px] text-slate-400 font-medium">Total</span>
            </div>
          </div>

          {/* Minimalist Legend List */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {categoryData.map((cat, index) => {
              const pct = Math.round((cat.value / totalCategorySum) * 100);
              return (
                <div key={index} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-slate-600 font-medium truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900">{cat.value}</span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ━━━ Bottom Grid: Recent Activity & Quick Operations ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Recent Applications Activity */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Applications & Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest registrations submitted by citizens</p>
            </div>
            {canAccessPending && (
              <button 
                onClick={() => navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } })} 
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition inline-flex items-center gap-1"
              >
                Review Pending <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 my-2">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-center gap-3 py-2.5 px-1 hover:bg-slate-50/80 rounded-lg transition">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${activity.iconBg}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{activity.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{activity.action}</p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 shrink-0">{activity.time}</span>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                No recent activity records found
              </div>
            )}
          </div>

          <div className="pt-2 text-right">
            <button
              onClick={() => navigate('/dashboard/beneficiaries')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
            >
              View Beneficiary Roster →
            </button>
          </div>
        </div>

        {/* Quick Operations & Application Verification Progress */}
        <div className="lg:col-span-5 p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Zap className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Quick Operations</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                ...(isSeniorAdmin ? [
                  { label: 'Senior Citizen Records', icon: Users, path: '/dashboard/beneficiaries?category=senior' },
                  { label: 'Review Pending Seniors', icon: CheckCircle, path: '/dashboard/beneficiaries?pending=true&category=senior' },
                  { label: 'Social Pension Distributions', icon: Package, path: '/dashboard/distributions' },
                  { label: 'OSCA Announcements', icon: Megaphone, path: '/dashboard/announcements' },
                  { label: 'Barangays Directory', icon: MapPin, path: '/dashboard/barangays' },
                  { label: 'OSCA Reports', icon: FileText, path: '/dashboard/reports' }
                ] : isPwdAdmin ? [
                  { label: 'PWD Beneficiary Records', icon: Users, path: '/dashboard/beneficiaries?category=pwd' },
                  { label: 'Review Pending PWDs', icon: CheckCircle, path: '/dashboard/beneficiaries?pending=true&category=pwd' },
                  { label: 'PWD Aid Distributions', icon: Package, path: '/dashboard/distributions' },
                  { label: 'PDAO Announcements', icon: Megaphone, path: '/dashboard/announcements' },
                  { label: 'Barangays Directory', icon: MapPin, path: '/dashboard/barangays' },
                  { label: 'PDAO Reports', icon: FileText, path: '/dashboard/reports' }
                ] : isMswdoStaff ? [
                  { label: 'Physical Claiming (RFID)', icon: Smartphone, path: '/dashboard/rfid-scanner' },
                  { label: 'Assembly RFID Attendance', icon: Award, path: '/dashboard/rfid-attendance' },
                  { label: 'Municipal Beneficiaries', icon: Users, path: '/dashboard/beneficiaries' },
                  { label: 'Municipal Distributions', icon: Package, path: '/dashboard/distributions' },
                  { label: 'Assistance Requests', icon: HandHeart, path: '/dashboard/assistance-requests' },
                  { label: 'Active Announcements', icon: Megaphone, path: '/dashboard/announcements' }
                ] : isMswdoAdmin ? [
                  { label: 'Municipal Beneficiaries', icon: Users, path: '/dashboard/beneficiaries' },
                  { label: 'Review Pending', icon: CheckCircle, path: '/dashboard/beneficiaries?pending=true' },
                  { label: 'Municipal Aid Distributions', icon: Package, path: '/dashboard/distributions' },
                  { label: 'Assistance Requests', icon: HandHeart, path: '/dashboard/assistance-requests' },
                  { label: 'Announcements Management', icon: Megaphone, path: '/dashboard/announcements' },
                  { label: 'Municipal Reports', icon: FileText, path: '/dashboard/reports' }
                ] : [
                  { label: 'New Distribution', icon: PesoIcon, path: '/dashboard/distributions' },
                  ...(['admin'].includes(user?.role) ? [
                    { label: 'Review Pending', icon: CheckCircle, path: '/dashboard/beneficiaries?pending=true' }
                  ] : [
                    { label: 'RFID Scanner', icon: Smartphone, path: '/dashboard/rfid-scanner' }
                  ]),
                  { label: 'Manage Programs', icon: Target, path: '/dashboard/programs' },
                  { label: 'Audit Reports', icon: FileText, path: '/dashboard/reports' }
                ])
              ].map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={() => navigate(action.path)}
                    className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition text-left flex items-center gap-2.5 group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-white border border-slate-200/60 flex items-center justify-center shrink-0 text-slate-700 group-hover:text-blue-600 shadow-2xs">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verification Progress Box (Minimalist) */}
          {canAccessPending && (
            <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  Application Processing Rate
                </span>
                <span className="font-bold text-blue-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {applications.length > 0 
                  ? `${processedAppsCount} of ${applications.length} applications processed` 
                  : 'All applications up to date'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

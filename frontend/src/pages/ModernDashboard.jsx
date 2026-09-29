import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { dashboardApi, beneficiaryApi, announcementApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, TrendingUp, FileText, 
  Clock, CheckCircle, XCircle, Calendar,
  Activity, Award, Target, Zap, ArrowRight, Megaphone, Smartphone, MapPin, Package, HandHeart
} from 'lucide-react';

const PesoIcon = ({ className = "w-6 h-6" }) => (
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
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [dateRange, setDateRange] = useState('today');
  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const isSystemAdmin = user?.role === 'admin';

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const promises = [
        dashboardApi.summary(),
        dashboardApi.monthlyDistribution(),
        announcementApi.list(),
      ];
      if (['admin','mswdo_admin'].includes(user?.role)) {
        promises.push(beneficiaryApi.listApplications());
      }
      const results = await Promise.all(promises);
      const summaryData = results[0].data?.data || results[0].data || {};
      const monthlyData = results[1].data?.data || results[1].data || [];
      const annData = results[2].data?.data || results[2].data || [];
      const appsData = (['admin','mswdo_admin'].includes(user?.role) && results[3]) ? (results[3].data?.data || results[3].data || []) : [];

      setSummary(summaryData);
      setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
      setAnnouncements(Array.isArray(annData) ? annData : []);
      setApplications(Array.isArray(appsData) ? appsData : []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
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

  // Get previous month data for trends
  const currentMonthData = monthly[monthly.length - 1] || {};
  const previousMonthData = monthly[monthly.length - 2] || {};
  
  const distributionTrend = calculateTrend(
    parseFloat(currentMonthData.total || 0),
    parseFloat(previousMonthData.total || 0)
  );

  const totalBeneficiaries = summary
    ? ((summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0) || summary.totalBeneficiaries || 0)
    : 0;
  const totalDistributedFunds = summary?.totalDistributedFunds || 0;

  const pendingApplicationsList = applications.filter(a =>
    a.status === 'Pending Review' ||
    a.status === 'Under Review' ||
    a.status === 'pending' ||
    a.status === 'Pending' ||
    (a.status !== 'Approved' && a.status !== 'Rejected' && a.status !== 'Pending Submission')
  );
  const pendingCount = (summary?.pendingApplications !== undefined && summary?.pendingApplications > 0)
    ? summary.pendingApplications
    : pendingApplicationsList.length;

  // MSWDO stats: includes 4Ps, Senior & PWD municipal oversight
  const stats = isMswdoAdmin ? [
    {
      title: '4Ps Beneficiaries',
      value: summary?.fourPsCount || 0,
      change: `${summary?.fourPsCount || 0} enrolled`,
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-600 to-indigo-700',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-700',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Senior Citizens',
      value: summary?.seniorCitizensCount || 0,
      change: `${summary?.seniorCitizensCount || 0} approved`,
      trend: 'up',
      icon: Users,
      gradient: 'from-red-500 to-rose-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'PWD Beneficiaries',
      value: summary?.pwdCount || 0,
      change: `${summary?.pwdCount || 0} approved`,
      trend: 'up',
      icon: HandHeart,
      gradient: 'from-amber-500 to-yellow-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Total Beneficiaries',
      value: totalBeneficiaries,
      change: `${totalBeneficiaries} total`,
      trend: 'up',
      icon: Users,
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Approved Beneficiaries',
      value: summary?.approvedCount || totalBeneficiaries,
      change: 'Verified records',
      trend: 'up',
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Pending Approvals',
      value: pendingCount,
      change: pendingApplicationsList.length > 0 ? `${pendingApplicationsList.length} queued` : 'None',
      trend: 'neutral',
      icon: Clock,
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      onClick: () => navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } })
    }
  ] : [
    {
      title: 'Total Beneficiaries',
      value: totalBeneficiaries,
      change: summary?.approvedCount !== undefined ? `${summary.approvedCount} approved` : '+0%',
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'Active Programs',
      value: summary?.totalPrograms || 0,
      change: summary?.totalDistributionEvents !== undefined ? `${summary.totalDistributionEvents} events` : '0',
      trend: 'up',
      icon: Target,
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      onClick: () => navigate('/dashboard/programs')
    },
    {
      title: 'Total Distributed',
      value: `₱${Number(totalDistributedFunds || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
      change: distributionTrend.value,
      trend: distributionTrend.isPositive ? 'up' : 'down',
      icon: PesoIcon,
      gradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Approved Beneficiaries',
      value: summary?.approvedCount || totalBeneficiaries,
      change: 'Verified records',
      trend: 'up',
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    ...(['admin','mswdo_admin'].includes(user?.role) ? [{
      title: 'Pending Beneficiaries',
      value: pendingCount,
      change: pendingApplicationsList.length > 0 ? `${pendingApplicationsList.length} queued` : 'None',
      trend: 'neutral',
      icon: Clock,
      gradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      onClick: () => navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } })
    }] : [{
      title: 'Assistance Requests',
      value: summary?.pendingAssistanceRequests || 0,
      change: 'Barangay aid',
      trend: 'neutral',
      icon: HandHeart,
      gradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      onClick: () => navigate('/dashboard/assistance-requests')
    }])
  ];

  const categoryData = [
    { name: '4Ps Program', value: summary?.fourPsCount || 0, color: '#00338D' },
    { name: 'Senior Citizens', value: summary?.seniorCitizensCount || 0, color: '#E30613' },
    { name: 'PWD Program', value: summary?.pwdCount || 0, color: '#FFD100' }
  ];

  // Get recent applications for activity feed
  const recentActivity = applications.slice(0, 5).map(app => {
    if (app.status === 'Approved') {
      return {
        type: 'approval',
        name: `${app.first_name || ''} ${app.last_name || ''}`,
        action: 'Application Approved',
        time: formatTimeAgo(app.updated_at),
        icon: CheckCircle,
        color: 'text-green-600',
        id: app.id
      };
    } else if (app.status === 'Rejected') {
      return {
        type: 'rejection',
        name: `${app.first_name || ''} ${app.last_name || ''}`,
        action: 'Application Rejected',
        time: formatTimeAgo(app.updated_at),
        icon: XCircle,
        color: 'text-red-600',
        id: app.id
      };
    } else {
      return {
        type: 'pending',
        name: `${app.first_name || ''} ${app.last_name || ''}`,
        action: 'New Application',
        time: formatTimeAgo(app.created_at),
        icon: FileText,
        color: 'text-amber-600',
        id: app.id
      };
    }
  });

  const monthlyDistributionData = monthly.map(item => ({
    month: item.month || '',
    amount: parseFloat(item.total || 0),
    count: item.count || 0
  }));

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-700">
          <p className="font-semibold text-sm mb-1">{label}</p>
          <p className="text-sm">
            Amount: <span className="font-bold">₱{payload[0].value.toLocaleString()}</span>
          </p>
          {payload[0].payload.count && (
            <p className="text-xs text-slate-300">
              Distributions: {payload[0].payload.count}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/80 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.18)] backdrop-blur-sm">
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-[#0B1F4D] via-[#00338D] to-[#0E52C1] px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${isMswdoAdmin ? 'border-white/35 bg-white/15 text-white' : ['admin','mswdo_admin'].includes(user?.role) ? 'border-white/35 bg-white/15 text-white' : 'border-white/35 bg-white/15 text-white'}`}>
                    {isMswdoAdmin ? 'MSWDO FOCUS' : ['admin','mswdo_admin'].includes(user?.role) ? 'ADMIN CONSOLE' : 'STAFF PORTAL'}
                  </span>
                  <span className="text-xs text-blue-100">• Bongabong, Or. Mindoro</span>
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                    Welcome back, <span className="text-blue-100">{user?.first_name || 'User'}</span>
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-blue-100/90 sm:text-base">
                    {isMswdoAdmin ? 'MSWDO focus: Senior Citizens and Persons with Disabilities (PWD) welfare.' : 'Here is the real-time overview of beneficiaries, programs, payouts, and operational activity.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={loadDashboard}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  <Activity className="h-4 w-4" />
                  Refresh Data
                </button>
                <button
                  onClick={() => navigate('/dashboard/reports')}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-[#00338D] shadow-md transition hover:bg-blue-50"
                >
                  <FileText className="h-4 w-4" />
                  View Reports
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-6 lg:p-7">
            {!['admin','mswdo_admin'].includes(user?.role) && announcements.filter(a => a.status === 'published').length > 0 && (
              <div className="rounded-[24px] bg-gradient-to-r from-slate-900 via-indigo-950 to-[#103A8F] p-5 text-white shadow-[0_20px_50px_-20px_rgba(59,130,246,0.8)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-400 p-2 text-slate-950">
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black tracking-tight">Upcoming Activity Announcements</h2>
                      <p className="text-xs text-blue-200">Scheduled events requiring attendance facilitation</p>
                    </div>
                  </div>
                  <Link
                    to="/dashboard/announcements"
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 underline-offset-2 hover:underline"
                  >
                    View All ({announcements.filter(a => a.status === 'published').length}) <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {announcements.filter(a => a.status === 'published').slice(0, 2).map((ann) => (
                    <div
                      key={ann.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="rounded-full bg-amber-400/15 px-2 py-1 font-bold uppercase tracking-wide text-amber-200">
                          {ann.priority} priority
                        </span>
                        <span className="text-blue-100">
                          {ann.recipient_count || 0} beneficiaries
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-extrabold leading-snug text-white">{ann.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-blue-100/90">{ann.message}</p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
                        <div className="space-y-1 text-slate-200">
                          {ann.event_date && (
                            <div className="flex items-center gap-1.5 font-medium">
                              <Calendar className="h-3.5 w-3.5 text-amber-300" />
                              <span>{ann.event_date} {ann.event_time && `at ${ann.event_time}`}</span>
                            </div>
                          )}
                          {ann.venue && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <MapPin className="h-3.5 w-3.5 text-red-300" />
                              <span>{ann.venue}</span>
                            </div>
                          )}
                        </div>

                        {(user?.role === 'staff' || user?.role === 'barangay') ? (
                          <button
                            onClick={() => navigate(`/dashboard/announcement-scanner?id=${ann.id}`)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-md transition hover:brightness-105"
                          >
                            <Smartphone className="h-3.5 w-3.5" />
                            Start Attendance
                          </button>
                        ) : (
                          <Link
                            to="/dashboard/announcements"
                            className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/15"
                          >
                            View Details
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <button
                    key={index}
                    onClick={stat.onClick}
                    className="group relative h-full min-h-[180px] overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-[0_10px_30px_-18px_rgba(30,41,59,0.5)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_40px_-18px_rgba(37,99,235,0.35)]"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.06]`}></div>
                    <div className="relative flex h-full flex-col">
                      <div className="mb-4 flex items-start justify-between gap-2">
                        <div className={`rounded-2xl p-3 ${stat.iconBg}`}>
                          <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                        </div>
                        <div className={`inline-flex items-center gap-1 text-[11px] font-semibold ${stat.trend === 'up' ? 'text-emerald-600' : stat.trend === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
                          {stat.trend !== 'neutral' && <TrendingUp className={`h-3.5 w-3.5 ${stat.trend === 'down' ? 'rotate-180' : ''}`} />}
                          {stat.change}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-600">{stat.title}</p>
                        <p className="text-[2rem] font-extrabold leading-none tracking-tight text-slate-900">{stat.value}</p>
                      </div>

                      <div className="mt-auto flex items-center justify-end pt-3 text-blue-600 opacity-0 transition group-hover:opacity-100">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.42)] sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Monthly Distribution Trend</h3>
                    <p className="mt-1 text-sm text-slate-500">Performance over time</p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-xs font-semibold text-blue-700">Amount</span>
                  </div>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyDistributionData}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563EB" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="#64748B" style={{ fontSize: '12px', fontWeight: 600 }} />
                      <YAxis tickLine={false} axisLine={false} stroke="#64748B" style={{ fontSize: '12px', fontWeight: 600 }} tickFormatter={(value) => `₱${Number(value).toLocaleString()}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.42)] sm:p-6">
                <div className="mb-5">
                  <h3 className="text-lg font-black text-slate-900">Category Distribution</h3>
                  <p className="mt-1 text-sm text-slate-500">Beneficiary mix</p>
                </div>

                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={5} dataKey="value">
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-3">
                  {categoryData.map((cat, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{cat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.42)] sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Recent Activity</h3>
                  <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700">
                    View all <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((activity, index) => {
                      const Icon = activity.icon;
                      return (
                        <div key={index} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 transition hover:bg-slate-100/90">
                          <div className={`rounded-xl p-2 ${activity.color.replace('text-', 'bg-').replace('600', '100')}`}>
                            <Icon className={`h-5 w-5 ${activity.color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">{activity.name}</p>
                            <p className="text-xs text-slate-500">{activity.action}</p>
                          </div>
                          <span className="text-xs font-medium text-slate-400">{activity.time}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[180px] flex-col items-center justify-center text-center text-slate-500">
                    <Activity className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                )}
              </div>

              <div className="rounded-[26px] bg-gradient-to-br from-[#00338D] via-[#0A235E] to-[#0F1E41] p-5 text-white shadow-[0_20px_40px_-18px_rgba(15,23,42,0.9)] sm:p-6">
                <div className="mb-5 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-300" />
                  <h3 className="text-base font-black tracking-wide text-white">Quick Operations</h3>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'New Distribution Event', icon: PesoIcon, path: '/dashboard/distributions' },
                    ...(['admin','mswdo_admin'].includes(user?.role) ? [
                      { label: 'Review Applications', icon: CheckCircle, path: '/dashboard/beneficiaries?pending=true' }
                    ] : [
                      { label: 'Distribution Scanner', icon: Smartphone, path: '/dashboard/rfid-scanner' }
                    ]),
                    { label: 'Manage Programs', icon: Target, path: '/dashboard/programs' },
                    { label: 'View Reports & Audit', icon: FileText, path: '/dashboard/reports' }
                  ].map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => navigate(action.path)}
                        className="group flex w-full items-center gap-3 rounded-xl bg-white/8 px-3 py-3 text-left transition hover:bg-white/12"
                      >
                        <div className="rounded-lg bg-white/10 p-2">
                          <Icon className="h-4 w-4 text-blue-100" />
                        </div>
                        <span className="flex-1 text-xs font-semibold sm:text-sm text-white">{action.label}</span>
                        <ArrowRight className="h-4 w-4 text-white opacity-0 transition group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>

                {['admin','mswdo_admin'].includes(user?.role) && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <Award className="h-4 w-4 text-amber-300" />
                      <span className="text-xs font-bold text-white">Application Verification Progress</span>
                    </div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-amber-300 transition-all duration-500"
                          style={{
                            width: `${applications.length > 0 ? Math.max(0, Math.min(100, Math.round(((applications.length - (summary?.pendingApplications || 0)) / applications.length) * 100))) : 100}%`
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-amber-300">
                        {applications.length > 0 ? Math.max(0, Math.min(100, Math.round(((applications.length - (summary?.pendingApplications || 0)) / applications.length) * 100))) : 100}%
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-100">
                      {applications.length > 0 ? `${Math.max(0, applications.length - (summary?.pendingApplications || 0))} of ${applications.length} applications processed` : 'All applications processed!'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

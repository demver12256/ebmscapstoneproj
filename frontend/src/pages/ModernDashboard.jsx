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

  // MSWDO stats: primary focus on Senior & PWD, with 4Ps included
  const stats = isMswdoAdmin ? [
    {
      title: 'Senior Citizens',
      value: summary?.seniorCitizensCount || 0,
      change: `${summary?.seniorCitizensCount || 0} approved`,
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: 'PWD Beneficiaries',
      value: summary?.pwdCount || 0,
      change: `${summary?.pwdCount || 0} approved`,
      trend: 'up',
      icon: HandHeart,
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      onClick: () => navigate('/dashboard/beneficiaries')
    },
    {
      title: '4Ps Beneficiaries',
      value: summary?.fourPsCount || 0,
      change: `${summary?.fourPsCount || 0} approved`,
      trend: 'up',
      icon: Target,
      gradient: 'from-sky-500 to-blue-600',
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-600',
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
      title: 'Pending Approvals',
      value: pendingCount,
      change: pendingApplicationsList.length > 0 ? `${pendingApplicationsList.length} queued` : 'None',
      trend: 'neutral',
      icon: Clock,
      gradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
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

  const categoryData = isMswdoAdmin ? [
    { name: 'Senior Citizens', value: summary?.seniorCitizensCount || 0, color: '#E30613' },
    { name: 'PWD Program', value: summary?.pwdCount || 0, color: '#FFD100' },
    { name: '4Ps Program', value: summary?.fourPsCount || 0, color: '#00338D' }
  ] : [
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
    <div className="space-y-8 p-6 sm:p-8 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${isMswdoAdmin ? 'bg-purple-50 text-purple-700 border-purple-200' : ['admin','mswdo_admin'].includes(user?.role) ? 'bg-blue-50 text-[#00338D] border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              {isMswdoAdmin ? '🏥 MSWDO — Senior & PWD Focus' : ['admin','mswdo_admin'].includes(user?.role) ? '👑 Admin Console' : '🏢 Staff Portal'}
            </span>
            <span className="text-xs text-slate-400 font-medium">• Bongabong, Or. Mindoro</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, <span className="text-[#00338D]">{user?.first_name || 'User'}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{isMswdoAdmin ? 'MSWDO focus: Senior Citizens and Persons with Disabilities (PWD) welfare.' : 'Here is the real-time summary of beneficiaries, programs, and payouts.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadDashboard}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-slate-500" />
            Refresh Data
          </button>
          <button 
            onClick={() => navigate('/dashboard/reports')}
            className="px-5 py-2.5 rounded-xl bg-[#00338D] hover:bg-[#002566] text-white text-xs font-bold transition shadow-xs flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            View Reports
          </button>
        </div>
      </div>

      {/* UPCOMING ANNOUNCEMENTS & ACTIVITY FACILITATION WIDGET */}
      {!['admin','mswdo_admin'].includes(user?.role) && announcements.filter(a => a.status === 'published').length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-dswd-blue text-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-400 text-slate-950 rounded-xl">
                <Megaphone className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Upcoming Activity Announcements</h2>
                <p className="text-xs text-blue-200">Scheduled events requiring RFID beneficiary attendance facilitation</p>
              </div>
            </div>
            <Link
              to="/dashboard/announcements"
              className="text-xs font-bold text-yellow-300 hover:text-yellow-200 underline flex items-center gap-1"
            >
              View All ({announcements.filter(a => a.status === 'published').length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.filter(a => a.status === 'published').slice(0, 2).map((ann) => (
              <div
                key={ann.id}
                className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-4 flex flex-col justify-between gap-3 hover:bg-white/15 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="bg-yellow-400/20 text-yellow-300 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase">
                      {ann.priority} PRIORITY
                    </span>
                    <span className="text-blue-200 text-[11px]">
                      Expected: <strong className="text-white">{ann.recipient_count || 0} Beneficiaries</strong>
                    </span>
                  </div>
                  <h3 className="font-extrabold text-white text-base leading-snug">{ann.title}</h3>
                  <p className="text-xs text-blue-100 line-clamp-2">{ann.message}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs text-amber-200">
                  <div className="space-y-0.5">
                    {ann.event_date && (
                      <div className="flex items-center gap-1 font-semibold text-slate-100">
                        <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                        <span>{ann.event_date} {ann.event_time && `at ${ann.event_time}`}</span>
                      </div>
                    )}
                    {ann.venue && (
                      <div className="flex items-center gap-1 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span className="truncate max-w-[200px]">{ann.venue}</span>
                      </div>
                    )}
                  </div>

                  {(user?.role === 'staff' || user?.role === 'barangay') ? (
                    <button
                      onClick={() => navigate(`/dashboard/announcement-scanner?id=${ann.id}`)}
                      className="bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-xs shadow transition flex items-center gap-1.5 transform active:scale-95"
                    >
                      <Smartphone className="w-3.5 h-3.5 stroke-[2.5]" />
                      Start Attendance
                    </button>
                  ) : (
                    <Link
                      to="/dashboard/announcements"
                      className="bg-white/15 hover:bg-white/25 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5"
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

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isMswdoAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6`}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <button
              key={index}
              onClick={stat.onClick}
              className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300 overflow-hidden text-left w-full"
            >
              {/* Background Gradient Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-semibold ${
                    stat.trend === 'up' ? 'text-green-600' : 
                    stat.trend === 'down' ? 'text-red-600' : 
                    'text-slate-500'
                  }`}>
                    {stat.trend !== 'neutral' && (
                      <TrendingUp className={`w-4 h-4 ${stat.trend === 'down' ? 'rotate-180' : ''}`} />
                    )}
                    {stat.change}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-slate-600 font-medium mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>

                {/* Hover Arrow */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Distribution Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Monthly Distribution Trend</h3>
              <p className="text-sm text-slate-500 mt-1">Track distribution performance over time</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-sm text-slate-600 font-medium">Amount</span>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyDistributionData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis 
                dataKey="month" 
                stroke="#64748B"
                style={{ fontSize: '12px', fontWeight: '500' }}
              />
              <YAxis 
                stroke="#64748B"
                style={{ fontSize: '12px', fontWeight: '500' }}
                tickFormatter={(value) => `₱${Number(value).toLocaleString()}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#3B82F6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorAmount)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">Category Distribution</h3>
            <p className="text-sm text-slate-500 mt-1">Beneficiary breakdown</p>
          </div>
          
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1E293B', 
                  border: 'none', 
                  borderRadius: '12px',
                  color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-3">
            {categoryData.map((cat, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{cat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
            <button 
              onClick={() => navigate('/dashboard')}
              className="text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                return (
                  <div key={index} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className={`p-2 rounded-lg ${activity.color.replace('text-', 'bg-').replace('600', '100')}`}>
                      <Icon className={`w-5 h-5 ${activity.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{activity.name}</p>
                      <p className="text-xs text-slate-500">{activity.action}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{activity.time}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-[#00338D] to-[#0A192F] rounded-2xl p-6 shadow-md text-white border border-blue-900/30">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-[#FFD100]" />
            <h3 className="text-base font-bold text-white tracking-wide">Quick Operations</h3>
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
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition text-left group"
                >
                  <Icon className="w-4 h-4 text-blue-200" />
                  <span className="text-xs sm:text-sm font-semibold flex-1 text-white">{action.label}</span>
                  <ArrowRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>

          {['admin','mswdo_admin'].includes(user?.role) && (
            <div className="mt-6 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-[#FFD100]" />
                <span className="text-xs font-bold text-white">Application Verification Progress</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#FFD100] h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${applications.length > 0 ? 
                        Math.max(0, Math.min(100, Math.round(((applications.length - (summary?.pendingApplications || 0)) / applications.length) * 100))) 
                        : 100}%` 
                    }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-[#FFD100]">
                  {applications.length > 0 ? 
                    Math.max(0, Math.min(100, Math.round(((applications.length - (summary?.pendingApplications || 0)) / applications.length) * 100))) 
                    : 100}%
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                {applications.length > 0 ? 
                  `${Math.max(0, applications.length - (summary?.pendingApplications || 0))} of ${applications.length} applications processed` 
                  : 'All applications processed!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { dashboardApi, beneficiaryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, TrendingUp, DollarSign, FileText, 
  Clock, CheckCircle, XCircle, Calendar,
  Activity, Award, Target, Zap, ArrowRight
} from 'lucide-react';

export default function ModernDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [applications, setApplications] = useState([]);
  const [dateRange, setDateRange] = useState('today');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [summaryRes, monthlyRes, appsRes] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.monthlyDistribution(),
        beneficiaryApi.listApplications()
      ]);
      const summaryData = summaryRes.data?.data || summaryRes.data || {};
      const monthlyData = monthlyRes.data?.data || monthlyRes.data || [];
      const appsData = appsRes.data?.data || appsRes.data || [];

      setSummary(summaryData);
      setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
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

  const totalBeneficiaries = summary ? ((summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0) || summary.totalBeneficiaries || 0) : 0;
  const totalDistributedFunds = summary?.totalDistributedFunds || 0;

  const stats = [
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
      value: `₱${(totalDistributedFunds / 1000).toFixed(1)}k`,
      change: distributionTrend.value,
      trend: distributionTrend.isPositive ? 'up' : 'down',
      icon: DollarSign,
      gradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      onClick: () => navigate('/dashboard/distributions')
    },
    {
      title: 'Pending Applications',
      value: summary?.pendingApplications || 0,
      change: applications.length > 0 ? `${applications.length} queued` : 'None',
      trend: 'neutral',
      icon: Clock,
      gradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      onClick: () => navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } })
    }
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
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">{user?.first_name || 'User'}</span>
          </h1>
          <p className="text-slate-600 mt-1">Here's what's happening with your programs today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={loadDashboard}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
          <button 
            onClick={() => navigate('/dashboard/reports')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            View Reports
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
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
        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 shadow-xl text-white">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6" />
            <h3 className="text-lg font-bold">Quick Actions</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'New Distribution', icon: DollarSign, path: '/dashboard/distributions' },
              { label: 'Review Applications', icon: CheckCircle, path: '/dashboard/beneficiaries?pending=true' },
              { label: 'Manage Programs', icon: Target, path: '/dashboard/programs' },
              { label: 'View Reports', icon: FileText, path: '/dashboard/reports' }
            ].map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => navigate(action.path)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all text-left group"
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold flex-1">{action.label}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5" />
              <span className="text-sm font-bold">Today's Progress</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${applications.length > 0 ? 
                      Math.max(0, Math.min(100, Math.round(((applications.length - (summary?.pendingApplications || 0)) / applications.length) * 100))) 
                      : 100}%` 
                  }}
                ></div>
              </div>
              <span className="text-sm font-bold">
                {applications.length > 0 ? 
                  Math.max(0, Math.min(100, Math.round(((applications.length - (summary?.pendingApplications || 0)) / applications.length) * 100))) 
                  : 100}%
              </span>
            </div>
            <p className="text-xs opacity-90">
              {applications.length > 0 ? 
                `${Math.max(0, applications.length - (summary?.pendingApplications || 0))} of ${applications.length} applications processed` 
                : 'All applications processed!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

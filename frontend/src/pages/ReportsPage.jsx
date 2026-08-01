import { useState, useEffect } from 'react';
import { FileText, Calendar, Filter, X, Download, FileSpreadsheet, Printer, Eye } from 'lucide-react';
import { reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [reportType, setReportType] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Data states
  const [summary, setSummary] = useState({});
  const [programData, setProgramData] = useState([]);
  const [recentDistributions, setRecentDistributions] = useState([]);
  const [distributionStatus, setDistributionStatus] = useState([]);
  const [monthlyAid, setMonthlyAid] = useState([]);

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, programRes, distributionsRes, statusRes, monthlyRes] = await Promise.all([
        reportsApi.summary(),
        reportsApi.beneficiariesByProgram(),
        reportsApi.recentDistributions(),
        reportsApi.distributionStatus(),
        reportsApi.monthlyAid(),
      ]);

      setSummary(summaryRes.data.data || {});
      setProgramData(programRes.data.data || []);
      setRecentDistributions(distributionsRes.data.data || []);
      setDistributionStatus(statusRes.data.data || []);
      setMonthlyAid(monthlyRes.data.data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    loadReportData();
  };

  const resetFilters = () => {
    setReportType('');
    setProgramFilter('');
    setBarangayFilter('');
    setDateRange({
      start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
  };

  // Calculate percentages for charts - use same category data as Dashboard
  const getProgramChartData = () => {
    const data = [
      { name: '4Ps Program', count: summary.fourPsCount || 0 },
      { name: 'Senior Citizens', count: summary.seniorCitizensCount || 0 },
      { name: 'PWD Program', count: summary.pwdCount || 0 },
    ];
    const total = data.reduce((sum, p) => sum + p.count, 0);
    return data.map(p => ({
      ...p,
      percentage: total > 0 ? ((p.count / total) * 100).toFixed(1) : 0
    }));
  };

  const getStatusChartData = () => {
    const total = distributionStatus.reduce((sum, s) => sum + s.count, 0);
    return distributionStatus.map(s => ({
      status: s.status,
      count: s.count,
      percentage: total > 0 ? ((s.count / total) * 100).toFixed(1) : 0
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-600 mt-1">
            Generate and download accurate reports for monitoring, transparency, and decision-making
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Reports</option>
              <option value="beneficiary">Beneficiary Reports</option>
              <option value="distribution">Distribution Reports</option>
              <option value="financial">Financial Reports</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Program</label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Programs</option>
              {programData.map((p, idx) => (
                <option key={idx} value={p.program_name}>{p.program_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Barangay</label>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Barangays</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date Range</label>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={resetFilters}
            className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stats Cards - Same data as Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{(summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0)}</div>
          <div className="text-sm text-slate-600 mt-1">Total Beneficiaries</div>
          <div className="text-xs text-slate-500 mt-1">All Programs</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{summary.totalPrograms || 0}</div>
          <div className="text-sm text-slate-600 mt-1">Active Programs</div>
          <div className="text-xs text-slate-500 mt-1">All Programs</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{summary.pendingApplications || 0}</div>
          <div className="text-sm text-slate-600 mt-1">Pending Enrollments</div>
          <div className="text-xs text-slate-500 mt-1">Awaiting Review</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{summary.completedEvents || 0}</div>
          <div className="text-sm text-slate-600 mt-1">Distributions Completed</div>
          <div className="text-xs text-slate-500 mt-1">All Events</div>
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-900">{formatCurrency(summary.totalDistributedFunds || 0)}</div>
          <div className="text-sm text-amber-700 mt-1">Total Budget Distributed</div>
          <div className="text-xs text-amber-600 mt-1">All Time</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Beneficiaries by Program - Donut Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Program Distribution</h3>
          <div className="flex flex-col items-center">
            {/* Donut Chart */}
            <div className="relative w-48 h-48 mb-4">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                {(() => {
                  const data = getProgramChartData();
                  const total = data.reduce((sum, item) => sum + item.count, 0);
                  let currentAngle = 0;
                  const colors = ['#00338D', '#E30613', '#FFD100'];
                  
                  return data.map((item, idx) => {
                    const percentage = total > 0 ? (item.count / total) : 0;
                    const angle = percentage * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    currentAngle = endAngle;

                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    
                    const outerRadius = 90;
                    const innerRadius = 60;
                    
                    const x1 = 100 + outerRadius * Math.cos(startRad);
                    const y1 = 100 + outerRadius * Math.sin(startRad);
                    const x2 = 100 + outerRadius * Math.cos(endRad);
                    const y2 = 100 + outerRadius * Math.sin(endRad);
                    
                    const x3 = 100 + innerRadius * Math.cos(endRad);
                    const y3 = 100 + innerRadius * Math.sin(endRad);
                    const x4 = 100 + innerRadius * Math.cos(startRad);
                    const y4 = 100 + innerRadius * Math.sin(startRad);
                    
                    const largeArc = angle > 180 ? 1 : 0;
                    
                    const pathData = [
                      `M ${x1} ${y1}`,
                      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                      `L ${x3} ${y3}`,
                      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                      'Z'
                    ].join(' ');
                    
                    return percentage > 0 ? (
                      <path
                        key={idx}
                        d={pathData}
                        fill={colors[idx % colors.length]}
                        className="hover:opacity-80 transition-opacity"
                      />
                    ) : null;
                  });
                })()}
              </svg>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-slate-900">
                  {getProgramChartData().reduce((sum, item) => sum + item.count, 0)}
                </div>
                <div className="text-sm text-slate-500">Total</div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="w-full space-y-2">
              {getProgramChartData().slice(0, 5).map((item, idx) => {
                const colors = ['bg-[#00338D]', 'bg-[#E30613]', 'bg-[#FFD100]'];
                return (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]} flex-shrink-0`} />
                      <span className="text-slate-700 truncate" title={item.name}>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-slate-900 font-semibold">{item.count}</span>
                      <span className="text-slate-500">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Aid Distribution - Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Monthly Aid Distribution</h3>
          <div className="h-64 relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-slate-500">
              {(() => {
                const maxValue = Math.max(...monthlyAid.map(m => parseFloat(m.total || 0)), 1);
                const steps = [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];
                return steps.map((val, idx) => (
                  <div key={idx} className="text-right pr-2">
                    ₱{(val / 1000).toFixed(0)}K
                  </div>
                ));
              })()}
            </div>
            
            {/* Chart area */}
            <div className="absolute left-16 right-0 top-0 bottom-0">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map(idx => (
                  <div key={idx} className="border-t border-slate-100" />
                ))}
              </div>
              
              {/* Bars */}
              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-8">
                {monthlyAid.length > 0 ? monthlyAid.map((item, idx) => {
                  const maxValue = Math.max(...monthlyAid.map(m => parseFloat(m.total || 0)), 1);
                  const height = ((parseFloat(item.total || 0) / maxValue) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div className="relative flex-1 w-full flex items-end justify-center">
                        <div 
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-500 relative group-hover:shadow-lg"
                          style={{ height: `${height}%`, minHeight: height > 0 ? '8px' : '0' }}
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {formatCurrency(item.total)}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 mt-2 font-medium">{item.month}</div>
                    </div>
                  );
                }) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Status - Donut Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Distribution Status</h3>
          <div className="flex flex-col items-center">
            {/* Donut Chart */}
            <div className="relative w-48 h-48 mb-4">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                {(() => {
                  const data = getStatusChartData();
                  const total = data.reduce((sum, item) => sum + item.count, 0);
                  let currentAngle = 0;
                  const colorMap = {
                    'Completed': '#10B981',
                    'Ongoing': '#F59E0B',
                    'Scheduled': '#3B82F6',
                    'Cancelled': '#94A3B8'
                  };
                  
                  return data.map((item, idx) => {
                    const percentage = total > 0 ? (item.count / total) : 0;
                    const angle = percentage * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    currentAngle = endAngle;

                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    
                    const outerRadius = 90;
                    const innerRadius = 60;
                    
                    const x1 = 100 + outerRadius * Math.cos(startRad);
                    const y1 = 100 + outerRadius * Math.sin(startRad);
                    const x2 = 100 + outerRadius * Math.cos(endRad);
                    const y2 = 100 + outerRadius * Math.sin(endRad);
                    
                    const x3 = 100 + innerRadius * Math.cos(endRad);
                    const y3 = 100 + innerRadius * Math.sin(endRad);
                    const x4 = 100 + innerRadius * Math.cos(startRad);
                    const y4 = 100 + innerRadius * Math.sin(startRad);
                    
                    const largeArc = angle > 180 ? 1 : 0;
                    
                    const pathData = [
                      `M ${x1} ${y1}`,
                      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}`,
                      `L ${x3} ${y3}`,
                      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
                      'Z'
                    ].join(' ');
                    
                    return percentage > 0 ? (
                      <path
                        key={idx}
                        d={pathData}
                        fill={colorMap[item.status] || '#94A3B8'}
                        className="hover:opacity-80 transition-opacity"
                      />
                    ) : null;
                  });
                })()}
              </svg>
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-slate-900">
                  {getStatusChartData().reduce((sum, item) => sum + item.count, 0)}
                </div>
                <div className="text-sm text-slate-500">Events</div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="w-full space-y-2">
              {getStatusChartData().map((item, idx) => {
                const colorMap = {
                  'Completed': 'bg-green-500',
                  'Ongoing': 'bg-yellow-500',
                  'Scheduled': 'bg-blue-500',
                  'Cancelled': 'bg-slate-400'
                };
                return (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colorMap[item.status] || 'bg-slate-400'}`} />
                      <span className="text-slate-700">{item.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 font-semibold">{item.count}</span>
                      <span className="text-slate-500">({item.percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Distributions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Recent Distributions</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Distribution Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Program</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Barangay</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Beneficiaries</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm">Loading...</p>
                  </td>
                </tr>
              ) : recentDistributions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-500">
                    No distributions found
                  </td>
                </tr>
              ) : (
                recentDistributions.map((dist) => (
                  <tr key={dist.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">{dist.distribution_id}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{dist.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{dist.program}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{dist.barangay}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {new Date(dist.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900">{dist.beneficiaries}</td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{formatCurrency(dist.amount)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(dist.status)}`}>
                        {dist.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-slate-400 hover:text-slate-600">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Available Reports & Quick Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Reports */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Reports</h3>
          <p className="text-sm text-slate-600 mb-4">Generate the report you need</p>
          
          <div className="space-y-3">
            {[
              { icon: '👥', title: 'Beneficiary List', desc: 'Generate list of beneficiaries', color: 'bg-blue-50' },
              { icon: '📊', title: 'Distribution Report', desc: 'Summary of distributions', color: 'bg-green-50' },
              { icon: '💰', title: 'Financial Report', desc: 'Funds and expenses', color: 'bg-purple-50' },
              { icon: '📅', title: 'Attendance Report', desc: 'Distribution attendance', color: 'bg-orange-50' },
              { icon: '📝', title: 'Program Report', desc: 'Program summary', color: 'bg-pink-50' },
              { icon: '📋', title: 'Enrollment Report', desc: 'Enrollment summary', color: 'bg-indigo-50' },
            ].map((report, idx) => (
              <button
                key={idx}
                className={`w-full ${report.color} rounded-lg p-4 hover:shadow-md transition-shadow text-left flex items-center gap-4`}
              >
                <div className="text-2xl">{report.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{report.title}</div>
                  <div className="text-sm text-slate-600">{report.desc}</div>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Export */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Export</h3>
          <p className="text-sm text-slate-600 mb-4">Export current data to your preferred format</p>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '📄', title: 'Export as PDF', desc: 'Download PDF report', color: 'bg-red-50 hover:bg-red-100', Icon: FileText },
              { icon: '📊', title: 'Export as Excel', desc: 'Download Excel file', color: 'bg-green-50 hover:bg-green-100', Icon: FileSpreadsheet },
              { icon: '📋', title: 'Export as CSV', desc: 'Download CSV file', color: 'bg-blue-50 hover:bg-blue-100', Icon: Download },
              { icon: '🖨️', title: 'Export as Print', desc: 'Print current report', color: 'bg-slate-50 hover:bg-slate-100', Icon: Printer },
            ].map((exp, idx) => (
              <button
                key={idx}
                className={`${exp.color} rounded-lg p-4 transition-colors text-left flex flex-col items-center justify-center gap-2`}
              >
                <exp.Icon className="w-8 h-8 text-slate-600" />
                <div className="font-semibold text-slate-900 text-sm text-center">{exp.title}</div>
                <div className="text-xs text-slate-600 text-center">{exp.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-slate-500">
        © 2026 DSWD Beneficiary System. All rights reserved. | Version 1.0.0
      </div>
    </div>
  );
}

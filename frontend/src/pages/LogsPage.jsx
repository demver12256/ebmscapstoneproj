import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Server, Smartphone, ShieldCheck, RefreshCw, Search, Filter, 
  Download, CheckCircle, AlertTriangle, XCircle, Clock, Database, 
  Cpu, HardDrive, RotateCw, Activity, Terminal
} from 'lucide-react';
import { auditApi, smsApi, reportsApi } from '../services/api';
import Pagination from '../components/ui/Pagination';

export default function LogsPage({ defaultTab = 'system' }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active tab from URL search param or prop
  const currentTabFromUrl = searchParams.get('tab');
  const activeTab = currentTabFromUrl || defaultTab;

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // ─────────────────────────────────────────────────────────────
  // 1. SYSTEM LOGS STATE
  // ─────────────────────────────────────────────────────────────
  const [systemData, setSystemData] = useState(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState(null);

  const fetchSystemLogs = useCallback(async () => {
    setSystemLoading(true);
    setSystemError(null);
    try {
      const res = await auditApi.getSystemLogs();
      setSystemData(res.data?.data || null);
    } catch (err) {
      setSystemError(err.response?.data?.message || err.message || 'Failed to fetch system logs');
    } finally {
      setSystemLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 2. SMS LOGS STATE
  // ─────────────────────────────────────────────────────────────
  const [smsList, setSmsList] = useState([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState(null);
  const [smsPagination, setSmsPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [smsStats, setSmsStats] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });
  const [smsFilterStatus, setSmsFilterStatus] = useState('all');
  const [smsSearch, setSmsSearch] = useState('');
  const [resendingId, setResendingId] = useState(null);
  const [resendNotice, setResendNotice] = useState(null);

  const fetchSmsLogs = useCallback(async (page = 1) => {
    setSmsLoading(true);
    setSmsError(null);
    try {
      const params = {
        page,
        limit: 15,
        status: smsFilterStatus !== 'all' ? smsFilterStatus : undefined,
        search: smsSearch.trim() || undefined,
      };
      const res = await smsApi.list(params);
      setSmsList(res.data?.data || []);
      if (res.data?.pagination) {
        setSmsPagination(res.data.pagination);
      }
      if (res.data?.stats) {
        setSmsStats(res.data.stats);
      }
    } catch (err) {
      setSmsError(err.response?.data?.message || err.message || 'Failed to fetch SMS logs');
    } finally {
      setSmsLoading(false);
    }
  }, [smsFilterStatus, smsSearch]);

  const handleResendSms = async (id) => {
    setResendingId(id);
    setResendNotice(null);
    try {
      const res = await smsApi.resend(id);
      setResendNotice({ type: 'success', text: `SMS #${id}: ${res.data?.message || 'Dispatch attempted'}` });
      fetchSmsLogs(smsPagination.page);
    } catch (err) {
      setResendNotice({ type: 'error', text: `Failed to resend SMS #${id}: ${err.response?.data?.message || err.message}` });
    } finally {
      setResendingId(null);
      setTimeout(() => setResendNotice(null), 5000);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. AUDIT LOGS STATE
  // ─────────────────────────────────────────────────────────────
  const [auditList, setAuditList] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditPagination, setAuditPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [auditStats, setAuditStats] = useState({ totalLogs: 0, todayLogs: 0, modules: [] });
  const [auditFilterModule, setAuditFilterModule] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [exportingAudit, setExportingAudit] = useState(false);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const params = {
        page,
        limit: 15,
        module: auditFilterModule !== 'all' ? auditFilterModule : undefined,
        search: auditSearch.trim() || undefined,
      };
      const res = await auditApi.list(params);
      setAuditList(res.data?.data || []);
      if (res.data?.pagination) {
        setAuditPagination(res.data.pagination);
      }
      if (res.data?.stats) {
        setAuditStats(res.data.stats);
      }
    } catch (err) {
      setAuditError(err.response?.data?.message || err.message || 'Failed to fetch audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilterModule, auditSearch]);

  const handleExportAudit = async () => {
    setExportingAudit(true);
    try {
      const res = await reportsApi.exportAuditLogs({
        module: auditFilterModule !== 'all' ? auditFilterModule : undefined,
        action: auditSearch.trim() || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit-logs-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export audit logs');
    } finally {
      setExportingAudit(false);
    }
  };

  // Trigger loads based on active tab
  useEffect(() => {
    if (activeTab === 'system') {
      fetchSystemLogs();
    } else if (activeTab === 'sms') {
      fetchSmsLogs(1);
    } else if (activeTab === 'audit') {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchSystemLogs, fetchSmsLogs, fetchAuditLogs]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-dswd-blue/10 rounded-xl text-dswd-blue">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                System & Audit Logs
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Live system diagnostics, automated SMS delivery logs, and administrator audit trails.
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner self-start md:self-auto">
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'system'
                ? 'bg-white text-dswd-blue shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="h-4 w-4" />
            <span>System Log</span>
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'sms'
                ? 'bg-white text-dswd-blue shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>SMS Log</span>
            {smsStats?.total > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {smsStats.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-white text-dswd-blue shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Audit Logs</span>
            {auditStats?.totalLogs > 0 && (
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {auditStats.totalLogs}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: SYSTEM LOGS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Diagnostic & Environment Metrics
            </span>
            <button
              onClick={fetchSystemLogs}
              disabled={systemLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${systemLoading ? 'animate-spin text-dswd-blue' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>

          {systemError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{systemError}</span>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Server Uptime */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Server Uptime</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Activity className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {systemData?.server?.uptimeFormatted || '0h 0m 0s'}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Node {systemData?.server?.nodeVersion} ({systemData?.server?.platform})
              </p>
            </div>

            {/* Memory RSS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Memory Allocation</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Cpu className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {systemData?.server?.memory?.heapUsed || '—'}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Heap Total: {systemData?.server?.memory?.heapTotal || '—'} (RSS: {systemData?.server?.memory?.rss || '—'})
              </p>
            </div>

            {/* Database Engine */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">MySQL Database</span>
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Database className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{systemData?.database?.status || 'Connected'}</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Latency: {systemData?.database?.latencyMs ?? 0} ms • Dialect: MySQL
              </p>
            </div>

            {/* SMS Gateway & Scheduler */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS & Services</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <HardDrive className="h-4 w-4" />
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 truncate">
                {systemData?.services?.smsGateway?.status || 'Active'}
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">
                Scheduler: {systemData?.services?.scheduler?.status} (Every 60s)
              </p>
            </div>
          </div>

          {/* Database Table Record Counts */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Database Table Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg font-black text-slate-900 block">
                  {systemData?.database?.counts?.audit_logs || 0}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Audit Logs</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg font-black text-slate-900 block">
                  {systemData?.database?.counts?.sms_notifications || 0}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">SMS Logs</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg font-black text-slate-900 block">
                  {systemData?.database?.counts?.users || 0}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Users</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg font-black text-slate-900 block">
                  {systemData?.database?.counts?.beneficiaries || 0}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Beneficiaries</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-lg font-black text-slate-900 block">
                  {systemData?.database?.counts?.announcements || 0}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Announcements</span>
              </div>
            </div>
          </div>

          {/* Automated System Events Feed */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Automated System & Scheduler Events</h3>
                <p className="text-xs text-slate-500">
                  Recent activities performed automatically by background workers and automated cron tasks.
                </p>
              </div>
              <span className="text-xs font-bold text-dswd-blue bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                {systemData?.systemEvents?.length || 0} Events Logged
              </span>
            </div>

            {systemLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading system diagnostic logs...</div>
            ) : !systemData?.systemEvents?.length ? (
              <div className="py-12 text-center text-slate-400 text-sm">No recent automated events logged.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Module</th>
                      <th className="px-4 py-3">Triggered By</th>
                      <th className="px-4 py-3">System Action Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {systemData.systemEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {evt.module || 'System'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {evt.User ? `${evt.User.first_name} ${evt.User.last_name}` : 'Background Worker'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-800 font-medium break-all">
                          {evt.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SMS LOGS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'sms' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total SMS</span>
              <span className="text-2xl font-black text-slate-900">{smsStats?.total || 0}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Delivered / Sent</span>
              <span className="text-2xl font-black text-emerald-600">{smsStats?.sent || 0}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider block mb-1">Failed Delivery</span>
              <span className="text-2xl font-black text-red-600">{smsStats?.failed || 0}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">Queued</span>
              <span className="text-2xl font-black text-amber-600">{smsStats?.queued || 0}</span>
            </div>
          </div>

          {smsError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{smsError}</span>
            </div>
          )}

          {resendNotice && (
            <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 border ${
              resendNotice.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {resendNotice.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
              <span>{resendNotice.text}</span>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-80">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search phone, recipient, message..."
                  value={smsSearch}
                  onChange={(e) => setSmsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchSmsLogs(1)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-dswd-blue/20 focus:border-dswd-blue"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={smsFilterStatus}
                  onChange={(e) => setSmsFilterStatus(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-dswd-blue/20"
                >
                  <option value="all">All Delivery Statuses</option>
                  <option value="sent">Sent / Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="queued">Queued</option>
                </select>
              </div>

              <button
                onClick={() => fetchSmsLogs(1)}
                className="px-4 py-2 bg-dswd-blue text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition w-full sm:w-auto"
              >
                Filter
              </button>
            </div>

            <button
              onClick={() => fetchSmsLogs(smsPagination.page)}
              disabled={smsLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition disabled:opacity-50 self-end md:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${smsLoading ? 'animate-spin text-dswd-blue' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* SMS Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {smsLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading SMS logs...</div>
            ) : smsList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">No SMS notification logs found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">ID</th>
                      <th className="px-4 py-3">Recipient Beneficiary</th>
                      <th className="px-4 py-3">Mobile No.</th>
                      <th className="px-4 py-3">Message Content</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Provider Detail / Error</th>
                      <th className="px-4 py-3">Sent / Logged</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {smsList.map((item) => {
                      const isSent = item.status === 'sent';
                      const isFailed = item.status === 'failed';
                      const isQueued = item.status === 'queued';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono font-bold text-slate-400">#{item.id}</td>
                          <td className="px-4 py-3">
                            {item.Beneficiary ? (
                              <div>
                                <span className="font-extrabold text-slate-900 block">
                                  {item.Beneficiary.first_name} {item.Beneficiary.last_name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {item.Beneficiary.Barangay?.barangay_name || 'Barangay N/A'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Direct / System Recipient</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {item.phone_number || '—'}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="line-clamp-2 text-slate-800 font-medium leading-relaxed">
                              {item.message}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isSent && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="h-3 w-3" />
                                SENT
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                                <XCircle className="h-3 w-3" />
                                FAILED
                              </span>
                            )}
                            {isQueued && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3" />
                                QUEUED
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs font-mono text-[10px] text-slate-500">
                            {item.failure_reason ? (
                              <span className="text-red-600 line-clamp-2" title={item.failure_reason}>
                                {item.failure_reason}
                              </span>
                            ) : item.provider_message_id ? (
                              <span className="text-slate-600">Ref: {item.provider_message_id}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {item.sent_at || item.createdAt
                              ? new Date(item.sent_at || item.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isFailed && (
                              <button
                                onClick={() => handleResendSms(item.id)}
                                disabled={resendingId === item.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold transition disabled:opacity-50"
                              >
                                <RotateCw className={`h-3 w-3 ${resendingId === item.id ? 'animate-spin' : ''}`} />
                                <span>{resendingId === item.id ? 'Retrying...' : 'Retry'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {smsPagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100">
                <Pagination
                  currentPage={smsPagination.page}
                  totalPages={smsPagination.totalPages}
                  onPageChange={(p) => fetchSmsLogs(p)}
                  totalItems={smsPagination.total}
                  itemsPerPage={smsPagination.limit}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: AUDIT LOGS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Audit Logs</span>
              <span className="text-2xl font-black text-slate-900">{auditStats?.totalLogs || 0}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Actions Today</span>
              <span className="text-2xl font-black text-indigo-600">{auditStats?.todayLogs || 0}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Modules</span>
              <span className="text-2xl font-black text-slate-900">{auditStats?.modules?.length || 0}</span>
            </div>
          </div>

          {auditError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{auditError}</span>
            </div>
          )}

          {/* Search, Filter & Export Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-80">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search action, actor, module..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs(1)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-dswd-blue/20 focus:border-dswd-blue"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <select
                  value={auditFilterModule}
                  onChange={(e) => setAuditFilterModule(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-dswd-blue/20"
                >
                  <option value="all">All Modules</option>
                  {(auditStats?.modules || []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => fetchAuditLogs(1)}
                className="px-4 py-2 bg-dswd-blue text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition w-full sm:w-auto"
              >
                Filter
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handleExportAudit}
                disabled={exportingAudit}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{exportingAudit ? 'Exporting...' : 'Export Excel'}</span>
              </button>

              <button
                onClick={() => fetchAuditLogs(auditPagination.page)}
                disabled={auditLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? 'animate-spin text-dswd-blue' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {auditLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Loading audit logs...</div>
            ) : auditList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">No audit records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor / User</th>
                      <th className="px-4 py-3">Module</th>
                      <th className="px-4 py-3">Action Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditList.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.User ? (
                            <div>
                              <span className="font-extrabold text-slate-900 block">
                                {log.User.first_name} {log.User.last_name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400">{log.User.email || '—'}</span>
                                <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                                  {log.User.role}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-semibold text-slate-500">System Automatic</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                            {log.module}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-medium">
                          {log.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {auditPagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100">
                <Pagination
                  currentPage={auditPagination.page}
                  totalPages={auditPagination.totalPages}
                  onPageChange={(p) => fetchAuditLogs(p)}
                  totalItems={auditPagination.total}
                  itemsPerPage={auditPagination.limit}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


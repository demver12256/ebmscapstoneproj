import { useState, useEffect, useMemo, useCallback } from 'react';
import { interventionApi } from '../services/api';
import { API_ORIGIN } from '../config/api';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';
import {
  FileHeart, CheckCircle, XCircle, Clock, Search, Eye,
  Building2, TrendingUp, X, Check, RefreshCw,
  Sparkles, ExternalLink, Paperclip, LayoutGrid, Table as TableIcon,
  ShieldCheck, MapPin, RotateCcw
} from 'lucide-react';

const STATUS_CONFIG = {
  Pending: {
    icon: Clock,
    label: 'Pending Review',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  Verified: {
    icon: CheckCircle,
    label: 'Verified',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  Rejected: {
    icon: XCircle,
    label: 'Rejected',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
  }
};

const COMMON_AGENCIES = [
  'All Agencies',
  'PhilHealth',
  'PCSO (Philippine Charity Sweepstakes Office)',
  'LGU (Local Government Unit)',
  'Barangay',
  'DOH (Department of Health)',
  'DSWD (Regional/Provincial)',
  'NGO (Non-Government Organization)',
  'Private Foundation'
];

export default function InterventionsManagementPage() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'verified' | 'rejected'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [interventions, setInterventions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [viewDetailsIntervention, setViewDetailsIntervention] = useState(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState(null);

  // Modals
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [staffNotes, setStaffNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allRes, statsRes] = await Promise.all([
        interventionApi.getAllInterventions(),
        interventionApi.getStats()
      ]);
      setInterventions(allRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (error) {
      console.error('Failed to load interventions:', error);
      showToast('error', error.response?.data?.message || 'Failed to load interventions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleVerify = async () => {
    if (!selectedIntervention) return;

    try {
      setProcessing(true);
      await interventionApi.verifyIntervention(selectedIntervention.id, {
        staff_notes: staffNotes.trim() || undefined
      });
      showToast('success', 'Intervention verified and validated successfully');
      setShowVerifyModal(false);
      setStaffNotes('');
      setSelectedIntervention(null);
      await loadData();
    } catch (error) {
      console.error('Failed to verify intervention:', error);
      showToast('error', error.response?.data?.message || 'Failed to verify intervention');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedIntervention) return;

    if (!rejectionReason.trim()) {
      showToast('error', 'Rejection reason is required');
      return;
    }

    try {
      setProcessing(true);
      await interventionApi.rejectIntervention(selectedIntervention.id, {
        rejection_reason: rejectionReason.trim(),
        staff_notes: staffNotes.trim() || undefined
      });
      showToast('success', 'Intervention rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setStaffNotes('');
      setSelectedIntervention(null);
      await loadData();
    } catch (error) {
      console.error('Failed to reject intervention:', error);
      showToast('error', error.response?.data?.message || 'Failed to reject intervention');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || Number(amount) === 0) return '₱0.00';
    return `₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Client-side filtering across tabs, search, and date filters
  const filteredInterventions = useMemo(() => {
    return interventions.filter((item) => {
      // Tab status match
      if (activeTab === 'pending' && item.status !== 'Pending') return false;
      if (activeTab === 'verified' && item.status !== 'Verified') return false;
      if (activeTab === 'rejected' && item.status !== 'Rejected') return false;

      // Agency filter match
      if (agencyFilter && agencyFilter !== 'All Agencies') {
        if (!item.agency_name?.toLowerCase().includes(agencyFilter.toLowerCase())) {
          return false;
        }
      }

      // Date range match
      if (dateFrom && item.date_received && item.date_received < dateFrom) {
        return false;
      }
      if (dateTo && item.date_received && item.date_received > dateTo) {
        return false;
      }

      // Search term match
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const benName = `${item.Beneficiary?.first_name || ''} ${item.Beneficiary?.last_name || ''}`.toLowerCase();
        const brgy = (item.Beneficiary?.Barangay?.barangay_name || '').toLowerCase();
        const agency = (item.agency_name || '').toLowerCase();
        const type = (item.assistance_type || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const notes = (item.staff_notes || '').toLowerCase();
        const reason = (item.rejection_reason || '').toLowerCase();

        const matches = benName.includes(q) || brgy.includes(q) || agency.includes(q) ||
          type.includes(q) || desc.includes(q) || notes.includes(q) || reason.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [interventions, activeTab, agencyFilter, dateFrom, dateTo, searchTerm]);

  // Pagination hook (10 items per page)
  const pagination = usePagination(filteredInterventions, 10);

  // Compute status counts for tab badges
  const counts = useMemo(() => {
    return {
      all: interventions.length,
      pending: interventions.filter((i) => i.status === 'Pending').length,
      verified: interventions.filter((i) => i.status === 'Verified').length,
      rejected: interventions.filter((i) => i.status === 'Rejected').length,
    };
  }, [interventions]);

  const hasActiveFilters = Boolean(searchTerm || agencyFilter || dateFrom || dateTo);

  const resetFilters = () => {
    setSearchTerm('');
    setAgencyFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const getDocumentUrl = (proofPath) => {
    if (!proofPath) return null;
    return `${API_ORIGIN}${proofPath}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl border shadow-xl max-w-md animate-fadeIn flex items-center justify-between gap-3 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
            : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              Agency Coordination
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            External Interventions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review, verify, and track social assistance received by beneficiaries from other agencies (PhilHealth, PCSO, LGU, DOH, NGOs).
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs active:scale-95"
            title="Reload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ━━━ Statistics KPI Cards (Minimalist) ━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Interventions</span>
            <FileHeart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {loading ? '...' : (stats?.total ?? counts.all)}
          </div>
          <p className="text-xs text-slate-400 mt-1">All recorded assistance</p>
        </div>

        {/* Card 2: Pending */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-600">
            {loading ? '...' : (stats?.pending ?? counts.pending)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Awaiting staff verification</p>
        </div>

        {/* Card 3: Verified */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Verified</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600">
            {loading ? '...' : (stats?.verified ?? counts.verified)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Officially validated records</p>
        </div>

        {/* Card 4: Total Amount */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Total Verified Aid</span>
            <span className="text-xs font-bold text-blue-500">₱</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 truncate">
            {loading ? '...' : formatCurrency(stats?.total_amount)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Cumulative monetary value</p>
        </div>
      </div>

      {/* ━━━ Top Partner Agencies Widget ━━━ */}
      {stats && stats.top_agencies && stats.top_agencies.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Top Partner Agencies (Verified Records)
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {stats.top_agencies.length} {stats.top_agencies.length === 1 ? 'agency' : 'agencies'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.top_agencies.slice(0, 6).map((agency, idx) => {
              const maxAmount = Math.max(...stats.top_agencies.map((a) => Number(a.total_amount || 0)), 1);
              const percentage = Math.min(100, Math.round((Number(agency.total_amount || 0) / maxAmount) * 100));

              return (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 truncate pr-2">{agency.agency_name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold shrink-0">
                      {agency.count} {agency.count === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">Verified Value:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(agency.total_amount)}</span>
                  </div>
                  {/* Visual Progress Track */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(8, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ━━━ Unified Control Toolbar: Tabs, Search & Filters ━━━ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
        {/* Row 1: Status Tab Buttons & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>All Interventions</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Review</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {counts.pending}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('verified')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'verified'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Verified</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'verified' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {counts.verified}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'rejected' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {counts.rejected}
              </span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table view"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Cards view"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Agency Filter, Date Range & Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search beneficiary, agency, assistance..."
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Agency Filter */}
          <div className="lg:col-span-3">
            <select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Agencies</option>
              {COMMON_AGENCIES.filter((a) => a !== 'All Agencies').map((agency) => (
                <option key={agency} value={agency}>{agency}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="lg:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Date Received From"
            />
          </div>

          {/* Date To */}
          <div className="lg:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Date Received To"
            />
          </div>

          {/* Reset Filters */}
          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className={`p-2 rounded-xl border border-slate-200 text-xs font-bold flex items-center justify-center transition w-full ${
                hasActiveFilters
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed border-dashed'
              }`}
              title="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ Main Content: Table View vs Card View ━━━ */}
      {loading ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600 mt-3">Loading external interventions...</p>
        </div>
      ) : filteredInterventions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm px-4">
          <FileHeart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {activeTab === 'pending'
              ? 'No Pending Interventions for Review'
              : hasActiveFilters
              ? 'No Interventions Match Your Filter'
              : 'No Interventions Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {activeTab === 'pending'
              ? 'All submitted assistance reports from beneficiaries have been reviewed.'
              : hasActiveFilters
              ? 'Try clearing your search term or adjusting agency and date range filters.'
              : 'Beneficiaries can report aid received from other agencies (PhilHealth, PCSO, LGU).'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-xs transition"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* ━━━ Table View ━━━ */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">ID & Date</th>
                  <th className="py-3.5 px-4">Beneficiary</th>
                  <th className="py-3.5 px-4">Agency & Assistance</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Date Received</th>
                  <th className="py-3.5 px-4">Proof Document</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {pagination.paginatedData.map((item) => {
                  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;
                  const StatusIcon = statusCfg.icon;
                  const docUrl = getDocumentUrl(item.proof_document_url);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => setViewDetailsIntervention(item)}
                    >
                      {/* ID & Date */}
                      <td className="py-4 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        #INT-{item.id}
                        <span className="block text-[10px] font-normal text-slate-400 font-sans">
                          Submitted {formatDate(item.created_at)}
                        </span>
                      </td>

                      {/* Beneficiary */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-2xs">
                            {item.Beneficiary?.first_name?.[0] || 'B'}{item.Beneficiary?.last_name?.[0] || ''}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {item.Beneficiary?.first_name} {item.Beneficiary?.last_name}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{item.Beneficiary?.Barangay?.barangay_name || 'Barangay N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Agency & Assistance */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{item.agency_name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.assistance_type}</div>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(item.amount)}
                        </span>
                      </td>

                      {/* Date Received */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {formatDate(item.date_received)}
                      </td>

                      {/* Proof Document */}
                      <td className="py-4 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {docUrl ? (
                          <button
                            type="button"
                            onClick={() => setDocumentPreviewUrl(docUrl)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition border border-blue-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Doc</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No document</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.badgeClass}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'Pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIntervention(item);
                                  setShowVerifyModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
                                title="Verify this intervention"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Verify
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIntervention(item);
                                  setShowRejectModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition border border-rose-200"
                                title="Reject this intervention"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewDetailsIntervention(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                            title="View intervention details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.goToPage}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
            />
          </div>
        </div>
      ) : (
        /* ━━━ Cards View (Enhanced Image 2 Layout) ━━━ */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagination.paginatedData.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;
              const StatusIcon = statusCfg.icon;
              const docUrl = getDocumentUrl(item.proof_document_url);

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Beneficiary Header */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-xs">
                          {item.Beneficiary?.first_name?.[0] || 'B'}{item.Beneficiary?.last_name?.[0] || ''}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {item.Beneficiary?.first_name} {item.Beneficiary?.last_name}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.Beneficiary?.Barangay?.barangay_name || 'N/A'} • Submitted {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${statusCfg.badgeClass}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Agency & Assistance Details */}
                    <div className="mt-3.5 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{item.agency_name}</h3>
                        <p className="text-xs text-slate-600 font-medium">{item.assistance_type}</p>
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Amount</span>
                        <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{formatCurrency(item.amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Date Received</span>
                        <span className="font-semibold text-slate-800 mt-0.5 block">{formatDate(item.date_received)}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Proof Document</span>
                        {docUrl ? (
                          <button
                            type="button"
                            onClick={() => setDocumentPreviewUrl(docUrl)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold mt-1 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Document
                          </button>
                        ) : (
                          <span className="text-slate-400 mt-1 block italic text-[11px]">None provided</span>
                        )}
                      </div>
                    </div>

                    {/* Description Notes */}
                    {item.description && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                        <p className="line-clamp-2">{item.description}</p>
                      </div>
                    )}

                    {/* Staff Notes */}
                    {item.staff_notes && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900">
                        <p className="font-bold text-[10px] uppercase text-blue-700">Staff Notes:</p>
                        <p className="mt-0.5 text-blue-950 font-medium">{item.staff_notes}</p>
                      </div>
                    )}

                    {/* Rejection Reason */}
                    {item.status === 'Rejected' && item.rejection_reason && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900">
                        <p className="font-bold text-[10px] uppercase text-rose-700">Rejection Reason:</p>
                        <p className="mt-0.5 text-rose-950 font-medium">{item.rejection_reason}</p>
                      </div>
                    )}

                    {/* Verifier Credit */}
                    {item.Verifier && (
                      <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {item.status === 'Verified' ? 'Verified' : 'Rejected'} by {item.Verifier.first_name} {item.Verifier.last_name} on {formatDate(item.verified_at)}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Pending Action Buttons */}
                  {item.status === 'Pending' && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIntervention(item);
                          setShowVerifyModal(true);
                        }}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIntervention(item);
                          setShowRejectModal(true);
                        }}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cards Pagination */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.goToPage}
              totalItems={pagination.totalItems}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
            />
          </div>
        </div>
      )}

      {/* ━━━ Verify Intervention Modal ━━━ */}
      {showVerifyModal && selectedIntervention && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Verify External Intervention
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  setStaffNotes('');
                  setSelectedIntervention(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Beneficiary:</span>
                <span className="font-bold text-slate-900">{selectedIntervention.Beneficiary?.first_name} {selectedIntervention.Beneficiary?.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Barangay:</span>
                <span className="font-semibold text-slate-800">{selectedIntervention.Beneficiary?.Barangay?.barangay_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Providing Agency:</span>
                <span className="font-bold text-slate-900">{selectedIntervention.agency_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Assistance Type:</span>
                <span className="font-semibold text-slate-800">{selectedIntervention.assistance_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Amount Received:</span>
                <span className="font-extrabold text-emerald-700 text-sm">{formatCurrency(selectedIntervention.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Date Received:</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedIntervention.date_received)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Staff Verification Notes (Optional)
              </label>
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={3}
                placeholder="E.g., Validated with PhilHealth certificate, receipt copy verified..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-white font-medium"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleVerify}
                disabled={processing}
                className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-1.5"
              >
                {processing ? 'Verifying...' : 'Confirm Verification'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  setStaffNotes('');
                  setSelectedIntervention(null);
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ Reject Intervention Modal ━━━ */}
      {showRejectModal && selectedIntervention && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-rose-600 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Reject External Intervention
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setStaffNotes('');
                  setSelectedIntervention(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
              <p><span className="text-slate-500 font-medium">Beneficiary:</span> <strong className="text-slate-900">{selectedIntervention.Beneficiary?.first_name} {selectedIntervention.Beneficiary?.last_name}</strong></p>
              <p><span className="text-slate-500 font-medium">Agency:</span> <strong className="text-slate-900">{selectedIntervention.agency_name}</strong></p>
              <p><span className="text-slate-500 font-medium">Assistance Type:</span> <strong className="text-slate-900">{selectedIntervention.assistance_type}</strong></p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="State reason (e.g., Unclear proof document, duplicate record, unauthorized report)..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none bg-white font-medium"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Internal Staff Notes (Optional)
              </label>
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={2}
                placeholder="Internal audit notes..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none bg-white font-medium"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-1.5"
              >
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setStaffNotes('');
                  setSelectedIntervention(null);
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ Intervention Details Modal ━━━ */}
      {viewDetailsIntervention && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileHeart className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Intervention Record Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsIntervention(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-4">
              {/* Beneficiary Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-xs">
                  {viewDetailsIntervention.Beneficiary?.first_name?.[0] || 'B'}{viewDetailsIntervention.Beneficiary?.last_name?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">
                    {viewDetailsIntervention.Beneficiary?.first_name} {viewDetailsIntervention.Beneficiary?.last_name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {viewDetailsIntervention.Beneficiary?.Barangay?.barangay_name || 'Barangay N/A'} • {viewDetailsIntervention.Beneficiary?.category || 'Beneficiary'}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CONFIG[viewDetailsIntervention.status]?.badgeClass}`}>
                  {viewDetailsIntervention.status}
                </span>
              </div>

              {/* Assistance Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Agency</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{viewDetailsIntervention.agency_name}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Type of Aid</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{viewDetailsIntervention.assistance_type}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Amount</span>
                  <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{formatCurrency(viewDetailsIntervention.amount)}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Date Received</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{formatDate(viewDetailsIntervention.date_received)}</p>
                </div>
              </div>

              {/* Description */}
              {viewDetailsIntervention.description && (
                <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Beneficiary Notes / Description</span>
                  <p className="text-slate-800">{viewDetailsIntervention.description}</p>
                </div>
              )}

              {/* Proof Document preview link */}
              {viewDetailsIntervention.proof_document_url && (
                <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-blue-900">Proof of Assistance Document</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocumentPreviewUrl(getDocumentUrl(viewDetailsIntervention.proof_document_url))}
                    className="px-3 py-1 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition"
                  >
                    View Document
                  </button>
                </div>
              )}

              {/* Staff Notes / Rejection Reason */}
              {viewDetailsIntervention.staff_notes && (
                <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-xs text-blue-900">
                  <span className="text-[10px] font-bold uppercase text-blue-700 block mb-0.5">Staff Notes</span>
                  <p>{viewDetailsIntervention.staff_notes}</p>
                </div>
              )}

              {viewDetailsIntervention.rejection_reason && (
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-900">
                  <span className="text-[10px] font-bold uppercase text-rose-700 block mb-0.5">Rejection Reason</span>
                  <p>{viewDetailsIntervention.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewDetailsIntervention(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ In-App Document Preview Modal ━━━ */}
      {documentPreviewUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-blue-600" />
                Proof Document Preview
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={documentPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                  title="Open original in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setDocumentPreviewUrl(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-slate-100 rounded-xl my-2">
              {documentPreviewUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={documentPreviewUrl}
                  title="PDF Document"
                  className="w-full h-[65vh] rounded-lg"
                />
              ) : (
                <img
                  src={documentPreviewUrl}
                  alt="Proof Document"
                  className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-sm"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/beniaid-logo.png';
                  }}
                />
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setDocumentPreviewUrl(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { interventionApi, beneficiaryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileHeart, CheckCircle, XCircle, Clock, Filter, Search, Eye,
  Building2, TrendingUp, Users, Calendar, X, Check
} from 'lucide-react';

const STATUS_CONFIG = {
  Pending: {
    icon: Clock,
    label: 'Pending',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200'
  },
  Verified: {
    icon: CheckCircle,
    label: 'Verified',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200'
  },
  Rejected: {
    icon: XCircle,
    label: 'Rejected',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200'
  }
};

export default function InterventionsManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [interventions, setInterventions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [staffNotes, setStaffNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [toast, setToast] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    agency_name: '',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'pending') {
        const res = await interventionApi.getPendingInterventions();
        setInterventions(res.data.data || []);
      } else {
        const params = {};
        if (filters.status) params.status = filters.status;
        if (filters.agency_name) params.agency_name = filters.agency_name;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        
        const res = await interventionApi.getAllInterventions(params);
        setInterventions(res.data.data || []);
      }

      // Load stats
      const statsRes = await interventionApi.getStats();
      setStats(statsRes.data.data);
    } catch (error) {
      console.error('Failed to load interventions:', error);
      showToast('error', 'Failed to load interventions');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleVerify = async () => {
    if (!selectedIntervention) return;

    try {
      setProcessing(true);
      await interventionApi.verifyIntervention(selectedIntervention.id, {
        staff_notes: staffNotes
      });
      showToast('success', 'Intervention verified successfully');
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
        rejection_reason: rejectionReason,
        staff_notes: staffNotes
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
    if (!amount || amount === 0) return 'N/A';
    return `₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl border shadow-lg max-w-md animate-fadeIn ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 block mb-1">
            {user?.role === 'admin' ? 'Admin' : 'Staff'} Dashboard
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Interventions Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and verify assistance received from other agencies
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Total</span>
              <FileHeart className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-700">Pending</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">{stats.pending}</div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-700">Verified</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900">{stats.verified}</div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-700">Total Amount</span>
              <span className="w-4 h-4 text-blue-600 flex items-center justify-center text-lg font-semibold leading-none">₱</span>
            </div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(stats.total_amount)}</div>
          </div>
        </div>
      )}

      {/* Top Agencies */}
      {stats && stats.top_agencies && stats.top_agencies.length > 0 && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            Top Agencies (Verified)
          </h3>
          <div className="space-y-2">
            {stats.top_agencies.slice(0, 5).map((agency, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{agency.agency_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{agency.count} times</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(agency.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pending Review
          {stats && stats.pending > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {stats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Interventions
        </button>
      </div>

      {/* Filters (for "All" tab) */}
      {activeTab === 'all' && (
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-900">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
            </select>

            <input
              type="text"
              placeholder="Agency name..."
              value={filters.agency_name}
              onChange={(e) => setFilters({ ...filters, agency_name: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />

            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              placeholder="From"
            />

            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              placeholder="To"
            />
          </div>
        </div>
      )}

      {/* Interventions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            <p className="text-sm text-slate-500 mt-2">Loading interventions...</p>
          </div>
        ) : interventions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <FileHeart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {activeTab === 'pending' ? 'No Pending Interventions' : 'No Interventions Found'}
            </h3>
            <p className="text-sm text-slate-500">
              {activeTab === 'pending' 
                ? 'All interventions have been reviewed'
                : 'Try adjusting your filters'
              }
            </p>
          </div>
        ) : (
          interventions.map((intervention) => {
            const statusConfig = STATUS_CONFIG[intervention.status] || STATUS_CONFIG.Pending;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={intervention.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Beneficiary Info */}
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
                      <Users className="w-4 h-4 text-slate-400" />
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900">
                          {intervention.Beneficiary?.first_name} {intervention.Beneficiary?.last_name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {intervention.Beneficiary?.Barangay?.barangay_name || 'N/A'} • 
                          Submitted {formatDate(intervention.created_at)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Intervention Details */}
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-slate-900">{intervention.agency_name}</h3>
                        <p className="text-sm text-slate-600">{intervention.assistance_type}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <span className="text-slate-500">Amount:</span>
                        <span className="ml-1 font-semibold text-slate-900">{formatCurrency(intervention.amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Date Received:</span>
                        <span className="ml-1 font-medium text-slate-900">{formatDate(intervention.date_received)}</span>
                      </div>
                      {intervention.proof_document_url && (
                        <div>
                          <a
                            href={`${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000'}${intervention.proof_document_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            View Document
                          </a>
                        </div>
                      )}
                    </div>

                    {intervention.description && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 mb-3">
                        <p className="text-sm text-slate-700">{intervention.description}</p>
                      </div>
                    )}

                    {intervention.staff_notes && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 mb-3">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Staff Notes:</p>
                        <p className="text-sm text-blue-800">{intervention.staff_notes}</p>
                      </div>
                    )}

                    {intervention.status === 'Rejected' && intervention.rejection_reason && (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                        <p className="text-xs font-semibold text-rose-900 mb-1">Rejection Reason:</p>
                        <p className="text-sm text-rose-800">{intervention.rejection_reason}</p>
                      </div>
                    )}

                    {intervention.Verifier && (
                      <p className="text-xs text-slate-500 mt-3">
                        {intervention.status === 'Verified' ? 'Verified' : 'Rejected'} by {intervention.Verifier.first_name} {intervention.Verifier.last_name} on {formatDate(intervention.verified_at)}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {intervention.status === 'Pending' && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setSelectedIntervention(intervention);
                          setShowVerifyModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Verify
                      </button>
                      <button
                        onClick={() => {
                          setSelectedIntervention(intervention);
                          setShowRejectModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Verify Modal */}
      {showVerifyModal && selectedIntervention && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              Verify Intervention
            </h3>
            
            <div className="space-y-3 mb-6 p-4 rounded-lg bg-slate-50">
              <p className="text-sm"><span className="font-semibold">Beneficiary:</span> {selectedIntervention.Beneficiary?.first_name} {selectedIntervention.Beneficiary?.last_name}</p>
              <p className="text-sm"><span className="font-semibold">Agency:</span> {selectedIntervention.agency_name}</p>
              <p className="text-sm"><span className="font-semibold">Type:</span> {selectedIntervention.assistance_type}</p>
              <p className="text-sm"><span className="font-semibold">Amount:</span> {formatCurrency(selectedIntervention.amount)}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Staff Notes (Optional)
              </label>
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={3}
                placeholder="Add verification notes..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleVerify}
                disabled={processing}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Verifying...' : 'Confirm Verification'}
              </button>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setStaffNotes('');
                  setSelectedIntervention(null);
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedIntervention && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-rose-600" />
              Reject Intervention
            </h3>
            
            <div className="space-y-3 mb-6 p-4 rounded-lg bg-slate-50">
              <p className="text-sm"><span className="font-semibold">Beneficiary:</span> {selectedIntervention.Beneficiary?.first_name} {selectedIntervention.Beneficiary?.last_name}</p>
              <p className="text-sm"><span className="font-semibold">Agency:</span> {selectedIntervention.agency_name}</p>
              <p className="text-sm"><span className="font-semibold">Type:</span> {selectedIntervention.assistance_type}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Provide reason for rejection..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Staff Notes (Optional)
              </label>
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setStaffNotes('');
                  setSelectedIntervention(null);
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

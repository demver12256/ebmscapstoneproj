import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { assistanceRequestApi } from '../services/api';
import {
  HandHeart, Clock, CheckCircle, XCircle, Eye, Search, Filter,
  ChevronDown, AlertTriangle, ShieldCheck, FileText, Users,
  Package, GraduationCap, Stethoscope, Utensils, Wallet, MoreHorizontal,
  X, MessageSquare, Circle
} from 'lucide-react';

const ASSISTANCE_TYPES = [
  { value: 'Financial Assistance', label: 'Financial', icon: Wallet, color: 'emerald' },
  { value: 'Food Assistance', label: 'Food', icon: Utensils, color: 'orange' },
  { value: 'Medical Assistance', label: 'Medical', icon: Stethoscope, color: 'red' },
  { value: 'Educational Assistance', label: 'Educational', icon: GraduationCap, color: 'blue' },
  { value: 'Livelihood Assistance', label: 'Livelihood', icon: Package, color: 'purple' },
  { value: 'Other', label: 'Other', icon: MoreHorizontal, color: 'slate' },
];

const STATUS_CONFIG = {
  Pending: { color: 'amber', icon: Clock, label: 'Pending', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  'Under Review': { color: 'blue', icon: Eye, label: 'Under Review', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  Approved: { color: 'emerald', icon: CheckCircle, label: 'Approved', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  Rejected: { color: 'red', icon: XCircle, label: 'Rejected', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  Completed: { color: 'purple', icon: CheckCircle, label: 'Completed', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
};

export default function AssistanceRequestsManagementPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reqRes, statsRes] = await Promise.all([
        assistanceRequestApi.list(),
        assistanceRequestApi.stats(),
      ]);
      setRequests(reqRes.data.data || []);
      setStats(statsRes.data.data || {});
    } catch (err) {
      console.error('Failed to load assistance requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!actionModal || !actionStatus) return;
    setProcessing(true);
    try {
      await assistanceRequestApi.updateStatus(actionModal.id, {
        status: actionStatus,
        admin_notes: actionNotes.trim() || undefined,
      });
      setActionModal(null);
      setActionNotes('');
      setActionStatus('');
      loadData();
    } catch (err) {
      console.error('Failed to update request:', err);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getTypeConfig = (type) => ASSISTANCE_TYPES.find(t => t.value === type) || ASSISTANCE_TYPES[5];

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const name = `${req.Beneficiary?.first_name || ''} ${req.Beneficiary?.last_name || ''}`.toLowerCase();
    const subject = (req.subject || '').toLowerCase();
    const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || subject.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
          <div className="absolute bottom-2 left-16 w-24 h-24 rounded-full bg-yellow-300/30 blur-xl" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
              <HandHeart className="w-7 h-7 text-yellow-300" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Assistance Requests</h1>
          </div>
          <p className="text-blue-100 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
            Review and manage assistance requests from beneficiaries. Approve, reject, or provide feedback on each request.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([status, conf]) => {
          const Icon = conf.icon;
          const count = stats[status] || 0;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              className={`rounded-xl border p-4 text-center transition-all hover:shadow-md ${
                filterStatus === status
                  ? `${conf.bg} ${conf.border} ${conf.text} ring-2 ring-${conf.color}-300`
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${filterStatus === status ? `text-${conf.color}-600` : 'text-slate-400'}`} />
              <div className="text-2xl font-black">{count}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">{conf.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by beneficiary name or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 transition"
            >
              <option value="all">All Status</option>
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-400 transition"
            >
              <option value="all">All Types</option>
              {ASSISTANCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table / Cards */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <HandHeart className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-600 mb-1">No Requests Found</h3>
          <p className="text-xs text-slate-400">
            {requests.length === 0
              ? 'No assistance requests have been submitted yet.'
              : 'No requests match your current filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.Pending;
            const StatusIcon = statusConf.icon;
            const typeConf = getTypeConfig(req.type);
            const TypeIcon = typeConf.icon;
            const isExpanded = selectedRequest === req.id;

            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
                <button
                  onClick={() => setSelectedRequest(isExpanded ? null : req.id)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className={`w-10 h-10 rounded-xl bg-${typeConf.color}-100 flex items-center justify-center shrink-0`}>
                    <TypeIcon className={`w-5 h-5 text-${typeConf.color}-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{req.subject}</h3>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusConf.bg} ${statusConf.text} ${statusConf.border} border shrink-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600">
                        <Users className="w-3 h-3 text-slate-400" />
                        {req.Beneficiary?.first_name} {req.Beneficiary?.last_name}
                      </span>
                      {req.Barangay && (
                        <>
                          <span className="text-[10px] text-slate-300">•</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{req.Barangay.barangay_name}</span>
                        </>
                      )}
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] text-slate-500 font-semibold">{req.type}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className={`text-[10px] font-bold ${req.priority === 'Urgent' ? 'text-red-600' : req.priority === 'Low' ? 'text-slate-400' : 'text-blue-600'}`}>
                        {req.priority === 'Urgent' && '⚡ '}{req.priority}
                      </span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-[10px] text-slate-400">{formatDate(req.created_at)}</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">{req.description}</p>
                    </div>

                    {/* Beneficiary Info */}
                    {req.Beneficiary && (
                      <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                          {req.Beneficiary.first_name?.[0]}{req.Beneficiary.last_name?.[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{req.Beneficiary.first_name} {req.Beneficiary.last_name}</p>
                          <p className="text-[10px] text-slate-500">{req.Beneficiary.category} • {req.Beneficiary.Barangay?.barangay_name || req.Barangay?.barangay_name}</p>
                        </div>
                      </div>
                    )}

                    {/* Existing Notes */}
                    {req.admin_notes && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Staff Notes
                        </p>
                        <p className="text-xs text-blue-900 leading-relaxed whitespace-pre-wrap">{req.admin_notes}</p>
                        {req.Reviewer && (
                          <p className="text-[10px] text-blue-600 mt-2 font-semibold">
                            — {req.Reviewer.first_name} {req.Reviewer.last_name} • {formatDate(req.reviewed_at)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {req.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => { setActionModal(req); setActionStatus('Under Review'); setActionNotes(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Start Review
                          </button>
                          <button
                            onClick={() => { setActionModal(req); setActionStatus('Approved'); setActionNotes(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => { setActionModal(req); setActionStatus('Rejected'); setActionNotes(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                      {req.status === 'Under Review' && (
                        <>
                          <button
                            onClick={() => { setActionModal(req); setActionStatus('Approved'); setActionNotes(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => { setActionModal(req); setActionStatus('Rejected'); setActionNotes(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                      {req.status === 'Approved' && (
                        <button
                          onClick={() => { setActionModal(req); setActionStatus('Completed'); setActionNotes(''); }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Update Request Status
              </h3>
              <button onClick={() => setActionModal(null)} className="p-1 hover:bg-slate-100 rounded-lg transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-800">{actionModal.subject}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {actionModal.Beneficiary?.first_name} {actionModal.Beneficiary?.last_name} • {actionModal.type}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">New Status</label>
                <select
                  value={actionStatus}
                  onChange={(e) => setActionStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400 transition"
                >
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Notes / Remarks (optional)</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Add feedback, instructions, or reason for the decision..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setActionModal(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatus}
                  disabled={processing}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition disabled:opacity-50 ${
                    actionStatus === 'Rejected' ? 'bg-red-600 hover:bg-red-700'
                    : actionStatus === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {processing ? 'Updating...' : `Set ${actionStatus}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

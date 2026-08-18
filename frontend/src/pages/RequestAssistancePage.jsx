import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { assistanceRequestApi } from '../services/api';
import {
  HandHeart, Send, Clock, CheckCircle, XCircle, AlertTriangle, Eye,
  ChevronDown, FileText, Sparkles, Circle, ShieldCheck, Package,
  GraduationCap, Stethoscope, Utensils, Wallet, MoreHorizontal
} from 'lucide-react';

const ASSISTANCE_TYPES = [
  { value: 'Financial Assistance', label: 'Financial Assistance', icon: Wallet, color: 'emerald' },
  { value: 'Food Assistance', label: 'Food Assistance', icon: Utensils, color: 'orange' },
  { value: 'Medical Assistance', label: 'Medical Assistance', icon: Stethoscope, color: 'red' },
  { value: 'Educational Assistance', label: 'Educational Assistance', icon: GraduationCap, color: 'blue' },
  { value: 'Livelihood Assistance', label: 'Livelihood Assistance', icon: Package, color: 'purple' },
  { value: 'Other', label: 'Other', icon: MoreHorizontal, color: 'slate' },
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low', color: 'slate' },
  { value: 'Normal', label: 'Normal', color: 'blue' },
  { value: 'Urgent', label: 'Urgent', color: 'red' },
];

const STATUS_CONFIG = {
  Pending: { color: 'amber', icon: Clock, label: 'Pending' },
  'Under Review': { color: 'blue', icon: Eye, label: 'Under Review' },
  Approved: { color: 'emerald', icon: CheckCircle, label: 'Approved' },
  Rejected: { color: 'red', icon: XCircle, label: 'Rejected' },
  Completed: { color: 'purple', icon: CheckCircle, label: 'Completed' },
};

export default function RequestAssistancePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [form, setForm] = useState({
    type: '',
    subject: '',
    description: '',
    priority: 'Normal',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const res = await assistanceRequestApi.list();
      setRequests(res.data.data || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.type || !form.subject.trim() || !form.description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await assistanceRequestApi.create(form);
      setSuccess('Your assistance request has been submitted successfully!');
      setForm({ type: '', subject: '', description: '', priority: 'Normal' });
      setShowForm(false);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getTypeConfig = (type) => ASSISTANCE_TYPES.find(t => t.value === type) || ASSISTANCE_TYPES[5];

  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const reviewCount = requests.filter(r => r.status === 'Under Review').length;
  const approvedCount = requests.filter(r => r.status === 'Approved' || r.status === 'Completed').length;

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
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                <HandHeart className="w-7 h-7 text-yellow-300" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Request Assistance</h1>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              Submit assistance requests to your Barangay Staff and DSWD. Track the status of your requests in real-time.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); setSuccess(''); }}
            className="shrink-0 flex items-center gap-2 bg-white text-dswd-blue font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <Send className="w-4 h-4" />
            {showForm ? 'Cancel' : 'New Request'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-blue-600">{reviewCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Under Review</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <div className="text-2xl font-black text-emerald-600">{approvedCount}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Approved</div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 text-sm font-semibold">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center gap-3 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          {error}
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Submit New Assistance Request
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill in the details below and your request will be sent to your Barangay Staff for review.</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Assistance Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ASSISTANCE_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = form.type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.value })}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-semibold transition-all text-left ${
                        isSelected
                          ? `border-${t.color}-400 bg-${t.color}-50 text-${t.color}-800 ring-2 ring-${t.color}-200`
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? `text-${t.color}-600` : 'text-slate-400'}`} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of your request (e.g., Need medical assistance for hospitalization)"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Description <span className="text-red-500">*</span></label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Provide detailed information about your request — what kind of assistance do you need, the urgency, and any relevant details..."
                rows={4}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
                maxLength={2000}
              />
              <p className="text-[10px] text-slate-400 mt-1 text-right">{form.description.length}/2000</p>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Priority Level</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p.value })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      form.priority === p.value
                        ? p.value === 'Low'
                          ? 'border-slate-400 bg-slate-50 text-slate-800'
                          : p.value === 'Normal'
                          ? 'border-blue-400 bg-blue-50 text-blue-800'
                          : 'border-red-400 bg-red-50 text-red-800'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {p.value === 'Urgent' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-dswd-blue text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg hover:shadow-xl hover:bg-blue-900 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          My Requests ({requests.length})
        </h2>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <HandHeart className="w-14 h-14 text-slate-200 mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-600 mb-1">No Requests Yet</h3>
            <p className="text-xs text-slate-400 mb-4">Click "New Request" to submit your first assistance request.</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-dswd-blue text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg hover:bg-blue-900 transition"
            >
              <Send className="w-4 h-4" />
              Submit New Request
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.Pending;
              const StatusIcon = statusConf.icon;
              const typeConf = getTypeConfig(req.type);
              const TypeIcon = typeConf.icon;
              const isExpanded = selectedRequest === req.id;

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  {/* Main Row */}
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
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-${statusConf.color}-100 text-${statusConf.color}-800 border border-${statusConf.color}-200 shrink-0`}>
                          <StatusIcon className={`w-3 h-3 text-${statusConf.color}-600`} />
                          {statusConf.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-500 font-semibold">{req.type}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className={`text-[10px] font-bold ${req.priority === 'Urgent' ? 'text-red-600' : req.priority === 'Low' ? 'text-slate-400' : 'text-blue-600'}`}>
                          {req.priority === 'Urgent' && '⚡ '}
                          {req.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400">{formatDate(req.created_at)}</span>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{req.description}</p>
                      </div>

                      {req.admin_notes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Staff Response
                          </p>
                          <p className="text-xs text-blue-900 leading-relaxed whitespace-pre-wrap">{req.admin_notes}</p>
                          {req.Reviewer && (
                            <p className="text-[10px] text-blue-600 mt-2">
                              — Reviewed by {req.Reviewer.first_name} {req.Reviewer.last_name} on {formatDate(req.reviewed_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

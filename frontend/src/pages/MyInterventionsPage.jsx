import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { interventionApi } from '../services/api';
import {
  FileHeart, Upload, Clock, CheckCircle, XCircle, Plus, Edit2, Trash2,
  Calendar, Building2, AlertCircle, FileText, X, Check, Eye
} from 'lucide-react';

const STATUS_CONFIG = {
  Pending: {
    icon: Clock,
    label: 'Pending Verification',
    color: 'amber',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200'
  },
  Verified: {
    icon: CheckCircle,
    label: 'Verified',
    color: 'emerald',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200'
  },
  Rejected: {
    icon: XCircle,
    label: 'Rejected',
    color: 'rose',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200'
  }
};

const AGENCY_OPTIONS = [
  'PhilHealth',
  'PCSO (Philippine Charity Sweepstakes Office)',
  'LGU (Local Government Unit)',
  'Barangay',
  'DOH (Department of Health)',
  'DSWD (Regional/Provincial)',
  'Private Foundation',
  'NGO (Non-Government Organization)',
  'Employer/Company',
  'Other'
];

const ASSISTANCE_TYPE_OPTIONS = [
  'Medical Assistance',
  'Hospital Bill Assistance',
  'Medicines Assistance',
  'Laboratory Assistance',
  'Financial Assistance',
  'Burial Assistance',
  'Educational Assistance',
  'Food Assistance',
  'Livelihood Assistance',
  'Other'
];

export default function MyInterventionsPage() {
  const [searchParams] = useSearchParams();
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedIntervention, setSelectedIntervention] = useState(null);

  const [form, setForm] = useState({
    agency_name: '',
    assistance_type: '',
    amount: '',
    description: '',
    date_received: '',
    proof_document: null
  });

  useEffect(() => {
    loadInterventions();
    if (searchParams.get('new') === '1') {
      setShowForm(true);
    }
  }, [searchParams]);

  const loadInterventions = async () => {
    try {
      setLoading(true);
      const res = await interventionApi.getMyInterventions();
      setInterventions(res.data.data || []);
    } catch (error) {
      console.error('Failed to load interventions:', error);
      showToast('error', 'Failed to load intervention history');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.agency_name || !form.assistance_type || !form.date_received) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    const formData = new FormData();
    formData.append('agency_name', form.agency_name);
    formData.append('assistance_type', form.assistance_type);
    formData.append('amount', form.amount || '0');
    formData.append('description', form.description || '');
    formData.append('date_received', form.date_received);
    if (form.proof_document) {
      formData.append('proof_document', form.proof_document);
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await interventionApi.updateMyIntervention(editingId, formData);
        showToast('success', 'Intervention updated successfully');
      } else {
        await interventionApi.submitIntervention(formData);
        showToast('success', 'Intervention submitted for staff verification');
      }
      
      resetForm();
      await loadInterventions();
    } catch (error) {
      console.error('Failed to submit intervention:', error);
      showToast('error', error.response?.data?.message || 'Failed to submit intervention');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (intervention) => {
    setEditingId(intervention.id);
    setForm({
      agency_name: intervention.agency_name,
      assistance_type: intervention.assistance_type,
      amount: intervention.amount || '',
      description: intervention.description || '',
      date_received: intervention.date_received,
      proof_document: null
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this intervention?')) {
      return;
    }

    try {
      await interventionApi.deleteMyIntervention(id);
      showToast('success', 'Intervention deleted successfully');
      await loadInterventions();
    } catch (error) {
      console.error('Failed to delete intervention:', error);
      showToast('error', error.response?.data?.message || 'Failed to delete intervention');
    }
  };

  const resetForm = () => {
    setForm({
      agency_name: '',
      assistance_type: '',
      amount: '',
      description: '',
      date_received: '',
      proof_document: null
    });
    setEditingId(null);
    setShowForm(false);
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

  const totalVerified = interventions
    .filter(i => i.status === 'Verified')
    .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
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
              <AlertCircle className="w-5 h-5 text-rose-600" />
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
            Assistance History
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            My Interventions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Report assistance received from other government agencies
          </p>
        </div>
        
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Report New Assistance
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Total Interventions</span>
            <FileHeart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{interventions.length}</div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-700">Verified</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-900">
            {interventions.filter(i => i.status === 'Verified').length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-700">Total Amount (Verified)</span>
            <span className="w-4 h-4 text-blue-600 flex items-center justify-center text-lg font-semibold leading-none">₱</span>
          </div>
          <div className="text-xl font-bold text-blue-900">{formatCurrency(totalVerified)}</div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            {editingId ? 'Edit Intervention' : 'Report New Assistance'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Agency Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Agency/Organization <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.agency_name}
                  onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                >
                  <option value="">Select Agency</option>
                  {AGENCY_OPTIONS.map(agency => (
                    <option key={agency} value={agency}>{agency}</option>
                  ))}
                </select>
              </div>

              {/* Assistance Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Assistance Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.assistance_type}
                  onChange={(e) => setForm({ ...form, assistance_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                >
                  <option value="">Select Type</option>
                  {ASSISTANCE_TYPE_OPTIONS.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Amount (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                />
              </div>

              {/* Date Received */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Date Received <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date_received}
                  onChange={(e) => setForm({ ...form, date_received: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description / Notes
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Additional details about the assistance received..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />
            </div>

            {/* Proof Document */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Proof Document (Receipt, Certificate, etc.)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setForm({ ...form, proof_document: e.target.files[0] })}
                className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="text-xs text-slate-500 mt-1">
                Max 10MB. Accepted formats: PDF, JPG, PNG, WEBP
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Submitting...' : editingId ? 'Update Intervention' : 'Submit for Verification'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Interventions Yet</h3>
            <p className="text-sm text-slate-500">
              Report any assistance you've received from other government agencies
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
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {intervention.agency_name}
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Type:</span>
                        <span className="ml-1 font-medium text-slate-900">{intervention.assistance_type}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Amount:</span>
                        <span className="ml-1 font-medium text-slate-900">{formatCurrency(intervention.amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Date:</span>
                        <span className="ml-1 font-medium text-slate-900">{formatDate(intervention.date_received)}</span>
                      </div>
                    </div>

                    {intervention.description && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                        {intervention.description}
                      </p>
                    )}

                    {intervention.status === 'Rejected' && intervention.rejection_reason && (
                      <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
                        <p className="text-xs font-medium text-rose-900">
                          <span className="font-bold">Rejection Reason:</span> {intervention.rejection_reason}
                        </p>
                      </div>
                    )}

                    {intervention.status === 'Verified' && intervention.Verifier && (
                      <p className="text-xs text-slate-500 mt-2">
                        Verified by {intervention.Verifier.first_name} {intervention.Verifier.last_name} on {formatDate(intervention.verified_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {intervention.proof_document_url && (
                      <a
                        href={`${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000'}${intervention.proof_document_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Document"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    )}
                    
                    {intervention.status !== 'Verified' && (
                      <>
                        <button
                          onClick={() => handleEdit(intervention)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(intervention.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

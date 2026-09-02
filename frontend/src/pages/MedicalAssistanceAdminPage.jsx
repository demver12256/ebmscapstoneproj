import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { medicalAssistanceApi, barangayApi } from '../services/api';
import {
  Stethoscope, Pill, FlaskConical, Building2, CheckCircle2, XCircle,
  AlertCircle, Upload, Eye, RefreshCw, FileText, Search, Filter,
  Clock, ShieldAlert, ShieldCheck, HelpCircle, Check, X,
  User, Phone, MapPin, DollarSign, ExternalLink, Sparkles,
  AlertTriangle, ChevronRight, FileCheck, Award
} from 'lucide-react';

const STATUS_CONFIG = {
  Draft: { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: FileText, label: 'Draft' },
  Incomplete: { bg: 'bg-amber-100 text-amber-900 border-amber-300', icon: AlertCircle, label: 'Incomplete' },
  'Pending Review': { bg: 'bg-blue-100 text-blue-900 border-blue-300', icon: Clock, label: 'Pending Review' },
  'Under Verification': { bg: 'bg-indigo-100 text-indigo-900 border-indigo-300', icon: RefreshCw, label: 'Under Verification' },
  Approved: { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', icon: CheckCircle2, label: 'Approved' },
  Rejected: { bg: 'bg-rose-100 text-rose-900 border-rose-300', icon: XCircle, label: 'Rejected' },
  'For Additional Requirements': { bg: 'bg-orange-100 text-orange-900 border-orange-300', icon: AlertTriangle, label: 'For Additional Requirements' },
  Released: { bg: 'bg-purple-100 text-purple-900 border-purple-300', icon: ShieldCheck, label: 'Released' },
  Archived: { bg: 'bg-slate-200 text-slate-700 border-slate-400', icon: FileText, label: 'Archived' },
};

export default function MedicalAssistanceAdminPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBarangay, setSelectedBarangay] = useState('all');

  // Inspection Drawer / Modal
  const [selectedApp, setSelectedApp] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Action Form Modals
  const [statusActionModal, setStatusActionModal] = useState(null); // 'Approve' | 'Reject' | 'For Additional Requirements' | 'Released' | 'Under Verification'
  const [approvedAmount, setApprovedAmount] = useState('');
  const [assistanceTypeGranted, setAssistanceTypeGranted] = useState('DSWD Guarantee Letter');
  const [rejectionReason, setRejectionReason] = useState('');
  const [additionalRequirementsNotes, setAdditionalRequirementsNotes] = useState('');
  const [staffRemarks, setStaffRemarks] = useState('');

  // Per-document review remarks
  const [docReviewModal, setDocReviewModal] = useState(null); // document object
  const [docReviewStatus, setDocReviewStatus] = useState('Approved');
  const [docReviewRemarks, setDocReviewRemarks] = useState('');

  const [notificationMsg, setNotificationMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus, selectedBarangay]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedStatus !== 'all') params.status = selectedStatus;
      if (selectedBarangay !== 'all') params.barangay_id = selectedBarangay;
      if (search.trim()) params.search = search.trim();

      const [appsRes, statsRes, brgyRes] = await Promise.all([
        medicalAssistanceApi.getAdminApplications(params),
        medicalAssistanceApi.getAdminStats(),
        barangayApi.list().catch(() => ({ data: { data: [] } })),
      ]);

      setApplications(appsRes.data?.data || []);
      setStats(statsRes.data?.data || null);
      setBarangays(brgyRes.data?.data || []);

      // If an app was selected, refresh its details
      if (selectedApp) {
        const refreshed = (appsRes.data?.data || []).find(a => a.id === selectedApp.id);
        if (refreshed) setSelectedApp(refreshed);
      }
    } catch (err) {
      console.error('Failed to load admin medical assistance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  // Open Status Action Modal
  const openStatusAction = (action) => {
    setStatusActionModal(action);
    setApprovedAmount(selectedApp?.total_amount_requested || '');
    setAssistanceTypeGranted(selectedApp?.assistance_type_granted || 'DSWD Guarantee Letter');
    setRejectionReason(selectedApp?.rejection_reason || '');
    setAdditionalRequirementsNotes(selectedApp?.additional_requirements_notes || '');
    setStaffRemarks(selectedApp?.staff_remarks || '');
  };

  // Submit Status Action
  const handleUpdateStatusSubmit = async () => {
    if (!selectedApp || !statusActionModal) return;

    setActionLoading(true);
    try {
      const payload = {
        status: statusActionModal,
        staff_remarks: staffRemarks.trim() || undefined,
      };

      if (statusActionModal === 'Approved') {
        payload.approved_amount = parseFloat(approvedAmount) || 0;
        payload.assistance_type_granted = assistanceTypeGranted;
      } else if (statusActionModal === 'Rejected') {
        if (!rejectionReason.trim()) {
          alert('Please enter a rejection reason.');
          setActionLoading(false);
          return;
        }
        payload.rejection_reason = rejectionReason.trim();
      } else if (statusActionModal === 'For Additional Requirements') {
        if (!additionalRequirementsNotes.trim()) {
          alert('Please specify the additional requirements needed.');
          setActionLoading(false);
          return;
        }
        payload.additional_requirements_notes = additionalRequirementsNotes.trim();
      }

      const res = await medicalAssistanceApi.updateApplicationStatus(selectedApp.id, payload);
      setSelectedApp(res.data.data);
      setStatusActionModal(null);
      setNotificationMsg({ type: 'success', text: `Application ${selectedApp.application_number} updated to ${statusActionModal}.` });
      loadData();
    } catch (err) {
      console.error('Failed to update status:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update application status.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Review single document
  const handleDocumentReviewSubmit = async () => {
    if (!docReviewModal) return;
    setActionLoading(true);
    try {
      await medicalAssistanceApi.reviewDocument(docReviewModal.id, {
        status: docReviewStatus,
        remarks: docReviewRemarks.trim() || undefined,
      });

      // Reload selected application
      const refreshedApp = await medicalAssistanceApi.getAdminApplication(selectedApp.id);
      setSelectedApp(refreshedApp.data.data);
      setDocReviewModal(null);
      setDocReviewRemarks('');
      setNotificationMsg({ type: 'success', text: `Document marked as ${docReviewStatus}.` });
    } catch (err) {
      console.error('Failed to review document:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to review document.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-2xl p-8 border border-white/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Administrative Verification Console
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Stethoscope className="w-9 h-9 text-blue-400" />
              Medical Assistance Verification
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
              Validate beneficiary clinical requirements, verify immediate and non-immediate family representations, inspect documents, request additional papers, and issue medical grants.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 backdrop-blur-md flex items-center gap-2 transition-all self-start sm:self-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Global Notification Toast */}
      {notificationMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg transition-all animate-fadeIn ${
            notificationMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {notificationMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{notificationMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotificationMsg(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block mb-1">Total Requests</span>
            <span className="text-2xl font-black text-slate-900">{stats.statusCounts?.total || 0}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-blue-200 bg-blue-50/20 shadow-sm">
            <span className="text-xs font-semibold text-blue-700 block mb-1">Pending Review</span>
            <span className="text-2xl font-black text-blue-800">{stats.statusCounts?.['Pending Review'] || 0}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-indigo-200 bg-indigo-50/20 shadow-sm">
            <span className="text-xs font-semibold text-indigo-700 block mb-1">Under Verification</span>
            <span className="text-2xl font-black text-indigo-800">{stats.statusCounts?.['Under Verification'] || 0}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-orange-200 bg-orange-50/20 shadow-sm">
            <span className="text-xs font-semibold text-orange-700 block mb-1">Needs Requirements</span>
            <span className="text-2xl font-black text-orange-800">{stats.statusCounts?.['For Additional Requirements'] || 0}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-sm">
            <span className="text-xs font-semibold text-emerald-700 block mb-1">Approved</span>
            <span className="text-2xl font-black text-emerald-800">{stats.statusCounts?.Approved || 0}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-purple-200 bg-purple-50/20 shadow-sm">
            <span className="text-xs font-semibold text-purple-700 block mb-1">Released</span>
            <span className="text-2xl font-black text-purple-800">{stats.statusCounts?.Released || 0}</span>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by App #, Patient, Representative..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="all">All Categories</option>
              <option value="Medicines Assistance">Medicines Assistance</option>
              <option value="Laboratory Assistance">Laboratory Assistance</option>
              <option value="Hospital Bill Assistance">Hospital Bill Assistance</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Under Verification">Under Verification</option>
              <option value="For Additional Requirements">For Additional Requirements</option>
              <option value="Approved">Approved</option>
              <option value="Released">Released</option>
              <option value="Rejected">Rejected</option>
              <option value="Draft">Draft</option>
              <option value="Incomplete">Incomplete</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Submit */}
          <div className="lg:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Application #</th>
                <th className="py-3.5 px-4">Patient & Representative</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Provider / Facility</th>
                <th className="py-3.5 px-4">Requested</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Checklist</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    Loading medical assistance applications...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-slate-400">
                    No medical assistance applications found matching the criteria.
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.Draft;
                  const StatusIcon = statusCfg.icon;
                  const isImmediate = app.is_immediate_family;

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedApp(app)}
                    >
                      <td className="py-4 px-5 font-mono font-bold text-blue-700">
                        {app.application_number}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {new Date(app.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 text-sm">{app.patient_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-500">
                            Rep: {app.representative_name || 'Self'} ({app.applicant_relationship})
                          </span>
                          {!isImmediate && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold" title="Non-Immediate family representative. Special authorization and barangay certificate required.">
                              Non-Immediate
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-semibold text-slate-800">{app.category}</span>
                        {app.hospital_confinement_status === 'currently_confined' && (
                          <span className="block text-[10px] text-blue-600 font-bold">Confined (Up to Present)</span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-medium text-slate-600">
                        {app.hospital_or_clinic_name || app.pharmacy_name || 'N/A'}
                      </td>

                      <td className="py-4 px-4 font-black text-slate-900">
                        ₱{Number(app.total_amount_requested || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        {app.approved_amount > 0 && (
                          <span className="block text-[10px] text-emerald-600 font-bold">
                            Grant: ₱{Number(app.approved_amount).toLocaleString('en-PH')}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.bg}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              app.is_complete ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="font-medium text-slate-600">
                            {app.total_uploaded}/{app.total_required} Docs
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApp(app);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          Verify & Review
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETAILED APPLICATION VERIFICATION MODAL / DRAWER */}
      {/* ========================================================================= */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-md">
                      {selectedApp.application_number}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        STATUS_CONFIG[selectedApp.status]?.bg || 'bg-slate-100'
                      }`}
                    >
                      {selectedApp.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1">{selectedApp.category}</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patient & Beneficiary Dossier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Patient Profile */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Patient Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Full Name</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedApp.patient_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Gender & DOB</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApp.patient_gender} • {selectedApp.patient_dob || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Hospital / Facility</span>
                      <span className="font-semibold text-slate-800">{selectedApp.hospital_or_clinic_name || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Attending Physician</span>
                      <span className="font-semibold text-slate-800">{selectedApp.attending_physician || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Clinical Diagnosis</span>
                      <p className="font-medium text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 mt-1">
                        {selectedApp.diagnosis || 'No clinical diagnosis specified.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Representative & Validation Check */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Representative Validation Dossier
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Relationship to Patient</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedApp.applicant_relationship}</span>
                    </div>

                    {/* Immediate Family vs Non-Immediate Notice */}
                    {selectedApp.is_immediate_family ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Immediate Family Member validated ({selectedApp.applicant_relationship}).</span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <ShieldAlert className="w-4 h-4 text-amber-700" />
                          Non-Immediate Family Representative
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-900/90">
                          Mandatory requirement: Verify that (1) Authorization Letter, (2) Patient's ID with 3 specimen signatures, and (3) Barangay Certification confirming representation/cohabitation are all attached and valid.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-slate-500 block">Representative Name</span>
                        <span className="font-semibold text-slate-900">{selectedApp.representative_name || 'Self'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Contact Number</span>
                        <span className="font-semibold text-slate-900">{selectedApp.representative_contact || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Requested Amount</span>
                        <span className="font-bold text-slate-900 text-sm">
                          ₱{Number(selectedApp.total_amount_requested || 0).toLocaleString('en-PH')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Approved Grant</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          ₱{Number(selectedApp.approved_amount || 0).toLocaleString('en-PH')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploaded Documents Inspection Panel */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                    Uploaded Document Verifications ({selectedApp.Documents?.length || 0})
                  </h4>
                  <span className="text-xs text-slate-500">
                    Click "Review" on any document to approve, reject, or request resubmission.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {(selectedApp.Documents || []).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-xs text-slate-900 line-clamp-1">{doc.document_name}</h5>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{doc.file_name} • {(doc.file_size / 1024).toFixed(0)} KB</p>
                        {doc.remarks && (
                          <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                            Notes: {doc.remarks}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="flex-1 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDocReviewModal(doc);
                            setDocReviewStatus(doc.status || 'Approved');
                            setDocReviewRemarks(doc.remarks || '');
                          }}
                          className="flex-1 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          Review Doc
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remarks and Review Feedback Box */}
              {(selectedApp.staff_remarks || selectedApp.additional_requirements_notes || selectedApp.rejection_reason) && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <h5 className="font-bold text-slate-700">Official Staff Records & Remarks:</h5>
                  {selectedApp.staff_remarks && (
                    <p className="text-slate-600"><strong>Staff Remarks:</strong> {selectedApp.staff_remarks}</p>
                  )}
                  {selectedApp.additional_requirements_notes && (
                    <p className="text-orange-800"><strong>Additional Requirements Requested:</strong> {selectedApp.additional_requirements_notes}</p>
                  )}
                  {selectedApp.rejection_reason && (
                    <p className="text-rose-800"><strong>Rejection Reason:</strong> {selectedApp.rejection_reason}</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer / Action Toolbar */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Current Status: <strong>{selectedApp.status}</strong>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openStatusAction('Under Verification')}
                  className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                >
                  Set Under Verification
                </button>

                <button
                  type="button"
                  onClick={() => openStatusAction('For Additional Requirements')}
                  className="px-3.5 py-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-colors"
                >
                  Request Additional Requirements
                </button>

                <button
                  type="button"
                  onClick={() => openStatusAction('Reject')}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors"
                >
                  Reject Application
                </button>

                <button
                  type="button"
                  onClick={() => openStatusAction('Approved')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
                >
                  Approve Application
                </button>

                {selectedApp.status === 'Approved' && (
                  <button
                    type="button"
                    onClick={() => openStatusAction('Released')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all"
                  >
                    Release Assistance
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATUS ACTION DIALOG MODAL */}
      {/* ========================================================================= */}
      {statusActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Action: {statusActionModal}
              </h3>
              <button
                type="button"
                onClick={() => setStatusActionModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* APPROVE FORM */}
            {statusActionModal === 'Approved' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approved Grant Amount (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    placeholder="Enter approved subsidy amount"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assistance Modality / Grant Type
                  </label>
                  <select
                    value={assistanceTypeGranted}
                    onChange={(e) => setAssistanceTypeGranted(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    <option value="DSWD Guarantee Letter (GL)">DSWD Guarantee Letter (GL)</option>
                    <option value="Direct Financial Assistance (Cash/Disbursement)">Direct Financial Assistance (Cash/Disbursement)</option>
                    <option value="Pharmacy Medicine Voucher">Pharmacy Medicine Voucher</option>
                    <option value="Hospital Billing Deductible Voucher">Hospital Billing Deductible Voucher</option>
                  </select>
                </div>
              </div>
            )}

            {/* REJECT FORM */}
            {statusActionModal === 'Rejected' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mandatory Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Specify why application does not qualify or why requirements are insufficient..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* FOR ADDITIONAL REQUIREMENTS */}
            {statusActionModal === 'For Additional Requirements' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specify Additional Requirements Needed <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={additionalRequirementsNotes}
                    onChange={(e) => setAdditionalRequirementsNotes(e.target.value)}
                    placeholder="e.g. Please attach signed Promissory Note from Hospital Billing and the official Barangay Certification..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* General Remarks */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Remarks / Verification Log
              </label>
              <textarea
                rows={2}
                value={staffRemarks}
                onChange={(e) => setStaffRemarks(e.target.value)}
                placeholder="Optional notes for internal tracking..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStatusActionModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatusSubmit}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all"
              >
                {actionLoading ? 'Saving...' : 'Confirm Status Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOCUMENT REVIEW MODAL */}
      {/* ========================================================================= */}
      {docReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Review Document</h3>
              <button
                type="button"
                onClick={() => setDocReviewModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Document: <strong className="text-slate-900">{docReviewModal.document_name}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={docReviewStatus}
                onChange={(e) => setDocReviewStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Needs Resubmission">Needs Resubmission</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Feedback / Remarks</label>
              <textarea
                rows={2}
                value={docReviewRemarks}
                onChange={(e) => setDocReviewRemarks(e.target.value)}
                placeholder="Remarks visible to the applicant if rejected or resubmission needed..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDocReviewModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDocumentReviewSubmit}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {actionLoading ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE DOCUMENT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{previewDoc.document_name}</h3>
                <p className="text-xs text-slate-500">{previewDoc.file_name} • {(previewDoc.file_size / 1024).toFixed(0)} KB</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`http://localhost:5000/${previewDoc.file_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
              {previewDoc.mime_type?.includes('pdf') || previewDoc.file_name?.endsWith('.pdf') ? (
                <iframe
                  src={`http://localhost:5000/${previewDoc.file_path}`}
                  title={previewDoc.document_name}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={`http://localhost:5000/${previewDoc.file_path}`}
                  alt={previewDoc.document_name}
                  className="max-h-[65vh] object-contain rounded-xl shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

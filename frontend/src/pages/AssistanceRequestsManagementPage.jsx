import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { assistanceRequestApi, medicalAssistanceApi, barangayApi } from '../services/api';
import {
  HandHeart, Clock, CheckCircle, XCircle, Eye, Search, Filter,
  ChevronDown, AlertTriangle, ShieldCheck, FileText, Users,
  Package, GraduationCap, Stethoscope, Utensils, Wallet, MoreHorizontal,
  X, MessageSquare, Circle, RefreshCw, Pill, FlaskConical, Building2,
  CheckCircle2, Upload, ExternalLink, Sparkles, ShieldAlert, ChevronRight,
  Check, User, Phone, MapPin, DollarSign, AlertCircle, FileCheck, HeartHandshake
} from 'lucide-react';

const ASSISTANCE_TYPES = [
  { value: 'Medical Assistance', label: 'Medical Assistance', icon: Stethoscope, color: 'blue' },
  { value: 'Hospital Assistance', label: 'Hospital Assistance', icon: Building2, color: 'rose' },
  { value: 'Educational Assistance', label: 'Educational Assistance', icon: GraduationCap, color: 'amber' },
  { value: 'Financial Assistance', label: 'Financial Assistance', icon: Wallet, color: 'emerald' },
  { value: 'Burial Assistance', label: 'Burial Assistance', icon: HeartHandshake, color: 'purple' },
  { value: 'Other', label: 'Other', icon: MoreHorizontal, color: 'slate' },
];

const GENERAL_STATUS_CONFIG = {
  Pending: { color: 'amber', icon: Clock, label: 'Pending', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  'Under Review': { color: 'blue', icon: Eye, label: 'Under Review', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  Approved: { color: 'emerald', icon: CheckCircle, label: 'Approved', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  Rejected: { color: 'red', icon: XCircle, label: 'Rejected', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  Completed: { color: 'purple', icon: CheckCircle, label: 'Completed', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
};

const MEDICAL_STATUS_CONFIG = {
  Draft: { bg: 'bg-slate-100 text-slate-800 border-slate-300', icon: FileText, label: 'Draft' },
  Incomplete: { bg: 'bg-amber-100 text-amber-900 border-amber-300', icon: AlertCircle, label: 'Incomplete' },
  'Pending Review': { bg: 'bg-blue-100 text-blue-900 border-blue-300', icon: Clock, label: 'Pending Review' },
  'Under Verification': { bg: 'bg-indigo-100 text-indigo-900 border-indigo-300', icon: RefreshCw, label: 'Under Verification' },
  'Under Barangay Verification': { bg: 'bg-indigo-100 text-indigo-900 border-indigo-300', icon: RefreshCw, label: 'Under Barangay Verification' },
  'Verified by Barangay': { bg: 'bg-teal-100 text-teal-900 border-teal-300', icon: ShieldCheck, label: 'Verified by Barangay (For Admin Approval)' },
  Approved: { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', icon: CheckCircle2, label: 'Approved by Admin' },
  Rejected: { bg: 'bg-rose-100 text-rose-900 border-rose-300', icon: XCircle, label: 'Rejected' },
  'For Additional Requirements': { bg: 'bg-orange-100 text-orange-900 border-orange-300', icon: AlertTriangle, label: 'For Additional Requirements' },
  Released: { bg: 'bg-purple-100 text-purple-900 border-purple-300', icon: ShieldCheck, label: 'Released' },
  Archived: { bg: 'bg-slate-200 text-slate-700 border-slate-400', icon: FileText, label: 'Archived' },
};

export default function AssistanceRequestsManagementPage() {
  const { user } = useAuth();

  // General Requests State
  const [requests, setRequests] = useState([]);
  const [generalStats, setGeneralStats] = useState({});
  const [generalSearchTerm, setGeneralSearchTerm] = useState('');
  const [generalFilterStatus, setGeneralFilterStatus] = useState('all');
  const [generalFilterType, setGeneralFilterType] = useState('all');
  const [selectedGeneralRequest, setSelectedGeneralRequest] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  // Medical Assistance State
  const [medicalApps, setMedicalApps] = useState([]);
  const [medicalStats, setMedicalStats] = useState(null);
  const [medicalSearch, setMedicalSearch] = useState('');
  const [medicalCategory, setMedicalCategory] = useState('all');
  const [medicalStatus, setMedicalStatus] = useState('all');
  const [medicalBarangay, setMedicalBarangay] = useState('all');
  const [selectedMedicalApp, setSelectedMedicalApp] = useState(null);
  const [medicalPreviewDoc, setMedicalPreviewDoc] = useState(null);

  // Medical Action Modals
  const [medicalStatusModal, setMedicalStatusModal] = useState(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [assistanceTypeGranted, setAssistanceTypeGranted] = useState('DSWD Guarantee Letter');
  const [rejectionReason, setRejectionReason] = useState('');
  const [additionalRequirementsNotes, setAdditionalRequirementsNotes] = useState('');
  const [staffRemarks, setStaffRemarks] = useState('');

  // Medical Document Review Modal
  const [docReviewModal, setDocReviewModal] = useState(null);
  const [docReviewStatus, setDocReviewStatus] = useState('Approved');
  const [docReviewRemarks, setDocReviewRemarks] = useState('');

  const [loading, setLoading] = useState(true);
  const [notificationMsg, setNotificationMsg] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadMedicalData();
  }, [medicalCategory, medicalStatus, medicalBarangay]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadGeneralData(), loadMedicalData()]);
    } catch (err) {
      console.error('Failed to load assistance requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGeneralData = async () => {
    try {
      const [reqRes, statsRes] = await Promise.all([
        assistanceRequestApi.list(),
        assistanceRequestApi.stats(),
      ]);
      setRequests(reqRes.data.data || []);
      setGeneralStats(statsRes.data.data || {});
    } catch (err) {
      console.error('Failed to load general requests:', err);
    }
  };

  const loadMedicalData = async () => {
    try {
      const params = {};
      if (medicalCategory !== 'all') params.category = medicalCategory;
      if (medicalStatus !== 'all') params.status = medicalStatus;
      if (medicalBarangay !== 'all') params.barangay_id = medicalBarangay;
      if (medicalSearch.trim()) params.search = medicalSearch.trim();

      const [appsRes, statsRes] = await Promise.all([
        medicalAssistanceApi.getAdminApplications(params),
        medicalAssistanceApi.getAdminStats(),
      ]);
      setMedicalApps(appsRes.data?.data || []);
      setMedicalStats(statsRes.data?.data || null);

      if (selectedMedicalApp) {
        const refreshed = (appsRes.data?.data || []).find(a => a.id === selectedMedicalApp.id);
        if (refreshed) setSelectedMedicalApp(refreshed);
      }
    } catch (err) {
      console.error('Failed to load medical applications:', err);
    }
  };

  // General Request Status Update
  const handleUpdateGeneralStatus = async () => {
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
      await loadGeneralData();
      setNotificationMsg({ type: 'success', text: `Request marked as ${actionStatus}.` });
    } catch (err) {
      console.error('Failed to update general request:', err);
      setNotificationMsg({ type: 'error', text: 'Failed to update request.' });
    } finally {
      setProcessing(false);
    }
  };

  // Medical Request Status Action
  const openMedicalStatusAction = (action) => {
    setMedicalStatusModal(action);
    setApprovedAmount(selectedMedicalApp?.total_amount_requested || '');
    setAssistanceTypeGranted(selectedMedicalApp?.assistance_type_granted || 'DSWD Guarantee Letter');
    setRejectionReason(selectedMedicalApp?.rejection_reason || '');
    setAdditionalRequirementsNotes(selectedMedicalApp?.additional_requirements_notes || '');
    setStaffRemarks(selectedMedicalApp?.staff_remarks || '');
  };

  const handleUpdateMedicalStatusSubmit = async () => {
    if (!selectedMedicalApp || !medicalStatusModal) return;

    setProcessing(true);
    try {
      const payload = {
        status: medicalStatusModal,
        staff_remarks: staffRemarks.trim() || undefined,
      };

      if (medicalStatusModal === 'Approved') {
        payload.approved_amount = parseFloat(approvedAmount) || 0;
        payload.assistance_type_granted = assistanceTypeGranted;
      } else if (medicalStatusModal === 'Verified by Barangay') {
        payload.barangay_endorsement_notes = staffRemarks.trim() || undefined;
      } else if (medicalStatusModal === 'Rejected') {
        if (!rejectionReason.trim()) {
          alert('Please enter a rejection reason.');
          setProcessing(false);
          return;
        }
        payload.rejection_reason = rejectionReason.trim();
      } else if (medicalStatusModal === 'For Additional Requirements') {
        if (!additionalRequirementsNotes.trim()) {
          alert('Please specify the additional requirements needed.');
          setProcessing(false);
          return;
        }
        payload.additional_requirements_notes = additionalRequirementsNotes.trim();
      }

      const res = await medicalAssistanceApi.updateApplicationStatus(selectedMedicalApp.id, payload);
      setSelectedMedicalApp(res.data.data);
      setMedicalStatusModal(null);
      setNotificationMsg({ type: 'success', text: `Medical Application ${selectedMedicalApp.application_number} updated to ${medicalStatusModal}.` });
      await loadMedicalData();
    } catch (err) {
      console.error('Failed to update medical status:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update application status.' });
    } finally {
      setProcessing(false);
    }
  };

  // Medical Single Document Review
  const handleDocumentReviewSubmit = async () => {
    if (!docReviewModal || !selectedMedicalApp) return;
    setProcessing(true);
    try {
      await medicalAssistanceApi.reviewDocument(docReviewModal.id, {
        status: docReviewStatus,
        remarks: docReviewRemarks.trim() || undefined,
      });
      const refreshedApp = await medicalAssistanceApi.getAdminApplication(selectedMedicalApp.id);
      setSelectedMedicalApp(refreshedApp.data.data);
      setDocReviewModal(null);
      setDocReviewRemarks('');
      setNotificationMsg({ type: 'success', text: `Document marked as ${docReviewStatus}.` });
      await loadMedicalData();
    } catch (err) {
      console.error('Failed to review document:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to review document.' });
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

  const getGeneralTypeConfig = (type) => ASSISTANCE_TYPES.find(t => t.value === type) || ASSISTANCE_TYPES[5];

  // Filter general requests
  const filteredGeneralRequests = requests.filter(req => {
    const name = `${req.Beneficiary?.first_name || ''} ${req.Beneficiary?.last_name || ''}`.toLowerCase();
    const subject = (req.subject || '').toLowerCase();
    const matchesSearch = !generalSearchTerm || name.includes(generalSearchTerm.toLowerCase()) || subject.includes(generalSearchTerm.toLowerCase());
    const matchesStatus = generalFilterStatus === 'all' || req.status === generalFilterStatus;
    const matchesType = generalFilterType === 'all' || req.type === generalFilterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
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

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
          <div className="absolute bottom-2 left-16 w-24 h-24 rounded-full bg-yellow-300/30 blur-xl" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-yellow-300 border border-white/20 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Administrative Verification Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <HandHeart className="w-8 h-8 text-yellow-300" />
              Assistance Requests
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Review and manage beneficiary assistance requests across DSWD programs: Medical, Hospital, Educational, Financial, and Burial assistance.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAllData}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md flex items-center gap-2 transition-all self-start sm:self-center shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

          {/* Stats Summary Cards (Image 1 style) */}
          {medicalStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500 block mb-1">Total Requests</span>
                <span className="text-2xl font-black text-slate-900">{medicalStats.statusCounts?.total || 0}</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-blue-200 bg-blue-50/30 shadow-sm">
                <span className="text-xs font-semibold text-blue-700 block mb-1">Pending Review</span>
                <span className="text-2xl font-black text-blue-800">{medicalStats.statusCounts?.['Pending Review'] || 0}</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-indigo-200 bg-indigo-50/30 shadow-sm">
                <span className="text-xs font-semibold text-indigo-700 block mb-1">Under Verification</span>
                <span className="text-2xl font-black text-indigo-800">{medicalStats.statusCounts?.['Under Verification'] || 0}</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-orange-200 bg-orange-50/30 shadow-sm">
                <span className="text-xs font-semibold text-orange-700 block mb-1">Needs Requirements</span>
                <span className="text-2xl font-black text-orange-800">{medicalStats.statusCounts?.['For Additional Requirements'] || 0}</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/30 shadow-sm">
                <span className="text-xs font-semibold text-emerald-700 block mb-1">Approved</span>
                <span className="text-2xl font-black text-emerald-800">{medicalStats.statusCounts?.Approved || 0}</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-purple-200 bg-purple-50/30 shadow-sm">
                <span className="text-xs font-semibold text-purple-700 block mb-1">Released</span>
                <span className="text-2xl font-black text-purple-800">{medicalStats.statusCounts?.Released || 0}</span>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadMedicalData();
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3"
            >
              <div className="lg:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={medicalSearch}
                  onChange={(e) => setMedicalSearch(e.target.value)}
                  placeholder="Search by App #, Patient, Representative..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="lg:col-span-3">
                <select
                  value={medicalCategory}
                  onChange={(e) => setMedicalCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="all">All Categories</option>
                  <option value="Medical Assistance">Medical Assistance</option>
                  <option value="Hospital Assistance">Hospital Assistance</option>
                  <option value="Educational Assistance">Educational Assistance</option>
                  <option value="Financial Assistance">Financial Assistance</option>
                  <option value="Burial Assistance">Burial Assistance</option>
                  <option value="Medicines Assistance">Medicines Assistance</option>
                  <option value="Laboratory Assistance">Laboratory Assistance</option>
                  <option value="Hospital Bill Assistance">Hospital Bill Assistance</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <select
                  value={medicalStatus}
                  onChange={(e) => setMedicalStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Under Verification">Under Verification</option>
                  <option value="Verified by Barangay">Verified by Barangay (For Admin Approval)</option>
                  <option value="For Additional Requirements">For Additional Requirements</option>
                  <option value="Approved">Approved</option>
                  <option value="Released">Released</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Draft">Draft</option>
                  <option value="Incomplete">Incomplete</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="lg:col-span-1">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                  ) : medicalApps.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-16 text-center text-slate-400">
                        No medical assistance applications found.
                      </td>
                    </tr>
                  ) : (
                    medicalApps.map((app) => {
                      const statusCfg = MEDICAL_STATUS_CONFIG[app.status] || MEDICAL_STATUS_CONFIG.Draft;
                      const StatusIcon = statusCfg.icon;
                      const isImmediate = app.is_immediate_family;

                      return (
                        <tr
                          key={app.id}
                          className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedMedicalApp(app)}
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
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
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
                                setSelectedMedicalApp(app);
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
      {/* MEDICAL APPLICATION VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {selectedMedicalApp && (
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
                      {selectedMedicalApp.application_number}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        MEDICAL_STATUS_CONFIG[selectedMedicalApp.status]?.bg || 'bg-slate-100'
                      }`}
                    >
                      {selectedMedicalApp.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1">{selectedMedicalApp.category}</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMedicalApp(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TWO-TIER HIERARCHY WORKFLOW STATUS BANNER */}
              <div className="p-4 rounded-2xl border bg-slate-50/90 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    selectedMedicalApp.barangay_verified_at || selectedMedicalApp.status === 'Verified by Barangay' || selectedMedicalApp.status === 'Approved' || selectedMedicalApp.status === 'Released'
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    1
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Stage 1: Barangay Verification</span>
                    <span className="text-xs font-black text-slate-800">
                      {selectedMedicalApp.barangay_verified_at || selectedMedicalApp.status === 'Verified by Barangay' || selectedMedicalApp.status === 'Approved' || selectedMedicalApp.status === 'Released'
                        ? `✅ Verified by ${selectedMedicalApp.BarangayVerifier?.first_name || 'Barangay Staff'}`
                        : 'Awaiting Barangay Review'}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block text-slate-300 font-black">➔</div>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    selectedMedicalApp.status === 'Approved' || selectedMedicalApp.status === 'Released'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : selectedMedicalApp.status === 'Verified by Barangay'
                      ? 'bg-blue-600 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Stage 2: Final Admin Approval</span>
                    <span className="text-xs font-black text-slate-800">
                      {selectedMedicalApp.status === 'Approved'
                        ? '✅ Final Approval Issued'
                        : selectedMedicalApp.status === 'Released'
                        ? '✅ Assistance Released'
                        : selectedMedicalApp.status === 'Verified by Barangay'
                        ? 'Pending Admin Final Approval'
                        : 'Awaiting Stage 1 Verification'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barangay Endorsement Remarks Callout */}
              {selectedMedicalApp.barangay_endorsement_notes && (
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-teal-900 block">Barangay Endorsement Remarks:</span>
                    <p className="text-teal-800 mt-0.5">{selectedMedicalApp.barangay_endorsement_notes}</p>
                    {selectedMedicalApp.barangay_verified_at && (
                      <span className="text-[10px] text-teal-600 block mt-1">
                        Endorsed on {new Date(selectedMedicalApp.barangay_verified_at).toLocaleString('en-PH')}
                      </span>
                    )}
                  </div>
                </div>
              )}

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
                      <span className="font-bold text-slate-900 text-sm">{selectedMedicalApp.patient_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Gender & DOB</span>
                      <span className="font-semibold text-slate-800">
                        {selectedMedicalApp.patient_gender} • {selectedMedicalApp.patient_dob || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Hospital / Facility</span>
                      <span className="font-semibold text-slate-800">{selectedMedicalApp.hospital_or_clinic_name || selectedMedicalApp.pharmacy_name || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Attending Physician</span>
                      <span className="font-semibold text-slate-800">{selectedMedicalApp.attending_physician || 'N/A'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Clinical Diagnosis</span>
                      <p className="font-medium text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200 mt-1">
                        {selectedMedicalApp.diagnosis || 'No clinical diagnosis specified.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Representative Validation Dossier */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Representative Validation Dossier
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Relationship to Patient</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedMedicalApp.applicant_relationship}</span>
                    </div>

                    {selectedMedicalApp.is_immediate_family ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Immediate Family Member validated ({selectedMedicalApp.applicant_relationship}).</span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <ShieldAlert className="w-4 h-4 text-amber-700" />
                          Non-Immediate Family Representative
                        </div>
                        <p className="text-[11px] leading-relaxed text-amber-900/90">
                          Verify that (1) Authorization Letter, (2) Patient's ID with 3 signatures, and (3) Barangay Certification are attached and valid.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-slate-500 block">Representative Name</span>
                        <span className="font-semibold text-slate-900">{selectedMedicalApp.representative_name || 'Self'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Contact Number</span>
                        <span className="font-semibold text-slate-900">{selectedMedicalApp.representative_contact || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Requested Amount</span>
                        <span className="font-bold text-slate-900 text-sm">
                          ₱{Number(selectedMedicalApp.total_amount_requested || 0).toLocaleString('en-PH')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Approved Grant</span>
                        <span className="font-bold text-emerald-700 text-sm">
                          ₱{Number(selectedMedicalApp.approved_amount || 0).toLocaleString('en-PH')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uploaded Documents */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                    Uploaded Document Verifications ({selectedMedicalApp.Documents?.length || 0})
                  </h4>
                  <span className="text-xs text-slate-500">
                    Click "Review Doc" to approve, reject, or request resubmission.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {(selectedMedicalApp.Documents || []).map((doc) => (
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
                          onClick={() => setMedicalPreviewDoc(doc)}
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

              {/* Remarks Records */}
              {(selectedMedicalApp.staff_remarks || selectedMedicalApp.additional_requirements_notes || selectedMedicalApp.rejection_reason) && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <h5 className="font-bold text-slate-700">Official Staff Records & Remarks:</h5>
                  {selectedMedicalApp.staff_remarks && (
                    <p className="text-slate-600"><strong>Staff Remarks:</strong> {selectedMedicalApp.staff_remarks}</p>
                  )}
                  {selectedMedicalApp.additional_requirements_notes && (
                    <p className="text-orange-800"><strong>Additional Requirements:</strong> {selectedMedicalApp.additional_requirements_notes}</p>
                  )}
                  {selectedMedicalApp.rejection_reason && (
                    <p className="text-rose-800"><strong>Rejection Reason:</strong> {selectedMedicalApp.rejection_reason}</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer / Action Toolbar */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Status: <strong className="text-slate-800">{selectedMedicalApp.status}</strong>
                {user?.role === 'barangay' && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    🏛️ Barangay Staff Reviewer
                  </span>
                )}
                {(['admin','mswdo_admin'].includes(user?.role) || user?.role === 'staff') && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    👑 System Administrator (Final Approver)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openMedicalStatusAction(user?.role === 'barangay' ? 'Under Barangay Verification' : 'Under Verification')}
                  className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                >
                  Set Under Verification
                </button>

                <button
                  type="button"
                  onClick={() => openMedicalStatusAction('For Additional Requirements')}
                  className="px-3.5 py-2 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-colors"
                >
                  Request Additional Requirements
                </button>

                <button
                  type="button"
                  onClick={() => openMedicalStatusAction('Rejected')}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors"
                >
                  Reject Application
                </button>

                {/* BARANGAY STAFF ACTION: ENDORSE TO ADMIN */}
                {user?.role === 'barangay' && (
                  <button
                    type="button"
                    onClick={() => openMedicalStatusAction('Verified by Barangay')}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Endorse to Admin (Verified)
                  </button>
                )}

                {/* ADMIN ACTION: FINAL APPROVAL & RELEASE */}
                {(['admin','mswdo_admin'].includes(user?.role) || user?.role === 'staff') && (
                  <>
                    <button
                      type="button"
                      onClick={() => openMedicalStatusAction('Approved')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve Application (Final)
                    </button>

                    {selectedMedicalApp.status === 'Approved' && (
                      <button
                        type="button"
                        onClick={() => openMedicalStatusAction('Released')}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all"
                      >
                        Release Assistance
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GENERAL ACTION MODAL */}
      {/* ========================================================================= */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
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
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400 transition bg-white"
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
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateGeneralStatus}
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

      {/* ========================================================================= */}
      {/* MEDICAL STATUS ACTION MODAL */}
      {/* ========================================================================= */}
      {medicalStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Action: {medicalStatusModal}
              </h3>
              <button
                type="button"
                onClick={() => setMedicalStatusModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {medicalStatusModal === 'Approved' && (
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

            {medicalStatusModal === 'Verified by Barangay' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-800 flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-teal-900">Endorse to Administrator for Final Approval</span>
                    <span className="text-teal-700 leading-relaxed block mt-0.5">
                      You are endorsing this application as verified. The System Administrator will be notified to perform the final check, determine the approved grant amount (₱), and issue final approval.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barangay Endorsement Notes (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={staffRemarks}
                    onChange={(e) => setStaffRemarks(e.target.value)}
                    placeholder="e.g. All requirements validated and confirmed resident. Recommended for full medical assistance subsidy."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {medicalStatusModal === 'Rejected' && (
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

            {medicalStatusModal === 'For Additional Requirements' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specify Additional Requirements Needed <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={additionalRequirementsNotes}
                    onChange={(e) => setAdditionalRequirementsNotes(e.target.value)}
                    placeholder="e.g. Please attach signed Promissory Note from Hospital Billing and official Barangay Certification..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

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
                onClick={() => setMedicalStatusModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateMedicalStatusSubmit}
                disabled={processing}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all"
              >
                {processing ? 'Saving...' : 'Confirm Status Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MEDICAL DOCUMENT REVIEW MODAL */}
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
                placeholder="Remarks visible to applicant if rejected or resubmission needed..."
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
                disabled={processing}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {processing ? 'Saving...' : 'Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MEDICAL DOCUMENT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {medicalPreviewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{medicalPreviewDoc.document_name}</h3>
                <p className="text-xs text-slate-500">{medicalPreviewDoc.file_name} • {(medicalPreviewDoc.file_size / 1024).toFixed(0)} KB</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`http://localhost:5000/${medicalPreviewDoc.file_path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setMedicalPreviewDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
              {medicalPreviewDoc.mime_type?.includes('pdf') || medicalPreviewDoc.file_name?.endsWith('.pdf') ? (
                <iframe
                  src={`http://localhost:5000/${medicalPreviewDoc.file_path}`}
                  title={medicalPreviewDoc.document_name}
                  className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={`http://localhost:5000/${medicalPreviewDoc.file_path}`}
                  alt={medicalPreviewDoc.document_name}
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

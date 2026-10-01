import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { assistanceRequestApi, beneficiaryApi } from '../services/api';
import { parseAttachments, getRequirementsForType } from '../utils/assistanceRequirements';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';
import {
  HandHeart, Clock, CheckCircle, XCircle, Eye, Search, Filter,
  AlertTriangle, ShieldCheck, FileText, Users,
  GraduationCap, Stethoscope, Wallet, MoreHorizontal,
  X, RefreshCw, Pill, FlaskConical, Building2,
  CheckCircle2, Sparkles, ShieldAlert,
  User, AlertCircle, HeartHandshake,
  Plus, Building, ExternalLink, Paperclip,
  Smartphone, QrCode
} from 'lucide-react';

const ASSISTANCE_TYPES = [
  { value: 'Medical Assistance', label: 'Medical Assistance', icon: Stethoscope, color: 'blue' },
  { value: 'Medicines Assistance', label: 'Medicines Assistance', icon: Pill, color: 'cyan' },
  { value: 'Hospital Assistance', label: 'Hospital Assistance', icon: Building2, color: 'rose' },
  { value: 'Laboratory Assistance', label: 'Laboratory Assistance', icon: FlaskConical, color: 'teal' },
  { value: 'Educational Assistance', label: 'Educational Assistance', icon: GraduationCap, color: 'amber' },
  { value: 'Financial Assistance', label: 'Financial Assistance', icon: Wallet, color: 'emerald' },
  { value: 'Burial Assistance', label: 'Burial Assistance', icon: HeartHandshake, color: 'purple' },
  { value: 'Other', label: 'Other', icon: MoreHorizontal, color: 'slate' },
];

const STATUS_CONFIG = {
  Pending: { color: 'amber', icon: Clock, label: 'Pending', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
  'Under Review': { color: 'blue', icon: Eye, label: 'Under Review', bg: 'bg-blue-100 text-blue-900 border-blue-300' },
  Approved: { color: 'emerald', icon: CheckCircle, label: 'Approved', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  Rejected: { color: 'red', icon: XCircle, label: 'Rejected', bg: 'bg-rose-100 text-rose-900 border-rose-300' },
  Completed: { color: 'purple', icon: CheckCircle, label: 'Completed', bg: 'bg-purple-100 text-purple-900 border-purple-300' },
};

export default function AssistanceRequestsManagementPage() {
  const { user } = useAuth();
  const isMswdo = user?.role === 'mswdo_admin';
  const isBarangayStaff = user?.role === 'barangay' || user?.role === 'staff';
  const canManageStatus = user?.role === 'admin' || user?.role === 'mswdo_admin';

  // Unified Requests State
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const filterAgency = isMswdo ? 'MSWDO' : 'DSWD';
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Status Action Modal
  const [actionModal, setActionModal] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  // RFID Claim Scanner Modal
  const [rfidClaimModalOpen, setRfidClaimModalOpen] = useState(false);
  const [rfidClaimTargetRequest, setRfidClaimTargetRequest] = useState(null);
  const [rfidInput, setRfidInput] = useState('');
  const [validIdChecked, setValidIdChecked] = useState(false);
  const [rfidClaimError, setRfidClaimError] = useState(null);
  const [rfidClaimSuccess, setRfidClaimSuccess] = useState(null);
  const [rfidClaimProcessing, setRfidClaimProcessing] = useState(false);

  const openRfidClaimModal = (req = null) => {
    setRfidClaimTargetRequest(req);
    setRfidInput('');
    setValidIdChecked(false);
    setRfidClaimError(null);
    setRfidClaimSuccess(null);
    setRfidClaimModalOpen(true);
  };

  const handleClaimRfidSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validIdChecked) {
      setRfidClaimError('Pakiusap lagyan ng check ang kumpirmasyon na na-check at na-beripika mo na ang Valid ID ng benepisyaryo.');
      return;
    }
    if (!rfidInput.trim()) {
      setRfidClaimError('Pakiusap i-tap ang RFID card sa scanner o i-type ang RFID number.');
      return;
    }

    setRfidClaimProcessing(true);
    setRfidClaimError(null);
    setRfidClaimSuccess(null);
    try {
      const res = await assistanceRequestApi.claimWithRfid({
        rfid_number: rfidInput.trim(),
        request_id: rfidClaimTargetRequest?.id || undefined,
        valid_id_verified: true,
      });

      if (res.data?.success) {
        setRfidClaimSuccess({
          message: 'Assistance request is claimed!',
          beneficiary: res.data.data?.beneficiary,
          request: res.data.data?.request,
        });
        setRfidInput('');
        await loadRequestsData();
      }
    } catch (err) {
      setRfidClaimError(err.response?.data?.message || err.message || 'Nabigong i-claim ang assistance request.');
    } finally {
      setRfidClaimProcessing(false);
    }
  };

  // Create Request Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [beneficiarySearchText, setBeneficiarySearchText] = useState('');
  const [createForm, setCreateForm] = useState({
    beneficiary_id: '',
    agency: isMswdo ? 'MSWDO' : 'DSWD',
    type: 'Medical Assistance',
    priority: 'Normal',
    subject: '',
    description: '',
    admin_notes: '',
  });

  const [loading, setLoading] = useState(true);
  const [notificationMsg, setNotificationMsg] = useState(null);

  useEffect(() => {
    loadRequestsData();
  }, [filterAgency]);

  const loadRequestsData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterAgency !== 'all') {
        params.agency = filterAgency;
      }
      const [reqRes, statsRes] = await Promise.all([
        assistanceRequestApi.list(params),
        assistanceRequestApi.stats(params),
      ]);
      setRequests(reqRes.data.data || []);
      setStats(statsRes.data.data || {});
    } catch (err) {
      console.error('Failed to load assistance requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal & load beneficiary list
  const openCreateModal = async () => {
    setCreateModalOpen(true);
    setCreateForm((prev) => ({
      ...prev,
      agency: isMswdo ? 'MSWDO' : 'DSWD',
    }));
    if (beneficiaries.length === 0) {
      try {
        const res = await beneficiaryApi.list();
        setBeneficiaries(res.data?.data || []);
      } catch (err) {
        console.error('Failed to load beneficiaries:', err);
      }
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!createForm.beneficiary_id) {
      alert('Please select a beneficiary.');
      return;
    }
    if (!createForm.subject.trim() || !createForm.description.trim()) {
      alert('Please enter both subject and description.');
      return;
    }
    setProcessing(true);
    try {
      await assistanceRequestApi.create(createForm);
      setCreateModalOpen(false);
      setCreateForm({
        beneficiary_id: '',
        agency: isMswdo ? 'MSWDO' : 'DSWD',
        type: 'Medical Assistance',
        priority: 'Normal',
        subject: '',
        description: '',
        admin_notes: '',
      });
      setBeneficiarySearchText('');
      setNotificationMsg({ type: 'success', text: `Assistance request successfully directed to ${createForm.agency}.` });
      await loadRequestsData();
    } catch (err) {
      console.error('Failed to create request:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create request.' });
    } finally {
      setProcessing(false);
    }
  };

  // Open Status Update Modal
  const openActionModal = (req) => {
    setActionModal(req);
    const initialStatus = req.status === 'Completed' ? 'Approved' : (req.status === 'Under Review' ? 'Approved' : (req.status || 'Under Review'));
    setActionStatus(initialStatus);
    if (initialStatus === 'Approved') {
      setActionNotes(req.admin_notes || `Inaprubahan at nakumpleto na ang iyong kahilingan para sa ${req.type}. Handa na itong i-claim sa tanggapan ng ${req.agency}.`);
    } else {
      setActionNotes(req.admin_notes || '');
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
      await loadRequestsData();
      setNotificationMsg({ type: 'success', text: `Request marked as ${actionStatus}.` });
    } catch (err) {
      console.error('Failed to update request:', err);
      setNotificationMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update request.' });
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

  const getTypeConfig = (type) => ASSISTANCE_TYPES.find(t => t.value === type) || ASSISTANCE_TYPES[7];

  // Filter requests locally by search, status, type, priority
  const filteredRequests = requests.filter(req => {
    const name = `${req.Beneficiary?.first_name || ''} ${req.Beneficiary?.last_name || ''}`.toLowerCase();
    const subject = (req.subject || '').toLowerCase();
    const desc = (req.description || '').toLowerCase();
    const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || subject.includes(searchTerm.toLowerCase()) || desc.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.type === filterType;
    const matchesPriority = filterPriority === 'all' || req.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });
  const requestPagination = usePagination(filteredRequests, 10);

  // Filter beneficiaries in Create Modal
  const filteredBeneficiaries = beneficiaries.filter(b => {
    if (!beneficiarySearchText.trim()) return true;
    const q = beneficiarySearchText.toLowerCase();
    const fullName = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
    const cat = (b.category || '').toLowerCase();
    const brgy = (b.Barangay?.barangay_name || '').toLowerCase();
    return fullName.includes(q) || cat.includes(q) || brgy.includes(q);
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

      {/* Unified Header Banner */}
      <div className={`text-white rounded-2xl p-6 shadow-xl relative overflow-hidden ${
        isMswdo
          ? 'bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900'
          : 'bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900'
      }`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
          <div className="absolute bottom-2 left-16 w-24 h-24 rounded-full bg-yellow-300/30 blur-xl" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-yellow-300 border border-white/20 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              {isMswdo ? 'MSWDO Municipal Office Console' : 'Social Welfare Assistance Console'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <HandHeart className="w-8 h-8 text-yellow-300" />
              Assistance Requests
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              {isMswdo
                ? 'Manage municipal assistance requests directed to MSWDO for Senior Citizens and Persons with Disabilities (PWD).'
                : 'Review and manage beneficiary assistance requests directed to DSWD and Municipal offices: Medical, Hospital, Educational, Financial, and Burial assistance.'}
            </p>
          </div>

          <button
            type="button"
            onClick={loadRequestsData}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md flex items-center gap-2 transition-all self-start sm:self-center shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Requests</span>
          <span className="text-2xl font-black text-slate-900">{stats.total || 0}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/30 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 block mb-1">Pending</span>
          <span className="text-2xl font-black text-amber-800">{stats.Pending || 0}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-blue-200 bg-blue-50/30 shadow-sm">
          <span className="text-xs font-semibold text-blue-700 block mb-1">Under Review</span>
          <span className="text-2xl font-black text-blue-800">{stats['Under Review'] || 0}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 block mb-1">Approved</span>
          <span className="text-2xl font-black text-emerald-800">{stats.Approved || 0}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/30 shadow-sm">
          <span className="text-xs font-semibold text-rose-700 block mb-1">Rejected</span>
          <span className="text-2xl font-black text-rose-800">{stats.Rejected || 0}</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-purple-200 bg-purple-50/30 shadow-sm">
          <span className="text-xs font-semibold text-purple-700 block mb-1">Completed</span>
          <span className="text-2xl font-black text-purple-800">{stats.Completed || 0}</span>
        </div>
      </div>

      {/* Unified Filters Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search beneficiary, subject..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Agency Selector Filter */}
          <div>
            {isMswdo ? (
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Office: MSWDO Municipal Aid</span>
              </div>
            ) : (
              <div className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-bold text-xs flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Office: DSWD National Aid</span>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          {/* Assistance Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white font-medium"
            >
              <option value="all">All Assistance Types</option>
              {ASSISTANCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {canManageStatus && (
            <button
              type="button"
              onClick={() => openRfidClaimModal(null)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition-all shrink-0 cursor-pointer"
              title="I-scan ang RFID ng benepisyaryo upang ma-claim ang tulong"
            >
              <Smartphone className="w-4 h-4" />
              RFID Claim Scanner
            </button>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0 cursor-pointer ${
              isMswdo
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Assistance Request
          </button>
        </div>
      </div>

      {/* Unified Assistance Requests Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">ID & Date</th>
                <th className="py-3.5 px-4">Beneficiary</th>
                <th className="py-3.5 px-4">Target Office</th>
                <th className="py-3.5 px-4">Assistance Type</th>
                <th className="py-3.5 px-4">Subject & Details</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    Loading assistance requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-slate-400">
                    <HandHeart className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No assistance requests found.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isMswdo
                        ? 'Assistance requests submitted to or created for MSWDO will appear here.'
                        : 'No requests match your current filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                requestPagination.paginatedData.map((req) => {
                  const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.Pending;
                  const StatusIcon = statusCfg.icon;
                  const typeCfg = getTypeConfig(req.type);
                  const TypeIcon = typeCfg.icon;
                  const isMswdoRequest = req.agency === 'MSWDO';

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <td className="py-4 px-5 font-mono font-bold text-slate-900">
                        REQ-#{req.id}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {new Date(req.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 text-sm">
                          {req.Beneficiary ? `${req.Beneficiary.first_name} ${req.Beneficiary.last_name}` : 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                            {req.Beneficiary?.category || 'Beneficiary'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {req.Beneficiary?.Barangay?.barangay_name || req.Barangay?.barangay_name || ''}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {isMswdoRequest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            🏢 MSWDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                            🏛️ DSWD
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <TypeIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {req.type}
                        </span>
                      </td>

                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 line-clamp-1">{req.subject}</div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{req.description}</p>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          req.priority === 'Urgent' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                          req.priority === 'High' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {req.priority || 'Normal'}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.bg}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          {req.claimed_at ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Claimed
                            </span>
                          ) : canManageStatus && ['Approved', 'Completed'].includes(req.status) ? (
                            <button
                              type="button"
                              onClick={() => openRfidClaimModal(req)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                              title="I-tap ang RFID card para i-claim ang tulong"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              Claim RFID
                            </button>
                          ) : null}
                          {canManageStatus && (
                            <button
                              type="button"
                              onClick={() => openActionModal(req)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer"
                            >
                              Status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-200 px-5 py-3">
            <Pagination
              currentPage={requestPagination.currentPage}
              totalPages={requestPagination.totalPages}
              onPageChange={requestPagination.goToPage}
              totalItems={requestPagination.totalItems}
              itemsPerPage={10}
              startIndex={requestPagination.startIndex}
              endIndex={requestPagination.endIndex}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REQUEST DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <HandHeart className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      REQ-#{selectedRequest.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        STATUS_CONFIG[selectedRequest.status]?.bg || 'bg-slate-100'
                      }`}
                    >
                      {selectedRequest.status}
                    </span>
                    {selectedRequest.claimed_at ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        CLAIMED VIA RFID
                      </span>
                    ) : (
                      selectedRequest.agency === 'MSWDO' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          🏢 Directed to MSWDO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                          🏛️ Directed to DSWD
                        </span>
                      )
                    )}
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mt-1">{selectedRequest.subject}</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
              {/* Beneficiary Details Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Beneficiary Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedRequest.Beneficiary
                        ? `${selectedRequest.Beneficiary.first_name} ${selectedRequest.Beneficiary.last_name}`
                        : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Category</span>
                    <span className="font-semibold text-slate-800">
                      {selectedRequest.Beneficiary?.category || 'N/A'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Barangay</span>
                    <span className="font-semibold text-slate-800">
                      {selectedRequest.Beneficiary?.Barangay?.barangay_name || selectedRequest.Barangay?.barangay_name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Request Metadata */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Assistance Modality</span>
                  <span className="font-bold text-slate-900">{selectedRequest.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Priority Level</span>
                  <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] mt-0.5 ${
                    selectedRequest.priority === 'Urgent' ? 'bg-rose-100 text-rose-800' :
                    selectedRequest.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedRequest.priority || 'Normal'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Target Office</span>
                  <span className="font-bold text-slate-900">
                    {selectedRequest.agency === 'MSWDO' ? '🏢 MSWDO (Municipal Social Welfare)' : '🏛️ DSWD (National Social Welfare)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Date Submitted</span>
                  <span className="font-semibold text-slate-800">{formatDate(selectedRequest.created_at)}</span>
                </div>
                {selectedRequest.User && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Submitted By</span>
                    <span className="font-medium text-slate-700">
                      {selectedRequest.User.first_name} {selectedRequest.User.last_name} ({selectedRequest.User.role})
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="font-bold text-slate-900 mb-1.5 text-xs">Request Description & Details:</h4>
                <p className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 whitespace-pre-wrap leading-relaxed text-slate-800">
                  {selectedRequest.description}
                </p>
              </div>

              {/* Official Category Requirements Checklist */}
              {(() => {
                const reqsConfig = getRequirementsForType(selectedRequest.type);
                if (!reqsConfig || !reqsConfig.requirements) return null;
                const attachments = parseAttachments(selectedRequest.attachment_url);

                return (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs">
                        Official Requirements for {selectedRequest.type}:
                      </h4>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Target: {selectedRequest.agency || 'DSWD'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {reqsConfig.requirements.map((item, idx) => {
                        const matchingAtt = attachments.find(
                          (a) =>
                            (a.requirementId && a.requirementId === item.id) ||
                            (a.requirementName &&
                              (a.requirementName.toLowerCase() === (item.filipinoName || '').toLowerCase() ||
                               a.requirementName.toLowerCase() === item.name.toLowerCase()))
                        );

                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border text-slate-700 flex flex-col justify-between gap-1.5 ${
                              matchingAtt
                                ? 'bg-emerald-50/50 border-emerald-300'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={`w-4 h-4 rounded-full font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5 ${
                                  matchingAtt
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {item.filipinoName || item.name}
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                                      item.mandatory
                                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {item.tag || (item.mandatory ? 'Required' : 'Supporting')}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-2">
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            {/* Attached document status for this requirement */}
                            {matchingAtt && (
                              <div className="pt-1 border-t border-emerald-200/60 flex items-center justify-between text-[10px]">
                                <span className="text-emerald-700 font-semibold truncate flex items-center gap-1">
                                  <Paperclip className="w-3 h-3 text-emerald-600" />
                                  <span className="truncate">{matchingAtt.name}</span>
                                </span>
                                <a
                                  href={matchingAtt.url?.startsWith('http') ? matchingAtt.url : `http://localhost:5000${matchingAtt.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-800 font-bold hover:underline shrink-0"
                                >
                                  View
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Supporting Documents / Attachments */}
              {selectedRequest.attachment_url && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    <span>Uploaded Documents / Kalakip na Dokumento:</span>
                  </h4>
                  <div className="space-y-2">
                    {parseAttachments(selectedRequest.attachment_url).map((att, attIdx) => (
                      <div
                        key={attIdx}
                        className="p-3 bg-blue-50/50 rounded-2xl border border-blue-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-slate-900 text-xs block truncate">
                              {att.requirementName ? `${att.requirementName}: ` : ''}{att.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {att.size ? `${(att.size / 1024 / 1024).toFixed(2)} MB • ` : ''}
                              {att.requirementName ? 'Official Requirement' : 'Supporting Document'}
                            </span>
                          </div>
                        </div>
                        <a
                          href={att.url?.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs shrink-0"
                        >
                          <span>View File</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Administrative Remarks / Reviewer Notes */}
              {(selectedRequest.admin_notes || selectedRequest.Reviewer) && (
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                  <h4 className="font-bold text-blue-900 text-xs">Administrative Notes & Review:</h4>
                  {selectedRequest.Reviewer && (
                    <p className="text-blue-800 text-[11px]">
                      <strong>Reviewed By:</strong> {selectedRequest.Reviewer.first_name} {selectedRequest.Reviewer.last_name} ({selectedRequest.Reviewer.role})
                      {selectedRequest.reviewed_at && ` on ${formatDate(selectedRequest.reviewed_at)}`}
                    </p>
                  )}
                  {selectedRequest.admin_notes && (
                    <p className="text-slate-700 text-xs bg-white p-2.5 rounded-xl border border-blue-200">
                      {selectedRequest.admin_notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              {canManageStatus ? (
                <div className="flex items-center gap-2">
                  {['Approved', 'Completed'].includes(selectedRequest.status) && !selectedRequest.claimed_at && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedRequest;
                        setSelectedRequest(null);
                        openRfidClaimModal(target);
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4" />
                      Claim via RFID
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedRequest;
                      setSelectedRequest(null);
                      openActionModal(target);
                    }}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Update Request Status
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  👁️ View-only mode (Admin lamang ang makakapag-apruba o magbabago ng status)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE NEW ASSISTANCE REQUEST MODAL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl text-white shadow-md ${isMswdo ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Create Assistance Request</h3>
                  <p className="text-xs text-slate-500">
                    File an official assistance request directed to the appropriate agency office.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4 text-xs">
              {/* Target Office Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Target Office / Kaninong Tanggapan <span className="text-red-500">*</span>
                </label>
                {isMswdo ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>Directed to: MSWDO (Municipal Social Welfare and Development Office)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, agency: 'DSWD' })}
                      className={`p-3 rounded-xl border-2 text-left font-bold transition-all ${
                        createForm.agency === 'DSWD'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      🏛️ DSWD (National)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, agency: 'MSWDO' })}
                      className={`p-3 rounded-xl border-2 text-left font-bold transition-all ${
                        createForm.agency === 'MSWDO'
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      🏢 MSWDO (Municipal)
                    </button>
                  </div>
                )}
              </div>

              {/* Beneficiary Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Beneficiary <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Type to search beneficiaries..."
                  value={beneficiarySearchText}
                  onChange={(e) => setBeneficiarySearchText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl mb-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <select
                  required
                  value={createForm.beneficiary_id}
                  onChange={(e) => setCreateForm({ ...createForm, beneficiary_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Choose Beneficiary ({filteredBeneficiaries.length} available) --</option>
                  {filteredBeneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.first_name} {b.last_name} ({b.category}) - {b.Barangay?.barangay_name || 'No Brgy'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type and Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Assistance Modality <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    {ASSISTANCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Priority Level</label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Subject / Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Request for maintenance medicine subsidy"
                  value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Detailed Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide context, estimated cost, requirements presented..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Administrative Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Endorsed by social worker"
                  value={createForm.admin_notes}
                  onChange={(e) => setCreateForm({ ...createForm, admin_notes: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-md transition-all ${
                    isMswdo ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                  }`}
                >
                  {processing ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATUS ACTION MODAL */}
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
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                <p className="text-xs font-bold text-slate-800">{actionModal.subject}</p>
                <p className="text-[10px] text-slate-500">
                  {actionModal.Beneficiary?.first_name} {actionModal.Beneficiary?.last_name} • {actionModal.type} • {actionModal.agency}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">New Status</label>
                <select
                  value={actionStatus}
                  onChange={(e) => {
                    const newSt = e.target.value;
                    setActionStatus(newSt);
                    if (newSt === 'Approved' || newSt === 'Completed') {
                      if (!actionNotes || actionNotes.includes('Kasalukuyang sinusuri')) {
                        setActionNotes(`Inaprubahan at nakumpleto na ang iyong kahilingan para sa ${actionModal.type}. Handa na itong i-claim sa tanggapan ng ${actionModal.agency}.`);
                      }
                    } else if (newSt === 'Under Review') {
                      if (!actionNotes || actionNotes.includes('Inaprubahan')) {
                        setActionNotes(`Kasalukuyang sinusuri ng ${actionModal.agency} ang mga isinumiteng dokumento para sa ${actionModal.type}. Mangyaring abangan ang susunod na abiso.`);
                      }
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-400 transition bg-white"
                >
                  <option value="Under Review">Under Review (Sinusuri)</option>
                  <option value="Approved">Approved & Completed (Na-aprubahan at Handa nang I-claim)</option>
                  <option value="Rejected">Rejected (Tinanggihan)</option>
                  <option value="Pending">Pending</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 Kapag pinili ang <strong>Approved & Completed</strong>, mamarkahan itong completed at maaari na itong i-claim ng benepisyaryo.
                </p>
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

      {/* ========================================================================= */}
      {/* RFID CLAIM SCANNER MODAL */}
      {/* ========================================================================= */}
      {rfidClaimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-purple-100 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">RFID Assistance Claim Scanner</h3>
                  <p className="text-[11px] text-purple-200">
                    I-verify ang Valid ID at i-tap ang RFID card ng benepisyaryo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRfidClaimModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition cursor-pointer text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Target Request Info if initiated from specific row */}
              {rfidClaimTargetRequest && (
                <div className="bg-purple-50/70 rounded-2xl p-4 border border-purple-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-purple-900">REQ-#{rfidClaimTargetRequest.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                      {rfidClaimTargetRequest.type}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{rfidClaimTargetRequest.subject}</h4>
                  <p className="text-xs text-slate-600">
                    Benepisyaryo: <strong>{rfidClaimTargetRequest.Beneficiary?.first_name} {rfidClaimTargetRequest.Beneficiary?.last_name}</strong> • Brgy. {rfidClaimTargetRequest.Beneficiary?.Barangay?.barangay_name || rfidClaimTargetRequest.Barangay?.barangay_name || 'N/A'}
                  </p>
                  {rfidClaimTargetRequest.Beneficiary?.RFID_number && (
                    <p className="text-[11px] font-mono text-purple-700 pt-0.5">
                      Registered RFID: <strong>{rfidClaimTargetRequest.Beneficiary.RFID_number}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Error Box */}
              {rfidClaimError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span className="font-medium">{rfidClaimError}</span>
                </div>
              )}

              {/* Success Result Box */}
              {rfidClaimSuccess ? (
                <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-3 animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-emerald-900">
                      🎉 Assistance Request is Claimed!
                    </h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      Matagumpay na na-claim ang tulong para kay:
                    </p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {rfidClaimSuccess.beneficiary?.name} (Brgy. {rfidClaimSuccess.beneficiary?.barangay})
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      RFID Tap: {rfidClaimSuccess.beneficiary?.rfid} • REQ-#{rfidClaimSuccess.request?.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRfidClaimSuccess(null);
                      setRfidInput('');
                      setValidIdChecked(false);
                      setRfidClaimModalOpen(false);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                  >
                    Tapos Na (Done)
                  </button>
                </div>
              ) : (
                <form onSubmit={handleClaimRfidSubmit} className="space-y-4">
                  {/* Step 1: Valid ID Verification Checkbox */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    validIdChecked ? 'bg-emerald-50/50 border-emerald-300' : 'bg-amber-50/60 border-amber-200'
                  }`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={validIdChecked}
                        onChange={(e) => {
                          setValidIdChecked(e.target.checked);
                          setRfidClaimError(null);
                        }}
                        className="w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 block">
                          Step 1: I-verify ang Valid ID ng Benepisyaryo <span className="text-red-500">*</span>
                        </span>
                        <span className="text-[11px] text-slate-600 leading-relaxed block mt-0.5">
                          Kinukumpirma ko na ipinakita ng benepisyaryo ang kanyang opisyal na <strong>Valid ID / Beneficiary ID</strong> at nagtutugma ang kanyang pagkakakilanlan bago i-release ang ayuda.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Step 2: RFID Scanner Input */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    !validIdChecked ? 'opacity-60 pointer-events-none' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                        Step 2: I-tap ang RFID Card sa Scanner
                      </span>
                      <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded">
                        Ready to scan
                      </span>
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        disabled={!validIdChecked || rfidClaimProcessing}
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        placeholder="I-tap ang RFID card dito..."
                        className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl text-sm font-mono font-bold text-center tracking-wider bg-white focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                      Maaari ring i-type manual ang RFID number kung sakaling walang physical scanner na nakasaksak.
                    </p>
                  </div>

                  {/* Submit / Process Button */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setRfidClaimModalOpen(false)}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Kanselahin
                    </button>
                    <button
                      type="submit"
                      disabled={!validIdChecked || !rfidInput.trim() || rfidClaimProcessing}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-md shadow-purple-500/20 transition cursor-pointer"
                    >
                      {rfidClaimProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Bine-beripika...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Kumpirmahin at I-claim</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

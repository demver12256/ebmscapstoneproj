import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  X, Users, Clock, Eye, EyeOff, AlertTriangle, FileCheck, ShieldAlert, 
  Download, Archive, Edit3, CreditCard, User, MapPin, Calendar, Phone, Lock, ShieldCheck,
  CheckCircle2, XCircle, Clock4, Award, RefreshCw, Package, Layers, BookmarkCheck, Wallet, Building2, ExternalLink, Sparkles, Gift
} from 'lucide-react';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { beneficiaryApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BeneficiaryListPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const pendingPagination = usePagination(pendingApplications, 10);
  const [selectedBarangayId, setSelectedBarangayId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIpClassification, setSelectedIpClassification] = useState('');
  const [selectedPayoutStatus, setSelectedPayoutStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Viewing Beneficiary Details State
  const [viewingBeneficiary, setViewingBeneficiary] = useState(null);
  const [rfidInput, setRfidInput] = useState('');
  const [rfidSaving, setRfidSaving] = useState(false);
  const [rfidMsg, setRfidMsg] = useState(null);
  const [showFullAccountNo, setShowFullAccountNo] = useState(false);
  const [modalTab, setModalTab] = useState('profile'); // 'profile' | 'attendance' | 'distributions' | 'programs'
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);

  // Distributions & Enrollments Modal Data
  const [distributionsData, setDistributionsData] = useState(null);
  const [distributionsLoading, setDistributionsLoading] = useState(false);
  const [distributionsError, setDistributionsError] = useState(null);

  const [enrollmentsData, setEnrollmentsData] = useState(null);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentsError, setEnrollmentsError] = useState(null);

  // Edit Modal State
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);

  // Pending Applications Modal State
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [missingDocs, setMissingDocs] = useState([]);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const CATEGORIES = [
    '4Ps Household Beneficiary',
    'Senior Citizens (Social Pension)',
    'Persons with Disabilities (PWD)'
  ];
  const displayCategories = CATEGORIES;

  const is4PsCategory = (cat) => {
    if (!cat) return false;
    const c = String(cat).toLowerCase();
    return c.includes('4ps') || c.includes('pantawid');
  };

  const getBackendUrl = () => {
    const defaultApiUrl = 'http://localhost:5000/api';
    const envApiUrl = process.env.REACT_APP_API_URL || defaultApiUrl;
    return envApiUrl.replace('/api', '');
  };

  const backendUrl = getBackendUrl();

  const loadAllData = async () => {
    setLoading(true);
    try {
      const promises = [
        beneficiaryApi.list(),
        barangayApi.list()
      ];
      if (['admin','mswdo_admin'].includes(user?.role)) {
        promises.push(beneficiaryApi.listApplications());
      }
      const results = await Promise.all(promises);
      setBeneficiaries(results[0].data?.data || []);
      setBarangays(results[1].data?.data || []);
      
      if (['admin','mswdo_admin'].includes(user?.role) && results[2]) {
        const apps = results[2].data?.data || [];
        // Filter non-approved applications for the pending queue
        // MSWDO only approves Senior Citizens & PWD; DSWD approves 4Ps, Senior Citizens, and PWD
        const pendingList = apps.filter(a => {
          if (a.status === 'Approved') return false;
          if (isMswdoAdmin && is4PsCategory(a.category)) return false;
          return true;
        });
        setPendingApplications(pendingList);
      } else {
        setPendingApplications([]);
      }

      if (user?.role === 'staff' && user?.barangay_id) {
        setSelectedBarangayId(String(user.barangay_id));
      }
    } catch (err) {
      setError(err.message || 'Unable to load beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  useEffect(() => {
    if (['admin','mswdo_admin'].includes(user?.role) && (location.state?.openPending || new URLSearchParams(location.search).get('pending') === 'true')) {
      openPendingModal();
    }
    const params = new URLSearchParams(location.search);
    const payoutParam = params.get('payout_status') || location.state?.payout_status;
    if (payoutParam) {
      setSelectedPayoutStatus(payoutParam);
    }
  }, [location, user]);

  const openPendingModal = async () => {
    if (!['admin','mswdo_admin'].includes(user?.role)) return;
    setShowPendingModal(true);
    setLoadingPending(true);
    try {
      const appsRes = await beneficiaryApi.listApplications();
      const apps = appsRes.data.data || [];
      const pendingList = apps.filter(a => {
        if (a.status === 'Approved') return false;
        if (isMswdoAdmin && is4PsCategory(a.category)) return false;
        return true;
      });
      setPendingApplications(pendingList);
    } catch (err) {
      console.error('Failed to reload pending applications:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatScanTime = (ts) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return ts;
    }
  };

  const fetchBeneficiaryAttendance = async (beneficiaryId) => {
    if (!beneficiaryId) return;
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const res = await beneficiaryApi.getAttendance(beneficiaryId);
      if (res.data?.success) {
        setAttendanceData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load beneficiary attendance:', err);
      setAttendanceError(err.response?.data?.message || 'Hindi ma-load ang attendance records.');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchBeneficiaryDistributions = async (beneficiaryId) => {
    if (!beneficiaryId) return;
    setDistributionsLoading(true);
    setDistributionsError(null);
    try {
      const res = await beneficiaryApi.getDistributions(beneficiaryId);
      if (res.data?.success) {
        setDistributionsData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load beneficiary distributions:', err);
      setDistributionsError(err.response?.data?.message || 'Hindi ma-load ang distribution claims.');
    } finally {
      setDistributionsLoading(false);
    }
  };

  const fetchBeneficiaryEnrollments = async (beneficiaryId) => {
    if (!beneficiaryId) return;
    setEnrollmentsLoading(true);
    setEnrollmentsError(null);
    try {
      const res = await beneficiaryApi.getEnrollments(beneficiaryId);
      if (res.data?.success) {
        setEnrollmentsData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load beneficiary enrollments:', err);
      setEnrollmentsError(err.response?.data?.message || 'Hindi ma-load ang program enrollments.');
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  const handleRefreshModalData = () => {
    if (!viewingBeneficiary) return;
    fetchBeneficiaryAttendance(viewingBeneficiary.id);
    fetchBeneficiaryDistributions(viewingBeneficiary.id);
    fetchBeneficiaryEnrollments(viewingBeneficiary.id);
  };

  const handleViewBeneficiary = (beneficiary) => {
    setViewingBeneficiary(beneficiary);
    setShowFullAccountNo(false);
    setRfidInput(beneficiary.RFID_number || '');
    setRfidMsg(null);
    setModalTab('profile');
    setAttendanceData(null);
    setDistributionsData(null);
    setEnrollmentsData(null);
    fetchBeneficiaryAttendance(beneficiary.id);
    fetchBeneficiaryDistributions(beneficiary.id);
    fetchBeneficiaryEnrollments(beneficiary.id);
  };

  const handleSaveRfidDirect = async (e) => {
    if (e) e.preventDefault();
    if (!['admin','mswdo_admin'].includes(user?.role)) return;
    setRfidSaving(true);
    setRfidMsg(null);
    try {
      const updatedValue = rfidInput.trim() || null;
      await beneficiaryApi.update(viewingBeneficiary.id, {
        RFID_number: updatedValue
      });
      setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, RFID_number: updatedValue } : b));
      setViewingBeneficiary(prev => ({ ...prev, RFID_number: updatedValue }));
      setRfidMsg({ type: 'success', text: '✓ RFID card registered successfully!' });
    } catch (err) {
      setRfidMsg({ type: 'error', text: err.message || 'Failed to save RFID card' });
    } finally {
      setRfidSaving(false);
    }
  };

  const handleEditClick = (beneficiary) => {
    if (!['admin','mswdo_admin'].includes(user?.role) && (user?.role === 'staff' || user?.role === 'barangay') && beneficiary.barangay_id !== user?.barangay_id) {
      setEditError('You can only edit beneficiaries from your own barangay');
      return;
    }
    
    setEditingBeneficiary(beneficiary);
    setEditFormData({
      RFID_number: beneficiary.RFID_number || '',
      status: beneficiary.User?.status || 'active',
      inactivation_reason: beneficiary.inactivation_reason || '',
      payout_preference: beneficiary.payout_preference || 'cash_otc',
      payout_provider: beneficiary.payout_provider || '',
      payout_account_number: beneficiary.payout_account_number || '',
      payout_account_name: beneficiary.payout_account_name || '',
    });
    setEditError(null);
    setEditSuccess(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (editFormData.status === 'inactive' && !editFormData.inactivation_reason?.trim()) {
      setEditError('Please enter a note / reason for making this beneficiary inactive.');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const payload = {
        ...editFormData,
        inactivation_reason: editFormData.status === 'inactive' ? editFormData.inactivation_reason.trim() : null
      };

      await beneficiaryApi.update(editingBeneficiary.id, payload);
      
      setBeneficiaries(
        beneficiaries.map((b) =>
          b.id === editingBeneficiary.id
            ? { 
                ...b, 
                RFID_number: payload.RFID_number,
                inactivation_reason: payload.inactivation_reason,
                User: { ...b.User, status: payload.status }
              }
            : b
        )
      );

      setEditSuccess('✓ Beneficiary updated successfully!');
      setTimeout(() => {
        setEditingBeneficiary(null);
        setEditSuccess(null);
      }, 1500);
    } catch (err) {
      setEditError(err.message || 'Failed to update beneficiary');
    } finally {
      setEditLoading(false);
    }
  };

  // Review & Approval handlers for Pending Modal
  const handleStartReview = async (appId) => {
    if (isMswdoAdmin && selectedApp && is4PsCategory(selectedApp.category)) {
      alert('Access Denied: MSWDO can only review Senior Citizens and PWD applications. 4Ps applications must be reviewed by DSWD.');
      return;
    }
    try {
      const res = await beneficiaryApi.reviewApplication(appId);
      if (res.data?.success) {
        setSelectedApp(prev => ({ ...prev, status: 'Under Review' }));
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Failed to start review.');
    }
  };

  const handleApproveApplication = async (appId) => {
    if (isMswdoAdmin && selectedApp && is4PsCategory(selectedApp.category)) {
      alert('Access Denied: MSWDO can only approve Senior Citizens and PWD applications. 4Ps applications must be approved by DSWD.');
      return;
    }
    if (!window.confirm('Are you sure you want to approve this application? This will issue a unique Beneficiary ID code.')) return;
    try {
      const res = await beneficiaryApi.approveApplication(appId);
      if (res.data?.success) {
        alert('Application approved successfully!');
        setSelectedApp(null);
        setPreviewUrl(null);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleRejectApplication = async (e) => {
    e.preventDefault();
    if (isMswdoAdmin && selectedApp && is4PsCategory(selectedApp.category)) {
      alert('Access Denied: MSWDO can only process Senior Citizens and PWD applications. 4Ps applications must be handled by DSWD.');
      return;
    }
    if (!rejectionReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }
    try {
      const res = await beneficiaryApi.rejectApplication(selectedApp.id, {
        rejection_reason: rejectionReason,
        missing_documents: missingDocs
      });
      if (res.data?.success) {
        alert('Application rejected.');
        setSelectedApp(null);
        setPreviewUrl(null);
        setShowRejectForm(false);
        setRejectionReason('');
        setMissingDocs([]);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Rejection failed.');
    }
  };

  const handleToggleMissingDoc = (doc) => {
    if (missingDocs.includes(doc)) {
      setMissingDocs(prev => prev.filter(d => d !== doc));
    } else {
      setMissingDocs(prev => [...prev, doc]);
    }
  };

  const getRequiredFilesList = (cat = '') => {
    const list = [
      { name: 'Valid Government ID / National ID', required: true }
    ];
    if (cat.includes('4Ps')) {
      list.push({ name: 'PSA Birth Certificate', required: true });
      list.push({ name: 'Barangay Certificate of Residency or Indigency', required: true });
      list.push({ name: 'Certificate of Enrollment', required: false });
    } else if (cat.includes('Senior')) {
      list.push({ name: 'Social Pension Application Form', required: true });
      list.push({ name: 'OSCA ID (optional if available)', required: false });
    } else if (cat.includes('PWD') || cat.includes('Disabilit')) {
      list.push({ name: 'Medical Certificate', required: true });
      list.push({ name: 'PWD Application Form', required: true });
    }
    return list;
  };

  const [showArchivedOnly, setShowArchivedOnly] = useState(false);

  const isArchivedBeneficiary = (b) => {
    return b.User?.status === 'inactive' || b.status === 'inactive' || b.status === 'archived' || (b.inactivation_reason && b.inactivation_reason.includes('Archived'));
  };

  const handleToggleArchiveBeneficiary = async (beneficiaryRow) => {
    const isArchived = isArchivedBeneficiary(beneficiaryRow);
    const actionText = isArchived ? 'unarchive' : 'archive';
    if (!window.confirm(`Are you sure you want to ${actionText} beneficiary ${beneficiaryRow.first_name} ${beneficiaryRow.last_name}?`)) return;
    try {
      if (isArchived) {
        await beneficiaryApi.update(beneficiaryRow.id, {
          status: 'active',
          inactivation_reason: null,
        });
        alert('Beneficiary unarchived successfully.');
      } else {
        await beneficiaryApi.update(beneficiaryRow.id, {
          status: 'inactive',
          inactivation_reason: 'Archived by Administrator',
        });
        alert('Beneficiary archived successfully.');
      }
      loadAllData();
    } catch (err) {
      alert(err.message || `Failed to ${actionText} beneficiary`);
    }
  };

  const columns = [
    { header: 'Beneficiary / Household ID', accessor: 'beneficiary_id_code', cell: (row) => {
      const is4Ps = row.category?.toLowerCase().includes('4ps');
      const idVal = row.household_id_number || row.beneficiary_id_code || '—';
      return (
        <button
          onClick={() => handleViewBeneficiary(row)}
          className="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline text-left inline-flex items-center gap-1.5"
          title="Click to view details"
        >
          {is4Ps && (
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded shrink-0">
              4Ps HH
            </span>
          )}
          <span>{idVal}</span>
        </button>
      );
    }},
    { header: 'RFID No.', accessor: 'RFID_number', cell: (row) => (
      row.RFID_number ? (
        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 inline-block shadow-2xs">
          {row.RFID_number}
        </span>
      ) : (
        <span className="text-xs text-slate-400 italic font-medium">No RFID</span>
      )
    )},
    { header: 'Full Name', accessor: 'first_name', cell: (row) => (
      <button
        onClick={() => handleViewBeneficiary(row)}
        className="font-semibold text-slate-900 hover:text-blue-700 hover:underline text-left"
        title="Click to view details"
      >
        {row.first_name} {row.last_name}
      </button>
    )},
    { header: 'Beneficiary Category', accessor: 'category', cell: (row) => (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
        row.category?.includes('4Ps') ? 'bg-blue-100 text-blue-800' :
        row.category?.includes('Senior') ? 'bg-red-100 text-red-800' :
        row.category?.includes('PWD') || row.category?.includes('Disabilit') ? 'bg-amber-100 text-amber-800' :
        'bg-slate-100 text-slate-800'
      }`}>
        {row.category}
      </span>
    )},
    { header: 'IP / Non-IP', accessor: 'ip_classification', cell: (row) => (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
        row.ip_classification === 'IP' 
          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs' 
          : 'bg-slate-100 text-slate-700 border border-slate-200'
      }`}>
        {row.ip_classification === 'IP' ? 'IP (Mangyan)' : 'Non-IP'}
      </span>
    )},
    { header: 'Barangay', accessor: 'barangay_id', cell: (row) => row.Barangay?.barangay_name || '—' },
    { header: 'Payout / Ayuda Channel', accessor: 'payout_preference', cell: (row) => (
      row.payout_preference === 'digital' ? (
        row.account_verification_status === 'verified' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
            ⚡ {row.payout_provider || 'GCash'} (Verified)
          </span>
        ) : row.account_verification_status === 'rejected' ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            ❌ {row.payout_provider || 'Digital'} (Rejected)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300 animate-pulse" title="Needs Admin Verification">
            🟡 {row.payout_provider || 'GCash'} (For Verification)
          </span>
        )
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200">
          🏢 Cash OTC / RFID
        </span>
      )
    )},
    { header: 'Date Approved', accessor: 'approval_date', cell: (row) => row.approval_date || '—' },
    { header: 'Status', accessor: 'status', cell: (row) => (
      <div className="flex flex-col gap-1 items-start">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          isArchivedBeneficiary(row) ? 'bg-purple-100 text-purple-800' :
          row.User?.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
        }`}>
          {isArchivedBeneficiary(row) ? 'Archived' : (row.User?.status || 'inactive')}
        </span>
        {row.inactivation_reason && (
          <span className="text-[11px] text-slate-500 italic max-w-[200px] truncate" title={row.inactivation_reason}>
            Note: {row.inactivation_reason}
          </span>
        )}
      </div>
    )},
    ...(['admin','mswdo_admin'].includes(user?.role) || user?.role === 'staff' || user?.role === 'barangay' ? [{
      header: 'Action', 
      accessor: 'id', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewBeneficiary(row)}
            title="View Details"
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {['admin','mswdo_admin'].includes(user?.role) && (
            <button
              onClick={() => handleEditClick(row)}
              title="Edit & Register RFID"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              <Edit3 className="w-4 h-4 text-amber-600" />
            </button>
          )}
          <button
            onClick={() => handleToggleArchiveBeneficiary(row)}
            title={isArchivedBeneficiary(row) ? "Unarchive Beneficiary" : "Archive Beneficiary"}
            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
          >
            <Archive className="w-4 h-4 text-purple-600" />
          </button>
        </div>
      )
    }] : []),
  ];

  const archivedCount = beneficiaries.filter(isArchivedBeneficiary).length;

  // Flexible category matching — handles PWD synonyms and case differences
  const categoryMatches = (beneficiaryCategory, filterCategory) => {
    if (!filterCategory) return true;
    if (!beneficiaryCategory) return false;
    if (beneficiaryCategory === filterCategory) return true;
    // PWD fuzzy match: both contain 'PWD' or 'Disabilit'
    const isPwdFilter = filterCategory.toLowerCase().includes('pwd') || filterCategory.toLowerCase().includes('disabilit');
    const isPwdBen = beneficiaryCategory.toLowerCase().includes('pwd') || beneficiaryCategory.toLowerCase().includes('disabilit');
    if (isPwdFilter && isPwdBen) return true;
    // 4Ps fuzzy match
    const is4PsFilter = filterCategory.toLowerCase().includes('4ps');
    const is4PsBen = beneficiaryCategory.toLowerCase().includes('4ps');
    if (is4PsFilter && is4PsBen) return true;
    // Senior Citizens fuzzy match
    const isSeniorFilter = filterCategory.toLowerCase().includes('senior');
    const isSeniorBen = beneficiaryCategory.toLowerCase().includes('senior');
    if (isSeniorFilter && isSeniorBen) return true;
    return false;
  };

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const isArchived = isArchivedBeneficiary(b);
    if (showArchivedOnly && !isArchived) return false;
    if (!showArchivedOnly && isArchived) return false;

    const barangayMatch = !selectedBarangayId || b.barangay_id === Number(selectedBarangayId);
    const catMatch = categoryMatches(b.category, selectedCategory);
    const ipMatch = !selectedIpClassification || b.ip_classification === selectedIpClassification;
    const payoutMatch = !selectedPayoutStatus || (
      selectedPayoutStatus === 'unverified' ? (b.payout_preference === 'digital' && b.account_verification_status !== 'verified') :
      selectedPayoutStatus === 'verified' ? (b.payout_preference === 'digital' && b.account_verification_status === 'verified') :
      selectedPayoutStatus === 'cash_otc' ? (b.payout_preference === 'cash_otc' || !b.payout_preference) :
      true
    );
    return barangayMatch && catMatch && ipMatch && payoutMatch;
  });

  return (
    <div className="mx-auto max-w-[1220px] space-y-6 px-1 pb-8 pt-2 sm:px-2 lg:px-3">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 rounded-[24px] bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 p-4 text-white shadow-xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-7 w-7 shrink-0 text-yellow-300 sm:h-8 sm:w-8" />
            <h1 className="text-xl font-black tracking-tight sm:text-2xl xl:text-[2rem]">Official Beneficiary Records</h1>
          </div>
          <p className="max-w-2xl text-xs text-blue-100 sm:text-sm">
            {showArchivedOnly ? 'Viewing archived beneficiary records.' : 'Manage verified municipal beneficiary records, track program enrollment, and audit beneficiary statuses.'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* View Pending Beneficiaries Button - Admin Only */}
          {['admin','mswdo_admin'].includes(user?.role) && (
            <button
              onClick={openPendingModal}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow transition text-sm border border-amber-500"
            >
              <Clock className="w-5 h-5" />
              <span>Pending ({pendingApplications.length})</span>
            </button>
          )}
          
          <button
            onClick={() => setShowArchivedOnly(!showArchivedOnly)}
            className={`flex items-center gap-2 font-bold px-4 py-3 rounded-xl shadow transition text-sm ${
              showArchivedOnly
                ? 'bg-yellow-400 text-slate-950 border border-yellow-400'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <Archive className="w-5 h-5 text-purple-300" />
            <span>Archived ({archivedCount})</span>
          </button>
        </div>
      </div>

      {isMswdoAdmin && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 flex items-start gap-3">
          <span className="text-xl">📋</span>
          <div>
            <p className="text-sm font-bold text-blue-900">Municipal Beneficiary Records Oversight (MSWDO)</p>
            <p className="text-xs text-blue-700">Municipal registry of 4Ps Household Beneficiaries, Senior Citizens, and Persons with Disabilities (PWD).</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Barangay</label>
            <select
              value={selectedBarangayId}
              onChange={(e) => setSelectedBarangayId(e.target.value)}
              disabled={user?.role === 'staff'}
              className={`w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 ${
                user?.role === 'staff' ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''
              }`}
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.barangay_name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Categories</option>
              {displayCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Classification</label>
            <select
              value={selectedIpClassification}
              onChange={(e) => setSelectedIpClassification(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Classifications</option>
              <option value="IP">IP (Indigenous People)</option>
              <option value="Non-IP">Non-IP</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Disbursement Channel</label>
            <select
              value={selectedPayoutStatus}
              onChange={(e) => setSelectedPayoutStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 font-medium"
            >
              <option value="">All Payout Channels</option>
              <option value="unverified">🟡 For Verification (Digital Accounts)</option>
              <option value="verified">✅ Verified Digital (GCash / Maya / Bank)</option>
              <option value="cash_otc">🏢 Cash OTC / Physical RFID</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats (Grid: 4 Cards for Admin / 3 Cards for Staff) */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${['admin','mswdo_admin'].includes(user?.role) ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6">
          <p className="mb-2 text-sm font-medium text-slate-600">Total Records</p>
          <p className="text-2xl font-bold text-blue-600 sm:text-3xl">{loading ? '...' : filteredBeneficiaries.length}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-4 sm:p-6">
          <p className="mb-2 text-sm font-medium text-slate-600">Active</p>
          <p className="text-2xl font-bold text-red-600 sm:text-3xl">{loading ? '...' : filteredBeneficiaries.filter(b => b.User?.status === 'active').length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 sm:p-6">
          <p className="mb-2 text-sm font-medium text-slate-600">Inactive</p>
          <p className="text-2xl font-bold text-emerald-600 sm:text-3xl">{loading ? '...' : filteredBeneficiaries.filter(b => b.User?.status === 'inactive').length}</p>
        </div>
        
        {/* Pending Beneficiaries Stat Box - Admin Only */}
        {['admin','mswdo_admin'].includes(user?.role) && (
          <div 
            onClick={openPendingModal}
            className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Pending Applications</p>
              <Clock className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-3xl font-bold text-amber-700">{loading ? '...' : pendingApplications.length}</p>
            <p className="text-xs text-amber-800 font-semibold mt-1 group-hover:underline">
              Click to review pending &rarr;
            </p>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-slate-600 mt-2">Loading beneficiaries...</p>
          </div>
        ) : filteredBeneficiaries.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">No beneficiaries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table 
              columns={columns} 
              data={filteredBeneficiaries} 
              itemsPerPage={5}
              onRowClick={handleViewBeneficiary}
            />
          </div>
        )}
      </div>

      {/* BENEFICIARY DETAILS MODAL (View Information + Admin-only RFID Registration + Meeting Attendance Records) */}
      {viewingBeneficiary && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header Banner */}
            <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white px-6 py-5 flex justify-between items-center relative overflow-hidden">
              <div className="flex items-center gap-4 z-10">
                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-2xl font-black shadow-md overflow-hidden shrink-0">
                  {viewingBeneficiary.profile_picture ? (
                    <img 
                      src={`${backendUrl}/${viewingBeneficiary.profile_picture.replace(/\\/g, '/').replace(/^\/+/, '')}`} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{viewingBeneficiary.first_name?.[0]}{viewingBeneficiary.last_name?.[0]}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">
                      {viewingBeneficiary.first_name} {viewingBeneficiary.middle_name ? `${viewingBeneficiary.middle_name} ` : ''}{viewingBeneficiary.last_name}
                    </h3>
                    <span className={`px-2.5 py-0.5 text-xs font-extrabold rounded-full ${
                      isArchivedBeneficiary(viewingBeneficiary)
                        ? 'bg-purple-400 text-slate-950'
                        : viewingBeneficiary.User?.status === 'active'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-300 text-slate-900'
                    }`}>
                      {isArchivedBeneficiary(viewingBeneficiary) ? 'Archived' : (viewingBeneficiary.User?.status || 'inactive')}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5 font-mono">
                    {viewingBeneficiary.category?.toLowerCase().includes('4ps') ? '4Ps Household No.: ' : 'Beneficiary ID: '}
                    <strong className="text-yellow-300">{viewingBeneficiary.household_id_number || viewingBeneficiary.beneficiary_id_code || 'Pending'}</strong> • {viewingBeneficiary.category}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingBeneficiary(null)}
                className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold transition z-10"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 pt-2 overflow-x-auto">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setModalTab('profile')}
                  className={`flex items-center gap-2 pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                    modalTab === 'profile'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Personal & RFID Details
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('attendance')}
                  className={`flex items-center gap-2 pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                    modalTab === 'attendance'
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  {user?.role === 'mswdo_admin' ? 'MSWDO Attendance' : 'DSWD Attendance'}
                  {attendanceData?.stats ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      attendanceData.stats.compliance_rate >= 80 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : attendanceData.stats.compliance_rate >= 50
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {attendanceData.stats.compliance_rate}% ({attendanceData.stats.present_count}/{attendanceData.stats.total_meetings})
                    </span>
                  ) : attendanceLoading ? (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('distributions')}
                  className={`flex items-center gap-2 pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                    modalTab === 'distributions'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  {user?.role === 'mswdo_admin' ? 'MSWDO Distributions' : 'DSWD Distributions'}
                  {distributionsData?.stats ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ₱{Number(distributionsData.stats.total_amount_claimed).toLocaleString('en-PH')} ({distributionsData.stats.released_count})
                    </span>
                  ) : distributionsLoading ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('programs')}
                  className={`flex items-center gap-2 pb-3 pt-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                    modalTab === 'programs'
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  {user?.role === 'mswdo_admin' ? 'MSWDO Programs' : 'DSWD Programs'}
                  {enrollmentsData?.stats ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                      {enrollmentsData.stats.active_count} Aktibo
                    </span>
                  ) : enrollmentsLoading ? (
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
                  ) : null}
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleRefreshModalData}
                disabled={attendanceLoading || distributionsLoading || enrollmentsLoading}
                className="pb-3 pt-2 text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition shrink-0 ml-2"
                title="I-refresh ang data sa modal"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(attendanceLoading || distributionsLoading || enrollmentsLoading) ? 'animate-spin text-blue-600' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-5 flex-1 bg-slate-50/50">
              {modalTab === 'profile' && (
                <>
                  {/* Attendance Quick KPI Banner inside Profile Tab */}
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-purple-50 rounded-2xl p-4 border border-blue-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-sm text-slate-900">
                            {user?.role === 'mswdo_admin' ? 'MSWDO Attendance Compliance Record' : 'DSWD Attendance Compliance Record'}
                          </h5>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            user?.role === 'mswdo_admin'
                              ? 'text-purple-700 bg-purple-100/70 border-purple-200'
                              : 'text-blue-700 bg-blue-100/70 border-blue-200'
                          }`}>
                            {user?.role === 'mswdo_admin' ? 'MSWDO & Shared Meetings' : 'DSWD Meetings Only'}
                          </span>
                          {attendanceData?.stats && (
                            <span className={`px-2 py-0.5 text-xs font-black rounded-full ${
                              attendanceData.stats.compliance_rate >= 80 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : attendanceData.stats.compliance_rate >= 50
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {attendanceData.stats.compliance_rate}% Rating
                            </span>
                          )}
                        </div>
                        {attendanceLoading ? (
                          <p className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-0.5">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Kinukuha ang attendance record...
                          </p>
                        ) : attendanceData?.stats ? (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Naka-attend: <strong className="text-emerald-700">{attendanceData.stats.present_count}</strong> • 
                            Liban: <strong className="text-rose-700">{attendanceData.stats.absent_count}</strong> • 
                            Pending: <strong className="text-amber-700">{attendanceData.stats.pending_count}</strong> 
                            &nbsp;(Kabuuang <strong>{attendanceData.stats.total_meetings}</strong> na meetings)
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-0.5">Walang nakatalang attendance stats.</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalTab('attendance')}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      Tingnan Buong Talaan →
                    </button>
                  </div>

                  {/* Claimed Distributions Quick KPI Banner inside Profile Tab */}
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-cyan-50 rounded-2xl p-4 border border-emerald-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-sm text-slate-900">
                            {user?.role === 'mswdo_admin' ? 'Claimed MSWDO Ayuda & Distributions' : 'Claimed DSWD Ayuda & Distributions'}
                          </h5>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            user?.role === 'mswdo_admin'
                              ? 'text-emerald-700 bg-emerald-100/70 border-emerald-200'
                              : 'text-teal-700 bg-teal-100/70 border-teal-200'
                          }`}>
                            {user?.role === 'mswdo_admin' ? 'MSWDO Released Only' : 'DSWD Released Only'}
                          </span>
                          {distributionsData?.stats && (
                            <span className="px-2 py-0.5 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ₱{Number(distributionsData.stats.total_amount_claimed || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} Na-claim
                            </span>
                          )}
                        </div>
                        {distributionsLoading ? (
                          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Kinukuha ang mga talaan ng ayuda...
                          </p>
                        ) : distributionsData?.stats ? (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Na-claim: <strong className="text-emerald-700">{distributionsData.stats.released_count}</strong> • 
                            Pending: <strong className="text-amber-700">{distributionsData.stats.pending_count}</strong> • 
                            Kabuuang Halaga: <strong className="text-emerald-700">₱{Number(distributionsData.stats.total_amount_claimed).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                            {distributionsData.stats.last_claim_date && (
                              <> (Huling Claim: <strong>{formatEventDate(distributionsData.stats.last_claim_date)}</strong>)</>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-0.5">Walang nakatalang distribution claims.</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalTab('distributions')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      Tingnan Buong Ayuda →
                    </button>
                  </div>

                  {/* Enrolled Programs Quick KPI Banner inside Profile Tab */}
                  <div className="bg-gradient-to-r from-purple-50 via-indigo-50/60 to-blue-50 rounded-2xl p-4 border border-purple-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-xs shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-sm text-slate-900">
                            {user?.role === 'mswdo_admin' ? 'Mga Naka-enroll na Programang MSWDO' : 'Mga Naka-enroll na Programang DSWD'}
                          </h5>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            user?.role === 'mswdo_admin'
                              ? 'text-purple-700 bg-purple-100/70 border-purple-200'
                              : 'text-indigo-700 bg-indigo-100/70 border-indigo-200'
                          }`}>
                            {user?.role === 'mswdo_admin' ? 'MSWDO Programs Only' : 'DSWD Programs Only'}
                          </span>
                          {enrollmentsData?.stats && (
                            <span className="px-2 py-0.5 text-xs font-black rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                              {enrollmentsData.stats.active_count} Aktibong Programa
                            </span>
                          )}
                        </div>
                        {enrollmentsLoading ? (
                          <p className="text-xs text-purple-600 font-medium flex items-center gap-1 mt-0.5">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Kinukuha ang mga programa...
                          </p>
                        ) : enrollmentsData?.stats ? (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Naka-enroll: <strong className="text-purple-700">{enrollmentsData.stats.total_enrolled}</strong> na programa • 
                            Aktibo: <strong className="text-emerald-700">{enrollmentsData.stats.active_count}</strong> • 
                            Kategorya: <strong className="text-slate-800">{viewingBeneficiary.category}</strong>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-0.5">Walang nakatalang program enrollments.</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalTab('programs')}
                      className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      Tingnan mga Programa →
                    </button>
                  </div>

                  {/* RFID Card Management Card */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">RFID Card Number</h4>
                          <p className="text-xs text-slate-500">Official Municipal RFID for Attendance & Distribution Tracking</p>
                        </div>
                      </div>
                      {viewingBeneficiary.RFID_number ? (
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 shadow-2xs">
                          💳 {viewingBeneficiary.RFID_number}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                          ⚠️ No RFID Card Assigned
                        </span>
                      )}
                    </div>

                    {/* If Admin: show RFID registration form */}
                    {['admin','mswdo_admin'].includes(user?.role) ? (
                      <form onSubmit={handleSaveRfidDirect} className="pt-2 border-t border-slate-100 space-y-3">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Register / Update RFID Card Number
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={rfidInput}
                            onChange={(e) => setRfidInput(e.target.value)}
                            placeholder="Scan or enter RFID card number (e.g. RFID-0001)..."
                            className="flex-1 px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
                          />
                          <button
                            type="submit"
                            disabled={rfidSaving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0"
                          >
                            {rfidSaving ? 'Saving...' : 'Save RFID'}
                          </button>
                        </div>
                        {rfidMsg && (
                          <div className={`p-2.5 rounded-xl text-xs font-semibold ${
                            rfidMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {rfidMsg.text}
                          </div>
                        )}
                      </form>
                    ) : (
                      /* If Barangay Staff: Show read-only notice */
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Ang MSWD Administrator lamang ang may pahintulot na mag-rehistro o magbago ng RFID card numbers.</span>
                      </div>
                    )}
                  </div>

                  {/* Personal Details & Location Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Personal Information */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600" /> Personal Details
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Sex:</span>
                          <span className="font-semibold text-slate-800">{viewingBeneficiary.sex || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Birthdate:</span>
                          <span className="font-semibold text-slate-800">{viewingBeneficiary.birthdate || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Civil Status:</span>
                          <span className="font-semibold text-slate-800">{viewingBeneficiary.civil_status || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Contact Number:</span>
                          <span className="font-semibold text-slate-800">{viewingBeneficiary.contact_number || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">IP Classification:</span>
                          <span className="font-semibold text-slate-800">{viewingBeneficiary.ip_classification || 'Non-IP'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Location & Address */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-500" /> Location & Residence
                      </h4>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1.5">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">
                          Complete Address / Buong Tirahan
                        </span>
                        <p className="font-bold text-slate-900 text-sm leading-relaxed">
                          {[
                            viewingBeneficiary.sitio ? `${viewingBeneficiary.sitio}` : null,
                            viewingBeneficiary.Barangay?.barangay_name
                              ? `Barangay ${viewingBeneficiary.Barangay.barangay_name}`
                              : (viewingBeneficiary.barangay_name ? `Barangay ${viewingBeneficiary.barangay_name}` : null),
                            'Bongabong, Oriental Mindoro',
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Government ID Numbers & Approval History */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Identification & Verification History
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-medium block">National ID No.</span>
                        <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                          {viewingBeneficiary.national_id_number || '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-medium block">PSA Birth Cert No.</span>
                        <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                          {viewingBeneficiary.psa_birth_cert_number || '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 font-medium block">Date Approved</span>
                        <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                          {viewingBeneficiary.approval_date || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payout & Disbursement Details */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Payout & Disbursement Details
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Payout Method:</span>
                        <span className={`font-semibold ${viewingBeneficiary.payout_preference === 'digital' ? 'text-purple-700' : 'text-slate-800'}`}>
                          {viewingBeneficiary.payout_preference === 'digital' ? '⚡ Digital (E-Wallet / Bank)' : '🏢 Cash OTC / RFID'}
                        </span>
                      </div>
                      {viewingBeneficiary.payout_preference === 'digital' && (
                        <>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Provider:</span>
                            <span className="font-semibold text-slate-800">{viewingBeneficiary.payout_provider || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-100">
                            <span className="text-slate-500">Account No.:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 text-xs tracking-wider">
                                {showFullAccountNo 
                                  ? viewingBeneficiary.payout_account_number 
                                  : (viewingBeneficiary.payout_account_number 
                                      ? viewingBeneficiary.payout_account_number.replace(/(.{4})(.*)(.{3})/, '$1****$3')
                                      : '—')}
                              </span>
                              {viewingBeneficiary.payout_account_number && (
                                <button
                                  type="button"
                                  onClick={() => setShowFullAccountNo(!showFullAccountNo)}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 transition"
                                  title={showFullAccountNo ? 'Itago ang buong numero' : 'Ipakita ang buong numero'}
                                >
                                  {showFullAccountNo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Automated Phone Match Check with Registered Contact Number */}
                          {viewingBeneficiary.payout_account_number && viewingBeneficiary.contact_number && (() => {
                            const clean = (num) => String(num || '').replace(/\D/g, '').replace(/^63/, '0');
                            const isMatch = clean(viewingBeneficiary.payout_account_number) === clean(viewingBeneficiary.contact_number);
                            return (
                              <div className={`p-2 rounded-xl text-[11px] font-medium flex items-center justify-between gap-2 ${
                                isMatch ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
                              }`}>
                                <span className="font-semibold">Match sa Contact No.:</span>
                                <span className="font-bold">
                                  {isMatch 
                                    ? '✅ Tugma sa Opisyal na Contact Number' 
                                    : `⚠️ Iba sa Contact No. (${viewingBeneficiary.contact_number})`}
                                </span>
                              </div>
                            );
                          })()}

                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Account Name:</span>
                            <span className="font-semibold text-slate-800">{viewingBeneficiary.payout_account_name || '—'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500">Verification:</span>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                viewingBeneficiary.account_verification_status === 'verified'
                                  ? 'bg-green-100 text-green-700'
                                  : viewingBeneficiary.account_verification_status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {viewingBeneficiary.account_verification_status === 'verified' ? '✅ Verified' 
                                  : viewingBeneficiary.account_verification_status === 'rejected' ? '❌ Rejected'
                                  : '🟡 Unverified'}
                              </span>
                              {user?.role === 'admin' && viewingBeneficiary.payout_account_number && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {viewingBeneficiary.account_verification_status !== 'verified' ? (
                                    <button
                                      onClick={async () => {
                                        const clean = (num) => String(num || '').replace(/\D/g, '').replace(/^63/, '0');
                                        const isMatch = clean(viewingBeneficiary.payout_account_number) === clean(viewingBeneficiary.contact_number);
                                        if (!isMatch && viewingBeneficiary.contact_number) {
                                          if (!window.confirm(`⚠️ BABALA SA BERIPIKASYON:\n\nAng GCash/Payout number (${viewingBeneficiary.payout_account_number}) ay HINDI tumutugma sa opisyal na Contact Number (${viewingBeneficiary.contact_number}) sa DSWD records.\n\nSigurado ka bang nais mong aprubahan at i-verify ang account na ito?`)) {
                                            return;
                                          }
                                        }

                                        try {
                                          const res = await beneficiaryApi.verifyPayoutAccount(viewingBeneficiary.id, { force: !isMatch });
                                          if (res.data.success) {
                                            setViewingBeneficiary(prev => ({ ...prev, account_verification_status: 'verified', account_verified_at: new Date() }));
                                            setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, account_verification_status: 'verified' } : b));
                                            alert(`✅ ${res.data.message}`);
                                          } else {
                                            if (window.confirm(`${res.data.message}\n\nGusto mo bang i-force verify ang account na ito?`)) {
                                              const forceRes = await beneficiaryApi.verifyPayoutAccount(viewingBeneficiary.id, { force: true });
                                              if (forceRes.data.success) {
                                                setViewingBeneficiary(prev => ({ ...prev, account_verification_status: 'verified', account_verified_at: new Date() }));
                                                setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, account_verification_status: 'verified' } : b));
                                                alert(`✅ ${forceRes.data.message}`);
                                              }
                                            } else {
                                              setViewingBeneficiary(prev => ({ ...prev, account_verification_status: 'rejected' }));
                                              setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, account_verification_status: 'rejected' } : b));
                                            }
                                          }
                                        } catch (err) {
                                          alert(`Error: ${err.response?.data?.message || err.message}`);
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                                    >
                                      ✓ Verify
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={async () => {
                                          if (!window.confirm('Nais mo bang bawiin ang beripikasyon at ibalik sa "Unverified" ang account na ito?')) return;
                                          try {
                                            const res = await beneficiaryApi.verifyPayoutAccount(viewingBeneficiary.id, { action: 'unverify' });
                                            if (res.data.success) {
                                              setViewingBeneficiary(prev => ({ ...prev, account_verification_status: 'unverified', account_verified_at: null }));
                                              setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, account_verification_status: 'unverified' } : b));
                                              alert('🟡 Naibalik sa "Unverified" ang account.');
                                            }
                                          } catch (err) {
                                            alert(`Error: ${err.response?.data?.message || err.message}`);
                                          }
                                        }}
                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                                        title="Bawiin ang beripikasyon"
                                      >
                                        I-unverify
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!window.confirm('Sigurado ka bang nais mong i-reject ang payout account na ito? Maabisuhan ang benepisyaryo na mag-update.')) return;
                                          try {
                                            const res = await beneficiaryApi.verifyPayoutAccount(viewingBeneficiary.id, { action: 'reject' });
                                            if (res.data.success) {
                                              setViewingBeneficiary(prev => ({ ...prev, account_verification_status: 'rejected', account_verified_at: null }));
                                              setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, account_verification_status: 'rejected' } : b));
                                              alert('❌ Na-reject ang payout account.');
                                            }
                                          } catch (err) {
                                            alert(`Error: ${err.response?.data?.message || err.message}`);
                                          }
                                        }}
                                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
                                        title="Tanggihan ang account"
                                      >
                                        I-reject
                                      </button>
                                    </>
                                  )}

                                  {/* Sync Contact Number if mismatched */}
                                  {viewingBeneficiary.payout_account_number && viewingBeneficiary.contact_number && (() => {
                                    const clean = (num) => String(num || '').replace(/\D/g, '').replace(/^63/, '0');
                                    const isMatch = clean(viewingBeneficiary.payout_account_number) === clean(viewingBeneficiary.contact_number);
                                    if (!isMatch) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (!window.confirm(`Gusto mo bang gawing opisyal na Contact Number ang GCash number na ${viewingBeneficiary.payout_account_number}?\n\nPapalitan nito ang lumang contact number (${viewingBeneficiary.contact_number}).`)) return;
                                            try {
                                              const res = await beneficiaryApi.verifyPayoutAccount(viewingBeneficiary.id, { action: 'sync_phone' });
                                              if (res.data.success) {
                                                const updatedPhone = viewingBeneficiary.payout_account_number;
                                                setViewingBeneficiary(prev => ({ ...prev, contact_number: updatedPhone }));
                                                setBeneficiaries(prev => prev.map(b => b.id === viewingBeneficiary.id ? { ...b, contact_number: updatedPhone } : b));
                                                alert(`✅ ${res.data.message}`);
                                              }
                                            } catch (err) {
                                              alert(`Error: ${err.response?.data?.message || err.message}`);
                                            }
                                          }}
                                          className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-colors"
                                          title="Gawing opisyal na contact number"
                                        >
                                          📲 I-sync bilang Contact No.
                                        </button>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Secondary / Extra Payout Accounts Display in Admin Modal */}
                      {Array.isArray(viewingBeneficiary.extra_payout_accounts) && viewingBeneficiary.extra_payout_accounts.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-purple-200">
                          <p className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                            <span>Secondary / Extra Payout Accounts ({viewingBeneficiary.extra_payout_accounts.length})</span>
                          </p>
                          <div className="space-y-2">
                            {viewingBeneficiary.extra_payout_accounts.map((acc, accIdx) => (
                              <div key={accIdx} className="bg-white/80 rounded-lg p-2.5 border border-purple-100 flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-purple-900">{acc.provider === 'Landbank' ? '🏦 Landbank' : `⚡ ${acc.provider}`}</span>
                                    <span className="font-mono font-semibold text-slate-800">{acc.account_number}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      acc.verification_status === 'verified'
                                        ? 'bg-green-100 text-green-700'
                                        : acc.verification_status === 'rejected'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {acc.verification_status || 'unverified'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5">Account Name: <span className="font-medium text-slate-700">{acc.account_name}</span></p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

            {/* ATTENDANCE RECORDS TAB */}
            {modalTab === 'attendance' && (
              <div className="space-y-5">
                  {attendanceLoading && !attendanceData ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-800">Kinukuha ang talaan ng attendance...</p>
                      <p className="text-xs text-slate-500 mt-1">Hinihintay ang datos mula sa sistema</p>
                    </div>
                  ) : attendanceError ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{attendanceError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchBeneficiaryAttendance(viewingBeneficiary.id)}
                        className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                      >
                        Subukang Muli
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Attendance KPIs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Compliance Rate Card */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Compliance</span>
                            <Award className={`w-4 h-4 ${
                              (attendanceData?.stats?.compliance_rate || 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'
                            }`} />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-black ${
                              (attendanceData?.stats?.compliance_rate || 0) >= 80 
                                ? 'text-emerald-700' 
                                : (attendanceData?.stats?.compliance_rate || 0) >= 50
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}>
                              {attendanceData?.stats?.compliance_rate || 0}%
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium mt-1">
                            {(attendanceData?.stats?.compliance_rate || 0) >= 80 ? 'Mahusay / Compliant' : 'Kailangang Subaybayan'}
                          </span>
                        </div>

                        {/* Present Count Card */}
                        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Naka-attend</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-emerald-700">
                              {attendanceData?.stats?.present_count || 0}
                            </span>
                            <span className="text-xs text-emerald-600">/ {attendanceData?.stats?.total_meetings || 0}</span>
                          </div>
                          <span className="text-[10px] text-emerald-600 font-medium mt-1">
                            Present sa pagpupulong
                          </span>
                        </div>

                        {/* Absent Count Card */}
                        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Liban (Absent)</span>
                            <XCircle className="w-4 h-4 text-rose-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-rose-700">
                              {attendanceData?.stats?.absent_count || 0}
                            </span>
                          </div>
                          <span className="text-[10px] text-rose-600 font-medium mt-1">
                            Hindi nakapag-attend
                          </span>
                        </div>

                        {/* Pending Count Card */}
                        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending</span>
                            <Clock4 className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-700">
                              {attendanceData?.stats?.pending_count || 0}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-600 font-medium mt-1">
                            Paparating na pulong
                          </span>
                        </div>
                      </div>

                      {/* Meeting Attendance Records List */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              {user?.role === 'mswdo_admin' ? 'Talaan ng mga Pulong mula sa MSWDO' : 'Talaan ng Lahat ng Meetings'} ({attendanceData?.records?.length || 0})
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {user?.role === 'mswdo_admin'
                                ? 'Ipinapakita ang mga pagpupulong mula sa MSWDO at mga anunsyo ng DSWD na may pabatid sa MSWDO (+ MSWDO Notified).'
                                : <>Listahan ng mga opisyal na pagpupulong para sa kategoryang <strong>{viewingBeneficiary.category}</strong></>}
                            </p>
                          </div>
                        </div>

                        {attendanceData?.records?.length === 0 ? (
                          <div className="p-8 text-center">
                            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-700">
                              {user?.role === 'mswdo_admin' ? 'Walang Nakatalang Pulong' : 'Walang Nakatalang Meetings'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {user?.role === 'mswdo_admin'
                                ? 'Wala pang nai-publish na pulong ang MSWDO o pabatid mula sa DSWD para sa benepisyaryong ito.'
                                : 'Wala pang nai-publish na pulong na tumutugma sa barangay at kategorya ng benepisyaryong ito.'}
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {attendanceData?.records?.map((record) => (
                              <div key={record.id} className="p-4 hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-bold text-sm text-slate-900 leading-snug">
                                      {record.title}
                                    </h5>
                                    {record.announcement_type && (
                                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                                        {record.announcement_type}
                                      </span>
                                    )}
                                    {record.notify_mswdo && (
                                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                                        🔔 + MSWDO Notified
                                      </span>
                                    )}
                                    {record.CreatedBy && (
                                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 text-slate-600">
                                        Nilikha ni: {record.CreatedBy.first_name} {record.CreatedBy.last_name}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                    <span className="flex items-center gap-1 font-medium text-slate-700">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                      {formatEventDate(record.event_date)}
                                      {record.event_time && ` • ${record.event_time}`}
                                    </span>
                                    {record.venue && (
                                      <span className="flex items-center gap-1 text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                                        {record.venue}
                                      </span>
                                    )}
                                  </div>

                                  {record.attendance_status === 'Present' && record.scanned_at && (
                                    <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      Na-scan ang RFID card noong: <strong>{formatScanTime(record.scanned_at)}</strong>
                                      {record.ScannedByStaff && ` ni Staff ${record.ScannedByStaff.first_name} ${record.ScannedByStaff.last_name}`}
                                    </p>
                                  )}
                                  {record.attendance_status === 'Absent' && (
                                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                      Hindi nakadalo sa itinakdang oras ng pulong
                                    </p>
                                  )}
                                  {record.attendance_status === 'Pending' && (
                                    <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                                      <Clock4 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                      Naka-iskedyul — I-tap ang RFID card sa staff scanner sa araw ng pulong
                                    </p>
                                  )}
                                </div>

                                {/* Status Badge */}
                                <div className="shrink-0 sm:self-center">
                                  {record.attendance_status === 'Present' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      Naka-attend (Present)
                                    </span>
                                  ) : record.attendance_status === 'Absent' ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      Hindi Naka-attend (Absent)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                      <Clock4 className="w-3.5 h-3.5 text-amber-600" />
                                      Naka-iskedyul (Pending)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: CLAIMED DISTRIBUTIONS TAB                                         */}
              {/* ========================================================================= */}
              {modalTab === 'distributions' && (
                <div className="space-y-5">
                  {distributionsLoading && !distributionsData ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
                      <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-800">Kinukuha ang talaan ng mga na-claim na ayuda...</p>
                      <p className="text-xs text-slate-500 mt-1">Hinihintay ang datos mula sa distribution transactions</p>
                    </div>
                  ) : distributionsError ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{distributionsError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchBeneficiaryDistributions(viewingBeneficiary.id)}
                        className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                      >
                        Subukang Muli
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Distribution KPIs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Total Claimed Amount Card */}
                        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Kabuuang Na-claim</span>
                            <span className="w-4 h-4 text-emerald-600 flex items-center justify-center text-lg font-semibold leading-none">₱</span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl sm:text-2xl font-black text-emerald-700">
                              ₱{Number(distributionsData?.stats?.total_amount_claimed || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-600 font-medium mt-1">
                            Opisyal na na-release na tulong
                          </span>
                        </div>

                        {/* Claimed Count Card */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Na-claim (Released)</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900">
                              {distributionsData?.stats?.released_count || 0}
                            </span>
                            <span className="text-xs text-slate-500">/ {distributionsData?.stats?.total_claims || 0} ayuda</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium mt-1">
                            Matagumpay na natanggap
                          </span>
                        </div>

                        {/* Pending Claims Card */}
                        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending / Naka-iskedyul</span>
                            <Clock4 className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-700">
                              {distributionsData?.stats?.pending_count || 0}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-600 font-medium mt-1">
                            Para sa releasing / verification
                          </span>
                        </div>

                        {/* Last Claim Date Card */}
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Huling Release</span>
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-blue-900 truncate">
                              {distributionsData?.stats?.last_claim_date 
                                ? formatEventDate(distributionsData.stats.last_claim_date) 
                                : 'Wala pa'}
                            </span>
                          </div>
                          <span className="text-[10px] text-blue-600 font-medium mt-1 truncate">
                            {distributionsData?.stats?.last_claim_date ? 'Petsa ng pinakahuling claim' : 'Walang nakaraang claim'}
                          </span>
                        </div>
                      </div>

                      {/* Transactions List */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Package className="w-4 h-4 text-emerald-600" />
                            {user?.role === 'mswdo_admin' ? 'Talaan ng Na-claim na Ayuda sa MSWDO' : 'Talaan ng Na-claim na Ayuda sa DSWD'} ({distributionsData?.transactions?.length || 0})
                          </h4>
                          <span className="text-xs text-slate-400">
                            Beneficiary: <strong className="text-slate-700">{viewingBeneficiary.beneficiary_id_code}</strong>
                          </span>
                        </div>

                        {(!distributionsData?.transactions || distributionsData.transactions.length === 0) ? (
                          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-700">Walang Nakatalang Claimed Distributions</p>
                            <p className="text-xs text-slate-400 mt-0.5">Hindi pa nakakatanggap ng ayuda o relief distribution ang benepisyaryong ito.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {distributionsData.transactions.map((txn, idx) => (
                              <div
                                key={txn.id || idx}
                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs ${
                                  txn.status === 'released'
                                    ? 'bg-emerald-50/30 border-emerald-200'
                                    : txn.status === 'pending'
                                    ? 'bg-amber-50/30 border-amber-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900 text-sm">
                                      {txn.Event?.title || 'Distribution Event'}
                                    </span>
                                    {txn.Event?.Program?.name && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        {txn.Event.Program.name}
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                      {txn.Event?.Program?.agency === 'MSWDO' ? '🏢 MSWDO' : '🏛️ DSWD'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                    <span className="flex items-center gap-1 font-medium text-slate-700">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                      {txn.released_at ? formatScanTime(txn.released_at) : formatEventDate(txn.created_at)}
                                    </span>
                                    {(txn.Event?.venue || txn.Event?.Barangay?.barangay_name) && (
                                      <span className="flex items-center gap-1 text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                                        {txn.Event.venue || txn.Event.Barangay?.barangay_name}
                                      </span>
                                    )}
                                    <span className="font-mono text-[11px] text-slate-500">
                                      Txn #{txn.transaction_number}
                                    </span>
                                  </div>

                                  {/* Verification Method & Releasing Staff */}
                                  <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap pt-1">
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium">
                                      {txn.verification_method === 'rfid' ? '💳 RFID Card Tap' :
                                       txn.verification_method === 'qr' ? '📱 QR Code Scan' :
                                       txn.verification_method === 'manual' ? '📝 Manual / ID Verified' :
                                       '✓ Verified'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium">
                                      {txn.disbursement_type === 'digital' 
                                        ? `📲 Digital (${txn.payout_provider || 'E-Wallet'})` 
                                        : '💵 Cash Over-the-Counter'}
                                    </span>
                                    {txn.ReleasedByStaff && (
                                      <span className="text-slate-500">
                                        Ni Staff: <strong className="text-slate-800">{txn.ReleasedByStaff.first_name} {txn.ReleasedByStaff.last_name}</strong>
                                      </span>
                                    )}
                                    {txn.notes && (
                                      <span className="italic text-slate-400">
                                        • Note: {txn.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Amount & Status Badge */}
                                <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                                  <div className="font-black text-base text-emerald-700">
                                    ₱{Number(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    {parseFloat(txn.retro_amount || 0) > 0 && (
                                      <span className="block text-[10px] text-amber-600 font-normal">
                                        (+₱{Number(txn.retro_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} Retro)
                                      </span>
                                    )}
                                  </div>

                                  {txn.status === 'released' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      Na-claim (Released)
                                    </span>
                                  ) : txn.status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                      <Clock4 className="w-3.5 h-3.5 text-amber-600" />
                                      Pending Claim
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      {txn.status}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 4: ENROLLED BENEFIT PROGRAMS TAB                                     */}
              {/* ========================================================================= */}
              {modalTab === 'programs' && (
                <div className="space-y-5">
                  {enrollmentsLoading && !enrollmentsData ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
                      <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-800">Kinukuha ang mga naka-enroll na programa...</p>
                      <p className="text-xs text-slate-500 mt-1">Hinihintay ang datos mula sa program enrollments</p>
                    </div>
                  ) : enrollmentsError ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{enrollmentsError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchBeneficiaryEnrollments(viewingBeneficiary.id)}
                        className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                      >
                        Subukang Muli
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Enrolled Programs KPIs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* Active Programs Card */}
                        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Aktibong Programa</span>
                            <Layers className="w-4 h-4 text-purple-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-purple-700">
                              {enrollmentsData?.stats?.active_count || 0}
                            </span>
                            <span className="text-xs text-purple-600 font-medium">programa</span>
                          </div>
                          <span className="text-[10px] text-purple-600 font-medium mt-1">
                            Kasalukuyang tumatanggap ng benepisyo
                          </span>
                        </div>

                        {/* Total Enrolled Card */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kabuuang Enrollment</span>
                            <BookmarkCheck className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-slate-900">
                              {enrollmentsData?.stats?.total_enrolled || 0}
                            </span>
                            <span className="text-xs text-slate-500">lahat ng talaan</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium mt-1">
                            Kasaysayan ng mga programang sinalihan
                          </span>
                        </div>

                        {/* Beneficiary Category Card */}
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Kategorya ng Benepisyaryo</span>
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-blue-900 truncate">
                              {viewingBeneficiary.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-blue-600 font-medium mt-1">
                            Opisyal na sektor sa DSWD / MSWDO
                          </span>
                        </div>
                      </div>

                      {/* Programs List */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-600" />
                            {user?.role === 'mswdo_admin' ? 'Mga Programang Sinalihan sa MSWDO (Municipal)' : 'Mga Programang Sinalihan sa DSWD (National)'} ({enrollmentsData?.enrollments?.length || 0})
                          </h4>
                          <span className="text-xs text-slate-400">
                            Beneficiary: <strong className="text-slate-700">{viewingBeneficiary.beneficiary_id_code}</strong>
                          </span>
                        </div>

                        {(!enrollmentsData?.enrollments || enrollmentsData.enrollments.length === 0) ? (
                          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-bold text-slate-700">Walang Naka-enroll na Programa</p>
                            <p className="text-xs text-slate-400 mt-0.5">Hindi pa naka-enroll ang benepisyaryong ito sa anumang opisyal na programa.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {enrollmentsData.enrollments.map((enr, idx) => (
                              <div
                                key={enr.id || idx}
                                className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-all space-y-2.5 text-xs"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-bold text-slate-900 text-sm">
                                      {enr.BenefitProgram?.name || 'Benefit Program'}
                                    </h5>
                                    {enr.BenefitProgram?.code && (
                                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {enr.BenefitProgram.code}
                                      </span>
                                    )}
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                      {enr.BenefitProgram?.agency === 'MSWDO' ? '🏢 MSWDO (Municipal)' : '🏛️ DSWD (National)'}
                                    </span>
                                  </div>

                                  {/* Status Badge */}
                                  <div className="shrink-0">
                                    {enr.status === 'active' ? (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Aktibo (Active)
                                      </span>
                                    ) : enr.status === 'completed' ? (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                        Nakumpleto (Completed)
                                      </span>
                                    ) : enr.status === 'pending' ? (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                        <Clock4 className="w-3.5 h-3.5 text-amber-600" />
                                        Pending Enrollment
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                                        {enr.status}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Metadata Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Uri ng Benepisyo (Benefit Type):</span>
                                    <strong className="text-slate-800">{enr.BenefitProgram?.benefit_type || 'Cash Grant'}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Petsa ng Pag-enroll:</span>
                                    <strong className="text-slate-800">{formatEventDate(enr.enrollment_date)}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">Kwalipikadong Sektor:</span>
                                    <strong className="text-slate-800">{enr.BenefitProgram?.eligibility_category || viewingBeneficiary.category}</strong>
                                  </div>
                                </div>

                                {/* Program Description if available */}
                                {enr.BenefitProgram?.description && (
                                  <p className="text-slate-500 text-[11px] leading-relaxed">
                                    {enr.BenefitProgram.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center gap-3">
              <div className="text-xs text-slate-500 font-medium">
                {modalTab === 'profile' && (
                  <span>Account Status: <strong className="text-slate-800">{viewingBeneficiary.User?.status || 'active'}</strong> • RFID: <strong>{viewingBeneficiary.RFID_number || 'Walang RFID Card'}</strong></span>
                )}
                {modalTab === 'attendance' && attendanceData?.stats && (
                  <span>Kabuuang Meetings: <strong>{attendanceData.stats.total_meetings}</strong> • Attendance Rating: <strong>{attendanceData.stats.compliance_rate}%</strong></span>
                )}
                {modalTab === 'distributions' && distributionsData?.stats && (
                  <span>Kabuuang Na-claim: <strong className="text-emerald-700">₱{Number(distributionsData.stats.total_amount_claimed || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> • Na-claim: <strong>{distributionsData.stats.released_count} ayuda</strong></span>
                )}
                {modalTab === 'programs' && enrollmentsData?.stats && (
                  <span>Naka-enroll: <strong className="text-purple-700">{enrollmentsData.stats.active_count} Aktibong Programa</strong> (Kabuuang {enrollmentsData.stats.total_enrolled} sinalihan)</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewingBeneficiary(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Beneficiary Modal */}
      {editingBeneficiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Edit Beneficiary</h2>
              <button
                onClick={() => {
                  setEditingBeneficiary(null);
                  setEditError(null);
                  setEditSuccess(null);
                }}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-200">
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">
                    {editingBeneficiary.category?.toLowerCase().includes('4ps') ? '4Ps Household Number' : 'Beneficiary ID'}
                  </p>
                  <p className="text-lg font-bold text-slate-900 font-mono">{editingBeneficiary.household_id_number || editingBeneficiary.beneficiary_id_code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Full Name</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {editingBeneficiary.first_name} {editingBeneficiary.last_name}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">RFID Number</label>
                  <input
                    type="text"
                    value={editFormData.RFID_number || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, RFID_number: e.target.value })}
                    placeholder="Enter RFID number (e.g., RFID-0001)"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono"
                  />
                  {editingBeneficiary.RFID_number && !editFormData.RFID_number && (
                    <p className="text-xs text-slate-500 mt-1">Current: {editingBeneficiary.RFID_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editFormData.status || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {editFormData.status === 'inactive' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Reason for Inactivation / Dahilan <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editFormData.inactivation_reason || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, inactivation_reason: e.target.value })}
                      placeholder="Specify why this beneficiary is set to inactive..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                      required
                    />
                  </div>
                )}

                {/* ── Payout & Disbursement Details ── */}
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" /> Payout & Disbursement
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Payout Method</label>
                      <select
                        value={editFormData.payout_preference || 'cash_otc'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFormData(prev => ({
                            ...prev,
                            payout_preference: val,
                            ...(val === 'cash_otc' ? { payout_provider: '', payout_account_number: '', payout_account_name: '' } : {})
                          }));
                        }}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      >
                        <option value="cash_otc">🏢 Cash OTC / Physical (RFID)</option>
                        <option value="digital">⚡ Digital (E-Wallet / Bank)</option>
                      </select>
                    </div>

                    {editFormData.payout_preference === 'digital' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Provider</label>
                          <select
                            value={editFormData.payout_provider || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, payout_provider: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                          >
                            <option value="">— Pumili ng Provider —</option>
                            <option value="GCash">GCash</option>
                            <option value="Maya">Maya (PayMaya)</option>
                            <option value="Landbank">Landbank ATM</option>
                            <option value="Other">Iba Pa (Other)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Account / Mobile Number
                          </label>
                          <input
                            type="text"
                            value={editFormData.payout_account_number || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, payout_account_number: e.target.value })}
                            placeholder="e.g., 09171234567 or 1234-5678-90"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Account Holder Name
                          </label>
                          <input
                            type="text"
                            value={editFormData.payout_account_name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, payout_account_name: e.target.value })}
                            placeholder="Pangalan sa GCash/Landbank (e.g., Juan Dela Cruz)"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                          />
                          <p className="text-xs text-slate-400 mt-1">Dapat tugma sa pangalan ng benepisyaryo para sa verification.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {editError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {editError}
                  </div>
                )}

                {editSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                    {editSuccess}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                  >
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBeneficiary(null);
                      setEditError(null);
                      setEditSuccess(null);
                    }}
                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Pending Beneficiaries Modal (Admin Only) */}
      {showPendingModal && ['admin','mswdo_admin'].includes(user?.role) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-amber-50/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Pending Beneficiary Applications</h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {isMswdoAdmin 
                      ? 'Review, verify, and approve pending Senior Citizens and PWD applicant submissions (4Ps is processed by DSWD).'
                      : 'Review, verify, and approve pending applicant submissions (4Ps, Senior Citizens, and PWD).'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPendingModal(false);
                  setSelectedApp(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPending ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                  <p className="text-sm text-slate-600 mt-2">Loading pending applications...</p>
                </div>
              ) : pendingApplications.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                  <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-700 font-bold text-lg">No Pending Beneficiary Applications</p>
                  <p className="text-sm text-slate-500 mt-1">All submitted applications have been verified and processed!</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3.5">Applicant Name</th>
                        <th className="px-4 py-3.5">Category</th>
                        <th className="px-4 py-3.5">Barangay</th>
                        <th className="px-4 py-3.5">National ID</th>
                        <th className="px-4 py-3.5">Date Registered</th>
                        <th className="px-4 py-3.5">Verification Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {pendingPagination.paginatedData.map((app) => (
                        <tr key={app.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900">{app.first_name} {app.last_name}</td>
                          <td className="px-4 py-3.5 text-slate-600 font-semibold">{app.category || '—'}</td>
                          <td className="px-4 py-3.5 text-slate-600">{app.Barangay?.barangay_name || '—'}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-700 text-xs font-bold">{app.national_id_number || '—'}</td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">
                            {(() => {
                              const rawDate = app.created_at || app.updated_at;
                              if (!rawDate) return '—';
                              const d = new Date(rawDate);
                              return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                            })()}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              app.status === 'Pending Review' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              app.status === 'Under Review' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              app.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => { setSelectedApp(app); setShowRejectForm(false); setPreviewUrl(null); }}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors uppercase tracking-wider"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-slate-200 px-4 py-3">
                    <Pagination
                      currentPage={pendingPagination.currentPage}
                      totalPages={pendingPagination.totalPages}
                      onPageChange={pendingPagination.goToPage}
                      totalItems={pendingPagination.totalItems}
                      itemsPerPage={10}
                      startIndex={pendingPagination.startIndex}
                      endIndex={pendingPagination.endIndex}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
              <span>Total Pending: <strong>{pendingApplications.length}</strong></span>
              <button
                onClick={() => setShowPendingModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white text-slate-700 font-semibold"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DETAIL REVIEW MODAL */}
      {selectedApp && ['admin','mswdo_admin'].includes(user?.role) && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Reviewing Application</h3>
                <p className="text-xs text-slate-500">Applicant: {selectedApp.first_name} {selectedApp.last_name}</p>
              </div>
              <button 
                onClick={() => { setSelectedApp(null); setPreviewUrl(null); }}
                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-3">Profile Information</h4>
                  <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-2 border border-slate-100">
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Category:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.category}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Barangay:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.Barangay?.barangay_name}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Sex:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.sex}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Birthdate:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.birthdate}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Civil Status:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.civil_status || '—'}</span>
                    </div>
                    {selectedApp.category?.toLowerCase().includes('4ps') && (
                      <div className="grid grid-cols-3 bg-blue-50/70 p-1.5 rounded-lg border border-blue-200">
                        <span className="text-blue-700 font-bold text-xs">4Ps Household No.:</span>
                        <span className="col-span-2 font-mono font-black text-blue-900">{selectedApp.household_id_number || selectedApp.beneficiary_id_code || '—'}</span>
                      </div>
                    )}
                    {!selectedApp.category?.toLowerCase().includes('4ps') && selectedApp.beneficiary_id_code && (
                      <div className="grid grid-cols-3">
                        <span className="text-slate-400 font-medium">Beneficiary ID:</span>
                        <span className="col-span-2 font-mono font-bold text-slate-800">{selectedApp.beneficiary_id_code}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Contact No:</span>
                      <span className="col-span-2 font-semibold text-slate-800">{selectedApp.contact_number || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">National ID:</span>
                      <span className="col-span-2 font-mono font-bold text-slate-800">{selectedApp.national_id_number}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">PSA Cert:</span>
                      <span className="col-span-2 font-mono font-bold text-slate-800">{selectedApp.psa_birth_cert_number || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3">
                      <span className="text-slate-400 font-medium">Address:</span>
                      <span className="col-span-2 font-semibold text-slate-800 text-xs">
                        {selectedApp.sitio ? `${selectedApp.sitio}, ` : ''}
                        {selectedApp.Barangay?.barangay_name ? `Barangay ${selectedApp.Barangay.barangay_name}, ` : ''}
                        Bongabong, Oriental Mindoro
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Review Actions</h4>
                  
                  {isMswdoAdmin && is4PsCategory(selectedApp.category) ? (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-center space-y-2">
                      <div className="inline-flex p-2 bg-amber-100 text-amber-800 rounded-full">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-amber-900">DSWD Approval Authority Required</p>
                      <p className="text-xs text-amber-700">
                        This applicant belongs to the <strong>4Ps Household Beneficiaries</strong> category. 4Ps applications are exclusively reviewed and approved by DSWD. MSWDO is only authorized to review and approve Senior Citizens and PWD applications.
                      </p>
                    </div>
                  ) : (
                    <>
                      {selectedApp.status === 'Pending Review' && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                          <p className="text-xs text-amber-800 font-medium mb-3">This application is marked as Pending Review.</p>
                          <Button onClick={() => handleStartReview(selectedApp.id)} className="w-full">
                            Mark Under Review
                          </Button>
                        </div>
                      )}

                      {selectedApp.status !== 'Approved' && !showRejectForm && (
                        <div className="flex gap-4">
                          <Button 
                            onClick={() => handleApproveApplication(selectedApp.id)} 
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            Approve Application
                          </Button>
                          <Button 
                            onClick={() => setShowRejectForm(true)} 
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                          >
                            Reject Application
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {showRejectForm && (
                    <form onSubmit={handleRejectApplication} className="p-4 border border-red-200 bg-red-50/50 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center text-red-900 font-bold text-sm">
                        <span>Rejection Review Details</span>
                        <button type="button" onClick={() => setShowRejectForm(false)} className="text-xs text-slate-400">Cancel</button>
                      </div>

                      <Input
                        label="Reason for Rejection *"
                        placeholder="Specify details, e.g. Birth certificate is blurry"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                      />

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Flag Missing / Invalid Documents:</label>
                        <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 max-h-36 overflow-y-auto">
                          {getRequiredFilesList(selectedApp.category).map((d) => (
                            <label key={d.name} className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={missingDocs.includes(d.name)}
                                onChange={() => handleToggleMissingDoc(d.name)}
                                className="rounded text-red-600 focus:ring-red-500"
                              />
                              {d.name}
                            </label>
                          ))}
                        </div>
                      </div>

                      <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
                        Confirm Rejection
                      </Button>
                    </form>
                  )}
                </div>
              </div>

              <div className="space-y-4 flex flex-col h-full">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider mb-3">Submitted Documents</h4>
                  <div className="divide-y divide-slate-100 bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                    {getRequiredFilesList(selectedApp.category).map((req, i) => {
                      const file = selectedApp.Documents?.find(d => d.document_type === req.name);
                      return (
                        <div key={i} className="py-2.5 flex items-center justify-between text-sm">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 block text-xs">{req.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{req.required ? 'Required' : 'Optional'}</span>
                          </div>
                          {file ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  const cleanPath = (file.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '');
                                  setPreviewUrl(`${backendUrl}/${cleanPath}`);
                                }}
                                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                              <a
                                href={`${backendUrl}/${(file.file_path || '').replace(/\\/g, '/').replace(/^\/+/, '')}`}
                                download
                                className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" /> Download
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-red-600 font-bold">❌ Missing</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {previewUrl && (
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-100 flex-1 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-xs font-bold text-slate-700">Inline Document Preview</span>
                      <button 
                        onClick={() => setPreviewUrl(null)} 
                        className="text-xs text-red-600 font-bold"
                      >
                        Close Preview
                      </button>
                    </div>
                    <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-2">
                      {previewUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || previewUrl.includes('image') ? (
                        <img 
                          src={previewUrl} 
                          alt="Submitted Document" 
                          className="max-h-[320px] w-auto max-w-full object-contain rounded-lg"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <iframe 
                          src={previewUrl} 
                          title="Submitted Document PDF" 
                          className="w-full h-full min-h-[320px] rounded-lg" 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

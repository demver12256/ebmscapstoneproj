import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Users, Clock, Eye, CheckCircle2, AlertTriangle, FileCheck, ShieldAlert, Download, Archive, Edit3 } from 'lucide-react';
import Table from '../components/ui/Table';
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
  const [selectedBarangayId, setSelectedBarangayId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIpClassification, setSelectedIpClassification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const CATEGORIES = [
    '4Ps Household Beneficiary',
    'Senior Citizens (Social Pension)',
    'Persons with Disabilities (PWD)'
  ];

  const getBackendUrl = () => {
    const defaultApiUrl = 'http://localhost:5000/api';
    const envApiUrl = process.env.REACT_APP_API_URL || defaultApiUrl;
    return envApiUrl.replace('/api', '');
  };

  const backendUrl = getBackendUrl();

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [beneficiariesRes, barangaysRes, appsRes] = await Promise.all([
        beneficiaryApi.list(),
        barangayApi.list(),
        beneficiaryApi.listApplications()
      ]);
      setBeneficiaries(beneficiariesRes.data.data || []);
      setBarangays(barangaysRes.data.data || []);
      
      const apps = appsRes.data.data || [];
      // Filter non-approved applications for the pending queue
      const pendingList = apps.filter(a => a.status !== 'Approved');
      setPendingApplications(pendingList);

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
    if (location.state?.openPending || new URLSearchParams(location.search).get('pending') === 'true') {
      openPendingModal();
    }
  }, [location]);

  const openPendingModal = async () => {
    setShowPendingModal(true);
    setLoadingPending(true);
    try {
      const appsRes = await beneficiaryApi.listApplications();
      const apps = appsRes.data.data || [];
      setPendingApplications(apps.filter(a => a.status !== 'Approved'));
    } catch (err) {
      console.error('Failed to reload pending applications:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleEditClick = (beneficiary) => {
    if ((user?.role === 'staff' || user?.role === 'barangay') && beneficiary.barangay_id !== user?.barangay_id) {
      setEditError('You can only edit beneficiaries from your own barangay');
      return;
    }
    
    setEditingBeneficiary(beneficiary);
    setEditFormData({
      RFID_number: beneficiary.RFID_number || '',
      status: beneficiary.User?.status || 'active',
      inactivation_reason: beneficiary.inactivation_reason || '',
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
    { header: 'Beneficiary ID', accessor: 'beneficiary_id_code', cell: (row) => (
      <span className="font-mono font-bold text-slate-800">{row.beneficiary_id_code || '—'}</span>
    )},
    { header: 'Full Name', accessor: 'first_name', cell: (row) => `${row.first_name} ${row.last_name}` },
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
    { header: 'Barangay', accessor: 'barangay_id', cell: (row) => row.Barangay?.barangay_name || '—' },
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
    ...(user?.role === 'admin' || user?.role === 'staff' ? [{
      header: 'Action', 
      accessor: 'id', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          {user?.role === 'admin' && (
            <button
              onClick={() => handleEditClick(row)}
              title="Edit Beneficiary"
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            >
              <Edit3 className="w-4 h-4 text-blue-600" />
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
    return barangayMatch && catMatch && ipMatch;
  });

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black tracking-tight">Official Beneficiary Records</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl">
            {showArchivedOnly ? 'Viewing archived beneficiary records.' : 'Manage verified municipal beneficiary records, track program enrollment, and audit beneficiary statuses.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Pending Beneficiaries Button */}
          <button
            onClick={openPendingModal}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow transition text-sm border border-amber-500"
          >
            <Clock className="w-5 h-5" />
            <span>Pending ({pendingApplications.length})</span>
          </button>
          
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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Barangay</label>
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

          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Classification</label>
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
        </div>
      </div>

      {/* Stats (Grid with 4 Cards: Total, Active, Inactive, Pending Applications) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Total Records</p>
          <p className="text-3xl font-bold text-blue-600">{loading ? '...' : filteredBeneficiaries.length}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Active</p>
          <p className="text-3xl font-bold text-red-600">{loading ? '...' : filteredBeneficiaries.filter(b => b.User?.status === 'active').length}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Inactive</p>
          <p className="text-3xl font-bold text-emerald-600">{loading ? '...' : filteredBeneficiaries.filter(b => b.User?.status === 'inactive').length}</p>
        </div>
        
        {/* Pending Beneficiaries Stat Box */}
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
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
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
          <Table columns={columns} data={filteredBeneficiaries} />
        )}
      </div>

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
                  <p className="text-xs text-slate-600 uppercase tracking-wide font-semibold">Beneficiary ID</p>
                  <p className="text-lg font-bold text-slate-900 font-mono">{editingBeneficiary.beneficiary_id_code || 'N/A'}</p>
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

      {/* Pending Beneficiaries Modal (Matching ProgramListPage Archived Modal style) */}
      {showPendingModal && (
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
                  <p className="text-sm text-slate-600 mt-0.5">Review, verify, and approve pending applicant submissions.</p>
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
                      {pendingApplications.map((app) => (
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

      {/* STAFF / ADMIN DETAIL REVIEW MODAL */}
      {selectedApp && (
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

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, Accessibility, Calendar, MapPin, Phone, Mail, ShieldCheck, CheckCircle2, 
  XCircle, Clock, Search, Filter, Download, Printer, QrCode, FileText, 
  ExternalLink, RefreshCw, AlertTriangle, Eye, ChevronRight, Sparkles, 
  Building2, Wallet, Megaphone, Smartphone, HeartHandshake, Package, 
  Check, X, FileCheck, Layers, Info, Stethoscope, HelpCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { 
  beneficiaryApi, 
  programApi, 
  barangayApi, 
  announcementApi, 
  assistanceRequestApi,
  interventionApi 
} from '../services/api';

export default function PwdAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'programs' | 'applications' | 'assistive_devices' | 'consultations'

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [assistanceRequests, setAssistanceRequests] = useState([]);
  const [interventions, setInterventions] = useState([]);

  // Filters for Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [selectedIpClassification, setSelectedIpClassification] = useState('');
  const [selectedPayout, setSelectedPayout] = useState('');
  const [selectedDisabilityType, setSelectedDisabilityType] = useState('all');

  // Pagination for Directory
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected beneficiary for profile modal
  const [viewingBeneficiary, setViewingBeneficiary] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('overview'); // 'overview' | 'attendance' | 'rfid'
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Digital QR Pass Modal
  const [qrModalBeneficiary, setQrModalBeneficiary] = useState(null);
  const [qrPassData, setQrPassData] = useState(null);
  const [loadingQrPass, setLoadingQrPass] = useState(false);

  // Review Application Modal
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [missingDocs, setMissingDocs] = useState([]);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [processingApp, setProcessingApp] = useState(false);
  const [appActionSuccess, setAppActionSuccess] = useState(null);

  // RFID Update inline
  const [rfidInput, setRfidInput] = useState('');
  const [savingRfid, setSavingRfid] = useState(false);
  const [rfidMessage, setRfidMessage] = useState(null);

  // Backend URL helper for documents/photos
  const getBackendUrl = () => {
    const defaultApiUrl = 'http://localhost:5000/api';
    const envApiUrl = process.env.REACT_APP_API_URL || defaultApiUrl;
    return envApiUrl.replace('/api', '');
  };
  const backendUrl = getBackendUrl();

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const clean = filePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    return `${backendUrl}/${clean}`;
  };

  // Helper to check if category is PWD
  const isPwdCategory = (cat) => {
    if (!cat) return false;
    const c = String(cat).toLowerCase();
    return c.includes('pwd') || c.includes('disabilit');
  };

  // Fetch all sector data
  const loadSectorData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        bRes,
        brgyRes,
        progRes,
        appRes,
        annRes,
        assistRes,
        intervRes
      ] = await Promise.allSettled([
        beneficiaryApi.list(),
        barangayApi.list(),
        programApi.list(),
        beneficiaryApi.listApplications(),
        announcementApi.list(),
        assistanceRequestApi.list({ limit: 100 }),
        interventionApi.getAllInterventions ? interventionApi.getAllInterventions() : Promise.resolve({ data: { data: [] } })
      ]);

      // 1. Beneficiaries (filter to PWD only)
      if (bRes.status === 'fulfilled') {
        const raw = bRes.value.data?.data || [];
        const pwdOnly = raw.filter(b => isPwdCategory(b.category));
        setBeneficiaries(pwdOnly);
      }

      // 2. Barangays
      if (brgyRes.status === 'fulfilled') {
        setBarangays(brgyRes.value.data?.data || []);
      }

      // 3. Programs (PWD-targeted programs)
      if (progRes.status === 'fulfilled') {
        const rawPrograms = progRes.value.data?.data || [];
        const pwdPrograms = rawPrograms.filter(p => {
          const cat = String(p.eligibility_category || p.category || p.name || '').toLowerCase();
          return cat.includes('pwd') || cat.includes('disabilit') || cat.includes('pdao') || cat.includes('assistive') || cat.includes('inclusive');
        });
        setPrograms(pwdPrograms.length > 0 ? pwdPrograms : rawPrograms);
      }

      // 4. Applications (PWD pending review)
      if (appRes.status === 'fulfilled') {
        const rawApps = appRes.value.data?.data || [];
        const pwdApps = rawApps.filter(a => isPwdCategory(a.category) && a.status !== 'Approved');
        setApplications(pwdApps);
      }

      // 5. Announcements (PWD sector assemblies & orientations)
      if (annRes.status === 'fulfilled') {
        const rawAnn = annRes.value.data?.data || [];
        const pwdAnn = rawAnn.filter(a => {
          const t = `${a.title} ${a.program || ''} ${a.sector || ''} ${a.target_categories || ''}`.toLowerCase();
          return t.includes('pwd') || t.includes('pdao') || t.includes('disabilit');
        });
        setAnnouncements(pwdAnn.length > 0 ? pwdAnn : rawAnn);
      }

      // 6. Assistance Requests
      if (assistRes.status === 'fulfilled') {
        const rawAss = assistRes.value.data?.data || [];
        setAssistanceRequests(rawAss);
      }

      // 7. Interventions
      if (intervRes.status === 'fulfilled') {
        const rawInt = intervRes.value.data?.data || [];
        setInterventions(rawInt);
      }

    } catch (err) {
      console.error('Failed to load PWD admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSectorData();
  }, []);

  // Filtered PWD Beneficiaries
  const filteredBeneficiaries = useMemo(() => {
    return beneficiaries.filter(b => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.toLowerCase();
        const code = String(b.beneficiary_id_code || '').toLowerCase();
        const rfid = String(b.RFID_number || '').toLowerCase();
        const phone = String(b.contact_number || '').toLowerCase();
        if (!fullName.includes(q) && !code.includes(q) && !rfid.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      // Barangay filter
      if (selectedBarangay && String(b.barangay_id) !== String(selectedBarangay)) {
        return false;
      }

      // IP filter
      if (selectedIpClassification && b.ip_classification !== selectedIpClassification) {
        return false;
      }

      // Payout preference
      if (selectedPayout && b.payout_preference !== selectedPayout) {
        return false;
      }

      return true;
    });
  }, [beneficiaries, searchQuery, selectedBarangay, selectedIpClassification, selectedPayout, selectedDisabilityType]);

  // Paginated directory items
  const paginatedBeneficiaries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBeneficiaries.slice(start, start + itemsPerPage);
  }, [filteredBeneficiaries, currentPage]);

  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage) || 1;

  // KPI Calculations
  const stats = useMemo(() => {
    const total = beneficiaries.length;
    const ipCount = beneficiaries.filter(b => b.ip_classification === 'IP').length;
    const nonIpCount = total - ipCount;
    const verifiedPayouts = beneficiaries.filter(b => b.account_verification_status === 'verified').length;
    const rfidCount = beneficiaries.filter(b => !!b.RFID_number).length;

    return {
      total,
      ipCount,
      nonIpCount,
      verifiedPayouts,
      rfidCount,
      pendingApps: applications.length,
      activePrograms: programs.filter(p => p.status === 'Active' || p.status === 'active').length,
    };
  }, [beneficiaries, applications, programs]);

  // Export to Excel / CSV
  const handleExportData = (format = 'xlsx') => {
    const rows = filteredBeneficiaries.map((b, idx) => {
      const brgy = barangays.find(x => x.id === b.barangay_id);
      return {
        '#': idx + 1,
        'Beneficiary ID': b.beneficiary_id_code || '—',
        'Full Name': `${b.last_name || ''}, ${b.first_name || ''} ${b.middle_name || ''}`.trim(),
        'Sex': b.sex || '—',
        'Birthdate': b.birthdate || '—',
        'Barangay': brgy ? brgy.barangay_name : '—',
        'IP Classification': b.ip_classification || 'Non-IP',
        'Contact Number': b.contact_number || '—',
        'RFID Number': b.RFID_number || '—',
        'Payout Preference': b.payout_preference === 'digital' ? 'E-Wallet / Bank' : 'Cash (OTC)',
        'Payout Provider': b.payout_provider || '—',
        'Account Verification': b.account_verification_status || 'unverified',
        'Status': b.status || 'Approved'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PWD Registry');

    const fileName = `EBMS_PWD_Registry_${new Date().toISOString().slice(0, 10)}.${format}`;
    if (format === 'csv') {
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, fileName);
    }
  };

  // Open Beneficiary Profile Modal
  const handleOpenBeneficiary = async (b) => {
    setViewingBeneficiary(b);
    setRfidInput(b.RFID_number || '');
    setRfidMessage(null);
    setActiveModalTab('overview');

    // Fetch attendance records
    setLoadingAttendance(true);
    try {
      const res = await beneficiaryApi.getAttendance(b.id);
      setAttendanceRecords(res.data?.data?.attendance || []);
    } catch (e) {
      setAttendanceRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Save RFID
  const handleSaveRfid = async () => {
    if (!viewingBeneficiary) return;
    setSavingRfid(true);
    setRfidMessage(null);
    try {
      await beneficiaryApi.update(viewingBeneficiary.id, { RFID_number: rfidInput.trim() || null });
      setRfidMessage({ type: 'success', text: 'RFID successfully assigned/updated!' });
      
      // Update local state
      setBeneficiaries(prev => prev.map(item => item.id === viewingBeneficiary.id ? { ...item, RFID_number: rfidInput.trim() || null } : item));
      setViewingBeneficiary(prev => ({ ...prev, RFID_number: rfidInput.trim() || null }));
    } catch (err) {
      setRfidMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update RFID.' });
    } finally {
      setSavingRfid(false);
    }
  };

  // Open QR Pass Modal
  const handleOpenQrModal = async (b) => {
    setQrModalBeneficiary(b);
    setLoadingQrPass(true);
    try {
      const res = await beneficiaryApi.getQrPass(b.id);
      setQrPassData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to get QR pass:', err);
      setQrPassData({
        full_name: `${b.first_name} ${b.last_name}`,
        beneficiary_id_code: b.beneficiary_id_code,
        category: b.category,
        barangay_name: barangays.find(x => x.id === b.barangay_id)?.barangay_name || 'Bongabong',
        rfid_number: b.RFID_number,
        qr_code_value: b.beneficiary_id_code || `BEN-${b.id}`
      });
    } finally {
      setLoadingQrPass(false);
    }
  };

  // Print PWD ID Pass Card
  const handlePrintQrPass = () => {
    if (!qrModalBeneficiary) return;
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) {
      window.print();
      return;
    }
    const b = qrModalBeneficiary;
    const brgy = barangays.find(x => x.id === b.barangay_id)?.barangay_name || 'Bongabong';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PWD PDAO Digital Pass - ${b.first_name} ${b.last_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 20px; background: #fff; color: #1e293b; }
            .card { width: 440px; margin: 0 auto; border: 2px solid #d97706; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #fff; position: relative; }
            .header { text-align: center; border-bottom: 2px solid #fed7aa; padding-bottom: 12px; margin-bottom: 16px; }
            .logo-title { font-size: 16px; font-weight: 800; color: #9a3412; text-transform: uppercase; letter-spacing: 0.5px; }
            .sub { font-size: 11px; color: #64748b; font-weight: 500; }
            .tag { display: inline-block; background: #fef3c7; color: #b45309; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-top: 6px; text-transform: uppercase; }
            .content { display: flex; gap: 18px; align-items: center; margin-bottom: 16px; }
            .qr-box { flex-shrink: 0; padding: 8px; border: 1px dashed #fcd34d; border-radius: 10px; background: #fffbeb; }
            .info { flex: 1; }
            .name { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
            .detail { font-size: 12px; color: #475569; margin: 3px 0; }
            .detail strong { color: #0f172a; }
            .footer { border-top: 1px solid #fed7aa; padding-top: 10px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="logo-title">Persons with Disability Affairs Office (PDAO)</div>
              <div class="sub">Municipality of Bongabong • Province of Oriental Mindoro</div>
              <div class="tag">Official PWD Registration & Assistance Pass</div>
            </div>
            <div class="content">
              <div class="qr-box">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(b.beneficiary_id_code || b.RFID_number || b.id)}" width="130" height="130" alt="QR Code" />
              </div>
              <div class="info">
                <div class="name">${b.first_name} ${b.middle_name ? b.middle_name + ' ' : ''}${b.last_name}</div>
                <div class="detail"><strong>PWD ID:</strong> ${b.beneficiary_id_code || 'BEN-PWD-' + b.id}</div>
                <div class="detail"><strong>Sex / Birthdate:</strong> ${b.sex || '—'} • ${b.birthdate || '—'}</div>
                <div class="detail"><strong>Barangay:</strong> ${brgy}</div>
                <div class="detail"><strong>IP Status:</strong> ${b.ip_classification || 'Non-IP'}</div>
                <div class="detail"><strong>RFID:</strong> ${b.RFID_number || 'Unassigned'}</div>
                <div class="detail"><strong>Statutory Rights:</strong> RA 7277 / RA 10754</div>
              </div>
            </div>
            <div class="footer">
              This card certifies official registration in the EBMS Municipal PWD Registry. Holder is entitled to statutory discounts, VAT exemption, and inclusive social assistance services.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Review / Approve / Reject Application
  const handleApproveApplication = async (appId) => {
    setProcessingApp(true);
    setAppActionSuccess(null);
    try {
      await beneficiaryApi.approveApplication(appId);
      setAppActionSuccess('Application has been successfully APPROVED! Person with Disability (PWD) is now officially registered.');
      loadSectorData(true);
      setTimeout(() => setSelectedApp(null), 1500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve application.');
    } finally {
      setProcessingApp(false);
    }
  };

  const handleRejectApplication = async (appId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a medical or clinical justification for rejection.');
      return;
    }
    setProcessingApp(true);
    setAppActionSuccess(null);
    try {
      await beneficiaryApi.rejectApplication(appId, {
        rejection_reason: rejectionReason,
        missing_documents: missingDocs
      });
      setAppActionSuccess('Application has been marked as REJECTED with notice sent.');
      loadSectorData(true);
      setTimeout(() => setSelectedApp(null), 1500);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject application.');
    } finally {
      setProcessingApp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-3">
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-amber-600 border-t-transparent"></div>
        <p className="text-xs font-semibold text-slate-500">Loading PWD Administration Console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-[1600px] mx-auto">
      {/* ━━━ Header Section ━━━ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <Accessibility className="w-3.5 h-3.5 text-amber-600" />
              PDAO Administration Hub
            </span>
            <span className="text-xs text-slate-400">• RA 7277 & RA 10754 Magna Carta for PWDs</span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            PWD Administration (PDAO)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dedicated portal for Persons with Disability Affairs Office & MSWDO inclusive welfare management.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => loadSectorData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-2xs active:scale-95"
            title="Refresh sector data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportData('xlsx')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Registry (Excel)</span>
          </button>
        </div>
      </div>

      {/* ━━━ KPI Metric Cards ━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total PWD Beneficiaries */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Registered PWDs</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
              <Accessibility className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.total.toLocaleString()}</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Verified</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across 36 municipal barangays</p>
        </div>

        {/* IP PWDs */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">IP Community PWDs</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.ipCount}</span>
            <span className="text-[11px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md font-semibold">
              {stats.total > 0 ? `${Math.round((stats.ipCount / stats.total) * 100)}%` : '0%'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{stats.nonIpCount} Non-IP beneficiaries</p>
        </div>

        {/* Pending PWD Applications */}
        <div 
          onClick={() => setActiveTab('applications')}
          className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending Applications</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-900">{stats.pendingApps}</span>
            <span className="text-[11px] font-semibold text-amber-700">Medical Review</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Click to open applications queue</p>
        </div>

        {/* Active PWD Programs */}
        <div 
          onClick={() => setActiveTab('programs')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inclusive Programs</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.activePrograms}</span>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">Programs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Assistive Devices & ID Issuance</p>
        </div>

        {/* RFID Enrolled */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">RFID Smart Tags</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.rfidCount}</span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">Contactless</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Equipped for scanner distribution</p>
        </div>
      </div>

      {/* ━━━ Sector Navigation Tabs ━━━ */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'directory'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Accessibility className="w-4 h-4" />
          <span>PWD Beneficiaries ({filteredBeneficiaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('programs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'programs'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>PDAO & Inclusive Programs ({programs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition relative ${
            activeTab === 'applications'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Medical Review Queue</span>
          {applications.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'applications' ? 'bg-white text-amber-700' : 'bg-amber-600 text-white'
            }`}>
              {applications.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('assistive_devices')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'assistive_devices'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Assistive Devices & Aids</span>
        </button>

        <button
          onClick={() => setActiveTab('consultations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'consultations'
              ? 'bg-amber-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Orientations & Consultations ({announcements.length})</span>
        </button>
      </div>

      {/* ━━━ TAB 1: PWD Beneficiaries Directory ━━━ */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search PWD name, ID, RFID..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Barangay Filter */}
              <div>
                <select
                  value={selectedBarangay}
                  onChange={(e) => { setSelectedBarangay(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-slate-700"
                >
                  <option value="">All Barangays (36)</option>
                  {barangays.map(b => (
                    <option key={b.id} value={b.id}>{b.barangay_name}</option>
                  ))}
                </select>
              </div>

              {/* IP Classification Filter */}
              <div>
                <select
                  value={selectedIpClassification}
                  onChange={(e) => { setSelectedIpClassification(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white text-slate-700"
                >
                  <option value="">All IP Classifications</option>
                  <option value="IP">Indigenous Peoples (IP)</option>
                  <option value="Non-IP">Non-IP</option>
                </select>
              </div>


            </div>

            {/* Quick Filter Indicators */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span>Showing <strong>{filteredBeneficiaries.length}</strong> PWD beneficiaries</span>
                {(searchQuery || selectedBarangay || selectedIpClassification || selectedPayout) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBarangay('');
                      setSelectedIpClassification('');
                      setSelectedPayout('');
                      setCurrentPage(1);
                    }}
                    className="text-amber-600 hover:underline font-semibold ml-2"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportData('csv')}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium hover:underline"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">PWD Beneficiary</th>
                    <th className="px-4 py-3">IDs & RFID</th>
                    <th className="px-4 py-3">Barangay & Address</th>
                    <th className="px-4 py-3">Demographics & Classification</th>
                    <th className="px-4 py-3">Disbursement Method</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBeneficiaries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                        <Accessibility className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No PWD beneficiaries found matching the filters</p>
                        <p className="text-[11px] mt-0.5">Try adjusting your search criteria or resetting filters.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedBeneficiaries.map((b) => {
                      const brgy = barangays.find(x => x.id === b.barangay_id);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition">
                          {/* Name & Avatar */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 border border-amber-200">
                                {b.first_name?.[0] || 'P'}{b.last_name?.[0] || 'D'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm">
                                  {b.first_name} {b.middle_name ? b.middle_name + ' ' : ''}{b.last_name}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>{b.sex || '—'}</span>
                                  <span>•</span>
                                  <span className="text-amber-700 font-semibold">{b.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* IDs */}
                          <td className="px-4 py-3">
                            <div className="font-mono text-slate-700 font-semibold">{b.beneficiary_id_code || '—'}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              {b.RFID_number ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Smartphone className="w-3 h-3" />
                                  RFID: {b.RFID_number}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No RFID tag</span>
                              )}
                            </div>
                          </td>

                          {/* Barangay */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{brgy ? brgy.barangay_name : 'Bongabong'}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {b.sitio ? `Sitio ${b.sitio}` : b.address || '—'}
                            </div>
                          </td>

                          {/* Demographics & Classification */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.ip_classification === 'IP' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {b.ip_classification || 'Non-IP'}
                              </span>
                              <span className="text-slate-400">• Born {b.birthdate || '—'}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Contact: {b.contact_number || 'None'}
                            </div>
                          </td>



                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenBeneficiary(b)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                                title="View PWD Profile & Details"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenQrModal(b)}
                                className="p-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700 transition"
                                title="View & Print Official PWD Pass / QR"
                              >
                                <QrCode className="w-4 h-4 text-amber-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
                <div>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━ TAB 2: PDAO & Inclusive Programs ━━━ */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">PDAO & Inclusive Welfare Programs</h2>
              <p className="text-xs text-slate-500">
                Statutory and municipal programs dedicated to Persons with Disabilities in Bongabong.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/programs')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Manage Programs</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map(prog => (
              <div key={prog.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                      {prog.agency || 'PDAO / MSWDO'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      prog.status === 'Active' || prog.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {prog.status || 'Active'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{prog.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-3 mb-4">{prog.description || 'Dedicated assistance and inclusive support program for Persons with Disabilities.'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Target Group:</span>
                    <span className="font-semibold text-slate-800">{prog.eligibility_category || 'Persons with Disabilities (PWD)'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Benefit Type:</span>
                    <span className="font-semibold text-amber-700">{prog.benefit_type || 'Assistive Devices / Financial Aid'}</span>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/dashboard/programs/${prog.id}`)}
                      className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 transition text-center"
                    >
                      View Program Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ TAB 3: Applications & Medical Review Queue ━━━ */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">PWD Applications & Medical Review Queue</h2>
              <p className="text-xs text-slate-500">
                Verify incoming PWD registrations, medical certificates, and physician assessments.
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              {applications.length} Awaiting PDAO Verification
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">All PWD Applications are Evaluated</h3>
              <p className="text-xs text-slate-500 mt-0.5">There are no pending PWD applications in the queue right now.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Applicant Name</th>
                      <th className="px-4 py-3">Barangay</th>
                      <th className="px-4 py-3">Attached Medical Docs</th>
                      <th className="px-4 py-3">Application Status</th>
                      <th className="px-4 py-3 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.map(app => {
                      const brgy = barangays.find(x => x.id === app.barangay_id);
                      return (
                        <tr key={app.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-sm">
                              {app.first_name} {app.middle_name ? app.middle_name + ' ' : ''}{app.last_name}
                            </div>
                            <div className="text-[11px] text-slate-500">{app.contact_number || 'No contact'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-700">{brgy ? brgy.barangay_name : 'Bongabong'}</span>
                            <div className="text-[10px] text-slate-400">{app.ip_classification || 'Non-IP'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <Stethoscope className="w-3.5 h-3.5 text-amber-600" />
                              {app.Documents?.length || 0} Medical/Legal Docs Uploaded
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              {app.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setRejectionReason('');
                                setMissingDocs([]);
                                setShowRejectBox(false);
                                setAppActionSuccess(null);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <span>Evaluate & Approve</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━ TAB 4: Assistive Devices & Interventions ━━━ */}
      {activeTab === 'assistive_devices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">PDAO Assistive Mobility & Sensory Devices</h2>
              <p className="text-xs text-slate-500">
                Specialized wheelchairs, crutches, white canes, hearing aids, and physical therapy referrals.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/interventions-management')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>All Interventions</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold mb-3">
                🦽
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Customized Wheelchairs & Crutches</h3>
              <p className="text-xs text-slate-600 mt-1">
                Measured wheelchairs, pediatric wheelchairs, underarm and elbow crutches for persons with physical impairments.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-3">
                🦯
              </div>
              <h3 className="font-bold text-slate-900 text-sm">White Canes & Sensory Devices</h3>
              <p className="text-xs text-slate-600 mt-1">
                Reflective white canes and sensory aids for visually-impaired beneficiaries in coordination with local SPED centers.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
                🦻
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Hearing Aids & Assistive Tech</h3>
              <p className="text-xs text-slate-600 mt-1">
                Audiological evaluations, digital hearing devices, and assistive technology for deaf and hard-of-hearing members.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ TAB 5: Orientations & Consultations ━━━ */}
      {activeTab === 'consultations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">PDAO Orientations, Assemblies & Consultations</h2>
              <p className="text-xs text-slate-500">
                Information sessions on RA 7277, RA 10754 privileges, discount booklets, and inclusive townhalls.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/announcements')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Announcements Hub</span>
            </button>
          </div>

          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      {ann.program || 'PDAO Assembly'}
                    </span>
                    <span className="text-xs text-slate-400">• {ann.target_barangay || 'All Barangays'}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{ann.activity_date ? new Date(ann.activity_date).toLocaleDateString() : 'Scheduled'}</span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1">{ann.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{ann.message}</p>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-400">Venue: <strong>{ann.venue || 'PDAO Center / Municipal Multi-Purpose Hall'}</strong></span>
                  <button
                    onClick={() => navigate('/dashboard/rfid-attendance')}
                    className="inline-flex items-center gap-1 text-amber-700 font-bold hover:underline"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Scan RFID Attendance</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ MODAL 1: PWD Profile Details ━━━ */}
      {viewingBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 border border-amber-200 text-sm">
                  {viewingBeneficiary.first_name?.[0]}{viewingBeneficiary.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingBeneficiary.first_name} {viewingBeneficiary.middle_name ? viewingBeneficiary.middle_name + ' ' : ''}{viewingBeneficiary.last_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingBeneficiary.beneficiary_id_code} • Registered Person with Disability (PWD)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingBeneficiary(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-200 flex gap-4 text-xs font-bold text-slate-600 bg-white">
              <button
                onClick={() => setActiveModalTab('overview')}
                className={`py-3 border-b-2 transition ${activeModalTab === 'overview' ? 'border-amber-600 text-amber-600' : 'border-transparent hover:text-slate-900'}`}
              >
                Profile & Details
              </button>
              <button
                onClick={() => setActiveModalTab('attendance')}
                className={`py-3 border-b-2 transition ${activeModalTab === 'attendance' ? 'border-amber-600 text-amber-600' : 'border-transparent hover:text-slate-900'}`}
              >
                PWD and Senior Attendance ({attendanceRecords.length})
              </button>
              <button
                onClick={() => setActiveModalTab('rfid')}
                className={`py-3 border-b-2 transition ${activeModalTab === 'rfid' ? 'border-amber-600 text-amber-600' : 'border-transparent hover:text-slate-900'}`}
              >
                RFID Management
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {activeModalTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date of Birth</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{viewingBeneficiary.birthdate || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sex & Civil Status</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{viewingBeneficiary.sex || '—'} • {viewingBeneficiary.civil_status || 'Single'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">IP Classification</span>
                      <p className="font-semibold text-purple-700 mt-0.5">{viewingBeneficiary.ip_classification || 'Non-IP'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Barangay</span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {barangays.find(x => x.id === viewingBeneficiary.barangay_id)?.barangay_name || 'Bongabong'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Number</span>
                      <p className="font-semibold text-slate-900 mt-0.5">{viewingBeneficiary.contact_number || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Statutory Status</span>
                      <p className="font-semibold text-emerald-700 mt-0.5">RA 7277 / RA 10754 Verified</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disbursement & Payout Account</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Method: <strong>{viewingBeneficiary.payout_preference === 'digital' ? 'E-Wallet / Bank' : 'Cash OTC / RFID'}</strong></div>
                      <div>Provider: <strong>{viewingBeneficiary.payout_provider || '—'}</strong></div>
                      <div>Account No: <strong>{viewingBeneficiary.payout_account_number || '—'}</strong></div>
                      <div>Account Holder: <strong>{viewingBeneficiary.payout_account_name || '—'}</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === 'attendance' && (
                <div className="space-y-3">
                  {loadingAttendance ? (
                    <div className="text-center py-6 text-slate-400">Loading attendance history...</div>
                  ) : attendanceRecords.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">No meeting attendance records found.</div>
                  ) : (
                    <div className="space-y-2">
                      {attendanceRecords.map((att, i) => (
                        <div key={i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{att.event_title || 'PDAO Assembly'}</div>
                            <div className="text-[11px] text-slate-500">{new Date(att.attended_at || att.created_at).toLocaleString()}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Present
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'rfid' && (
                <div className="space-y-3">
                  <p className="text-slate-600">
                    Assign or re-link an RFID card or wristband to this PWD beneficiary for contactless assistance claims and orientation attendance.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">RFID Card Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        placeholder="e.g. 0004567891"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveRfid}
                        disabled={savingRfid}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50 transition"
                      >
                        {savingRfid ? 'Saving...' : 'Update RFID'}
                      </button>
                    </div>
                  </div>
                  {rfidMessage && (
                    <div className={`p-3 rounded-xl text-xs font-semibold ${
                      rfidMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {rfidMessage.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleOpenQrModal(viewingBeneficiary)}
                className="inline-flex items-center gap-1.5 text-amber-700 font-bold hover:underline"
              >
                <QrCode className="w-4 h-4" />
                <span>Open Digital PWD Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingBeneficiary(null)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ MODAL 2: Digital PWD Pass (QR) ━━━ */}
      {qrModalBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4 animate-scaleIn">
            <button
              onClick={() => setQrModalBeneficiary(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-block p-2 rounded-full bg-amber-100 text-amber-800 mb-2">
                <Accessibility className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Official PWD Pass</h3>
              <p className="text-xs text-slate-500">PDAO Digital Identity Verification</p>
            </div>

            {/* QR View */}
            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 inline-block">
              <QRCodeSVG
                value={qrPassData?.qr_code_value || qrModalBeneficiary.beneficiary_id_code || `BEN-${qrModalBeneficiary.id}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div>
              <div className="font-bold text-slate-900 text-sm">
                {qrModalBeneficiary.first_name} {qrModalBeneficiary.last_name}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                {qrModalBeneficiary.beneficiary_id_code || 'ID: ' + qrModalBeneficiary.id}
              </div>
              <div className="text-[11px] text-amber-800 font-semibold mt-1">
                {barangays.find(x => x.id === qrModalBeneficiary.barangay_id)?.barangay_name || 'Bongabong'} • RA 7277 Registered
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintQrPass}
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official PWD Card</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ MODAL 3: Review Application ━━━ */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">Evaluate PWD Application</h3>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Application Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Applicant:</span>
                <span className="font-bold text-slate-900">{selectedApp.first_name} {selectedApp.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Barangay:</span>
                <span className="font-semibold text-slate-800">
                  {barangays.find(x => x.id === selectedApp.barangay_id)?.barangay_name || 'Bongabong'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact:</span>
                <span className="font-semibold text-slate-800">{selectedApp.contact_number || '—'}</span>
              </div>
            </div>

            {/* Documents Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Attached Medical & Legal Documents</h4>
              {(!selectedApp.Documents || selectedApp.Documents.length === 0) ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                  No medical certificate or documents attached yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedApp.Documents.map(doc => (
                    <div key={doc.id} className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold text-slate-800">{doc.document_type || doc.file_name}</span>
                      </div>
                      <a
                        href={resolveFileUrl(doc.file_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-700 hover:underline font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {appActionSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                {appActionSuccess}
              </div>
            )}

            {/* Rejection Form Box */}
            {showRejectBox && (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                <h5 className="font-bold text-amber-900 text-xs">Specify Medical / Clinical Justification</h5>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection (e.g. uncertified medical assessment, incomplete clinical findings)..."
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  rows="3"
                />
                <button
                  type="button"
                  onClick={() => handleRejectApplication(selectedApp.id)}
                  disabled={processingApp}
                  className="w-full py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition"
                >
                  {processingApp ? 'Processing...' : 'Confirm Rejection'}
                </button>
              </div>
            )}

            {/* Footer Actions */}
            {!appActionSuccess && !showRejectBox && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectBox(true)}
                  className="px-4 py-2 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs transition"
                >
                  Reject Application
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveApplication(selectedApp.id)}
                  disabled={processingApp}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{processingApp ? 'Approving...' : 'Approve PWD Registration'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


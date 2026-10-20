import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, Award, Calendar, MapPin, Phone, Mail, ShieldCheck, CheckCircle2, 
  XCircle, Clock, Search, Filter, Download, Printer, QrCode, FileText, 
  ExternalLink, RefreshCw, AlertTriangle, Eye, ChevronRight, Sparkles, 
  Building2, Wallet, Megaphone, Smartphone, HeartHandshake, Package, 
  Check, X, FileCheck, Layers, Info
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

export default function SeniorCitizenAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'programs' | 'applications' | 'interventions' | 'assemblies'

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
  const [selectedAgeBracket, setSelectedAgeBracket] = useState('all'); // 'all', '60-69', '70-79', '80+'

  // Pagination for Directory
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected beneficiary for profile modal
  const [viewingBeneficiary, setViewingBeneficiary] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('overview'); // 'overview' | 'documents' | 'attendance' | 'payout'
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Digital QR Pass Modal
  const [qrModalBeneficiary, setQrModalBeneficiary] = useState(null);
  const [qrPassData, setQrPassData] = useState(null);
  const [loadingQrPass, setLoadingQrPass] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

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

  // Calculate age from birthdate
  const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Helper to check if category is Senior Citizen
  const isSeniorCategory = (cat) => {
    if (!cat) return false;
    const c = String(cat).toLowerCase();
    return c.includes('senior') || c.includes('social pension');
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

      // 1. Beneficiaries (filter to Senior Citizens only)
      if (bRes.status === 'fulfilled') {
        const raw = bRes.value.data?.data || [];
        const seniorsOnly = raw.filter(b => isSeniorCategory(b.category));
        setBeneficiaries(seniorsOnly);
      }

      // 2. Barangays
      if (brgyRes.status === 'fulfilled') {
        setBarangays(brgyRes.value.data?.data || []);
      }

      // 3. Programs (Senior-targeted programs)
      if (progRes.status === 'fulfilled') {
        const rawPrograms = progRes.value.data?.data || [];
        const seniorPrograms = rawPrograms.filter(p => {
          const cat = String(p.eligibility_category || p.category || p.name || '').toLowerCase();
          return cat.includes('senior') || cat.includes('social pension') || cat.includes('osca') || cat.includes('geriatric') || cat.includes('wellness');
        });
        setPrograms(seniorPrograms.length > 0 ? seniorPrograms : rawPrograms);
      }

      // 4. Applications (Senior Citizens pending review)
      if (appRes.status === 'fulfilled') {
        const rawApps = appRes.value.data?.data || [];
        const seniorApps = rawApps.filter(a => isSeniorCategory(a.category) && a.status !== 'Approved');
        setApplications(seniorApps);
      }

      // 5. Announcements (Senior sector assemblies & meetings)
      if (annRes.status === 'fulfilled') {
        const rawAnn = annRes.value.data?.data || [];
        const seniorAnn = rawAnn.filter(a => {
          const t = `${a.title} ${a.program || ''} ${a.sector || ''} ${a.target_categories || ''}`.toLowerCase();
          return t.includes('senior') || t.includes('osca') || t.includes('pension');
        });
        setAnnouncements(seniorAnn.length > 0 ? seniorAnn : rawAnn);
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
      console.error('Failed to load Senior Citizen admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSectorData();
  }, []);

  // Filtered Senior Beneficiaries
  const filteredBeneficiaries = useMemo(() => {
    return beneficiaries.filter(b => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.toLowerCase();
        const code = String(b.beneficiary_id_code || '').toLowerCase();
        const oscaId = String(b.osca_id_number || b.national_id_number || '').toLowerCase();
        const rfid = String(b.RFID_number || '').toLowerCase();
        const phone = String(b.contact_number || '').toLowerCase();
        if (!fullName.includes(q) && !code.includes(q) && !oscaId.includes(q) && !rfid.includes(q) && !phone.includes(q)) {
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

      // Age bracket filter
      if (selectedAgeBracket !== 'all') {
        const age = calculateAge(b.birthdate);
        if (age === null) return false;
        if (selectedAgeBracket === '60-69' && (age < 60 || age > 69)) return false;
        if (selectedAgeBracket === '70-79' && (age < 70 || age > 79)) return false;
        if (selectedAgeBracket === '80+' && age < 80) return false;
      }

      return true;
    });
  }, [beneficiaries, searchQuery, selectedBarangay, selectedIpClassification, selectedPayout, selectedAgeBracket]);

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
    
    // Age breakdowns
    let youngOld = 0; // 60-69
    let middleOld = 0; // 70-79
    let oldest = 0; // 80+
    beneficiaries.forEach(b => {
      const age = calculateAge(b.birthdate);
      if (age !== null) {
        if (age >= 80) oldest++;
        else if (age >= 70) middleOld++;
        else if (age >= 60) youngOld++;
      }
    });

    return {
      total,
      ipCount,
      nonIpCount,
      verifiedPayouts,
      pendingApps: applications.length,
      activePrograms: programs.filter(p => p.status === 'Active' || p.status === 'active').length,
      youngOld,
      middleOld,
      oldest
    };
  }, [beneficiaries, applications, programs]);

  // Export to Excel / CSV
  const handleExportData = (format = 'xlsx') => {
    const rows = filteredBeneficiaries.map((b, idx) => {
      const brgy = barangays.find(x => x.id === b.barangay_id);
      const age = calculateAge(b.birthdate);
      return {
        '#': idx + 1,
        'Beneficiary ID': b.beneficiary_id_code || '—',
        'Full Name': `${b.last_name || ''}, ${b.first_name || ''} ${b.middle_name || ''}`.trim(),
        'Sex': b.sex || '—',
        'Age': age !== null ? age : '—',
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Senior Citizens Registry');

    const fileName = `EBMS_Senior_Citizens_Registry_${new Date().toISOString().slice(0, 10)}.${format}`;
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
      // Fallback object if backend qr-pass endpoint error
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

  // Print QR Pass Card
  const handlePrintQrPass = () => {
    if (!qrModalBeneficiary) return;
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) {
      window.print();
      return;
    }
    const b = qrModalBeneficiary;
    const brgy = barangays.find(x => x.id === b.barangay_id)?.barangay_name || 'Bongabong';
    const age = calculateAge(b.birthdate);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Senior Citizen OSCA Digital Pass - ${b.first_name} ${b.last_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 20px; background: #fff; color: #1e293b; }
            .card { width: 440px; margin: 0 auto; border: 2px solid #e11d48; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #fff; position: relative; }
            .header { text-align: center; border-bottom: 2px solid #fecdd3; padding-bottom: 12px; margin-bottom: 16px; }
            .logo-title { font-size: 16px; font-weight: 800; color: #9f1239; text-transform: uppercase; letter-spacing: 0.5px; }
            .sub { font-size: 11px; color: #64748b; font-weight: 500; }
            .tag { display: inline-block; background: #ffe4e6; color: #be123c; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-top: 6px; text-transform: uppercase; }
            .content { display: flex; gap: 18px; align-items: center; margin-bottom: 16px; }
            .qr-box { flex-shrink: 0; padding: 8px; border: 1px dashed #fda4af; border-radius: 10px; background: #fff1f2; }
            .info { flex: 1; }
            .name { font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
            .detail { font-size: 12px; color: #475569; margin: 3px 0; }
            .detail strong { color: #0f172a; }
            .footer { border-top: 1px solid #fecdd3; padding-top: 10px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="logo-title">Office of Senior Citizens Affairs (OSCA)</div>
              <div class="sub">Municipality of Bongabong • Province of Oriental Mindoro</div>
              <div class="tag">Official Senior Citizen Social Pension Pass</div>
            </div>
            <div class="content">
              <div class="qr-box">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(b.beneficiary_id_code || b.RFID_number || b.id)}" width="130" height="130" alt="QR Code" />
              </div>
              <div class="info">
                <div class="name">${b.first_name} ${b.middle_name ? b.middle_name + ' ' : ''}${b.last_name}</div>
                <div class="detail"><strong>Senior ID:</strong> ${b.beneficiary_id_code || 'BEN-SR-' + b.id}</div>
                <div class="detail"><strong>Age / Sex:</strong> ${age ? age + ' yrs old' : '—'} • ${b.sex || '—'}</div>
                <div class="detail"><strong>Barangay:</strong> ${brgy}</div>
                <div class="detail"><strong>IP Status:</strong> ${b.ip_classification || 'Non-IP'}</div>
                <div class="detail"><strong>RFID:</strong> ${b.RFID_number || 'Unassigned'}</div>
                <div class="detail"><strong>Status:</strong> Approved Beneficiary</div>
              </div>
            </div>
            <div class="footer">
              This card certifies official inclusion in the EBMS Senior Citizen Social Welfare Registry. Present this pass or RFID tag at municipal distribution events.
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
      setAppActionSuccess('Application has been successfully APPROVED! Senior Citizen is now officially registered.');
      // Refresh list
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
      alert('Please provide a reason for rejection.');
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
        <div className="animate-spin rounded-full h-9 w-9 border-2 border-rose-600 border-t-transparent"></div>
        <p className="text-xs font-semibold text-slate-500">Loading Senior Citizen Admin Console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-[1600px] mx-auto">
      {/* ━━━ Header Section ━━━ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
              <Award className="w-3.5 h-3.5 text-rose-600" />
              OSCA Administration Hub
            </span>
            <span className="text-xs text-slate-400">• RA 9994 Expanded Senior Citizens Act</span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Senior Citizen Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dedicated portal for the Office of Senior Citizens Affairs (OSCA) & MSWDO Social Pension management.
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
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin text-rose-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportData('xlsx')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Registry (Excel)</span>
          </button>
        </div>
      </div>

      {/* ━━━ KPI Metric Cards ━━━ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Seniors */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Senior Citizens</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.total.toLocaleString()}</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">100% Verified</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Covering all 36 barangays</p>
        </div>

        {/* IP Seniors */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">IP Senior Citizens</span>
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

        {/* Pending Applications */}
        <div 
          onClick={() => setActiveTab('applications')}
          className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending Review</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-900">{stats.pendingApps}</span>
            <span className="text-[11px] font-semibold text-amber-700">Awaiting OSCA</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Click to open applications queue</p>
        </div>

        {/* Active Senior Programs */}
        <div 
          onClick={() => setActiveTab('programs')}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs cursor-pointer hover:border-slate-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Programs</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.activePrograms}</span>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">Programs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Social Pension & Mobility</p>
        </div>

        {/* Age Demographics */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Oldest / Frail (80+)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{stats.oldest}</span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">Priority</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{stats.youngOld} (60-69) • {stats.middleOld} (70-79)</p>
        </div>
      </div>

      {/* ━━━ Sector Navigation Tabs ━━━ */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'directory'
              ? 'bg-rose-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Senior Beneficiaries ({filteredBeneficiaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('programs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'programs'
              ? 'bg-rose-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>OSCA & Social Pension Programs ({programs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition relative ${
            activeTab === 'applications'
              ? 'bg-rose-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Review Applications</span>
          {applications.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
              activeTab === 'applications' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
            }`}>
              {applications.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('interventions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'interventions'
              ? 'bg-rose-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Mobility Devices & Aid</span>
        </button>

        <button
          onClick={() => setActiveTab('assemblies')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
            activeTab === 'assemblies'
              ? 'bg-rose-600 text-white shadow-xs font-bold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Assemblies & Health Sessions ({announcements.length})</span>
        </button>
      </div>

      {/* ━━━ TAB 1: Senior Beneficiaries Directory ━━━ */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, ID, RFID..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Barangay Filter */}
              <div>
                <select
                  value={selectedBarangay}
                  onChange={(e) => { setSelectedBarangay(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white text-slate-700"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white text-slate-700"
                >
                  <option value="">All IP Classifications</option>
                  <option value="IP">Indigenous Peoples (IP)</option>
                  <option value="Non-IP">Non-IP</option>
                </select>
              </div>

              {/* Age Bracket */}
              <div>
                <select
                  value={selectedAgeBracket}
                  onChange={(e) => { setSelectedAgeBracket(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white text-slate-700"
                >
                  <option value="all">All Ages (60+)</option>
                  <option value="60-69">60 - 69 yrs (Young-Old)</option>
                  <option value="70-79">70 - 79 yrs (Middle-Old)</option>
                  <option value="80+">80+ yrs (Centenarian/Frail)</option>
                </select>
              </div>


            </div>

            {/* Quick Filter Indicators */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span>Showing <strong>{filteredBeneficiaries.length}</strong> senior citizens</span>
                {(searchQuery || selectedBarangay || selectedIpClassification || selectedPayout || selectedAgeBracket !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBarangay('');
                      setSelectedIpClassification('');
                      setSelectedPayout('');
                      setSelectedAgeBracket('all');
                      setCurrentPage(1);
                    }}
                    className="text-rose-600 hover:underline font-semibold ml-2"
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
                    <th className="px-4 py-3">Senior Beneficiary</th>
                    <th className="px-4 py-3">IDs & RFID</th>
                    <th className="px-4 py-3">Barangay & Address</th>
                    <th className="px-4 py-3">Age & Demographics</th>
                    
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedBeneficiaries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                        <Award className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">No senior citizens found matching the filters</p>
                        <p className="text-[11px] mt-0.5">Try adjusting your search criteria or resetting filters.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedBeneficiaries.map((b) => {
                      const brgy = barangays.find(x => x.id === b.barangay_id);
                      const age = calculateAge(b.birthdate);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition">
                          {/* Name & Avatar */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 border border-rose-200">
                                {b.first_name?.[0] || 'S'}{b.last_name?.[0] || 'C'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm">
                                  {b.first_name} {b.middle_name ? b.middle_name + ' ' : ''}{b.last_name}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>{b.sex || '—'}</span>
                                  <span>•</span>
                                  <span className="text-rose-600 font-semibold">{b.category}</span>
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

                          {/* Age & Demographics */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-sm">{age !== null ? `${age} yrs old` : '—'}</span>
                              {age !== null && age >= 80 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                                  80+
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] mt-1 flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.ip_classification === 'IP' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {b.ip_classification || 'Non-IP'}
                              </span>
                              <span className="text-slate-400">• Born {b.birthdate || '—'}</span>
                            </div>
                          </td>



                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenBeneficiary(b)}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                                title="View Senior Profile & Records"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenQrModal(b)}
                                className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 transition"
                                title="View & Print Digital Senior Pass / QR"
                              >
                                <QrCode className="w-4 h-4 text-rose-600" />
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

      {/* ━━━ TAB 2: Programs (OSCA & Social Pension) ━━━ */}
      {activeTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Senior Citizen Welfare Programs</h2>
              <p className="text-xs text-slate-500">
                Statutory and municipal programs dedicated to Social Pensioners and Senior Citizens.
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
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      {prog.agency || 'OSCA / MSWDO'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      prog.status === 'Active' || prog.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {prog.status || 'Active'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{prog.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-3 mb-4">{prog.description || 'Dedicated assistance program for indigent senior citizens in Bongabong.'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Eligibility:</span>
                    <span className="font-semibold text-slate-800">{prog.eligibility_category || 'Senior Citizens'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Benefit Type:</span>
                    <span className="font-semibold text-rose-700">{prog.benefit_type || 'Social Pension / Cash'}</span>
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

      {/* ━━━ TAB 3: Applications Queue ━━━ */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Senior Citizen Applications Queue</h2>
              <p className="text-xs text-slate-500">
                Review incoming applications for the Social Pension for Indigent Senior Citizens and OSCA registration.
              </p>
            </div>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              {applications.length} Awaiting Verification
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">All Senior Applications are Reviewed</h3>
              <p className="text-xs text-slate-500 mt-0.5">There are no pending senior citizen applications in the queue right now.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Applicant Name</th>
                      <th className="px-4 py-3">Computed Age</th>
                      <th className="px-4 py-3">Barangay</th>
                      <th className="px-4 py-3">Attached Documents</th>
                      <th className="px-4 py-3">Application Status</th>
                      <th className="px-4 py-3 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.map(app => {
                      const brgy = barangays.find(x => x.id === app.barangay_id);
                      const age = calculateAge(app.birthdate);
                      return (
                        <tr key={app.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-sm">
                              {app.first_name} {app.middle_name ? app.middle_name + ' ' : ''}{app.last_name}
                            </div>
                            <div className="text-[11px] text-slate-500">{app.contact_number || 'No contact'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-800">{age !== null ? `${age} yrs old` : '—'}</span>
                            <div className="text-[10px] text-slate-400">Born {app.birthdate || '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-700">{brgy ? brgy.barangay_name : 'Bongabong'}</span>
                            <div className="text-[10px] text-slate-400">{app.ip_classification || 'Non-IP'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                              <FileCheck className="w-3.5 h-3.5" />
                              {app.Documents?.length || 0} Documents Uploaded
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
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1"
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

      {/* ━━━ TAB 4: Mobility & Assistive Devices / Interventions ━━━ */}
      {activeTab === 'interventions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">OSCA Mobility & Assistive Devices Support</h2>
              <p className="text-xs text-slate-500">
                Wheelchairs, walking canes, hearing aids, and maintenance medicine interventions for frail and bedridden seniors.
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
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-3">
                🦽
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Wheelchairs & Walkers</h3>
              <p className="text-xs text-slate-600 mt-1">
                Standard and reclining wheelchairs distributed to frail seniors through OSCA and municipal health partners.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-3">
                🦯
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Quad Canes & Mobility Aids</h3>
              <p className="text-xs text-slate-600 mt-1">
                Assistive walking sticks, quad canes, and mobility supports to prevent fall hazards among elderly residents.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
                💊
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Geriatric Maintenance Medicine</h3>
              <p className="text-xs text-slate-600 mt-1">
                Hypertension, diabetes maintenance medicines, and multivitamins dispatched via barangay health centers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ TAB 5: Assemblies & Health Sessions ━━━ */}
      {activeTab === 'assemblies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Senior Assemblies, Orientations & Health Missions</h2>
              <p className="text-xs text-slate-500">
                Official meetings, OSCA consultations, and RFID-tracked health sessions for Senior Citizens.
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
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                      {ann.program || 'Senior Citizen Assembly'}
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
                  <span className="text-slate-400">Venue: <strong>{ann.venue || 'OSCA Office / Municipal Hall'}</strong></span>
                  <button
                    onClick={() => navigate('/dashboard/rfid-attendance')}
                    className="inline-flex items-center gap-1 text-rose-700 font-bold hover:underline"
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

      {/* ━━━ MODAL 1: Senior Citizen Profile Details ━━━ */}
      {viewingBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 border border-rose-200 text-sm">
                  {viewingBeneficiary.first_name?.[0]}{viewingBeneficiary.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {viewingBeneficiary.first_name} {viewingBeneficiary.middle_name ? viewingBeneficiary.middle_name + ' ' : ''}{viewingBeneficiary.last_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingBeneficiary.beneficiary_id_code} • Senior Citizen Social Pensioner
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
                className={`py-3 border-b-2 transition ${activeModalTab === 'overview' ? 'border-rose-600 text-rose-600' : 'border-transparent hover:text-slate-900'}`}
              >
                Profile & Info
              </button>
              <button
                onClick={() => setActiveModalTab('attendance')}
                className={`py-3 border-b-2 transition ${activeModalTab === 'attendance' ? 'border-rose-600 text-rose-600' : 'border-transparent hover:text-slate-900'}`}
              >
                PWD and Senior Attendance ({attendanceRecords.length})
              </button>
              <button
                onClick={() => setActiveModalTab('rfid')}
                className={`py-3 border-b-2 transition ${activeModalTab === 'rfid' ? 'border-rose-600 text-rose-600' : 'border-transparent hover:text-slate-900'}`}
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Computed Age</span>
                      <p className="font-bold text-slate-900 text-sm mt-0.5">
                        {calculateAge(viewingBeneficiary.birthdate) !== null ? `${calculateAge(viewingBeneficiary.birthdate)} years old` : '—'}
                      </p>
                    </div>
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
                            <div className="font-bold text-slate-900">{att.event_title || 'OSCA Meeting'}</div>
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
                    Assign or re-link an RFID card or wristband to this senior citizen for contactless payout releases and attendance scanning.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">RFID Card Number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        placeholder="e.g. 0004567891"
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveRfid}
                        disabled={savingRfid}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50 transition"
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
                className="inline-flex items-center gap-1.5 text-rose-700 font-bold hover:underline"
              >
                <QrCode className="w-4 h-4" />
                <span>Open Digital Pass</span>
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

      {/* ━━━ MODAL 2: Digital Senior Pass (QR) ━━━ */}
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
              <div className="inline-block p-2 rounded-full bg-rose-100 text-rose-700 mb-2">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Senior Citizen Digital Pass</h3>
              <p className="text-xs text-slate-500">OSCA Official Verification QR</p>
            </div>

            {/* QR View */}
            <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 inline-block">
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
              <div className="text-[11px] text-rose-700 font-semibold mt-1">
                {barangays.find(x => x.id === qrModalBeneficiary.barangay_id)?.barangay_name || 'Bongabong'} • Age {calculateAge(qrModalBeneficiary.birthdate) || '60+'}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintQrPass}
                className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Card</span>
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
                <Award className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-base">Evaluate Senior Citizen Application</h3>
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
                <span className="text-slate-500">Age:</span>
                <span className="font-bold text-rose-700">{calculateAge(selectedApp.birthdate)} years old</span>
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Attached Documents</h4>
              {(!selectedApp.Documents || selectedApp.Documents.length === 0) ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                  No documents attached to this application yet.
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
                        className="text-rose-600 hover:underline font-bold text-[11px] inline-flex items-center gap-1"
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
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                <h5 className="font-bold text-rose-900 text-xs">Specify Rejection Justification</h5>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection (e.g. proof of age shows below 60 years old, invalid residency)..."
                  className="w-full p-2.5 rounded-xl border border-rose-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
                  rows="3"
                />
                <button
                  type="button"
                  onClick={() => handleRejectApplication(selectedApp.id)}
                  disabled={processingApp}
                  className="w-full py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition"
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
                  className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition"
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
                  <span>{processingApp ? 'Approving...' : 'Approve Senior Citizen'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


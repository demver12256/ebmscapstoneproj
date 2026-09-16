import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  Package,
  TrendingUp,
  Download,
  AlertTriangle,
  AlertCircle,
  GraduationCap,
  Pill,
  Stethoscope,
  FlaskConical,
  Wallet,
  HeartHandshake,
  HandHeart,
  FileText,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Eye,
  CheckCircle2,
  XCircle,
  X,
  Building2,
  Landmark,
  User,
  Sparkles,
  Plus,
  Zap,
  RefreshCw,
  Paperclip,
  ChevronRight,
  Filter,
  Check
} from 'lucide-react';
import { beneficiaryApi, medicalAssistanceApi, distributionApi, assistanceRequestApi } from '../services/api';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';
import { isNonCashProgram, getNonCashDetails } from '../utils/nonCashPrograms';
import { parseAttachments } from '../utils/assistanceRequirements';

export default function MyBenefitsPage() {
  const navigate = useNavigate();
  const [beneficiary, setBeneficiary] = useState(null);
  const [assistanceApplications, setAssistanceApplications] = useState([]);
  const [portalAssistanceRequests, setPortalAssistanceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [selectedRequestModal, setSelectedRequestModal] = useState(null);
  const [requestFilterStatus, setRequestFilterStatus] = useState('all'); // 'all' | 'in_progress' | 'approved' | 'completed'
  const [previewDoc, setPreviewDoc] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [acknowledgeSuccess, setAcknowledgeSuccess] = useState(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  useEffect(() => {
    loadBeneficiaryData();
  }, []);

  const loadBeneficiaryData = async () => {
    try {
      const [benRes, assistRes, portalReqsRes] = await Promise.all([
        beneficiaryApi.getMe(),
        medicalAssistanceApi.getMyApplications().catch(() => ({ data: { data: [] } })),
        assistanceRequestApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      setBeneficiary(benRes.data.data);
      setAssistanceApplications(assistRes.data?.data || []);
      setPortalAssistanceRequests(portalReqsRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load beneficiary or assistance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeReceipt = async (transactionId) => {
    if (!window.confirm('Sigurado ka ba na natanggap mo na ang digital payout sa iyong account?\n\nAng pagkumpirma na ito ay magsisilbing opisyal na digital resibo at makikita ng DSWD Admin.')) {
      return;
    }

    setAcknowledgingId(transactionId);
    try {
      const res = await distributionApi.acknowledgePayout(transactionId);
      if (res.data?.success) {
        setAcknowledgedIds((prev) => new Set(prev).add(transactionId));
        setAcknowledgeSuccess('✅ Maraming salamat! Matagumpay mong nakumpirma ang pagtanggap ng iyong digital payout.');
        setTimeout(() => setAcknowledgeSuccess(null), 6000);
        await loadBeneficiaryData();
      }
    } catch (err) {
      alert(`Error sa pagkumpirma: ${err.response?.data?.message || err.message}`);
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Base distribution transactions
  const transactions = beneficiary?.DistributionTransactions || [];
  const releasedDistributions = transactions.filter((t) => t.status === 'released');
  const pendingDistributions = transactions.filter((t) => t.status === 'pending');
  const unacknowledgedDigitalPayouts = releasedDistributions.filter(
    (t) => (t.disbursement_type === 'digital' || t.payout_reference_number) && !t.beneficiary_acknowledged_at && !acknowledgedIds.has(t.id)
  );

  const totalDistributionsReceived = releasedDistributions.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0),
    0
  );
  const totalDistributionsPending = pendingDistributions.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0),
    0
  );

  // Assistance requests data (Medical, Educational, Financial, Burial, etc.)
  const approvedOrReleasedAssistance = assistanceApplications.filter(
    (a) => a.status === 'Approved' || a.status === 'Released'
  );
  const pendingVerificationAssistance = assistanceApplications.filter((a) =>
    ['Pending Review', 'Under Verification', 'Under Barangay Verification', 'Verified by Barangay'].includes(
      a.status
    )
  );

  const assistanceReceivedAmount = approvedOrReleasedAssistance
    .filter((a) => a.status === 'Released')
    .reduce((sum, a) => sum + parseFloat(a.approved_amount || a.total_amount_requested || 0), 0);

  const assistanceApprovedPendingRelease = approvedOrReleasedAssistance
    .filter((a) => a.status === 'Approved')
    .reduce((sum, a) => sum + parseFloat(a.approved_amount || a.total_amount_requested || 0), 0);

  // Helper to format dates cleanly
  const formatAppDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Unified assistance requests list combining AssistanceRequest (MSWDO & DSWD) and any medical applications
  const allAssistanceItems = [
    ...portalAssistanceRequests.map((req) => ({
      source: 'assistance_request',
      id: req.id,
      rawId: req.id,
      refNumber: `#${req.id}`,
      agency: req.agency || 'DSWD',
      type: req.type || 'General Assistance',
      category: req.type || 'General Assistance',
      subject: req.subject,
      description: req.description,
      status: req.status || 'Pending', // 'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'
      priority: req.priority || 'Normal',
      adminNotes: req.admin_notes,
      attachmentUrl: req.attachment_url,
      createdAt: req.created_at || req.createdAt,
      reviewedAt: req.reviewed_at,
      reviewer: req.Reviewer,
      rawItem: req,
    })),
    ...assistanceApplications
      .filter((app) => !portalAssistanceRequests.some((r) => r.subject?.includes(app.application_number) || r.id === app.id))
      .map((app) => ({
        source: 'medical_application',
        id: `med-${app.id}`,
        rawId: app.id,
        refNumber: app.application_number,
        agency: 'DSWD',
        type: app.category || 'Medical Assistance',
        category: app.category || 'Medical Assistance',
        subject: `${app.category} - ${app.patient_name}`,
        description: app.diagnosis || 'Medical Assistance Application',
        status: app.status === 'Released' ? 'Completed' : app.status === 'Approved' ? 'Approved' : 'Under Review',
        priority: 'Normal',
        adminNotes: app.staff_remarks || app.barangay_endorsement_notes,
        approvedAmount: parseFloat(app.approved_amount || app.total_amount_requested || 0),
        grantType: app.assistance_type_granted,
        createdAt: app.created_at || app.createdAt,
        reviewedAt: app.reviewed_at,
        rawItem: app,
      })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Counts for tabs
  const countAll = allAssistanceItems.length;
  const countInProgress = allAssistanceItems.filter((i) =>
    ['Pending', 'Under Review', 'Pending Review', 'Under Verification', 'Under Barangay Verification', 'Verified by Barangay'].includes(i.status)
  ).length;
  const countApproved = allAssistanceItems.filter((i) => i.status === 'Approved').length;
  const countCompleted = allAssistanceItems.filter((i) => ['Completed', 'Released'].includes(i.status)).length;

  // Filtered assistance list
  const filteredAssistanceItems = allAssistanceItems.filter((item) => {
    if (requestFilterStatus === 'in_progress') {
      return ['Pending', 'Under Review', 'Pending Review', 'Under Verification', 'Under Barangay Verification', 'Verified by Barangay'].includes(item.status);
    }
    if (requestFilterStatus === 'approved') {
      return item.status === 'Approved';
    }
    if (requestFilterStatus === 'completed') {
      return ['Completed', 'Released'].includes(item.status);
    }
    return true;
  });

  // Helper to render stage progress stepper
  const renderProgressStepper = (item) => {
    const isRejected = item.status === 'Rejected';
    const isPending = item.status === 'Pending';
    const isUnderReview = ['Under Review', 'Pending Review', 'Under Verification', 'Under Barangay Verification', 'Verified by Barangay'].includes(item.status);
    const isApproved = item.status === 'Approved';
    const isCompleted = ['Completed', 'Released'].includes(item.status);

    let currentStep = 1;
    if (isUnderReview) currentStep = 2;
    else if (isApproved) currentStep = 3;
    else if (isCompleted) currentStep = 4;

    const steps = [
      { num: 1, title: 'Isinumite', subtitle: formatAppDate(item.createdAt) },
      { num: 2, title: 'Sinusuri', subtitle: isUnderReview ? 'Kasalukuyan' : currentStep > 2 ? 'Natapos' : 'Pila' },
      { num: 3, title: isRejected ? 'Tinanggihan' : 'Na-aprubahan', subtitle: isRejected ? 'Rejected' : isApproved ? 'Approved' : currentStep > 3 ? 'Natapos' : 'Pila' },
      { num: 4, title: 'Naipamahagi', subtitle: isCompleted ? 'Natanggap' : 'Pila' },
    ];

    return (
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100/90 my-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-2">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Stage Tracker
          </span>
          <span className="font-semibold text-slate-700">
            {isRejected ? 'Katayuan: Tinanggihan' : `Hakbang ${currentStep} sa 4`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 sm:gap-2 relative">
          {steps.map((step, idx) => {
            const isStepDone = !isRejected && currentStep > step.num;
            const isStepActive = !isRejected && currentStep === step.num;
            const isStepRejected = isRejected && step.num === 3;

            let circleClass = 'bg-slate-100 text-slate-400 border-slate-200';
            let titleClass = 'text-slate-400';

            if (isStepDone) {
              circleClass = 'bg-emerald-600 text-white border-emerald-600';
              titleClass = 'text-emerald-800 font-bold';
            } else if (isStepActive) {
              circleClass = 'bg-blue-600 text-white border-blue-600 ring-2 sm:ring-4 ring-blue-100 animate-pulse';
              titleClass = 'text-blue-900 font-bold';
            } else if (isStepRejected) {
              circleClass = 'bg-rose-600 text-white border-rose-600 ring-2 sm:ring-4 ring-rose-100';
              titleClass = 'text-rose-900 font-bold';
            }

            return (
              <div key={idx} className="flex flex-col items-center text-center">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center text-[10px] sm:text-xs font-black transition-all ${circleClass}`}>
                  {isStepDone ? (
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                  ) : isStepRejected ? (
                    <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                  ) : (
                    step.num
                  )}
                </div>
                <span className={`text-[10px] sm:text-[11px] font-semibold mt-1 line-clamp-1 ${titleClass}`}>
                  {step.title}
                </span>
                <span className="text-[9px] text-slate-400 hidden sm:block">
                  {step.subtitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Unified Overview Statistics
  const totalReceived = totalDistributionsReceived + assistanceReceivedAmount;
  const totalPending = totalDistributionsPending + assistanceApprovedPendingRelease;
  const enrolledPrograms = beneficiary?.Enrollments || [];
  const totalProgramsCount = enrolledPrograms.length + allAssistanceItems.length;
  const totalDistributionsCount =
    releasedDistributions.length +
    approvedOrReleasedAssistance.filter((a) => a.status === 'Released').length +
    portalAssistanceRequests.filter((r) => r.status === 'Completed').length;

  // Unified benefits ledger (combines regular distributions + approved/released assistance grants)
  const unifiedHistory = [
    ...transactions.map((t) => ({
      id: `dist-${t.id}`,
      rawId: t.id,
      type: 'distribution',
      date: t.Event?.distribution_date || t.created_at,
      programName: t.Event?.Program?.name || (t.Event?.agency === 'MSWDO' ? 'MSWDO Program Benefit' : 'DSWD Program Benefit'),
      benefitType: t.Event?.benefit_type || 'Cash',
      itemName: t.item_name || t.Event?.item_name || null,
      itemQuantity: t.item_quantity || t.Event?.item_quantity || null,
      eventOrRef: t.Event?.title || 'Community Distribution',
      amount: parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0),
      status: t.status === 'released' ? 'Received' : 'Pending',
      rawStatus: t.status,
      disbursement_type: t.disbursement_type,
      payout_provider: t.payout_provider,
      payout_reference_number: t.payout_reference_number,
      beneficiary_acknowledged_at: t.beneficiary_acknowledged_at,
      eventDate: t.Event?.distribution_date,
      eventStatus: t.Event?.status,
    })),
    ...portalAssistanceRequests
      .filter((r) => ['Approved', 'Completed'].includes(r.status))
      .map((r) => ({
        id: `assist-req-${r.id}`,
        type: 'assistance',
        date: r.reviewed_at || r.created_at,
        programName: `${r.type} (${r.agency})`,
        eventOrRef: `#${r.id} - ${r.subject}`,
        amount: 0,
        status: r.status === 'Completed' ? 'Received' : 'Approved (Ready for Release)',
        rawStatus: r.status,
        grantType: `${r.agency} Assistance Grant`,
        appData: r,
      })),
    ...approvedOrReleasedAssistance.map((a) => ({
      id: `assist-${a.id}`,
      type: 'assistance',
      date: a.released_at || a.reviewed_at || a.created_at || a.createdAt,
      programName: a.category,
      eventOrRef: a.application_number,
      amount: parseFloat(a.approved_amount || a.total_amount_requested || 0),
      status: a.status === 'Released' ? 'Received' : 'Approved (Ready for Release)',
      rawStatus: a.status,
      grantType: a.assistance_type_granted || 'Cash Assistance / Voucher',
      appData: a,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Pagination for combined transactions
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedTransactions,
    goToPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination(unifiedHistory, 10);

  const getCategoryIcon = (category) => {
    const cat = String(category || '').toLowerCase();
    if (cat.includes('education')) return <GraduationCap className="w-5 h-5 text-amber-500" />;
    if (cat.includes('medicin') || cat.includes('gamot')) return <Pill className="w-5 h-5 text-emerald-500" />;
    if (cat.includes('hospital') || cat.includes('ospital')) return <Building2 className="w-5 h-5 text-blue-500" />;
    if (cat.includes('lab') || cat.includes('diagnostic')) return <FlaskConical className="w-5 h-5 text-teal-500" />;
    if (cat.includes('financ') || cat.includes('cash') || cat.includes('aics')) return <Wallet className="w-5 h-5 text-indigo-500" />;
    if (cat.includes('burial') || cat.includes('libing')) return <HeartHandshake className="w-5 h-5 text-purple-500" />;
    if (cat.includes('food') || cat.includes('relief') || cat.includes('pagkain')) return <Package className="w-5 h-5 text-orange-500" />;
    return <HandHeart className="w-5 h-5 text-blue-500" />;
  };

  const getCategoryBadgeClass = (category) => {
    const cat = String(category || '').toLowerCase();
    if (cat.includes('education')) return 'bg-amber-100 text-amber-900 border-amber-300';
    if (cat.includes('medicin') || cat.includes('gamot')) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    if (cat.includes('hospital') || cat.includes('ospital')) return 'bg-blue-100 text-blue-900 border-blue-300';
    if (cat.includes('lab') || cat.includes('diagnostic')) return 'bg-teal-100 text-teal-900 border-teal-300';
    if (cat.includes('financ') || cat.includes('cash') || cat.includes('aics')) return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    if (cat.includes('burial') || cat.includes('libing')) return 'bg-purple-100 text-purple-900 border-purple-300';
    if (cat.includes('food') || cat.includes('relief') || cat.includes('pagkain')) return 'bg-orange-100 text-orange-900 border-orange-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Under Review':
      case 'Pending Review':
      case 'Under Verification':
      case 'Under Barangay Verification':
      case 'Verified by Barangay':
        return {
          label: 'Under Review',
          tagalog: 'Kasalukuyang Sinusuri',
          icon: Eye,
          pill: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'Approved':
        return {
          label: 'Approved',
          tagalog: 'Na-aprubahan',
          icon: CheckCircle2,
          pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'Completed':
      case 'Released':
        return {
          label: 'Completed',
          tagalog: 'Naipamahagi / Natanggap',
          icon: ShieldCheck,
          pill: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      case 'Rejected':
        return {
          label: 'Rejected',
          tagalog: 'Tinanggihan',
          icon: XCircle,
          pill: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      default:
        return {
          label: 'Pending',
          tagalog: 'Nasa Pila (Pending)',
          icon: Clock,
          pill: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-8 h-8 text-yellow-300" />
              <h1 className="text-3xl font-black tracking-tight">My Benefits Overview</h1>
            </div>
            <p className="text-blue-100 text-sm mt-1 max-w-2xl leading-relaxed">
              View your released and approved assistance payouts, claimed benefit history, and active program enrollments.
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => navigate('/dashboard/request-assistance')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition border border-white/20 flex items-center gap-1.5 backdrop-blur-md shadow-sm"
            >
              <Plus className="w-4 h-4 text-yellow-300" />
              Request Assistance
            </button>
          </div>
        </div>
      </div>

      {/* ── Success Toast Alert ── */}
      {acknowledgeSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl font-semibold text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{acknowledgeSuccess}</span>
        </div>
      )}

      {/* ── Unacknowledged Digital Payout Alert Banner ── */}
      {unacknowledgedDigitalPayouts.length > 0 && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-yellow-300 shadow-inner">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                ⚡ May Pumasok na Digital Ayuda sa Iyong Account!
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-900 font-bold">
                  {unacknowledgedDigitalPayouts.length} Action Needed
                </span>
              </h3>
              <p className="text-purple-100 text-xs sm:text-sm mt-0.5">
                Paki-kumpirma kung natanggap mo na ang cash sa iyong e-wallet / bank account para sa opisyal na resibo ng DSWD.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {unacknowledgedDigitalPayouts.map((txn) => (
              <div key={txn.id} className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-yellow-400 text-slate-900">
                      {txn.payout_provider || 'GCash / Bank'}
                    </span>
                    <h4 className="text-xl font-black mt-1">
                      ₱{(parseFloat(txn.amount) + parseFloat(txn.retro_amount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </h4>
                    <p className="text-xs text-purple-200 mt-0.5">
                      {txn.Event?.title || 'Community Assistance Grant'}
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-black/20 px-2 py-1 rounded text-purple-100">
                    {txn.payout_reference_number || 'N/A'}
                  </span>
                </div>

                <button
                  onClick={() => handleAcknowledgeReceipt(txn.id)}
                  disabled={acknowledgingId === txn.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  {acknowledgingId === txn.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Kinukumpirma...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      ✓ I-confirm na Natanggap Ko Na
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Received */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5" />
            <p className="text-sm font-semibold">Total Received</p>
          </div>
          <p className="text-3xl font-black">
            ₱{totalReceived.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-green-100 mt-1">All time claimed & released</p>
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5" />
            <p className="text-sm font-semibold">Pending / Approved</p>
          </div>
          <p className="text-3xl font-black">
            ₱{totalPending.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-blue-100 mt-1">
            {pendingDistributions.length} dist. • {approvedOrReleasedAssistance.filter((a) => a.status === 'Approved').length} approved grant(s)
          </p>
        </div>

        {/* Programs */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5" />
            <p className="text-sm font-semibold">Programs & Grants</p>
          </div>
          <p className="text-3xl font-black">{totalProgramsCount}</p>
          <p className="text-xs text-purple-100 mt-1">
            {enrolledPrograms.length} regular • {approvedOrReleasedAssistance.length} special assistance
          </p>
        </div>

        {/* Distributions */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5" />
            <p className="text-sm font-semibold">Disbursements</p>
          </div>
          <p className="text-3xl font-black">{totalDistributionsCount}</p>
          <p className="text-xs text-amber-100 mt-1">Total claims received</p>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 1: ASSISTANCE REQUESTS & GRANTS MONITORING TRACKER                  */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        {/* Header with Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <HeartHandshake className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                Subaybayan ang Nirequest na Ayuda at Grants
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Direktang pagsubaybay sa katayuan ng iyong mga nirequest na tulong (Educational, Medical, Financial, Burial, Ospital) mula sa DSWD at MSWDO.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate('/dashboard/request-assistance')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Mag-apply ng Ayuda</span>
            </button>
          </div>
        </div>

        {/* Filter Pills Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setRequestFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
              requestFilterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Lahat ({countAll})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilterStatus('in_progress')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
              requestFilterStatus === 'in_progress'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            ⏳ Sinusuri / Pending ({countInProgress})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilterStatus('approved')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
              requestFilterStatus === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            ✅ Na-aprubahan ({countApproved})
          </button>
          <button
            type="button"
            onClick={() => setRequestFilterStatus('completed')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
              requestFilterStatus === 'completed'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
            }`}
          >
            🎉 Naipamahagi / Natapos ({countCompleted})
          </button>
        </div>

        {/* Request List or Empty State */}
        {allAssistanceItems.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <HandHeart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="font-bold text-slate-800 text-base">Wala pang Naisumiteng Kahilingan sa Ayuda</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Kailangan mo ba ng tulong sa matrikula, gamot, pampalibing, o krisis pampinansyal? Magsumite ng kahilingan sa tanggapan ng DSWD o MSWDO upang masuri at mabigyan ng ayuda.
            </p>
            <div className="mt-4">
              <button
                onClick={() => navigate('/dashboard/request-assistance')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
              >
                Magsumite ng Kahilingan sa Ayuda
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : filteredAssistanceItems.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
            <Filter className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-700">Walang kahilingan para sa napiling filter.</p>
            <button
              onClick={() => setRequestFilterStatus('all')}
              className="text-blue-600 font-semibold underline mt-2 inline-block cursor-pointer"
            >
              Ipakita ang Lahat ng Kahilingan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAssistanceItems.map((item) => {
              const statusCfg = getStatusConfig(item.status);
              const isMswdo = item.agency === 'MSWDO';
              const Icon = statusCfg.icon;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition-all p-5 space-y-3.5 relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Ref #, Agency, Category & Status Pill */}
                    <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md text-[11px] border border-slate-200">
                          {item.refNumber}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isMswdo
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {isMswdo ? '🏢 MSWDO (Municipal)' : '🏛️ DSWD (National)'}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                          {getCategoryIcon(item.category)}
                          <span className="truncate max-w-[150px]">{item.type}</span>
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 ${statusCfg.pill}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    {/* Subject & Description */}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">
                        {item.subject}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                        {item.description}
                      </p>
                    </div>

                    {/* Stage Progress Stepper */}
                    {renderProgressStepper(item)}

                    {/* Ready to Claim / Completed Banner */}
                    {['Approved', 'Completed', 'Released'].includes(item.status) && (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 flex items-center justify-between gap-2 shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎉</span>
                          <div>
                            <span className="font-bold text-emerald-900 text-xs block">
                              Handa nang I-claim / Naipamahagi
                            </span>
                            <span className="text-[11px] text-emerald-700 leading-relaxed block mt-0.5">
                              Pumunta sa tanggapan ng <strong>{item.agency}</strong> dala ang iyong <strong>Valid ID</strong> at <strong>RFID Card</strong>. Susuriin ng Admin ang iyong Valid ID at ita-tap ang iyong RFID upang ma-claim ang tulong.
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 px-2.5 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider">
                          Claimable
                        </span>
                      </div>
                    )}

                    {/* Approved Amount Tag if available */}
                    {item.approvedAmount > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                        <span className="text-emerald-800 font-bold">Inaprubahang Halaga:</span>
                        <span className="font-black text-emerald-700 text-sm">
                          ₱{item.approvedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Admin / Reviewer Remarks Banner */}
                    {item.adminNotes && (
                      <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-950 space-y-0.5">
                        <span className="font-bold text-amber-900 block text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Tugon mula sa Tanggapan:
                        </span>
                        <p className="leading-relaxed whitespace-pre-wrap text-amber-900/90 pl-4">
                          "{item.adminNotes}"
                        </p>
                      </div>
                    )}

                    {/* Attached Documents Chips */}
                    {item.attachmentUrl && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] font-medium text-slate-400">Mga Dokumento:</span>
                        {parseAttachments(item.attachmentUrl).map((att, attIdx) => (
                          <a
                            key={attIdx}
                            href={att.url?.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                            title={att.name}
                          >
                            <Paperclip className="w-3 h-3 text-slate-500" />
                            <span className="max-w-[130px] truncate">{att.name}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
                    <span>
                      Petsa: <strong className="text-slate-600">{formatAppDate(item.createdAt)}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.source === 'medical_application') {
                            setSelectedGrant(item.rawItem);
                          } else {
                            setSelectedRequestModal(item);
                          }
                        }}
                        className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Tingnan ang Detalye</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/request-assistance')}
                        className="text-slate-400 hover:text-slate-700 p-1 transition cursor-pointer"
                        title="Subaybayan sa Request Assistance"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 2: ENROLLED REGULAR PROGRAMS */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Enrolled Programs</h2>
          <span className="text-sm text-slate-600">{enrolledPrograms.length} program(s)</span>
        </div>

        {enrolledPrograms.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">You are not enrolled in any regular programs yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrolledPrograms.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div>
                  <h3 className="font-semibold text-slate-900">{enrollment.BenefitProgram?.name || 'N/A'}</h3>
                  <p className="text-sm text-slate-600">
                    Enrolled on{' '}
                    {new Date(enrollment.enrollment_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    enrollment.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {enrollment.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 3: UNIFIED BENEFITS HISTORY TABLE */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Benefits & Assistance History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete chronological record of all community distributions and approved assistance grants.
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition border border-blue-200 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Print / Export
          </button>
        </div>

        {unifiedHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No benefits or grants received yet</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category / Program</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Event / Ref #</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTransactions.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">
                            {new Date(item.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {item.type === 'assistance' ? (
                            getCategoryIcon(item.programName)
                          ) : (
                            <Package className="w-4 h-4 text-purple-600" />
                          )}
                          <span className="text-slate-900 font-medium">{item.programName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.type === 'assistance' ? (
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {item.eventOrRef}
                          </span>
                        ) : (
                          <span className="text-slate-600">{item.eventOrRef}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isNonCashProgram(item.programName, item.benefitType) || item.itemName ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 font-bold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full text-xs border border-purple-200">
                              {getNonCashDetails(item.programName)?.badge || '📦 In-Kind'}
                            </span>
                            <span className="text-[11px] text-slate-600 font-medium mt-0.5 max-w-[140px] truncate" title={item.itemName || getNonCashDetails(item.programName)?.default_item}>
                              {item.itemName || getNonCashDetails(item.programName)?.default_item || 'In-Kind Package'}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-green-600">
                            ₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.type === 'distribution' && (item.disbursement_type === 'digital' || item.payout_reference_number) && item.rawStatus === 'released' ? (
                          (item.beneficiary_acknowledged_at || acknowledgedIds.has(item.rawId)) ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ✓ Confirmed Received!
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5 font-mono font-medium">
                                Ref: {item.payout_reference_number}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleAcknowledgeReceipt(item.rawId)}
                                disabled={acknowledgingId === item.rawId}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                              >
                                {acknowledgingId === item.rawId ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Kinukumpirma...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                                    ✓ I-confirm na Natanggap Ko Na
                                  </>
                                )}
                              </button>
                              <span className="text-[10px] font-mono text-purple-700 font-semibold">
                                ⚡ Credited in {item.payout_provider || 'E-Wallet'}
                              </span>
                            </div>
                          )
                        ) : item.status === 'Received' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            Received
                          </span>
                        ) : item.status.includes('Approved') ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : item.eventDate && String(item.eventDate).split('T')[0] < new Date().toISOString().split('T')[0] ? (
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-extrabold border border-amber-300"
                            title="The distribution date for this event has passed without being claimed"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Unclaimed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalItems}
                itemsPerPage={10}
                startIndex={startIndex}
                endIndex={endIndex}
              />
            </div>
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* SECTION 4: YEAR SUMMARY */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-4">Year {new Date().getFullYear()} Assistance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
            <p className="text-xs text-slate-600 mb-1 font-semibold">Total Received This Year</p>
            <p className="text-2xl font-black text-slate-900">
              ₱
              {unifiedHistory
                .filter((t) => t.status === 'Received' && new Date(t.date).getFullYear() === new Date().getFullYear())
                .reduce((sum, t) => sum + t.amount, 0)
                .toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
            <p className="text-xs text-slate-600 mb-1 font-semibold">Active & Approved Grants</p>
            <p className="text-2xl font-black text-slate-900">
              {approvedOrReleasedAssistance.length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
            <p className="text-xs text-slate-600 mb-1 font-semibold">Average Per Grant / Payout</p>
            <p className="text-2xl font-black text-slate-900">
              ₱
              {totalDistributionsCount > 0
                ? (totalReceived / totalDistributionsCount).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : '0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MODAL: APPROVED ASSISTANCE DETAILS MODAL */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {selectedGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 text-white flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    {selectedGrant.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-yellow-300">
                    {selectedGrant.application_number}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white">Approved Grant Details</h3>
                <p className="text-xs text-blue-200">
                  Official verification and grant disbursement information
                </p>
              </div>
              <button
                onClick={() => setSelectedGrant(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600">
              {/* Approval Badge Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 block">Status</span>
                  <span className="font-black text-base text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {selectedGrant.status === 'Released' ? 'Grant Released' : 'Application Approved'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-emerald-800 block">Granted Amount</span>
                  <span className="font-black text-xl text-emerald-700">
                    ₱{parseFloat(selectedGrant.approved_amount || selectedGrant.total_amount_requested || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">Beneficiary / Patient</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedGrant.patient_name}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">Institution / Provider</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedGrant.hospital_or_clinic_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">Assistance Type Granted</span>
                  <span className="font-semibold text-slate-800">{selectedGrant.assistance_type_granted || 'Cash Grant Voucher'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block mb-0.5">Representative</span>
                  <span className="font-semibold text-slate-800">
                    {selectedGrant.representative_name || 'Self'} ({selectedGrant.applicant_relationship})
                  </span>
                </div>
                {selectedGrant.diagnosis && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-500 block mb-0.5">Details / Description</span>
                    <span className="text-slate-800 leading-relaxed">{selectedGrant.diagnosis}</span>
                  </div>
                )}
              </div>

              {/* Staff / Reviewer Remarks */}
              {selectedGrant.staff_remarks && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950">
                  <span className="font-bold text-blue-900 block mb-1">DSWD Staff / Reviewer Notes:</span>
                  <p className="text-xs text-blue-900/90 leading-relaxed italic">
                    "{selectedGrant.staff_remarks}"
                  </p>
                </div>
              )}

              {/* Barangay Endorsement */}
              {selectedGrant.barangay_endorsement_notes && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950">
                  <span className="font-bold text-purple-900 block mb-1">Barangay Staff Verification Notes:</span>
                  <p className="text-xs text-purple-900/90 leading-relaxed">
                    {selectedGrant.barangay_endorsement_notes}
                  </p>
                </div>
              )}

              {/* Uploaded Documents List */}
              <div className="space-y-2">
                <span className="font-bold text-slate-900 block">Verified Supporting Documents:</span>
                <div className="space-y-2">
                  {(selectedGrant.Documents || []).map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <div>
                          <span className="font-bold text-slate-800 block text-xs">{doc.document_name}</span>
                          <span className="text-[10px] text-slate-400">
                            {doc.file_name} • {(doc.file_size / 1024).toFixed(0)} KB
                          </span>
                        </div>
                      </div>
                      <a
                        href={`http://localhost:5000/${doc.file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-600" />
                        View File
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Official Republic of the Philippines • DSWD Crisis Intervention Unit
              </span>
              <button
                onClick={() => setSelectedGrant(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* MODAL: ASSISTANCE REQUEST DETAIL MODAL (TRACKER MODAL)                     */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {selectedRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] text-xs">
            {/* Modal Header */}
            <div className={`p-6 text-white flex items-start justify-between ${
              selectedRequestModal.agency === 'MSWDO'
                ? 'bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-950'
                : 'bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-yellow-300 bg-black/20 px-2 py-0.5 rounded">
                    {selectedRequestModal.refNumber}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                    {selectedRequestModal.agency === 'MSWDO' ? 'MSWDO (Municipal)' : 'DSWD (National)'}
                  </span>
                  <span className="text-emerald-200 font-semibold text-xs">
                    {selectedRequestModal.type}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {selectedRequestModal.subject}
                </h3>
                <p className="text-xs text-white/80">
                  Subaybayan ang katayuan at tugon mula sa tanggapan ng {selectedRequestModal.agency}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequestModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700">
              {/* Status & Stepper Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Kasalukuyang Katayuan:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusConfig(selectedRequestModal.status).pill}`}>
                      {getStatusConfig(selectedRequestModal.status).label}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Naisumite noong {formatAppDate(selectedRequestModal.createdAt)}
                  </span>
                </div>

                {renderProgressStepper(selectedRequestModal)}
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Tanggapan (Agency)</span>
                  <span className="font-bold text-slate-900">
                    {selectedRequestModal.agency === 'MSWDO' ? 'MSWDO (Municipal)' : 'DSWD (National)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Uri ng Tulong</span>
                  <span className="font-bold text-slate-900 truncate block">
                    {selectedRequestModal.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Priyoridad</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRequestModal.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Petsa ng Pagsusuri</span>
                  <span className="font-semibold text-slate-800">
                    {selectedRequestModal.reviewedAt ? formatAppDate(selectedRequestModal.reviewedAt) : 'Pending Review'}
                  </span>
                </div>
              </div>

              {/* Buong Salaysay / Full Description */}
              <div>
                <span className="font-bold text-slate-800 block text-xs mb-1">
                  Buong Salaysay ng Pangangailangan (Description):
                </span>
                <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 whitespace-pre-wrap leading-relaxed text-slate-800 text-xs">
                  {selectedRequestModal.description}
                </p>
              </div>

              {/* Tugon mula sa Tanggapan / Admin Notes */}
              {selectedRequestModal.adminNotes && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Opisyal na Tugon / Paalala mula sa Tanggapan:</span>
                  </div>
                  <p className="text-xs text-amber-900/90 leading-relaxed whitespace-pre-wrap pl-5">
                    "{selectedRequestModal.adminNotes}"
                  </p>
                </div>
              )}

              {/* Mga Kalakip na Dokumento (Attachments) */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 block text-xs">
                  Mga Kalakip na Dokumento (Attached Requirements):
                </span>
                {parseAttachments(selectedRequestModal.attachmentUrl).length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 rounded-xl bg-slate-50 border border-slate-200">
                    Walang online kalakip na na-upload. Maaaring dalhin ang pisikal na kopya ng mga dokumento sa tanggapan kapag ipinatawag.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {parseAttachments(selectedRequestModal.attachmentUrl).map((att, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-blue-600" />
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">{att.name}</span>
                            {att.requirementName && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                Para sa: {att.requirementName}
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={att.url?.startsWith('http') ? att.url : `http://localhost:5000${att.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition"
                        >
                          <ExternalLink className="w-3 h-3 text-blue-600" />
                          Buksan ang File
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                EBMS • Social Welfare Assistance Monitoring
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequestModal(null);
                    navigate('/dashboard/request-assistance');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition cursor-pointer"
                >
                  Pumunta sa Request Assistance →
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRequestModal(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
                >
                  Isara
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

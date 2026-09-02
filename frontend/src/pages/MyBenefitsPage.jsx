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
  GraduationCap,
  Pill,
  Stethoscope,
  Wallet,
  HeartHandshake,
  HandHeart,
  FileText,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Eye,
  CheckCircle2,
  X,
  Building2,
  User,
  Sparkles,
  Plus
} from 'lucide-react';
import { beneficiaryApi, medicalAssistanceApi } from '../services/api';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';

export default function MyBenefitsPage() {
  const navigate = useNavigate();
  const [beneficiary, setBeneficiary] = useState(null);
  const [assistanceApplications, setAssistanceApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrant, setSelectedGrant] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    loadBeneficiaryData();
  }, []);

  const loadBeneficiaryData = async () => {
    try {
      const [benRes, assistRes] = await Promise.all([
        beneficiaryApi.getMe(),
        medicalAssistanceApi.getMyApplications().catch(() => ({ data: { data: [] } })),
      ]);
      setBeneficiary(benRes.data.data);
      setAssistanceApplications(assistRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load beneficiary or assistance data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Base distribution transactions
  const transactions = beneficiary?.DistributionTransactions || [];
  const releasedDistributions = transactions.filter((t) => t.status === 'released');
  const pendingDistributions = transactions.filter((t) => t.status === 'pending');

  const totalDistributionsReceived = releasedDistributions.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0),
    0
  );
  const totalDistributionsPending = pendingDistributions.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0),
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

  // Unified Overview Statistics
  const totalReceived = totalDistributionsReceived + assistanceReceivedAmount;
  const totalPending = totalDistributionsPending + assistanceApprovedPendingRelease;
  const enrolledPrograms = beneficiary?.Enrollments || [];
  const totalProgramsCount = enrolledPrograms.length + approvedOrReleasedAssistance.length;
  const totalDistributionsCount =
    releasedDistributions.length +
    approvedOrReleasedAssistance.filter((a) => a.status === 'Released').length;

  // Unified benefits ledger (combines regular distributions + approved/released assistance grants)
  const unifiedHistory = [
    ...transactions.map((t) => ({
      id: `dist-${t.id}`,
      type: 'distribution',
      date: t.Event?.distribution_date || t.created_at,
      programName: t.Event?.Program?.name || 'DSWD Program Benefit',
      eventOrRef: t.Event?.title || 'Community Distribution',
      amount: parseFloat(t.amount || 0),
      status: t.status === 'released' ? 'Received' : 'Pending',
      rawStatus: t.status,
      eventDate: t.Event?.distribution_date,
      eventStatus: t.Event?.status,
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
    switch (category) {
      case 'Educational Assistance':
        return <GraduationCap className="w-5 h-5 text-amber-500" />;
      case 'Medicines Assistance':
        return <Pill className="w-5 h-5 text-emerald-500" />;
      case 'Hospital Bill Assistance':
      case 'Hospital Assistance':
        return <Stethoscope className="w-5 h-5 text-blue-500" />;
      case 'Financial Assistance':
        return <Wallet className="w-5 h-5 text-indigo-500" />;
      case 'Burial Assistance':
        return <HeartHandshake className="w-5 h-5 text-purple-500" />;
      default:
        return <HandHeart className="w-5 h-5 text-blue-500" />;
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'Educational Assistance':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Medicines Assistance':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Hospital Bill Assistance':
      case 'Hospital Assistance':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Financial Assistance':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'Burial Assistance':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
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
      {/* SECTION 1: APPROVED ASSISTANCE GRANTS & PAYOUTS (NEW DIRECT LANDING VIEW) */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">Approved Assistance Grants</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Direct overview of your approved and released assistance requests (Educational, Medical, Financial, Burial, Hospital Bill).
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            {approvedOrReleasedAssistance.length} Approved / Active
          </span>
        </div>

        {approvedOrReleasedAssistance.length === 0 ? (
          <div className="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <HandHeart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="font-bold text-slate-800 text-base">No Approved Assistance Grants Yet</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              Once your assistance request is verified by Barangay Staff and approved by the Administrator, your approved grant details and release schedule will automatically appear here.
            </p>
            {pendingVerificationAssistance.length > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
                <Clock className="w-4 h-4 text-amber-600" />
                You have {pendingVerificationAssistance.length} application(s) currently under verification.
              </div>
            )}
            <div className="mt-4">
              <button
                onClick={() => navigate('/dashboard/request-assistance')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition"
              >
                Track Applications in Request Assistance
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedOrReleasedAssistance.map((app) => {
              const isReleased = app.status === 'Released';
              const approvedAmt = parseFloat(app.approved_amount || app.total_amount_requested || 0);

              return (
                <div
                  key={app.id}
                  className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm hover:shadow-md transition space-y-3.5 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        {getCategoryIcon(app.category)}
                      </div>
                      <div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getCategoryBadgeClass(app.category)}`}>
                          {app.category}
                        </span>
                        <h4 className="font-mono text-xs font-bold text-slate-500 mt-1">
                          Ref: {app.application_number}
                        </h4>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${
                        isReleased
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isReleased ? 'Released' : 'Approved'}
                    </span>
                  </div>

                  {/* Beneficiary & Amount Breakdown */}
                  <div className="bg-white/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Beneficiary / Student:</span>
                      <span className="font-bold text-slate-900">{app.patient_name}</span>
                    </div>
                    {app.hospital_or_clinic_name && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Institution / Provider:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                          {app.hospital_or_clinic_name}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-emerald-800 font-bold">Approved Grant Amount:</span>
                      <span className="font-black text-emerald-600 text-base">
                        ₱{approvedAmt.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Grant Release Details */}
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>
                      Type: <strong className="text-slate-700">{app.assistance_type_granted || 'Cash Grant Voucher'}</strong>
                    </span>
                    <span>
                      {isReleased ? 'Released on: ' : 'Approved on: '}
                      <strong>
                        {new Date(app.released_at || app.reviewed_at || app.updatedAt || app.createdAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedGrant(app)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Grant Details & Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard/request-assistance')}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition"
                    >
                      <span>Application Timeline</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
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
                        <span className="font-bold text-green-600">
                          ₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'Received' ? (
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
    </div>
  );
}

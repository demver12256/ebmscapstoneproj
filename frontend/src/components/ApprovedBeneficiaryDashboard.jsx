import { Calendar, MapPin, Copy, Bell, FileText, CheckCircle2, Clock, Users, AlertTriangle, Megaphone, Check, X, Award, Gift, Zap, RefreshCw, CreditCard, Edit3, ShieldCheck, XCircle, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { announcementApi, notificationApi, distributionApi, beneficiaryApi } from '../services/api';
import { Link } from 'react-router-dom';
import { isNonCashProgram, getNonCashDetails } from '../utils/nonCashPrograms';

const PesoIcon = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 3h6a5 5 0 0 1 0 10H6V3z" />
    <path d="M6 13v8" />
    <path d="M4 7.5h11" />
    <path d="M4 11.5h11" />
  </svg>
);

// Helper to check if an announcement is incoming / upcoming
const isAnnouncementUpcoming = (ann) => {
  if (!ann) return false;
  if (ann.status !== 'published') return false;

  const now = new Date();
  if (ann.event_date) {
    const timeToCheck = ann.end_time || ann.event_time || '23:59';
    let hours = 23;
    let minutes = 59;
    if (timeToCheck) {
      const match = String(timeToCheck).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3] ? match[3].toUpperCase() : null;
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hours = h;
        minutes = m;
      }
    }
    const [y, m, d] = String(ann.event_date).split('-').map(Number);
    if (y && m && d) {
      const eventEndTime = new Date(y, m - 1, d, hours, minutes, 59);
      if (now > eventEndTime) return false;
    }
  }

  if (ann.expiration_date) {
    const [y, m, d] = String(ann.expiration_date).split('-').map(Number);
    if (y && m && d) {
      const expirationTime = new Date(y, m - 1, d, 23, 59, 59);
      if (now > expirationTime) return false;
    }
  }

  return true;
};

export default function ApprovedBeneficiaryDashboard({ beneficiary }) {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [modalItems, setModalItems] = useState([]);
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);

  // Digital payout account registration/update state
  const [currentBeneficiary, setCurrentBeneficiary] = useState(beneficiary);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    payout_preference: beneficiary?.payout_preference || 'digital',
    payout_provider: beneficiary?.payout_provider || 'GCash',
    payout_account_number: beneficiary?.payout_account_number || '',
    payout_account_name: beneficiary?.payout_account_name || `${beneficiary?.first_name || ''} ${beneficiary?.last_name || ''}`.trim(),
  });
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutError, setPayoutError] = useState(null);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(null);

  useEffect(() => {
    if (beneficiary) {
      setCurrentBeneficiary(beneficiary);
      setPayoutForm({
        payout_preference: beneficiary.payout_preference || 'digital',
        payout_provider: beneficiary.payout_provider || 'GCash',
        payout_account_number: beneficiary.payout_account_number || '',
        payout_account_name: beneficiary.payout_account_name || `${beneficiary.first_name || ''} ${beneficiary.last_name || ''}`.trim(),
      });
    }
  }, [beneficiary]);

  const handleSavePayoutAccount = async (e) => {
    e.preventDefault();
    setPayoutSaving(true);
    setPayoutError(null);
    try {
      const res = await beneficiaryApi.updateMyPayoutAccount(payoutForm);
      if (res.data?.success) {
        setCurrentBeneficiary(res.data.data);
        setPayoutSuccessMsg(res.data.message || 'Matagumpay na naisumite ang iyong payout account!');
        setShowPayoutModal(false);
        setTimeout(() => setPayoutSuccessMsg(null), 7000);
      }
    } catch (err) {
      setPayoutError(err.response?.data?.message || err.message || 'Hindi ma-save ang payout account.');
    } finally {
      setPayoutSaving(false);
    }
  };

  // Extra/Secondary Payout Accounts state
  const [showAddExtraModal, setShowAddExtraModal] = useState(false);
  const [extraPayoutForm, setExtraPayoutForm] = useState({
    provider: 'Landbank',
    account_number: '',
    account_name: beneficiary?.payout_account_name || `${beneficiary?.first_name || ''} ${beneficiary?.last_name || ''}`.trim(),
  });
  const [extraSaving, setExtraSaving] = useState(false);
  const [extraError, setExtraError] = useState(null);
  const [deletingExtraIdx, setDeletingExtraIdx] = useState(null);

  const handleAddExtraPayoutAccount = async (e) => {
    e.preventDefault();
    setExtraSaving(true);
    setExtraError(null);
    try {
      const res = await beneficiaryApi.addExtraPayoutAccount(extraPayoutForm);
      if (res.data?.success) {
        setCurrentBeneficiary(res.data.data);
        setPayoutSuccessMsg(res.data.message || 'Naidagdag ang bagong payout account!');
        setShowAddExtraModal(false);
        setExtraPayoutForm({
          provider: 'Landbank',
          account_number: '',
          account_name: `${currentBeneficiary?.first_name || ''} ${currentBeneficiary?.last_name || ''}`.trim(),
        });
        setTimeout(() => setPayoutSuccessMsg(null), 7000);
      }
    } catch (err) {
      setExtraError(err.response?.data?.message || err.message || 'Hindi ma-add ang secondary payout account.');
    } finally {
      setExtraSaving(false);
    }
  };

  const handleRemoveExtraPayoutAccount = async (index) => {
    if (!window.confirm('Sigurado ka ba na nais mong tanggalin ang secondary payout account na ito?')) {
      return;
    }
    setDeletingExtraIdx(index);
    try {
      const res = await beneficiaryApi.removeExtraPayoutAccount(index);
      if (res.data?.success) {
        setCurrentBeneficiary(res.data.data);
        setPayoutSuccessMsg('Natanggal ang secondary payout account.');
        setTimeout(() => setPayoutSuccessMsg(null), 5000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Hindi ma-delete ang account.');
    } finally {
      setDeletingExtraIdx(null);
    }
  };


  // Digital payout acknowledgment
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [acknowledgeSuccess, setAcknowledgeSuccess] = useState(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  const transactions = currentBeneficiary?.DistributionTransactions || beneficiary?.DistributionTransactions || [];
  const unacknowledgedDigitalPayouts = transactions.filter(
    (t) => t.status === 'released' &&
    (t.disbursement_type === 'digital' || t.payout_reference_number) &&
    !t.beneficiary_acknowledged_at &&
    !acknowledgedIds.has(t.id)
  );
  const allDigitalPayouts = transactions.filter(
    (t) => t.disbursement_type === 'digital' || t.payout_reference_number
  );

  const handleAcknowledgeReceipt = async (transactionId) => {
    if (!window.confirm('Sigurado ka ba na natanggap mo na ang digital payout sa iyong account?\n\nAng pagkumpirma na ito ay magsisilbing opisyal na digital resibo at makikita ng DSWD Admin.')) {
      return;
    }

    setAcknowledgingId(transactionId);
    try {
      const res = await distributionApi.acknowledgePayout(transactionId);
      if (res.data?.success) {
        setAcknowledgeSuccess('✅ Maraming salamat! Matagumpay mong nakumpirma ang pagtanggap ng iyong digital payout.');
        setAcknowledgedIds(prev => new Set(prev).add(transactionId));
        setTimeout(() => setAcknowledgeSuccess(null), 6000);
      }
    } catch (err) {
      alert(`Error sa pagkumpirma: ${err.response?.data?.message || err.message}`);
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Track IDs already dismissed/shown so we don't re-popup them on each poll
  const [shownIds, setShownIds] = useState(new Set());

  useEffect(() => {
    const loadPopups = async () => {
      try {
        const [annRes, notifRes] = await Promise.all([
          announcementApi.list(),
          notificationApi.list()
        ]);
        const annList = annRes.data?.data || [];
        const notifList = notifRes.data?.data || [];

        setAnnouncements(annList);

        const unreadAnn = annList
          .filter(a => !a.is_read && isAnnouncementUpcoming(a))
          .map(a => ({ ...a, popupType: 'announcement' }));

        // Exclude regular announcement notifications — they are already shown via unreadAnn above.
        // BUT keep announcement_absence notifications so absence notices always pop up!
        const unclaimedReferenceIds = new Set(
          notifList
            .filter(n => n.title?.toLowerCase().includes('unclaimed'))
            .map(n => n.reference_id)
            .filter(Boolean)
        );

        const unreadNotif = notifList
          .filter(n => {
            if (n.is_read) return false;
            // Exclude regular upcoming announcement notices if already processed via unreadAnn
            if ((n.type === 'announcement' || n.reference_type === 'announcement') && n.reference_type !== 'announcement_absence') {
              return false;
            }

            const isUpcoming = n.title?.toLowerCase().includes('upcoming') || n.message?.toLowerCase().includes('you are scheduled');
            if (isUpcoming && n.reference_id && unclaimedReferenceIds.has(n.reference_id)) {
              // Silently mark old upcoming notification as read on backend
              notificationApi.markAsRead(n.id).catch(() => {});
              return false;
            }
            return true;
          })
          .map(n => ({ ...n, popupType: 'notification' }));

        const combined = [...unreadAnn, ...unreadNotif];

        // Only show items that haven't been dismissed in this session
        const newItems = combined.filter(item => {
          const key = `${item.popupType}-${item.id}`;
          return !shownIds.has(key);
        });

        if (newItems.length > 0) {
          setModalItems(newItems);
          setCurrentPopupIndex(0);
          setShowPopupModal(true);
        }
      } catch (err) {
        console.error('Failed to load beneficiary dashboard popups:', err);
      }
    };

    // Run immediately on mount
    loadPopups();

    // Poll every 10 seconds to catch new enrollment/distribution/payout notifications
    const pollInterval = setInterval(loadPopups, 10000);

    // Also re-check when another part of the app marks notifications updated
    const handleNotifUpdate = () => loadPopups();
    window.addEventListener('notificationsUpdated', handleNotifUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('notificationsUpdated', handleNotifUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkAsRead = async (item) => {
    try {
      const itemObj = typeof item === 'object' && item !== null ? item : { id: item, popupType: 'announcement' };
      const key = `${itemObj.popupType}-${itemObj.id}`;
      // Add to shownIds so polling won't re-show this item
      setShownIds(prev => new Set([...prev, key]));

      if (itemObj.popupType === 'announcement') {
        await announcementApi.markAsRead(itemObj.id);
        setAnnouncements(prev => prev.map(a => a.id === itemObj.id ? { ...a, is_read: true } : a));
      } else {
        await notificationApi.markAsRead(itemObj.id);
      }
      setModalItems(prev => prev.filter(i => !(i.id === itemObj.id && i.popupType === itemObj.popupType)));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const upcomingAnnouncements = announcements.filter(isAnnouncementUpcoming);
  const unreadUpcomingAnnouncements = upcomingAnnouncements.filter((a) => !a.is_read);

  const handleCopy = () => {
    const textToCopy = beneficiary?.household_id_number || beneficiary?.beneficiary_id_code || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getTodayStr();

  // Get next upcoming distribution (only future/today dates that are not completed)
  const upcomingDistribution = beneficiary?.DistributionTransactions
    ?.filter(txn => {
      if (txn.status !== 'pending') return false;
      const eventDate = txn.Event?.distribution_date ? String(txn.Event.distribution_date).split('T')[0] : '';
      if (!eventDate) return false;
      return eventDate >= todayStr && txn.Event?.status !== 'completed' && txn.Event?.status !== 'archived';
    })
    ?.sort((a, b) => new Date(a.Event?.distribution_date) - new Date(b.Event?.distribution_date))?.[0];

  // Get unclaimed past distributions
  const unclaimedDistributions = beneficiary?.DistributionTransactions
    ?.filter(txn => {
      if (txn.status !== 'pending') return false;
      const eventDate = txn.Event?.distribution_date ? String(txn.Event.distribution_date).split('T')[0] : '';
      return (eventDate && eventDate < todayStr) || txn.Event?.status === 'completed';
    }) || [];

  const getDaysRemainingText = (distDate) => {
    if (!distDate) return 'No upcoming schedule';
    const target = new Date(distDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) return `In ${diffDays} days`;
    return 'Passed';
  };

  // Calculate total benefits
  const totalBenefits = beneficiary?.DistributionTransactions
    ?.filter(txn => txn.status === 'released')
    ?.reduce((sum, txn) => sum + parseFloat(txn.amount), 0) || 0;

  const distributionsCount = beneficiary?.DistributionTransactions
    ?.filter(txn => txn.status === 'released')?.length || 0;

  const enrolledPrograms = beneficiary?.Enrollments?.filter(e => e.status === 'active').map(e => e.BenefitProgram) || [];

  const unreadAnnouncements = announcements.filter(a => !a.is_read);

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-2 sm:px-4 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#00338D] via-[#002D87] to-[#0A192F] text-white rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-900/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#FFD100]">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Beneficiary Portal</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl mt-1">
            Welcome back, <span className="font-bold text-white">{beneficiary?.first_name} {beneficiary?.last_name}</span>! Here is your official application, RFID card, and assistance payout overview.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 text-xs text-blue-100 font-semibold self-start md:self-auto shadow-2xs">
          <div>📅 {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div className="text-[#FFD100] font-mono font-bold mt-0.5">⏱️ {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* Banner - Show different message based on status */}
      {user?.status === 'inactive' ? (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-300 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-orange-900">⚠️ Unauthorized access - user inactive</p>
            {(beneficiary?.inactivation_reason || user?.inactive_reason) && (
              <p className="text-sm text-orange-700 mt-1">
                Reason: {beneficiary?.inactivation_reason || user?.inactive_reason}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-green-900">Congratulations! Your application has been APPROVED.</p>
            <p className="text-sm text-green-700">You are now an official beneficiary. You can now view your benefits and upcoming distributions.</p>
          </div>
        </div>
      )}

      {/* ── Success Toast Alert ── */}
      {acknowledgeSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl font-semibold text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{acknowledgeSuccess}</span>
        </div>
      )}

      {/* ── Digital Ayuda Payout Alert Banner ── */}
      {unacknowledgedDigitalPayouts.length > 0 && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-yellow-300 shadow-inner">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div className="flex-1">
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
                      ₱{(parseFloat(txn.amount || 0) + parseFloat(txn.retro_amount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
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

      {/* TARGETED ANNOUNCEMENTS BANNER / WIDGET - ONLY UPCOMING / INCOMING ANNOUNCEMENTS */}
      {upcomingAnnouncements.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Megaphone className="w-6 h-6 text-yellow-400" />
                {unreadUpcomingAnnouncements.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Official Municipal Announcements</h2>
                <p className="text-xs text-blue-200">Mga Paparating na Gawain at Oryentasyon</p>
              </div>
            </div>
            <Link
              to="/dashboard/notifications"
              className="text-xs font-bold text-yellow-300 hover:text-yellow-200 underline flex items-center gap-1"
            >
              View All / Nakaraang Anunsyo ({announcements.length})
            </Link>
          </div>

          <div className="space-y-3">
            {upcomingAnnouncements.slice(0, 2).map((ann) => (
              <div
                key={ann.id}
                className={`bg-white/10 backdrop-blur-md border rounded-xl p-4 transition ${
                  !ann.is_read ? 'border-yellow-400/80 bg-white/15' : 'border-white/10 opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {!ann.is_read && (
                        <span className="bg-yellow-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full">
                          NEW UNREAD
                        </span>
                      )}
                      <span className="text-xs text-yellow-200 font-bold">{ann.priority} Priority</span>
                      <span className="text-xs text-blue-200">• Published by {ann.CreatedBy?.first_name || 'Admin'}</span>
                    </div>
                    <h3 className="font-extrabold text-white text-base leading-snug">{ann.title}</h3>
                    <p className="text-xs text-blue-100 line-clamp-2">{ann.message}</p>
                    {(ann.event_date || ann.venue) && (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-amber-200 font-semibold pt-1">
                        {ann.event_date && <span>📅 Date: {ann.event_date} {ann.event_time && `at ${ann.event_time}`}</span>}
                        {ann.venue && <span>📍 Venue: {ann.venue}</span>}
                      </div>
                    )}
                  </div>

                  {!ann.is_read && (
                    <button
                      onClick={() => handleMarkAsRead({ ...ann, popupType: 'announcement' })}
                      className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-extrabold text-xs px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className={`text-white rounded-xl p-5 shadow-lg ${
          user?.status === 'inactive' 
            ? 'bg-gradient-to-br from-red-500 to-red-700' 
            : 'bg-gradient-to-br from-dswd-blue to-blue-700'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {user?.status === 'inactive' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <p className="text-sm font-semibold">My Status</p>
          </div>
          <h3 className="text-2xl font-black mb-1">
            {user?.status === 'inactive' ? 'INACTIVE' : 'APPROVED'}
          </h3>
          <p className="text-xs opacity-90">
            {user?.status === 'inactive' 
              ? 'Account temporarily deactivated' 
              : 'You are an official beneficiary.'}
          </p>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span>Approved on</span>
            <span className="font-bold">{beneficiary?.approval_date || 'N/A'}</span>
          </div>
        </div>

        {/* Beneficiary ID Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative">
          <div className="absolute top-3 right-3 bg-dswd-lightBlue text-white px-2 py-0.5 rounded text-[10px] font-bold">
            OFFICIAL MEMBER
          </div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-dswd-lightBlue" />
            <p className="text-sm font-semibold text-slate-700">
              {beneficiary?.category?.toLowerCase().includes('4ps') ? '4Ps Household Number' : 'Beneficiary ID'}
            </p>
          </div>
          <h3 className="text-xl font-black text-slate-900 font-mono">
            {beneficiary?.household_id_number || beneficiary?.beneficiary_id_code || '—'}
          </h3>
          <button
            onClick={handleCopy}
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-dswd-lightBlue hover:text-dswd-blue transition"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Enrolled Program Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-amber-600" />
            <p className="text-sm font-semibold text-amber-900">Enrolled Program</p>
          </div>
          {enrolledPrograms && enrolledPrograms.length > 0 ? (
            <div className="space-y-2">
              {enrolledPrograms.slice(0, 2).map((program, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-amber-200">
                  <h4 className="text-sm font-bold text-amber-900 leading-tight line-clamp-2">{program.name}</h4>
                  <p className="text-xs text-amber-700 mt-1">{program.eligibility_category || program.category}</p>
                </div>
              ))}
              {enrolledPrograms.length > 2 && (
                <p className="text-xs text-amber-700 font-semibold mt-2">
                  +{enrolledPrograms.length - 2} more program(s)
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-700">No program enrollment yet</p>
          )}
        </div>

        {/* Barangay Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-slate-600" />
            <p className="text-sm font-semibold text-slate-700">Barangay</p>
          </div>
          <h4 className="text-lg font-bold text-slate-900">{beneficiary?.Barangay?.barangay_name || 'N/A'}</h4>
          <p className="text-xs text-slate-600 mt-1">
            {beneficiary?.sitio ? `${beneficiary.sitio},` : ''} {beneficiary?.Barangay?.barangay_name}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Digital Payout Account Settings Card */}
          <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50/40 rounded-2xl border border-purple-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200 shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">Digital Ayuda Account</h3>
                    {currentBeneficiary?.payout_preference === 'digital' ? (
                      currentBeneficiary?.account_verification_status === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : currentBeneficiary?.account_verification_status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          <X className="w-3.5 h-3.5" /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                          <Clock className="w-3.5 h-3.5" /> For Verification
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        🏢 Cash OTC / RFID
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tumatanggap ng ayuda sa pamamagitan ng GCash, Maya, o Bank Account nang walang pila.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setPayoutError(null);
                  setShowPayoutModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition hover:shadow-md cursor-pointer shrink-0"
              >
                <Edit3 className="w-4 h-4" />
                {currentBeneficiary?.payout_preference === 'digital' && currentBeneficiary?.payout_account_number
                  ? 'I-update ang Account'
                  : 'I-setup ang E-Wallet / Bank'}
              </button>
            </div>

            {/* Account Details Box */}
            {currentBeneficiary?.payout_preference === 'digital' && currentBeneficiary?.payout_account_number ? (
              <div className="bg-white rounded-xl border border-purple-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Provider</span>
                  <span className="font-bold text-purple-900 text-sm flex items-center gap-1.5 mt-0.5">
                    {['Landbank', 'Other'].includes(currentBeneficiary.payout_provider)
                      ? <span className="text-base">🏦</span>
                      : <Zap className="w-3.5 h-3.5 text-purple-600 fill-current" />}
                    {currentBeneficiary.payout_provider || 'GCash'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Account Number</span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                    {currentBeneficiary.payout_account_number}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Account Name</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                    {currentBeneficiary.payout_account_name || '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white/80 rounded-xl border border-dashed border-purple-200 p-4 text-center text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Wala ka pang naka-link na digital account.</p>
                <p className="text-slate-500 mt-0.5">
                  Maaari mong ilagay ang iyong GCash, Maya, o Landbank account number upang maging kwalipikado sa mabilisang digital disbursement.
                </p>
              </div>
            )}

            {/* Verification Status Notice Alert */}
            {currentBeneficiary?.payout_preference === 'digital' && (
              currentBeneficiary?.account_verification_status === 'verified' ? (
                <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-center gap-2.5 text-xs text-green-800">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>
                    <strong>Beripikado na ang iyong primary account!</strong> Handa ka nang makatanggap ng digital grants at ayuda direkta sa iyong account.
                  </span>
                </div>
              ) : currentBeneficiary?.account_verification_status === 'rejected' ? (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-2.5 text-xs text-red-800">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    <strong>Hindi na-verify ang iyong account.</strong> Posibleng hindi nagtutugma ang pangalan sa iyong account laban sa iyong DSWD record. Pindutin ang "I-update ang Account" upang itama.
                  </span>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-2.5 text-xs text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Nakahain para sa Beripikasyon ng Admin.</strong> Tinitingnan ng DSWD/MSWDO admin ang iyong impormasyon para sa beripikasyon bago magpadala ng pondo.
                  </span>
                </div>
              )
            )}

            {/* Secondary / Extra Payout Accounts Section */}
            <div className="pt-3 border-t border-purple-100">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Secondary Payout Accounts (Landbank / Karagdagang E-Wallet)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Maaari kang mag-rehistro ng iba pang account o Landbank ATM/Account bilang alternatibo kapag may problema sa primary wallet.
                  </p>
                </div>
                {(!currentBeneficiary?.extra_payout_accounts || currentBeneficiary?.extra_payout_accounts?.length < 3) && (
                  <button
                    type="button"
                    onClick={() => {
                      setExtraError(null);
                      setExtraPayoutForm({
                        provider: 'Landbank',
                        account_number: '',
                        account_name: `${currentBeneficiary?.first_name || ''} ${currentBeneficiary?.last_name || ''}`.trim(),
                      });
                      setShowAddExtraModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Mag-add ng Account
                  </button>
                )}
              </div>

              {Array.isArray(currentBeneficiary?.extra_payout_accounts) && currentBeneficiary.extra_payout_accounts.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {currentBeneficiary.extra_payout_accounts.map((extra, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {extra.provider === 'Landbank' ? '🏦' : '⚡'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{extra.provider}</span>
                            <span className="font-mono text-slate-700 font-semibold">{extra.account_number}</span>
                            {extra.verification_status === 'verified' ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle2 className="w-3 h-3" /> Verified
                              </span>
                            ) : extra.verification_status === 'rejected' ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                <X className="w-3 h-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" /> For Verification
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            Pangalan: <span className="font-medium text-slate-700">{extra.account_name}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveExtraPayoutAccount(idx)}
                        disabled={deletingExtraIdx === idx}
                        title="Tanggalin ang account na ito"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {deletingExtraIdx === idx ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic bg-white/50 p-2.5 rounded-lg border border-dashed border-slate-200 text-center">
                  Walang karagdagang secondary account. Maaari kang mag-add ng Landbank o ibang e-wallet (hanggang 3 accounts).
                </div>
              )}
            </div>
          </div>

          {/* Digital Ayuda & E-Wallet Payouts Card */}
          {allDigitalPayouts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Digital Ayuda & E-Wallet Disbursed</h3>
                    <p className="text-xs text-slate-500">Mabilis at ligtas na ayuda diretso sa iyong rehistradong e-wallet o bangko.</p>
                  </div>
                </div>
                <Link
                  to="/dashboard/my-benefits"
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 underline flex items-center gap-1"
                >
                  View Full History
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Provider / Channel</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Reference #</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Event / Title</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase">Receipt Confirmation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allDigitalPayouts.map((txn) => {
                      const isConfirmed = txn.beneficiary_acknowledged_at || acknowledgedIds.has(txn.id);
                      return (
                        <tr key={txn.id} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-3 font-semibold text-slate-900">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
                              ⚡ {txn.payout_provider || 'GCash / Bank'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">
                            {txn.payout_reference_number || 'Pending Reference'}
                          </td>
                          <td className="px-3 py-3 text-slate-800">
                            {txn.Event?.title || 'Community Assistance Ayuda'}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-emerald-600">
                            ₱{(parseFloat(txn.amount || 0) + parseFloat(txn.retro_amount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {isConfirmed ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ✓ Confirmed Received!
                              </span>
                            ) : txn.status === 'released' ? (
                              <button
                                onClick={() => handleAcknowledgeReceipt(txn.id)}
                                disabled={acknowledgingId === txn.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                              >
                                {acknowledgingId === txn.id ? (
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
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                Pending DSWD Release
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upcoming Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-dswd-lightBlue" />
              <h3 className="text-lg font-bold text-slate-900">Upcoming Distribution</h3>
            </div>

            {upcomingDistribution ? (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex gap-6">
                  <div className="bg-dswd-blue text-white rounded-xl p-4 text-center flex-shrink-0">
                    <p className="text-xs font-bold uppercase">
                      {new Date(upcomingDistribution.Event?.distribution_date).toLocaleDateString('en-US', { month: 'short' })}
                    </p>
                    <p className="text-3xl font-black">
                      {new Date(upcomingDistribution.Event?.distribution_date).getDate()}
                    </p>
                    <p className="text-xs">{new Date(upcomingDistribution.Event?.distribution_date).getFullYear()}</p>
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-lg">{upcomingDistribution.Event?.title}</h4>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>Date:</span>
                        <span className="font-semibold">
                          {new Date(upcomingDistribution.Event?.distribution_date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            weekday: 'long'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Time:</span>
                        <span className="font-semibold">8:00 AM - 4:00 PM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>Venue:</span>
                        <span className="font-semibold">{upcomingDistribution.Event?.venue || 'TBA'}</span>
                      </div>
                      {isNonCashProgram(upcomingDistribution.Event?.Program?.name || upcomingDistribution.Event?.title, upcomingDistribution.Event?.benefit_type) || upcomingDistribution.item_name ? (
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-purple-600" />
                          <span>Assistance:</span>
                          <span className="font-bold text-purple-700">
                            {upcomingDistribution.item_name || upcomingDistribution.Event?.item_name || getNonCashDetails(upcomingDistribution.Event?.Program?.name || upcomingDistribution.Event?.title)?.default_item || 'In-Kind Assistance'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <PesoIcon className="w-4 h-4" />
                          <span>Amount:</span>
                          <span className="font-semibold text-green-600">
                            ₱{parseFloat(upcomingDistribution.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                    <button className="mt-4 px-4 py-2 bg-dswd-lightBlue text-white text-sm font-semibold rounded-lg hover:bg-dswd-blue transition">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No upcoming distributions scheduled</p>
                <p className="text-xs mt-1">Check back later for updates</p>
              </div>
            )}
          </div>

          {/* Unclaimed Distribution Notice Banner if beneficiary has missed payouts */}
          {unclaimedDistributions.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3 text-amber-900">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 animate-bounce" />
                <div>
                  <h4 className="font-extrabold text-base text-amber-950">Notice of Unclaimed Benefit ({unclaimedDistributions.length})</h4>
                  <p className="text-xs text-amber-800">
                    The distribution date for the following payout(s) has ended without being claimed:
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {unclaimedDistributions.map((txn) => (
                  <div key={txn.id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block text-sm">{txn.Event?.title}</span>
                      <span className="text-slate-600">
                        Date: {txn.Event?.distribution_date ? new Date(txn.Event.distribution_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'} • Venue: {txn.Event?.venue || 'Barangay Hall'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isNonCashProgram(txn.Event?.Program?.name || txn.Event?.title, txn.Event?.benefit_type) || txn.item_name ? (
                        <span className="font-extrabold text-purple-800 bg-purple-100 px-2.5 py-1 rounded-md border border-purple-200">
                          {txn.item_name || txn.Event?.item_name || getNonCashDetails(txn.Event?.Program?.name || txn.Event?.title)?.badge || 'In-Kind Assistance'}
                        </span>
                      ) : (
                        <span className="font-extrabold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                          ₱{parseFloat(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      <span className="bg-red-100 text-red-700 font-black px-2.5 py-1 rounded-md border border-red-200">
                        NOT CLAIMED
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-700 italic">
                Please visit your Barangay hall or contact MSWD staff if you need assistance regarding unclaimed distributions.
              </p>
            </div>
          )}

          {/* Application Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-dswd-lightBlue" />
              <h3 className="text-lg font-bold text-slate-900">Application Timeline</h3>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-green-200"></div>
              
              <div className="space-y-6">
                {[
                  { label: 'Register Account', date: beneficiary?.created_at, completed: true },
                  { label: 'Submit Application', date: beneficiary?.updated_at, completed: true },
                  { label: 'Under Review', date: beneficiary?.updated_at, completed: true },
                  { label: 'Approved', date: beneficiary?.approval_date, completed: true }
                ].map((step, idx) => (
                  <div key={idx} className="relative flex gap-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs z-10 ${
                      step.completed ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {step.completed ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="font-semibold text-slate-900">{step.label}</p>
                      <p className="text-xs text-slate-500">
                        {step.date ? new Date(step.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Benefits Overview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Benefits Overview</h3>
              <button className="text-xs text-dswd-lightBlue hover:text-dswd-blue font-semibold">
                View All History
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 font-semibold mb-1">Total Benefits Received</p>
                <p className="text-2xl font-black text-green-900">
                  ₱{totalBenefits.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600 mt-1">Year 2026</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-black text-purple-900">{distributionsCount}</p>
                  <p className="text-xs text-purple-700 font-semibold">Distributions Received</p>
                  <p className="text-[10px] text-purple-600">This Year</p>
                </div>

                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Calendar className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm font-black text-blue-900">
                    {upcomingDistribution ? new Date(upcomingDistribution.Event?.distribution_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'None'}
                  </p>
                  <p className="text-xs text-blue-700 font-semibold">Next Distribution</p>
                  <p className="text-[10px] text-blue-600 font-bold">
                    {upcomingDistribution ? getDaysRemainingText(upcomingDistribution.Event?.distribution_date) : 'No upcoming schedule'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Important Reminders */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-amber-900">Important Reminders</h3>
            </div>

            <ul className="space-y-3 text-sm text-amber-900">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">ℹ️</span>
                <span>Bring your valid ID or RFID card on distribution day.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">⏰</span>
                <span>Claiming is available only on the scheduled date.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">✓</span>
                <span>Ensure your information is updated to avoid any issues.</span>
              </li>
            </ul>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-dswd-lightBlue" />
              <h3 className="text-lg font-bold text-slate-900">Recent Notifications</h3>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">Your application has been approved!</p>
                  <p className="text-xs text-green-700">Congratulations! You are now an official beneficiary.</p>
                  <p className="text-xs text-green-600 mt-1">
                    {beneficiary?.approval_date ? new Date(beneficiary.approval_date).toLocaleDateString() : 'Recently'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AUTO POP-UP ANNOUNCEMENT & SYSTEM NOTIFICATION MODAL ON LOGIN/DASHBOARD */}
      {showPopupModal && modalItems.length > 0 && (() => {
        const currentItem = modalItems[currentPopupIndex] || modalItems[0];
        // popupType is stamped at load time: 'announcement' for announcementApi items, 'notification' for notificationApi items.
        // ALWAYS use popupType first to avoid old/misclassified DB records polluting the display.
        const isAnnouncement = currentItem?.popupType === 'announcement';
        const isAbsence = !isAnnouncement && (
          currentItem?.reference_type === 'announcement_absence' ||
          currentItem?.type === 'announcement_absence' ||
          currentItem?.title?.toLowerCase().includes('absent') ||
          currentItem?.title?.toLowerCase().includes('hindi naka-attend')
        );
        const isProgram = !isAnnouncement && !isAbsence && (currentItem?.type === 'program' || currentItem?.reference_type === 'BenefitProgram');
        const isDistribution = !isAnnouncement && !isAbsence && (currentItem?.type === 'distribution' || currentItem?.reference_type === 'DistributionEvent');
        const isUnclaimed = !isAbsence && currentItem?.title?.toLowerCase().includes('unclaimed');
        const isPayoutVerified = !isAnnouncement && (currentItem?.reference_type === 'payout_verified' || currentItem?.title?.toLowerCase().includes('na-aprubahan ang iyong digital payout'));
        const isPayoutRejected = !isAnnouncement && (currentItem?.reference_type === 'payout_rejected' || currentItem?.title?.toLowerCase().includes('may puna sa iyong payout') || currentItem?.title?.toLowerCase().includes('hindi na-aprubahan'));

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden relative space-y-0">
              {/* Header Banner */}
              <div className={`p-6 relative text-white ${
                isAbsence
                  ? 'bg-gradient-to-r from-red-800 via-rose-900 to-slate-950'
                  : isPayoutVerified
                  ? 'bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900'
                  : isPayoutRejected
                  ? 'bg-gradient-to-r from-rose-800 via-red-900 to-slate-900'
                  : isUnclaimed 
                  ? 'bg-gradient-to-r from-amber-700 via-orange-800 to-red-900'
                  : 'bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900'
              }`}>
                <button
                  onClick={() => setShowPopupModal(false)}
                  className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl shadow-md ${
                    isAbsence
                      ? 'bg-rose-500 text-white shadow-lg'
                      : isPayoutVerified
                      ? 'bg-emerald-400 text-slate-950'
                      : isPayoutRejected
                      ? 'bg-rose-400 text-white'
                      : isUnclaimed
                      ? 'bg-amber-400 text-slate-950'
                      : isProgram
                      ? 'bg-purple-400 text-slate-950'
                      : isDistribution
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-yellow-400 text-slate-950'
                  }`}>
                    {isAbsence ? (
                      <AlertTriangle className="w-6 h-6 animate-bounce text-white" />
                    ) : isPayoutVerified ? (
                      <ShieldCheck className="w-6 h-6 animate-bounce text-slate-950" />
                    ) : isPayoutRejected ? (
                      <AlertTriangle className="w-6 h-6 animate-bounce text-white" />
                    ) : isUnclaimed ? (
                      <AlertTriangle className="w-6 h-6 animate-bounce" />
                    ) : isProgram ? (
                      <Award className="w-6 h-6 animate-bounce" />
                    ) : isDistribution ? (
                      <Gift className="w-6 h-6 animate-bounce" />
                    ) : (
                      <Megaphone className="w-6 h-6 animate-bounce" />
                    )}
                  </div>
                  <div>
                    <span className="text-yellow-300 text-xs font-extrabold uppercase tracking-wider block">
                      {isAbsence
                        ? '⚠️ Paunawa sa Hindi Pagdalo / Notice of Absence'
                        : isPayoutVerified
                        ? '✅ Digital Payout Verified & Active'
                        : isPayoutRejected
                        ? '⚠️ Payout Account Review Required'
                        : isUnclaimed
                        ? 'Notice of Unclaimed Benefit'
                        : isProgram
                        ? 'Program Enrollment Notification'
                        : isDistribution
                        ? 'New Benefit Distribution'
                        : 'Important Announcement'}
                    </span>
                    <h2 className="text-xl font-black tracking-tight text-white">
                      {currentItem?.title}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {isAbsence ? (
                    <span className="bg-red-100 text-red-950 font-black px-2.5 py-0.5 rounded-md border border-red-300">
                      ❌ ABSENT / HINDI NAKADALO
                    </span>
                  ) : isPayoutVerified ? (
                    <span className="bg-emerald-100 text-emerald-900 font-black px-2.5 py-0.5 rounded-md border border-emerald-300">
                      ✅ PAYOUT APPROVED & VERIFIED
                    </span>
                  ) : isPayoutRejected ? (
                    <span className="bg-red-100 text-red-900 font-black px-2.5 py-0.5 rounded-md border border-red-300">
                      ❌ ACTION REQUIRED: UPDATE ACCOUNT
                    </span>
                  ) : isUnclaimed ? (
                    <span className="bg-amber-100 text-amber-900 font-black px-2.5 py-0.5 rounded-md border border-amber-300">
                      ⚠️ UNCLAIMED BENEFIT
                    </span>
                  ) : isProgram ? (
                    <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-md border border-purple-200">
                      🎓 PROGRAM ENROLLMENT
                    </span>
                  ) : isDistribution ? (
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-md border border-emerald-200">
                      💰 PAYOUT SCHEDULED
                    </span>
                  ) : currentItem?.priority === 'Urgent' ? (
                    <span className="bg-red-100 text-red-800 font-black px-2.5 py-0.5 rounded-md border border-red-300">
                      🔴 URGENT
                    </span>
                  ) : currentItem?.priority === 'High' ? (
                    <span className="bg-orange-100 text-orange-800 font-bold px-2.5 py-0.5 rounded-md border border-orange-200">
                      🟠 HIGH PRIORITY
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-md border border-blue-200">
                      📢 EVENT ANNOUNCEMENT
                    </span>
                  )}
                  <span className="text-slate-400 font-semibold">•</span>
                  <span className="text-slate-500 font-medium">
                    {new Date(currentItem?.created_at || currentItem?.createdAt || Date.now()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 text-sm leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line font-medium">
                  {currentItem?.message}
                </div>

                {/* Compliance Guidance Notice for Absent Beneficiaries */}
                {isAbsence && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-900 font-extrabold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Paalala ukol sa Attendance at Compliance:</span>
                    </div>
                    <p className="text-rose-800 leading-relaxed font-medium">
                      Ang hindi pagdalo sa mga itinakdang opisyal na aktibidad o oryentasyon ng munisipyo ay naitala sa inyong record bilang <strong>Absent</strong>. Kung ikaw ay may balidong dahilan (tulad ng emerhensiya o medikal), mangyaring makipag-ugnayan agad sa inyong Barangay Staff o sa Tanggapan ng DSWD/MSWDO.
                    </p>
                  </div>
                )}

                {/* Schedule & Venue Details for Announcement or Distribution */}
                {(currentItem?.event_date || currentItem?.venue || isAnnouncement) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs">
                    {currentItem?.event_date && (
                      <div className="flex items-center gap-2 text-amber-900 font-bold">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Schedule: {currentItem?.event_date}{' '}
                          {currentItem?.event_time &&
                            `at ${currentItem?.event_time}${
                              currentItem?.end_time
                                ? ` - ${currentItem?.end_time}`
                                : ''
                            }`}
                        </span>
                      </div>
                    )}
                    {currentItem?.venue && (
                      <div className="flex items-center gap-2 text-amber-900 font-bold">
                        <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Venue: {currentItem?.venue}</span>
                      </div>
                    )}
                    {isAnnouncement && (
                      <div className="flex items-center gap-2 text-amber-950 font-bold pt-1 border-t border-amber-200/60">
                        <span>💳 Instruction: Bring your RFID card for your Attendance.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Pagination if multiple unread */}
                {modalItems.length > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 font-semibold">
                    <span>
                      Unread Notification {currentPopupIndex + 1} of {modalItems.length}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPopupIndex === 0}
                        onClick={() => setCurrentPopupIndex((prev) => Math.max(0, prev - 1))}
                        className="px-2.5 py-1 bg-slate-100 rounded-lg disabled:opacity-40 font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        disabled={currentPopupIndex === modalItems.length - 1}
                        onClick={() => setCurrentPopupIndex((prev) => Math.min(modalItems.length - 1, prev + 1))}
                        className="px-2.5 py-1 bg-slate-100 rounded-lg disabled:opacity-40 font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-wrap">
                {isPayoutRejected && (
                  <button
                    onClick={() => {
                      setShowPopupModal(false);
                      setShowPayoutModal(true);
                    }}
                    className="px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>I-update ang Payout Account</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    // Mark all currently shown items as "seen this session" so they don't re-popup on next poll
                    setShownIds(prev => {
                      const next = new Set(prev);
                      modalItems.forEach(item => next.add(`${item.popupType}-${item.id}`));
                      return next;
                    });
                    setShowPopupModal(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Close for Now
                </button>
                <button
                  onClick={async () => {
                    const itemToMark = modalItems[currentPopupIndex] || modalItems[0];
                    if (itemToMark) {
                      await handleMarkAsRead(itemToMark);
                      if (itemToMark.reference_type?.includes('payout')) {
                        try {
                          const res = await beneficiaryApi.getMe();
                          if (res.data?.data) setCurrentBeneficiary(res.data.data);
                        } catch (e) {}
                      }
                    }
                    if (modalItems.length <= 1) {
                      setShowPopupModal(false);
                    } else {
                      setCurrentPopupIndex(0);
                    }
                  }}
                  className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
                    isAbsence
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-dswd-blue hover:bg-blue-800 text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{isAbsence ? 'Naintindihan Ko / Nabasa Ko Na' : 'Salamat / Nabasa Ko Na'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: Setup / Update Digital Payout Account ── */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Digital Payout Account</h3>
                  <p className="text-xs text-purple-200 mt-0.5">I-rehistro ang iyong GCash, Maya, o Landbank Account</p>
                </div>
              </div>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePayoutAccount} className="p-6 space-y-4">
              {payoutError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{payoutError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Paraan ng Pagtanggap (Payout Preference)
                </label>
                <select
                  value={payoutForm.payout_preference}
                  onChange={(e) => setPayoutForm({ ...payoutForm, payout_preference: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="digital">⚡ Digital (E-Wallet / Bank Account)</option>
                  <option value="cash_otc">🏢 Cash OTC / Physical Claiming (RFID)</option>
                </select>
              </div>

              {payoutForm.payout_preference === 'digital' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Pumili ng Provider / Bangko <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={payoutForm.payout_provider}
                      onChange={(e) => setPayoutForm({ ...payoutForm, payout_provider: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
                      required
                    >
                      <option value="GCash">GCash</option>
                      <option value="Maya">Maya (PayMaya)</option>
                      <option value="Landbank">Landbank ATM / Account</option>
                      <option value="Other">Iba Pa (Other Bank)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Account / Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={payoutForm.payout_account_number}
                      onChange={(e) => setPayoutForm({ ...payoutForm, payout_account_number: e.target.value })}
                      placeholder={
                        payoutForm.payout_provider === 'GCash' ? '09XXXXXXXXX (GCash number)'
                        : payoutForm.payout_provider === 'Maya' ? '09XXXXXXXXX (Maya number)'
                        : payoutForm.payout_provider === 'Landbank' ? 'Landbank account number (e.g. 0000-0000-00)'
                        : 'Bank account number'
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {payoutForm.payout_provider === 'Landbank'
                        ? 'Ilagay ang iyong Landbank account number (hindi ATM card number).'
                        : 'Siguraduhing tama at aktibo ang mobile number o bank account.'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Pangalan ng May-ari ng Account (Account Holder Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={payoutForm.payout_account_name}
                      onChange={(e) => setPayoutForm({ ...payoutForm, payout_account_name: e.target.value })}
                      placeholder={
                        payoutForm.payout_provider === 'Landbank'
                          ? 'Buong pangalan tulad ng nasa Landbank passbook/card'
                          : 'Buong pangalan tulad ng nasa GCash/Maya/ID'
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      required
                    />
                    <span className="text-[11px] text-purple-600 mt-1 block font-medium">
                    💡 Paalala: Dapat tugma ang pangalan sa iyong DSWD/MSWDO beneficiary record upang mabilis na ma-verify ng Admin.
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Administrative Verification Policy:
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Kapag isinumite mo ang bagong account number, awtomatiko itong mamarkahan bilang <strong>"For Verification"</strong>. Ive-verify ito ng Admin bago mag-disburse ng ayuda upang maiwasan ang maling pagpapadala ng pondo.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  disabled={payoutSaving}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {payoutSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sine-save...
                    </>
                  ) : (
                    'I-submit para sa Beripikasyon'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Extra/Secondary Payout Account Modal */}
      {showAddExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold text-base">Magdagdag ng Secondary Payout Account</h3>
              </div>
              <button
                onClick={() => setShowAddExtraModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExtraPayoutAccount} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Maaari kang magdagdag ng Landbank account/card o karagdagang e-wallet (GCash/Maya) bilang pangalawang pagpipilian sa digital payout ng ayuda.
              </p>

              {extraError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{extraError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Provider o Bangko <span className="text-red-500">*</span>
                </label>
                <select
                  value={extraPayoutForm.provider}
                  onChange={(e) => setExtraPayoutForm({ ...extraPayoutForm, provider: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                  required
                >
                  <option value="Landbank">Landbank ATM / Account</option>
                  <option value="GCash">GCash</option>
                  <option value="Maya">Maya (PayMaya)</option>
                  <option value="Other">Iba Pa (Other Bank)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Account / Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extraPayoutForm.account_number}
                  onChange={(e) => setExtraPayoutForm({ ...extraPayoutForm, account_number: e.target.value })}
                  placeholder={
                    extraPayoutForm.provider === 'Landbank' ? 'Landbank account number (e.g. 0000-0000-00)'
                    : extraPayoutForm.provider === 'GCash' ? '09XXXXXXXXX (GCash number)'
                    : extraPayoutForm.provider === 'Maya' ? '09XXXXXXXXX (Maya number)'
                    : 'Account number'
                  }
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {extraPayoutForm.provider === 'Landbank'
                    ? 'Ilagay ang iyong Landbank account number.'
                    : 'Siguraduhing tama at aktibo ang account o mobile number.'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Pangalan sa Account (Account Holder Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extraPayoutForm.account_name}
                  onChange={(e) => setExtraPayoutForm({ ...extraPayoutForm, account_name: e.target.value })}
                  placeholder="Buong pangalan tulad ng nasa ID o passbook"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  required
                />
                <span className="text-[11px] text-indigo-600 mt-1 block font-medium">
                  💡 Paalala: Dapat tugma ang pangalan sa iyong DSWD record para sa mabilisang verification ng Admin.
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Admin Verification:
                </p>
                <p className="text-[11px] leading-relaxed">
                  Ang secondary account na ito ay susuriin at ive-verify ng Admin bago magamit bilang opsyon sa payout.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExtraModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  disabled={extraSaving}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {extraSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Nag-aadd...
                    </>
                  ) : (
                    'I-save ang Secondary Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

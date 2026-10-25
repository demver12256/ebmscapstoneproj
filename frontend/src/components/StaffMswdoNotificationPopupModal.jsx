import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import {
  Megaphone,
  BellRing,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Building2,
  QrCode,
  Users,
  CreditCard,
  Package,
} from 'lucide-react';

export default function StaffMswdoNotificationPopupModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modalItems, setModalItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // In-memory dismissal tracker for this component lifecycle
  const [dismissedIds, setDismissedIds] = useState(new Set());

  // Show for all non-beneficiary users (beneficiaries have their own modal in ApprovedBeneficiaryDashboard)
  const isEligibleRole = user && user.role !== 'beneficiary';
  const isAnyStaff = ['staff', 'barangay', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'].includes(user?.role);
  const isSeniorAdmin = user?.role === 'senior_citizen_admin';
  const isPwdAdmin = user?.role === 'pwd_admin';
  const isMswdoAdmin = user?.role === 'mswdo_admin';

  // Reset dismissed IDs if user switches account
  useEffect(() => {
    setDismissedIds(new Set());
    setModalItems([]);
    setIsOpen(false);
  }, [user?.id]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!user || !isEligibleRole) return;

    try {
      const notifRes = await notificationApi.list();
      const notifs = notifRes.data?.data || [];

      const canManageAssistance = ['admin', 'staff', 'barangay', 'mswdo_admin', 'mswdo_staff'].includes(user?.role);
      const isMswdo = ['mswdo_admin', 'mswdo_staff'].includes(user?.role);
      const isDswd = ['admin', 'staff', 'barangay'].includes(user?.role);

      // Filter notifications: payout verification is DSWD-admin only,
      // and assistance requests must strictly belong only to DSWD or MSWDO (not Senior or PWD)
      const roleVisibleNotifs = notifs.filter((item) => {
        if (item.reference_type === 'payout_verification' && user.role !== 'admin') return false;
        if (item.reference_type === 'assistance_request') {
          if (!canManageAssistance) return false;
          if (isMswdo && item.title?.includes('(DSWD)')) return false;
          if (isDswd && item.title?.includes('(MSWDO)')) return false;
        }
        return true;
      });

      // Filter unread notifications for this user
      const unreadList = roleVisibleNotifs.filter((n) => !n.is_read);

      // Only show items not dismissed in current session
      const newItems = unreadList.filter((item) => !dismissedIds.has(item.id));

      if (newItems.length > 0) {
        setModalItems(newItems);
        setCurrentIndex(0);
        setIsOpen(true);
      } else {
        setModalItems([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Error loading notification popup:', err);
    }
  }, [user, isEligibleRole, dismissedIds]);

  // Initial load and periodic polling every 8 seconds
  useEffect(() => {
    if (!isEligibleRole) return;

    loadUnreadNotifications();

    const handleUpdate = () => loadUnreadNotifications();
    window.addEventListener('notificationsUpdated', handleUpdate);
    const interval = setInterval(loadUnreadNotifications, 8000);

    return () => {
      window.removeEventListener('notificationsUpdated', handleUpdate);
      clearInterval(interval);
    };
  }, [isEligibleRole, loadUnreadNotifications]);

  const handleDismissCurrent = () => {
    if (modalItems.length === 0) return;
    const current = modalItems[currentIndex];
    if (current?.id) {
      setDismissedIds((prev) => new Set([...prev, current.id]));
    }

    const remaining = modalItems.filter((_, idx) => idx !== currentIndex);
    if (remaining.length > 0) {
      setModalItems(remaining);
      setCurrentIndex((prev) => Math.min(prev, remaining.length - 1));
    } else {
      setIsOpen(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (modalItems.length === 0) return;
    const current = modalItems[currentIndex];
    if (!current) return;

    setLoadingAction(true);
    try {
      await notificationApi.markAsRead(current.id);
      window.dispatchEvent(new Event('notificationsUpdated'));

      setDismissedIds((prev) => new Set([...prev, current.id]));

      const remaining = modalItems.filter((_, idx) => idx !== currentIndex);
      if (remaining.length > 0) {
        setModalItems(remaining);
        setCurrentIndex((prev) => Math.min(prev, remaining.length - 1));
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoadingAction(true);
    try {
      await Promise.all(modalItems.map((item) => notificationApi.markAsRead(item.id).catch(() => {})));
      window.dispatchEvent(new Event('notificationsUpdated'));

      setDismissedIds((prev) => new Set([...prev, ...modalItems.map((i) => i.id)]));
      setModalItems([]);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  if (!isOpen || modalItems.length === 0) return null;

  const currentItem = modalItems[currentIndex] || modalItems[0];
  const refType = currentItem?.reference_type || '';
  const notifType = currentItem?.type || '';
  const notifTitle = (currentItem?.title || '').toLowerCase();

  const isPayoutVerification = refType === 'payout_verification' || notifTitle.includes('payout');
  const isDistributionNotice = refType === 'DistributionEvent' || refType === 'distribution_staff' || notifType === 'distribution' || notifTitle.includes('distribution');
  const isSeniorNotice = refType === 'announcement_senior' || notifTitle.includes('osca') || (isSeniorAdmin && !isDistributionNotice && !isPayoutVerification);
  const isPwdNotice = refType === 'announcement_pwd' || notifTitle.includes('pdao') || (isPwdAdmin && !isDistributionNotice && !isPayoutVerification);
  const isMswdoNotice = refType === 'announcement_mswdo' || (isMswdoAdmin && !isDistributionNotice && !isPayoutVerification);
  const isStaffAssignment = (refType === 'announcement_staff' || isAnyStaff) && !isPayoutVerification && !isDistributionNotice && !isSeniorNotice && !isPwdNotice && !isMswdoNotice;

  // Header styling & banner configuration
  let bannerGradient = 'bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-900';
  let bannerBadge = '📢 Opisyal na Abiso';
  let bannerIcon = <Megaphone className="w-6 h-6 animate-bounce text-slate-950" />;
  let iconBg = 'bg-yellow-400 text-slate-950';
  let badgeStyle = 'bg-yellow-400/20 text-yellow-300 border border-yellow-300/30';
  let tagLabel = 'DSWD Notice';
  let tagStyle = 'bg-blue-100 text-blue-800 border-blue-200';
  let reminderText = null;

  if (isPayoutVerification) {
    bannerGradient = 'bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900';
    bannerBadge = '💳 Digital Payout Verification';
    bannerIcon = <CreditCard className="w-6 h-6 animate-bounce text-yellow-300" />;
    iconBg = 'bg-purple-500 text-white shadow-purple-900/50';
    badgeStyle = 'bg-purple-400/20 text-purple-200 border border-purple-400/30';
    tagLabel = '⚡ Bagong E-Wallet Registration';
    tagStyle = 'bg-purple-100 text-purple-900 border-purple-200';
    reminderText = 'Paalala sa Opisyal: I-verify ang nakarehistrong pangalan at account number ng benepisyaryo bago mag-disburse upang maiwasan ang maling pagpapadala ng ayuda.';
  } else if (isDistributionNotice) {
    bannerGradient = 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900';
    bannerBadge = '📦 Distribution Event Assignment';
    bannerIcon = <Package className="w-6 h-6 animate-bounce text-yellow-300" />;
    iconBg = 'bg-emerald-500 text-white shadow-emerald-900/50';
    badgeStyle = 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30';
    tagLabel = 'Ayuda Distribution Duty';
    tagStyle = 'bg-emerald-100 text-emerald-900 border-emerald-200';
    reminderText = 'Paalala sa Assigned Staff: Mangyaring pumunta sa takdang distribution venue at i-facilitate ang pag-verify at pag-release ng ayuda gamit ang Distribution Scanner.';
  } else if (isSeniorNotice) {
    bannerGradient = 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900';
    bannerBadge = '👴 OSCA / Senior Citizen Coordination Notice';
    bannerIcon = <Building2 className="w-6 h-6 animate-bounce text-amber-300" />;
    iconBg = 'bg-blue-600 text-white shadow-blue-900/50';
    badgeStyle = 'bg-blue-400/20 text-blue-200 border border-blue-400/30';
    tagLabel = 'OSCA Coordination Copy';
    tagStyle = 'bg-blue-100 text-blue-900 border-blue-200';
    reminderText = 'Paalala sa OSCA / Senior Citizen Admin: Ito ay opisyal na abiso para sa inyong kaalaman at koordinasyon ng aktibidad para sa mga Senior Citizens.';
  } else if (isPwdNotice) {
    bannerGradient = 'bg-gradient-to-r from-amber-950 via-orange-900 to-slate-900';
    bannerBadge = '♿ PDAO / PWD Coordination Notice';
    bannerIcon = <Building2 className="w-6 h-6 animate-bounce text-yellow-300" />;
    iconBg = 'bg-amber-600 text-white shadow-amber-900/50';
    badgeStyle = 'bg-amber-400/20 text-amber-200 border border-amber-400/30';
    tagLabel = 'PDAO Coordination Copy';
    tagStyle = 'bg-amber-100 text-amber-900 border-amber-200';
    reminderText = 'Paalala sa PDAO / PWD Admin: Ito ay opisyal na abiso para sa inyong kaalaman at koordinasyon ng aktibidad para sa mga Persons with Disabilities.';
  } else if (isMswdoNotice) {
    bannerGradient = 'bg-gradient-to-r from-indigo-950 via-indigo-900 to-purple-950';
    bannerBadge = '🏛️ MSWDO Coordination Notice';
    bannerIcon = <Building2 className="w-6 h-6 animate-bounce text-yellow-300" />;
    iconBg = 'bg-indigo-600 text-white shadow-indigo-900/50';
    badgeStyle = 'bg-indigo-400/20 text-indigo-200 border border-indigo-400/30';
    tagLabel = 'MSWDO Admin Copy';
    tagStyle = 'bg-purple-100 text-purple-900 border-purple-200';
    reminderText = 'Paalala sa MSWDO: Ito ay opisyal na abiso para sa inyong kaalaman at koordinasyon sa mga programang pangkomunidad.';
  } else if (isStaffAssignment) {
    bannerGradient = 'bg-gradient-to-r from-blue-950 via-cyan-900 to-slate-900';
    bannerBadge = '📋 Na-assign na Aktibidad / Duty Assignment';
    bannerIcon = <QrCode className="w-6 h-6 animate-bounce text-slate-950" />;
    iconBg = 'bg-cyan-400 text-slate-950 shadow-cyan-900/50';
    badgeStyle = 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/30';
    tagLabel = 'Attendance Facilitator Duty';
    tagStyle = 'bg-cyan-100 text-cyan-900 border-cyan-200';
    reminderText = 'Paalala sa Assigned Staff: Mangyaring i-facilitate ang pag-verify at pag-scan ng RFID Beneficiary Cards sa takdang oras ng aktibidad gamit ang Attendance Scanner.';
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden relative transition-all transform scale-100">
        {/* Header Banner */}
        <div className={`p-6 text-white relative ${bannerGradient}`}>
          {/* Close button */}
          <button
            onClick={handleDismissCurrent}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition"
            title="Isara"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div className={`p-3 rounded-2xl shadow-lg shrink-0 ${iconBg}`}>
              {bannerIcon}
            </div>
            <div className="space-y-0.5">
              <span className={`text-[11px] font-black uppercase tracking-wider block px-2.5 py-0.5 rounded-full w-fit ${badgeStyle}`}>
                {bannerBadge}
              </span>
              <h2 className="text-xl font-black text-white tracking-tight leading-snug line-clamp-2">
                {currentItem?.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-4">
          {/* Tags Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-slate-100 text-slate-800 font-bold px-2.5 py-0.5 rounded-md border border-slate-200">
                🔵 OFFICIAL EBMS NOTICE
              </span>
              <span className={`font-bold px-2.5 py-0.5 rounded-md border ${tagStyle}`}>
                {tagLabel}
              </span>
            </div>

            <span className="text-slate-400 text-xs font-semibold">
              {new Date(currentItem?.created_at || currentItem?.createdAt || Date.now()).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Notification Message Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 text-sm leading-relaxed whitespace-pre-line font-medium max-h-52 overflow-y-auto shadow-inner">
            {currentItem?.message}
          </div>

          {/* Instruction Note */}
          {reminderText && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-xs text-blue-950 flex items-start gap-2">
              <BellRing className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Paalala:</strong> {reminderText}
              </span>
            </div>
          )}
        </div>

        {/* Footer & Action Controls */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Pagination for multiple unread notifications */}
          {modalItems.length > 1 ? (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Abiso {currentIndex + 1} ng {modalItems.length}
              </span>
              <button
                disabled={currentIndex === modalItems.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(modalItems.length - 1, prev + 1))}
                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400">
              {isPayoutVerification ? 'Bagong Payout Account Registration' : 'Bagong Opisyal na Abiso'}
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Quick Navigation Buttons */}
            {isPayoutVerification && (
              <button
                onClick={() => {
                  handleMarkAsRead();
                  navigate('/dashboard/beneficiaries?payout_status=unverified', { state: { payout_status: 'unverified' } });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>I-verify sa Records</span>
              </button>
            )}

            {isDistributionNotice && (
              <button
                onClick={() => {
                  handleMarkAsRead();
                  navigate('/dashboard/rfid-scanner');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Buksan Distribution Scanner</span>
              </button>
            )}

            {isStaffAssignment && !isDistributionNotice && (
              <button
                onClick={() => {
                  handleMarkAsRead();
                  navigate('/dashboard/rfid-attendance');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Buksan Attendance Scanner</span>
              </button>
            )}

            {(isSeniorNotice || isPwdNotice || isMswdoNotice || isStaffAssignment) && !isDistributionNotice && !isPayoutVerification && (
              <button
                onClick={() => {
                  handleMarkAsRead();
                  navigate('/dashboard/announcements');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tingnan sa Announcements</span>
              </button>
            )}

            {/* Mark as read button */}
            <button
              onClick={handleMarkAsRead}
              disabled={loadingAction}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-dswd-blue hover:bg-blue-800 text-white transition shadow-md disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Naintindihan / Nabasa Na</span>
            </button>

            {modalItems.length > 1 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={loadingAction}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1 transition underline"
              >
                Mark All as Read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

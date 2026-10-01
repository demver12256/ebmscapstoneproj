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
  const isStaff = user?.role === 'staff' || user?.role === 'barangay';
  const isMswdo = user?.role === 'mswdo_admin';

  const loadUnreadNotifications = useCallback(async () => {
    if (!user || !isEligibleRole) return;

    try {
      const notifRes = await notificationApi.list();
      const notifs = notifRes.data?.data || [];

      // Payout verification requests are DSWD-admin-only, including older
      // notifications that may already exist in an MSWDO account.
      const roleVisibleNotifs = notifs.filter((item) =>
        user.role === 'admin' || item.reference_type !== 'payout_verification'
      );

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
  const isPayoutVerification = currentItem?.reference_type === 'payout_verification' || currentItem?.title?.toLowerCase().includes('payout');
  const isMswdoNotice = (currentItem?.reference_type === 'announcement_mswdo' || isMswdo) && !isPayoutVerification;
  const isStaffAssignment = isStaff && (currentItem?.reference_type === 'announcement_staff' || !isMswdo) && !isPayoutVerification;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden relative transition-all transform scale-100">
        {/* Header Banner */}
        <div
          className={`p-6 text-white relative ${
            isPayoutVerification
              ? 'bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900'
              : isMswdoNotice
                ? 'bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900'
                : 'bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-900'
          }`}
        >
          {/* Close button */}
          <button
            onClick={handleDismissCurrent}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition"
            title="Isara"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div
              className={`p-3 rounded-2xl shadow-lg shrink-0 ${
                isPayoutVerification
                  ? 'bg-purple-500 text-white shadow-purple-900/50'
                  : isMswdoNotice ? 'bg-amber-400 text-slate-950' : 'bg-yellow-400 text-slate-950'
              }`}
            >
              {isPayoutVerification ? (
                <CreditCard className="w-6 h-6 animate-bounce text-yellow-300" />
              ) : isMswdoNotice ? (
                <Building2 className="w-6 h-6 animate-bounce" />
              ) : (
                <Megaphone className="w-6 h-6 animate-bounce" />
              )}
            </div>
            <div className="space-y-0.5">
              <span
                className={`text-[11px] font-black uppercase tracking-wider block px-2.5 py-0.5 rounded-full w-fit ${
                  isPayoutVerification
                    ? 'bg-purple-400/20 text-purple-200 border border-purple-400/30'
                    : isMswdoNotice
                      ? 'bg-amber-400/20 text-yellow-300 border border-amber-300/30'
                      : 'bg-yellow-400/20 text-yellow-300 border border-yellow-300/30'
                }`}
              >
                {isPayoutVerification
                  ? '💳 Digital Payout Verification'
                  : isMswdoNotice ? '🏛️ MSWDO Coordination Notice' : '📢 Barangay Activity Assignment'}
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
              <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-md border border-blue-200">
                🔵 OFFICIAL DSWD NOTICE
              </span>
              {isPayoutVerification && (
                <span className="bg-purple-100 text-purple-900 font-bold px-2.5 py-0.5 rounded-md border border-purple-200">
                  ⚡ Bagong E-Wallet Registration
                </span>
              )}
              {isMswdoNotice && (
                <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded-md border border-purple-200">
                  MSWDO Admin Copy
                </span>
              )}
              {isStaffAssignment && (
                <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                  Barangay Duty
                </span>
              )}
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
          {isPayoutVerification && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-950 flex items-start gap-2">
              <CreditCard className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                <strong>Paalala sa Opisyal:</strong> I-verify ang nakarehistrong pangalan at account number ng benepisyaryo bago mag-disburse upang maiwasan ang maling pagpapadala ng ayuda.
              </span>
            </div>
          )}

          {isStaffAssignment && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Paalala sa Barangay Staff:</strong> Mangyaring i-facilitate ang pag-verify at pag-scan ng RFID Beneficiary Cards sa takdang oras ng aktibidad.
              </span>
            </div>
          )}

          {isMswdoNotice && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 flex items-start gap-2">
              <Building2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                <strong>Paalala sa MSWDO:</strong> Ito ay opisyal na abiso para sa inyong kaalaman at koordinasyon sa mga programang pangkomunidad.
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
              {isPayoutVerification ? 'Bagong Payout Account Registration' : 'Bagong Abiso mula sa DSWD'}
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Quick Navigation Button */}
            {isPayoutVerification && (
              <button
                onClick={() => {
                  handleMarkAsRead();
                  navigate('/dashboard/beneficiaries?payout_status=unverified', { state: { payout_status: 'unverified' } });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>I-verify sa Beneficiary Records</span>
              </button>
            )}

            {isStaffAssignment && (
              <button
                onClick={() => {
                  handleMarkAsRead();
                  navigate('/dashboard/announcement-scanner');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Buksan RFID Scanner</span>
              </button>
            )}

            {isMswdoNotice && (
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

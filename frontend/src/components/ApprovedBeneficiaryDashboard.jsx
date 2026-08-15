import { Calendar, MapPin, Copy, Bell, FileText, CheckCircle2, Clock, Users, AlertTriangle, Megaphone, Check, X, Award, Gift } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { announcementApi, notificationApi } from '../services/api';
import { Link } from 'react-router-dom';

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

export default function ApprovedBeneficiaryDashboard({ beneficiary }) {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [modalItems, setModalItems] = useState([]);
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);

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
          .filter(a => !a.is_read && a.status === 'published')
          .map(a => ({ ...a, popupType: 'announcement' }));

        // Exclude announcement-type notifications — they are already shown via unreadAnn above.
        // Also exclude old "Upcoming" notifications if an "Unclaimed Benefit Notice" exists for the same event or if event ended.
        const unclaimedReferenceIds = new Set(
          notifList
            .filter(n => n.title?.toLowerCase().includes('unclaimed'))
            .map(n => n.reference_id)
            .filter(Boolean)
        );

        const unreadNotif = notifList
          .filter(n => {
            if (n.is_read) return false;
            if (n.type === 'announcement' || n.reference_type === 'announcement') return false;

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

    // Poll every 30 seconds to catch new enrollment/distribution notifications
    const pollInterval = setInterval(loadPopups, 30000);

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
      const key = `${item.popupType}-${item.id}`;
      // Add to shownIds so polling won't re-show this item
      setShownIds(prev => new Set([...prev, key]));

      if (item.popupType === 'announcement') {
        await announcementApi.markAsRead(item.id);
        setAnnouncements(prev => prev.map(a => a.id === item.id ? { ...a, is_read: true } : a));
      } else {
        await notificationApi.markAsRead(item.id);
      }
      setModalItems(prev => prev.filter(i => !(i.id === item.id && i.popupType === item.popupType)));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(beneficiary?.beneficiary_id_code || '');
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black tracking-tight">Beneficiary Dashboard</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl">
            Welcome back, {beneficiary?.first_name}! Here is your application, program enrollment, and assistance payout overview.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-xs text-blue-100 font-semibold self-start md:self-auto">
          <div>📅 {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div className="text-yellow-300 font-mono font-bold mt-0.5">⏱️ {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
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

      {/* TARGETED ANNOUNCEMENTS BANNER / WIDGET */}
      {announcements.length > 0 && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Megaphone className="w-6 h-6 text-yellow-400" />
                {unreadAnnouncements.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              <h2 className="text-lg font-black tracking-tight">Official Municipal Announcements</h2>
            </div>
            <Link
              to="/dashboard/notifications"
              className="text-xs font-bold text-yellow-300 hover:text-yellow-200 underline flex items-center gap-1"
            >
              View All ({announcements.length})
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.slice(0, 2).map((ann) => (
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
                      onClick={() => handleMarkAsRead(ann.id)}
                      className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-extrabold text-xs px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1"
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
            <p className="text-sm font-semibold text-slate-700">Beneficiary ID</p>
          </div>
          <h3 className="text-xl font-black text-slate-900">{beneficiary?.beneficiary_id_code}</h3>
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
                      <div className="flex items-center gap-2">
                        <PesoIcon className="w-4 h-4" />
                        <span>Amount:</span>
                        <span className="font-semibold text-green-600">
                          ₱{parseFloat(upcomingDistribution.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
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
                      <span className="font-extrabold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                        ₱{parseFloat(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
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
        const isProgram = !isAnnouncement && (currentItem?.type === 'program' || currentItem?.reference_type === 'BenefitProgram');
        const isDistribution = !isAnnouncement && (currentItem?.type === 'distribution' || currentItem?.reference_type === 'DistributionEvent');
        const isUnclaimed = currentItem?.title?.toLowerCase().includes('unclaimed');

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden relative space-y-0">
              {/* Header Banner */}
              <div className={`p-6 relative text-white ${
                isUnclaimed 
                  ? 'bg-gradient-to-r from-amber-700 via-orange-800 to-red-900'
                  : 'bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900'
              }`}>
                <button
                  onClick={() => setShowPopupModal(false)}
                  className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl shadow-md ${
                    isUnclaimed
                      ? 'bg-amber-400 text-slate-950'
                      : isProgram
                      ? 'bg-purple-400 text-slate-950'
                      : isDistribution
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-yellow-400 text-slate-950'
                  }`}>
                    {isUnclaimed ? (
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
                      {isUnclaimed
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
                  {isUnclaimed ? (
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
                        className="px-2.5 py-1 bg-slate-100 rounded-lg disabled:opacity-40 font-bold text-slate-700 hover:bg-slate-200 transition"
                      >
                        Prev
                      </button>
                      <button
                        disabled={currentPopupIndex === modalItems.length - 1}
                        onClick={() => setCurrentPopupIndex((prev) => Math.min(modalItems.length - 1, prev + 1))}
                        className="px-2.5 py-1 bg-slate-100 rounded-lg disabled:opacity-40 font-bold text-slate-700 hover:bg-slate-200 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
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
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Close for Now
                </button>
                <button
                  onClick={async () => {
                    const itemToMark = modalItems[currentPopupIndex] || modalItems[0];
                    if (itemToMark) {
                      await handleMarkAsRead(itemToMark);
                    }
                    if (modalItems.length <= 1) {
                      setShowPopupModal(false);
                    } else {
                      setCurrentPopupIndex(0);
                    }
                  }}
                  className="px-5 py-2.5 text-xs font-extrabold bg-dswd-blue hover:bg-blue-800 text-white rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Mark as Read & Continue</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

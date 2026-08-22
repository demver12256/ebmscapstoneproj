import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Moon, ChevronDown, CheckCheck, Users, MessageSquare, Megaphone, UserPlus, Package, Clock, X, ExternalLink, AlertCircle, UserCheck, Info, HandHeart, FileText } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationApi, beneficiaryApi, messageApi, assistanceRequestApi } from '../../services/api';

export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [pendingAssistance, setPendingAssistance] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [dropdownLoading, setDropdownLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff' || user?.role === 'barangay';

  // Time ago helper
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${diffWeeks}w ago`;
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount();
      setUnreadCount(res.data?.data?.count || 0);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  // Compute total badge count from all sources
  const computeTotalBadge = useCallback(() => {
    let total = unreadCount;
    total += pendingApplications.length;
    total += pendingAssistance.length;
    if (unreadMessages > 0) total += unreadMessages;
    return total;
  }, [unreadCount, pendingApplications.length, pendingAssistance.length, unreadMessages]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Pre-fetch pending beneficiary applications for admin only
      if (isAdmin) {
        beneficiaryApi.listApplications().then(res => {
          const apps = res.data?.data || [];
          setPendingApplications(apps.filter(a =>
            a.status === 'pending' || a.status === 'Pending' ||
            a.status === 'Under Review' || a.status === 'under_review'
          ));
        }).catch(() => {});
      } else {
        setPendingApplications([]);
      }

      if (isAdmin || isStaff) {
        assistanceRequestApi.list().then(res => {
          const requests = res.data?.data || [];
          setPendingAssistance(requests.filter(r =>
            r.status === 'Pending' || r.status === 'pending' ||
            r.status === 'Under Review' || r.status === 'under_review'
          ));
        }).catch(() => {});
      }

      messageApi.unreadCount().then(res => {
        setUnreadMessages(res.data?.data?.count || res.data?.count || 0);
      }).catch(() => {});

      const handleUpdate = () => fetchUnreadCount();
      window.addEventListener('notificationsUpdated', handleUpdate);
      const interval = setInterval(() => {
        fetchUnreadCount();
        // Refresh counts periodically
        if (isAdmin) {
          beneficiaryApi.listApplications().then(res => {
            const apps = res.data?.data || [];
            setPendingApplications(apps.filter(a =>
              a.status === 'pending' || a.status === 'Pending' ||
              a.status === 'Under Review' || a.status === 'under_review'
            ));
          }).catch(() => {});
        }
        if (isAdmin || isStaff) {
          assistanceRequestApi.list().then(res => {
            const requests = res.data?.data || [];
            setPendingAssistance(requests.filter(r =>
              r.status === 'Pending' || r.status === 'pending' ||
              r.status === 'Under Review' || r.status === 'under_review'
            ));
          }).catch(() => {});
        }
        messageApi.unreadCount().then(res => {
          setUnreadMessages(res.data?.data?.count || res.data?.count || 0);
        }).catch(() => {});
      }, 30000);
      return () => {
        window.removeEventListener('notificationsUpdated', handleUpdate);
        clearInterval(interval);
      };
    }
  }, [user, fetchUnreadCount, isAdmin, isStaff]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load dropdown data when opened
  const loadDropdownData = useCallback(async () => {
    setDropdownLoading(true);
    try {
      // Notifications
      const notifRes = await notificationApi.list();
      setNotifications(notifRes.data?.data || []);

      // Pending beneficiary applications for admin only
      if (isAdmin) {
        try {
          const appRes = await beneficiaryApi.listApplications();
          const apps = appRes.data?.data || [];
          setPendingApplications(apps.filter(a =>
            a.status === 'pending' || a.status === 'Pending' ||
            a.status === 'Under Review' || a.status === 'under_review'
          ));
        } catch (e) {
          console.error('Failed to load applications:', e);
        }
      } else {
        setPendingApplications([]);
      }

      // Pending assistance requests
      if (isAdmin || isStaff) {
        try {
          const assistRes = await assistanceRequestApi.list();
          const requests = assistRes.data?.data || [];
          setPendingAssistance(requests.filter(r =>
            r.status === 'Pending' || r.status === 'pending' ||
            r.status === 'Under Review' || r.status === 'under_review'
          ));
        } catch (e) {
          console.error('Failed to load assistance requests:', e);
        }
      }

      // Unread messages
      try {
        const msgRes = await messageApi.unreadCount();
        setUnreadMessages(msgRes.data?.data?.count || msgRes.data?.count || 0);
      } catch (e) {
        console.error('Failed to load unread messages:', e);
      }
    } catch (err) {
      console.error('Failed to load dropdown data:', err);
    } finally {
      setDropdownLoading(false);
    }
  }, [isAdmin, isStaff]);

  const toggleDropdown = () => {
    const willOpen = !showDropdown;
    setShowDropdown(willOpen);
    if (willOpen) {
      loadDropdownData();
    }
  };

  const handleMarkAsRead = async (notifId, e) => {
    e.stopPropagation();
    try {
      await notificationApi.markAsRead(notifId);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      fetchUnreadCount();
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Get notification icon based on type
  const getNotifIcon = (notif) => {
    const type = notif.reference_type || notif.type || '';
    if (type.includes('announcement') || type.includes('megaphone')) {
      return <Megaphone className="w-4 h-4 text-blue-500" />;
    }
    if (type.includes('enrollment') || type.includes('enroll')) {
      return <UserPlus className="w-4 h-4 text-green-500" />;
    }
    if (type.includes('distribution') || type.includes('benefit')) {
      return <Package className="w-4 h-4 text-purple-500" />;
    }
    if (type.includes('approval') || type.includes('approved')) {
      return <UserCheck className="w-4 h-4 text-emerald-500" />;
    }
    if (type.includes('message')) {
      return <MessageSquare className="w-4 h-4 text-indigo-500" />;
    }
    return <Info className="w-4 h-4 text-blue-500" />;
  };

  // Get icon background color
  const getNotifIconBg = (notif) => {
    const type = notif.reference_type || notif.type || '';
    if (type.includes('announcement')) return 'bg-blue-100';
    if (type.includes('enrollment') || type.includes('enroll')) return 'bg-green-100';
    if (type.includes('distribution') || type.includes('benefit')) return 'bg-purple-100';
    if (type.includes('approval') || type.includes('approved')) return 'bg-emerald-100';
    if (type.includes('message')) return 'bg-indigo-100';
    return 'bg-blue-100';
  };

  // Filter notifications based on tab
  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  // Check if there are any items to show
  const hasAnyItems = (isAdmin || isStaff)
    ? (pendingApplications.length > 0 || pendingAssistance.length > 0 || unreadMessages > 0 || filteredNotifications.length > 0)
    : (unreadMessages > 0 || filteredNotifications.length > 0);

  const totalBadge = computeTotalBadge();

  // Generate initials for avatar
  const getInitials = () => {
    if (!user) return 'U';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  };

  const getUserRoleLabel = () => {
    if (!user) return '';
    if (user.role === 'admin') return 'Administrator';
    if (user.role === 'staff') return 'Barangay Staff';
    if (user.role === 'barangay') return 'Barangay Captain';
    if (user.role === 'beneficiary') return 'Beneficiary Member';
    return user.role;
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Search Input Bar (DSWD dashboard inspired) */}
      <div className="relative w-80 max-w-xs sm:max-w-md hidden sm:block">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400" />
        </span>
        <input
          type="text"
          placeholder="Search anything..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-700 outline-none transition focus:bg-white focus:border-dswd-lightBlue focus:ring-2 focus:ring-blue-100"
        />
        <kbd className="absolute right-3.5 top-2.5 hidden md:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 text-[9px] font-medium text-slate-400">
          ⌘K
        </kbd>
      </div>
      <div className="sm:hidden text-lg font-bold text-dswd-blue tracking-tight">
        DSWD EBMS
      </div>

      {/* Right Side Header Items */}
      <div className="flex items-center gap-5 ml-auto">
        {/* Notifications Bell with Dropdown */}
        <div className="relative">
          <button 
            ref={bellRef}
            onClick={toggleDropdown}
            className={`relative p-2 rounded-xl transition ${showDropdown ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'}`}
          >
            <Bell className="h-5 w-5" />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                {totalBadge > 99 ? '99+' : totalBadge}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-full mt-2 w-[400px] max-h-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50"
              style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.18)' }}
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-2 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-slate-900">Notifications</h3>
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 items-center">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                      activeTab === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveTab('unread')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                      activeTab === 'unread'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Unread
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto max-h-[390px] px-2 py-1" style={{ scrollbarWidth: 'thin' }}>
                {dropdownLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
                    <p className="text-xs text-slate-400 mt-3">Loading notifications...</p>
                  </div>
                ) : !hasAnyItems ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <Bell className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">No notifications yet</p>
                    <p className="text-xs text-slate-400 mt-1">You're all caught up! 🎉</p>
                  </div>
                ) : (
                  <>
                    {/* ━━━ Pending Beneficiary Applications (Admin only) ━━━ */}
                    {isAdmin && pendingApplications.length > 0 && (
                      <div className="py-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-2">
                          🔔 Pending Beneficiary Approvals ({pendingApplications.length})
                        </p>
                        {pendingApplications.slice(0, 5).map((app) => (
                          <button
                            key={`app-${app.id}`}
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } });
                            }}
                            className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-amber-50 transition text-left group"
                          >
                            <div className="flex-shrink-0">
                              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm relative">
                                <Users className="w-5 h-5 text-white" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center">
                                  <Clock className="w-2.5 h-2.5 text-white" />
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-slate-800 leading-snug">
                                <span className="font-bold">{app.first_name} {app.last_name}</span>
                                {' '}submitted a beneficiary application
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold">
                                  <Clock className="w-2.5 h-2.5" />
                                  {app.status}
                                </span>
                                <span className="text-[11px] text-slate-400">{timeAgo(app.createdAt)}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 mt-2">
                              <span className="w-3 h-3 rounded-full bg-amber-400 block animate-pulse" />
                            </div>
                          </button>
                        ))}
                        {pendingApplications.length > 5 && (
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/dashboard/beneficiaries?pending=true', { state: { openPending: true } });
                            }}
                            className="w-full text-center py-2 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          >
                            View all {pendingApplications.length} pending applications →
                          </button>
                        )}
                      </div>
                    )}

                    {/* ━━━ Pending Assistance Requests (Admin/Staff only) ━━━ */}
                    {(isAdmin || isStaff) && pendingAssistance.length > 0 && (
                      <div className="py-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-2">
                          🆘 Assistance Requests ({pendingAssistance.length})
                        </p>
                        {pendingAssistance.slice(0, 3).map((req) => (
                          <button
                            key={`assist-${req.id}`}
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/dashboard/assistance-requests');
                            }}
                            className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-rose-50 transition text-left group"
                          >
                            <div className="flex-shrink-0">
                              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-sm relative">
                                <HandHeart className="w-5 h-5 text-white" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center">
                                  <AlertCircle className="w-2.5 h-2.5 text-white" />
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-slate-800 leading-snug">
                                <span className="font-bold">
                                  {req.Beneficiary?.first_name || req.User?.first_name || 'Beneficiary'}{' '}
                                  {req.Beneficiary?.last_name || req.User?.last_name || ''}
                                </span>
                                {' '}requested <span className="font-semibold text-rose-600">{req.type}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {req.priority && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                    req.priority === 'Urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {req.priority}
                                  </span>
                                )}
                                <span className="text-[11px] text-slate-400">{timeAgo(req.createdAt)}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 mt-2">
                              <span className="w-3 h-3 rounded-full bg-rose-400 block animate-pulse" />
                            </div>
                          </button>
                        ))}
                        {pendingAssistance.length > 3 && (
                          <button
                            onClick={() => {
                              setShowDropdown(false);
                              navigate('/dashboard/assistance-requests');
                            }}
                            className="w-full text-center py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          >
                            View all {pendingAssistance.length} requests →
                          </button>
                        )}
                      </div>
                    )}

                    {/* ━━━ Unread Messages ━━━ */}
                    {unreadMessages > 0 && (
                      <div className="py-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-2">
                          💬 Messages
                        </p>
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            navigate('/dashboard/messages');
                          }}
                          className="w-full flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-indigo-50 transition text-left group"
                        >
                          <div className="flex-shrink-0">
                            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-sm relative">
                              <MessageSquare className="w-5 h-5 text-white" />
                              <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center">
                                <span className="text-[8px] font-bold text-white">{unreadMessages > 9 ? '9+' : unreadMessages}</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-slate-800 leading-snug">
                              You have <span className="font-bold text-indigo-600">{unreadMessages} unread message{unreadMessages > 1 ? 's' : ''}</span>
                            </p>
                            <p className="text-[11px] text-indigo-500 font-medium mt-0.5">
                              Tap to view your conversations
                            </p>
                          </div>
                          <div className="flex-shrink-0 mt-2">
                            <span className="w-3 h-3 rounded-full bg-indigo-400 block animate-pulse" />
                          </div>
                        </button>
                      </div>
                    )}

                    {/* ━━━ System Notifications ━━━ */}
                    {filteredNotifications.length > 0 && (
                      <div className="py-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-2">
                          📋 System Notifications
                        </p>
                        {filteredNotifications.slice(0, 10).map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() => {
                              if (!notif.is_read) {
                                handleMarkAsRead(notif.id, { stopPropagation: () => {} });
                              }
                              setShowDropdown(false);
                              navigate('/dashboard/notifications');
                            }}
                            className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl transition text-left group ${
                              notif.is_read ? 'hover:bg-slate-50' : 'bg-blue-50/60 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              <div className={`h-11 w-11 rounded-full ${getNotifIconBg(notif)} flex items-center justify-center`}>
                                {getNotifIcon(notif)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] leading-snug ${notif.is_read ? 'text-slate-500' : 'text-slate-800 font-medium'}`}>
                                {notif.message?.length > 90
                                  ? notif.message.substring(0, 90) + '...'
                                  : notif.message || 'New notification'}
                              </p>
                              <p className={`text-[11px] mt-0.5 ${notif.is_read ? 'text-slate-400' : 'text-blue-500 font-medium'}`}>
                                {timeAgo(notif.created_at)}
                              </p>
                            </div>
                            {!notif.is_read && (
                              <div className="flex-shrink-0 mt-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500 block" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer - See All */}
              <div className="border-t border-slate-100 p-2">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/dashboard/notifications');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition"
                >
                  See all notifications
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Moon Icon */}
        <button className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition">
          <Moon className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {/* User Details & Avatar */}
        <div className="flex items-center gap-3">
          {/* Avatar (CSS styled as circular letter block or fallback) */}
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-dswd-blue to-dswd-lightBlue text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-slate-100 uppercase">
            {getInitials()}
          </div>
          <div className="hidden md:block text-left">
            <span className="text-sm font-bold text-slate-900 block leading-tight">
              {user ? `${user.first_name} ${user.last_name}` : 'Guest User'}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5">
              {getUserRoleLabel()}
            </span>
          </div>
          <button className="text-slate-400 hover:text-slate-600 transition">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

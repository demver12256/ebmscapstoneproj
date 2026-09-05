import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Megaphone,
  User,
  Check,
  RefreshCw,
  Info,
  Filter,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { announcementApi, notificationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('announcements'); // 'announcements' or 'notifications'

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await announcementApi.list();
      let list = res.data?.data || [];
      if (user?.role === 'mswdo_admin') {
        list = list.filter((a) => a.created_by_user_id === user.id || a.notify_mswdo);
      }
      setAnnouncements(list);
    } catch (err) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setNotifications(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    fetchNotifications();
  }, [fetchAnnouncements, fetchNotifications]);

  const handleMarkAnnouncementAsRead = async (annId) => {
    try {
      await announcementApi.markAsRead(annId);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === annId ? { ...a, is_read: true, read_at: new Date().toISOString() } : a))
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.reference_id === annId && isAnnouncementItem(n) ? { ...n, is_read: true } : n
        )
      );
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  const handleMarkNotificationAsRead = async (notifId, refId = null) => {
    try {
      await notificationApi.markAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      if (refId) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === refId ? { ...a, is_read: true, read_at: new Date().toISOString() } : a))
        );
      }
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setAnnouncements((prev) => prev.map((a) => ({ ...a, is_read: true, read_at: new Date().toISOString() })));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Helper to identify whether a notification belongs to Announcements vs System
  const isAnnouncementItem = (item) => {
    if (!item) return false;
    const refType = String(item.reference_type || '').toLowerCase();
    const type = String(item.type || '').toLowerCase();
    const title = String(item.title || '').toLowerCase();
    return (
      refType.startsWith('announcement') ||
      refType === 'event' ||
      type === 'announcement' ||
      title.includes('📢') ||
      title.toLowerCase().startsWith('absent:')
    );
  };

  // Pure system notifications (assistance, applications, distributions, profile/account notices)
  const systemNotifications = notifications.filter((n) => !isAnnouncementItem(n));

  // Announcement-related notifications (absence alerts, staff assignments, mswdo notices, etc.)
  const announcementNotifs = notifications.filter((n) => isAnnouncementItem(n));

  // Absence notices (attendance warning notifications)
  const absenceNotifs = announcementNotifs.filter((n) => n.reference_type === 'announcement_absence');

  // Other standalone announcement notices not already covered by a rich announcement
  const otherAnnouncementNotifs = announcementNotifs.filter(
    (n) => n.reference_type !== 'announcement_absence' && !announcements.some((a) => a.id === n.reference_id)
  );

  // Total Event Announcement items count & unread count
  const totalEventItemsCount = announcements.length + absenceNotifs.length + otherAnnouncementNotifs.length;

  const unreadAnnouncementsCount = announcements.filter((a) => !a.is_read).length;
  const unreadAbsenceNotifsCount = absenceNotifs.filter((n) => !n.is_read).length;
  const unreadOtherNotifsCount = otherAnnouncementNotifs.filter((n) => !n.is_read).length;
  const unreadEventAnnouncementsCount = unreadAnnouncementsCount + unreadAbsenceNotifsCount + unreadOtherNotifsCount;

  const unreadSystemNotificationCount = systemNotifications.filter((n) => !n.is_read).length;
  const totalUnread = unreadEventAnnouncementsCount + unreadSystemNotificationCount;

  // Filtered lists by activeTab ('all', 'unread', 'read')
  const filteredAnnouncements = announcements.filter((a) => {
    if (activeTab === 'unread') return !a.is_read;
    if (activeTab === 'read') return a.is_read;
    return true;
  });

  const filteredAbsenceNotifs = absenceNotifs.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'read') return n.is_read;
    return true;
  });

  const filteredOtherNotifs = otherAnnouncementNotifs.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'read') return n.is_read;
    return true;
  });

  const filteredSystemNotifications = systemNotifications.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'read') return n.is_read;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-yellow-300 animate-bounce" />
            <h1 className="text-3xl font-black tracking-tight">Notifications & Announcements</h1>
          </div>
          <p className="text-blue-100 text-sm">
            Official municipal communications, absence notifications, and RFID attendance records.
          </p>
        </div>

        {totalUnread > 0 && (
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-yellow-400 text-slate-950 font-black px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              <span>{totalUnread} Unread</span>
            </div>
            <button
              onClick={handleMarkAllAsRead}
              className="bg-white/20 hover:bg-white/30 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-2 transition backdrop-blur-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Mark All Read</span>
            </button>
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        <button
          onClick={() => setViewMode('announcements')}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
            viewMode === 'announcements' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>📢 Event Announcements ({totalEventItemsCount})</span>
          {unreadEventAnnouncementsCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
              {unreadEventAnnouncementsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode('notifications')}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
            viewMode === 'notifications' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>🔔 System Notifications ({systemNotifications.length})</span>
          {unreadSystemNotificationCount > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
              {unreadSystemNotificationCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'all' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({viewMode === 'announcements' ? totalEventItemsCount : systemNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'unread' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unread ({viewMode === 'announcements' ? unreadEventAnnouncementsCount : unreadSystemNotificationCount})
          </button>
          <button
            onClick={() => setActiveTab('read')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'read' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Read
          </button>
        </div>

        <div className="flex items-center gap-2">
          {totalUnread > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-1.5 text-xs font-bold text-dswd-blue hover:bg-blue-50 rounded-lg transition flex items-center gap-1.5"
              title="Mark All as Read"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
          <button
            onClick={() => {
              fetchAnnouncements();
              fetchNotifications();
            }}
            className="p-2 text-slate-500 hover:text-dswd-blue rounded-lg hover:bg-slate-100 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-dswd-blue" />
          <p className="font-semibold text-sm">Loading...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-bold text-sm">{error}</p>
        </div>
      ) : viewMode === 'notifications' ? (
        /* SYSTEM NOTIFICATIONS VIEW */
        filteredSystemNotifications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-800 text-lg">No System Notifications</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up! No system alerts at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSystemNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`bg-white border rounded-2xl p-5 transition shadow-sm ${
                  !notif.is_read
                    ? 'border-red-300 ring-2 ring-red-500/20 bg-gradient-to-r from-red-50/40 via-white to-white'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    notif.type === 'distribution' 
                      ? 'bg-emerald-100' 
                      : notif.type === 'assistance'
                      ? 'bg-purple-100'
                      : 'bg-blue-100'
                  }`}>
                    {notif.type === 'distribution' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <Bell className="w-6 h-6 text-blue-600" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-black text-slate-900 text-lg">{notif.title}</h3>
                      {!notif.is_read && (
                        <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">{notif.message}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {new Date(notif.created_at || notif.createdAt).toLocaleString()}
                      </span>

                      {!notif.is_read && (
                        <button
                          onClick={() => handleMarkNotificationAsRead(notif.id)}
                          className="flex items-center gap-1.5 bg-dswd-blue hover:bg-blue-800 text-white font-bold px-3 py-1 rounded-lg text-xs transition"
                        >
                          <Check className="w-3 h-3" />
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* EVENT ANNOUNCEMENTS VIEW */
        filteredAnnouncements.length === 0 && filteredAbsenceNotifs.length === 0 && filteredOtherNotifs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-800 text-lg">No Announcements Here</p>
            <p className="text-xs text-slate-500 mt-1">You're all caught up! Check back later for official updates.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Absence Notices */}
            {filteredAbsenceNotifs.map((notif) => (
              <div
                key={`absence-${notif.id}`}
                className={`bg-white border rounded-2xl p-5 transition shadow-sm relative overflow-hidden ${
                  !notif.is_read
                    ? 'border-red-300 ring-2 ring-red-500/20 bg-gradient-to-r from-red-50/50 via-white to-white'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-red-100 shrink-0">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-md text-xs border border-red-300 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          RFID ATTENDANCE ABSENCE NOTICE
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(notif.created_at || notif.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {!notif.is_read && (
                        <span className="bg-red-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>

                    <h3 className="font-black text-slate-900 text-lg">{notif.title}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{notif.message}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {new Date(notif.created_at || notif.createdAt).toLocaleString()}
                      </span>

                      {!notif.is_read ? (
                        <button
                          onClick={() => handleMarkNotificationAsRead(notif.id, notif.reference_id)}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition"
                        >
                          <Check className="w-3 h-3" />
                          Mark as Read
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Acknowledged</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Other Announcement Notices (e.g. Staff/MSWDO Notices) */}
            {filteredOtherNotifs.map((notif) => (
              <div
                key={`other-ann-${notif.id}`}
                className={`bg-white border rounded-2xl p-5 transition shadow-sm relative overflow-hidden ${
                  !notif.is_read
                    ? 'border-blue-300 ring-2 ring-blue-500/20 bg-gradient-to-r from-blue-50/50 via-white to-white'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-blue-100 shrink-0">
                    <Megaphone className="w-6 h-6 text-blue-600" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-md text-xs border border-blue-300 flex items-center gap-1">
                          <Megaphone className="w-3.5 h-3.5 text-blue-600" />
                          OFFICIAL ACTIVITY NOTICE
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(notif.created_at || notif.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {!notif.is_read && (
                        <span className="bg-blue-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>

                    <h3 className="font-black text-slate-900 text-lg">{notif.title}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{notif.message}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {new Date(notif.created_at || notif.createdAt).toLocaleString()}
                      </span>

                      {!notif.is_read ? (
                        <button
                          onClick={() => handleMarkNotificationAsRead(notif.id, notif.reference_id)}
                          className="flex items-center gap-1.5 bg-dswd-blue hover:bg-blue-800 text-white font-bold px-3 py-1 rounded-lg text-xs transition"
                        >
                          <Check className="w-3 h-3" />
                          Mark as Read
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Read</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className={`bg-white border rounded-2xl p-6 transition shadow-sm relative overflow-hidden ${
                  !ann.is_read
                    ? 'border-blue-300 ring-2 ring-blue-500/20 bg-gradient-to-r from-blue-50/40 via-white to-white'
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {!ann.is_read && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm">
                    NEW UNREAD ANNOUNCEMENT
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4 pr-16">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ann.priority === 'Urgent' ? (
                          <span className="bg-red-100 text-red-800 font-black px-2.5 py-0.5 rounded-md text-xs border border-red-300">
                            🔴 URGENT
                          </span>
                        ) : ann.priority === 'High' ? (
                          <span className="bg-orange-100 text-orange-800 font-bold px-2.5 py-0.5 rounded-md text-xs border border-orange-200">
                            🟠 HIGH PRIORITY
                          </span>
                        ) : ann.priority === 'Medium' ? (
                          <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-md text-xs border border-blue-200">
                            🔵 MEDIUM PRIORITY
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-md text-xs">
                            ⚪ NOTICE
                          </span>
                        )}

                        {/* RFID Attendance Status Badge for Beneficiary */}
                        {ann.attendance_status === 'Present' ? (
                          <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-md text-xs border border-emerald-300 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            ATTENDANCE CONFIRMED PRESENT
                          </span>
                        ) : ann.attendance_status === 'Absent' ? (
                          <span className="bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-md text-xs border border-red-300 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            MARKED ABSENT
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-md text-xs border border-amber-200">
                            ⏱️ ATTENDANCE PENDING
                          </span>
                        )}

                        <span className="text-xs text-slate-400">
                          Posted: {new Date(ann.created_at || ann.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-900 pt-1 leading-snug">{ann.title}</h3>
                    </div>
                  </div>

                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 text-sm text-slate-800 leading-relaxed font-medium">
                    {ann.message}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-slate-700">
                    {ann.event_date ? (
                      <div className="flex items-center gap-2 font-bold text-blue-950">
                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Date: {ann.event_date}</span>
                      </div>
                    ) : null}

                    {ann.event_time ? (
                      <div className="flex items-center gap-2 font-bold text-blue-950">
                        <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Time: {ann.event_time}</span>
                      </div>
                    ) : null}

                    {ann.venue ? (
                      <div className="flex items-center gap-2 font-bold text-red-950 md:col-span-1">
                        <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="truncate">Venue: {ann.venue}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 font-bold flex items-center gap-2">
                    <span>💳 Instruction: Bring your RFID card for your Attendance.</span>
                  </div>

                  {/* Attendance verification info */}
                  {ann.attendance_status === 'Present' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Your RFID card was successfully scanned at this event.</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-emerald-700">
                        Scanned at: {ann.scanned_at ? new Date(ann.scanned_at).toLocaleString() : 'Present'}
                      </span>
                    </div>
                  )}

                  {ann.attendance_status === 'Absent' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>You were marked absent for this event. Please contact the municipal office for more information.</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Administrator: <strong className="text-slate-700">{ann.CreatedBy?.first_name || 'Admin'} {ann.CreatedBy?.last_name || ''}</strong></span>
                    </div>

                    {!ann.is_read ? (
                      <button
                        onClick={() => handleMarkAnnouncementAsRead(ann.id)}
                        className="flex items-center gap-1.5 bg-dswd-blue hover:bg-blue-800 text-white font-bold px-4 py-2 rounded-xl transition shadow-sm active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        Mark as Read
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Read {ann.read_at ? new Date(ann.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

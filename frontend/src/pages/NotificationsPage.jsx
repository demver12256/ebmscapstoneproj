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
} from 'lucide-react';
import { announcementApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await announcementApi.list();
      setAnnouncements(res.data?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleMarkAsRead = async (annId) => {
    try {
      await announcementApi.markAsRead(annId);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === annId ? { ...a, is_read: true, read_at: new Date().toISOString() } : a))
      );
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (activeTab === 'unread') return !a.is_read;
    if (activeTab === 'read') return a.is_read;
    return true;
  });

  const unreadCount = announcements.filter((a) => !a.is_read).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-yellow-300 animate-bounce" />
            <h1 className="text-3xl font-black tracking-tight">Announcements & Event Attendance</h1>
          </div>
          <p className="text-blue-100 text-sm">
            Official municipal communications and RFID attendance records tailored for your program and barangay.
          </p>
        </div>

        {unreadCount > 0 && (
          <div className="bg-yellow-400 text-slate-950 font-black px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-2 self-start md:self-auto">
            <Megaphone className="w-4 h-4" />
            <span>{unreadCount} Unread Announcement{unreadCount > 1 ? 's' : ''}</span>
          </div>
        )}
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
            All Announcements ({announcements.length})
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'unread' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setActiveTab('read')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'read' ? 'bg-dswd-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Read ({announcements.length - unreadCount})
          </button>
        </div>

        <button
          onClick={fetchAnnouncements}
          className="p-2 text-slate-500 hover:text-dswd-blue rounded-lg hover:bg-slate-100 transition"
          title="Refresh announcements"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-dswd-blue" />
          <p className="font-semibold text-sm">Loading your announcements...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-bold text-sm">{error}</p>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800 text-lg">No Announcements Here</p>
          <p className="text-xs text-slate-500 mt-1">You're all caught up! Check back later for official updates.</p>
        </div>
      ) : (
        <div className="space-y-4">
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

                <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Administrator: <strong className="text-slate-700">{ann.CreatedBy?.first_name || 'Admin'} {ann.CreatedBy?.last_name || ''}</strong></span>
                  </div>

                  {!ann.is_read ? (
                    <button
                      onClick={() => handleMarkAsRead(ann.id)}
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
      )}
    </div>
  );
}

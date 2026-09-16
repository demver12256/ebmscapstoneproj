import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  Check,
  MapPin,
  Calendar,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { announcementApi } from '../services/api';

// Helper to determine if announcement is active for attendance recording
const isAnnouncementActiveForAttendance = (ann) => {
  if (!ann) return false;
  if (ann.status === 'completed' || ann.status === 'archived') return false;
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

export default function RfidAnnouncementAttendanceModal({ announcement, onClose, onRefresh }) {
  const [rfidInput, setRfidInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null); // { status: 'success'|'rejected'|'duplicate', message, beneficiary, timestamp }
  const isEnded = !isAnnouncementActiveForAttendance(announcement);
  const [stats, setStats] = useState({
    total_expected: announcement?.recipient_count || 0,
    total_present: announcement?.present_count || 0,
    total_absent: (announcement?.recipient_count || 0) - (announcement?.present_count || 0),
    percentage: 0,
  });
  const [recentAttendees, setRecentAttendees] = useState([]);
  const rfidInputRef = useRef(null);

  // Auto-focus input for RFID scanner
  useEffect(() => {
    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  }, []);

  // Fetch initial stats & attendees
  const fetchAttendanceStats = async () => {
    if (!announcement?.id) return;
    try {
      const res = await announcementApi.getAttendanceStats(announcement.id);
      const data = res.data?.data;
      if (data) {
        setStats(data.stats);
        setRecentAttendees(data.present_attendees || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendance stats:', err);
    }
  };

  useEffect(() => {
    fetchAttendanceStats();
  }, [announcement?.id]);

  // Handle RFID Submit / Hardware scan
  const handleScanSubmit = async (e) => {
    e.preventDefault();
    if (isEnded) {
      setLastScanResult({
        status: 'rejected',
        message: `BAWAL NA ANG ATTENDANCE: Ang aktibidad na "${announcement?.title}" ay tapos na. Hindi na maaaring magtala ng attendance ang staff.`,
        beneficiary: null,
        timestamp: new Date().toLocaleTimeString(),
      });
      return;
    }

    if (!rfidInput.trim()) return;

    const scannedCode = rfidInput.trim();
    setRfidInput('');
    setScanLoading(true);

    try {
      const res = await announcementApi.scanRfid(announcement.id, {
        RFID_number: scannedCode,
      });

      const data = res.data;
      setLastScanResult({
        status: 'success',
        message: data.message,
        beneficiary: data.beneficiary,
        timestamp: new Date().toLocaleTimeString(),
      });

      if (data.stats) {
        setStats(data.stats);
      }

      fetchAttendanceStats();
      if (onRefresh) onRefresh();
    } catch (err) {
      const errorMsg = err.message || err.data?.message || 'Attendance scan failed';
      const beneficiary = err.data?.beneficiary || null;

      if (err.status === 409 || errorMsg.includes('DUPLICATE')) {
        setLastScanResult({
          status: 'duplicate',
          message: errorMsg,
          beneficiary,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setLastScanResult({
          status: 'rejected',
          message: errorMsg,
          beneficiary,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } finally {
      setScanLoading(false);
      if (rfidInputRef.current) {
        rfidInputRef.current.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden my-6 border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isEnded ? 'bg-red-500 text-white' : 'bg-yellow-400 text-slate-950'}`}>
              <Smartphone className={`w-6 h-6 ${isEnded ? '' : 'animate-pulse'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-[10px] uppercase px-2 py-0.5 rounded ${
                  isEnded ? 'bg-red-500/30 text-red-200' : 'bg-yellow-400/20 text-yellow-300'
                }`}>
                  {isEnded ? 'ATTENDANCE ISINARA NA' : 'LIVE RFID ATTENDANCE SCANNER'}
                </span>
                <span className="text-xs text-blue-200">• Activity Facilitation</span>
              </div>
              <h2 className="font-black text-xl leading-tight">{announcement?.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Subheader event details */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-700 font-semibold shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {announcement?.event_date && (
              <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Date: {announcement.event_date} {announcement.event_time && `at ${announcement.event_time}`}</span>
              </div>
            )}
            {announcement?.venue && (
              <div className="flex items-center gap-1.5 text-red-900">
                <MapPin className="w-4 h-4 text-red-600" />
                <span>Venue: {announcement.venue}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Facility Status:</span>
            {isEnded ? (
              <span className="bg-red-100 text-red-800 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                ATTENDANCE CLOSED (TAPOS NA)
              </span>
            ) : (
              <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                ATTENDANCE ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Closed Announcement Notice Banner */}
        {isEnded && (
          <div className="bg-red-50 border-b-2 border-red-300 px-6 py-3.5 flex items-center gap-3 text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-xs">
              <strong className="font-bold text-red-950">⛔ BAWAL NA ANG ATTENDANCE (Tapos na ang Aktibidad):</strong>{' '}
              Ang aktibidad na ito ay nagwakas na noong <strong>{announcement?.event_date || 'nakaraang petsa'}</strong>.
              Ayon sa patakaran ng sistema, <strong>hindi na pinahihintulutan ang staff na magtala ng attendance</strong> matapos ang pagtatapos ng anunsyo.
            </div>
          </div>
        )}

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
          {/* Scanner Input & Result Column (Left 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* RFID Hardware Scanner Box */}
            <div className={`text-white rounded-2xl p-6 shadow-md border space-y-4 ${
              isEnded ? 'bg-gradient-to-br from-slate-900 to-red-950 border-red-900' : 'bg-gradient-to-br from-slate-900 to-indigo-950 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className={`w-5 h-5 ${isEnded ? 'text-red-400' : 'text-yellow-400'}`} />
                  <label className={`text-sm font-black uppercase tracking-wider ${isEnded ? 'text-red-300' : 'text-yellow-300'}`}>
                    {isEnded ? 'Scanner Closed' : 'Scan Beneficiary RFID Card'}
                  </label>
                </div>
                <span className={`text-[11px] font-semibold ${isEnded ? 'text-red-300' : 'text-slate-400'}`}>
                  {isEnded ? 'Attendance Closed' : 'Card Reader Ready'}
                </span>
              </div>

              <form onSubmit={handleScanSubmit} className="relative">
                <input
                  ref={rfidInputRef}
                  type="text"
                  placeholder={isEnded ? "Sarado na ang attendance para sa tapos nang event..." : "Tap RFID Card or enter Beneficiary ID Code..."}
                  value={rfidInput}
                  onChange={(e) => setRfidInput(e.target.value)}
                  disabled={scanLoading || isEnded}
                  className={`w-full pl-4 pr-24 py-3.5 bg-slate-800/90 border-2 rounded-xl text-white font-mono text-base tracking-wider focus:outline-none transition ${
                    isEnded
                      ? 'border-red-500/50 cursor-not-allowed text-slate-400 placeholder:text-red-300/60'
                      : 'border-yellow-400/60 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 placeholder:text-slate-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={scanLoading || !rfidInput.trim() || isEnded}
                  className={`absolute right-2 top-2 bottom-2 font-black px-4 rounded-lg transition disabled:opacity-50 text-xs flex items-center gap-1 ${
                    isEnded
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-yellow-400 hover:bg-yellow-500 text-slate-950'
                  }`}
                >
                  {scanLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : isEnded ? 'Sarado' : 'Record'}
                </button>
              </form>

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${isEnded ? 'text-red-400' : 'text-emerald-400'}`} />
                {isEnded
                  ? 'Hindi na maaaring gamitin ang physical scanner para sa tapos nang anunsyong ito.'
                  : 'Tap beneficiary RFID card on physical scanner. System automatically validates program enrollment and barangay assignment.'}
              </p>
            </div>

            {/* SCAN RESULT FEEDBACK DISPLAY */}
            {lastScanResult ? (
              <div>
                {lastScanResult.status === 'success' && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-2xl p-5 shadow-lg animate-fade-in space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> ATTENDANCE RECORDED PRESENT
                      </span>
                      <span className="text-xs text-emerald-700 font-bold">{lastScanResult.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      {lastScanResult.beneficiary?.profile_photo ? (
                        <img
                          src={lastScanResult.beneficiary.profile_photo}
                          alt="Beneficiary"
                          className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-emerald-200 text-emerald-900 font-black text-2xl flex items-center justify-center border-2 border-emerald-400">
                          {lastScanResult.beneficiary?.first_name?.[0] || 'B'}
                        </div>
                      )}

                      <div className="space-y-1">
                        <h4 className="text-xl font-black text-slate-900">
                          {lastScanResult.beneficiary?.first_name} {lastScanResult.beneficiary?.last_name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold flex-wrap">
                          <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded">
                            ID: {lastScanResult.beneficiary?.beneficiary_id_code}
                          </span>
                          <span>Barangay: {lastScanResult.beneficiary?.barangay_name}</span>
                          {lastScanResult.beneficiary?.category && (
                            <span className="text-slate-500">• Category: {lastScanResult.beneficiary.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {lastScanResult.status === 'duplicate' && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-5 shadow-lg animate-fade-in space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      <span>DUPLICATE SCAN PREVENTED</span>
                    </div>
                    <p className="text-xs text-amber-800 font-bold">{lastScanResult.message}</p>
                  </div>
                )}

                {lastScanResult.status === 'rejected' && (
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-400 rounded-2xl p-5 shadow-lg animate-fade-in space-y-2">
                    <div className="flex items-center gap-2 text-red-900 font-black text-sm">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span>ATTENDANCE REJECTED</span>
                    </div>
                    <p className="text-xs text-red-800 font-extrabold">{lastScanResult.message}</p>
                    <p className="text-[11px] text-red-600">
                      Reason: Beneficiary is either not enrolled in the selected program or belongs to a non-targeted barangay.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                <Smartphone className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-bold text-slate-600 text-sm">Ready to scan RFID cards</p>
                <p className="text-xs">Scan beneficiary cards as they enter the meeting venue.</p>
              </div>
            )}
          </div>

          {/* Stats & Attendees Stream (Right 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Progress Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Attendance Progress</span>
                <span className="text-xl font-black text-dswd-blue">{stats.percentage}%</span>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5">
                  <span className="text-[10px] font-bold text-blue-800 uppercase block">Expected</span>
                  <span className="text-xl font-black text-blue-950">{stats.total_expected}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Present</span>
                  <span className="text-xl font-black text-emerald-950">{stats.total_present}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Absent</span>
                  <span className="text-xl font-black text-slate-700">{stats.total_absent}</span>
                </div>
              </div>
            </div>

            {/* Scanned Attendees Stream */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-700">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>Present Attendees ({recentAttendees.length})</span>
                </div>
                <button onClick={fetchAttendanceStats} className="text-slate-400 hover:text-dswd-blue transition">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentAttendees.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">No beneficiaries scanned present yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {recentAttendees.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {att.Beneficiary?.first_name} {att.Beneficiary?.last_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {att.Beneficiary?.beneficiary_id_code} • {att.Beneficiary?.Barangay?.barangay_name}
                        </p>
                      </div>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {att.scanned_at ? new Date(att.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Present'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

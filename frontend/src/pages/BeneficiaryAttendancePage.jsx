import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MapPin,
  User,
  Search,
  RefreshCw,
  Printer,
  AlertTriangle,
  CreditCard,
  Building2,
  Check,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { announcementApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BeneficiaryAttendancePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Present', 'Absent', 'Pending'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await announcementApi.myAttendance();
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Hindi ma-load ang attendance records.');
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
      setError(err.response?.data?.message || err.message || 'Error habang kinukuha ang attendance data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const beneficiary = data?.beneficiary || {};
  const stats = data?.stats || {
    total_meetings: 0,
    present_count: 0,
    absent_count: 0,
    pending_count: 0,
    compliance_rate: 100,
  };
  const records = data?.records || [];

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesStatus =
        statusFilter === 'all' ? true : rec.attendance_status === statusFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rec.title?.toLowerCase().includes(q) ||
        rec.venue?.toLowerCase().includes(q) ||
        rec.event_date?.toLowerCase().includes(q) ||
        (Array.isArray(rec.target_programs) &&
          rec.target_programs.some((p) => String(p).toLowerCase().includes(q)));

      return matchesStatus && matchesSearch;
    });
  }, [records, statusFilter, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 print:p-0 print:m-0 print:max-w-none">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-dswd-blue via-blue-900 to-indigo-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden print:bg-white print:text-slate-900 print:shadow-none print:border-b-2 print:border-slate-300 print:rounded-none">
        {/* Subtle Background Glow */}
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <CalendarCheck className="w-7 h-7 text-yellow-300" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                  Meeting Attendance & RFID Records
                </h1>
                <p className="text-blue-100 text-xs md:text-sm font-medium">
                  Opisyal na talaan ng iyong pagdalo sa mga pulong, assemblies, at orientations.
                </p>
              </div>
            </div>

            {/* Beneficiary Meta Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <div className="bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-200" />
                <span>{beneficiary.first_name} {beneficiary.last_name}</span>
              </div>

              {beneficiary.RFID_number && (
                <div className="bg-emerald-500/25 border border-emerald-400/40 text-emerald-100 px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 font-mono shadow-sm">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-300" />
                  <span>RFID: {beneficiary.RFID_number}</span>
                </div>
              )}

              {beneficiary.category && (
                <div className="bg-yellow-400/20 border border-yellow-300/30 text-yellow-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
                  <span>{beneficiary.category}</span>
                </div>
              )}

              {beneficiary.barangay && (
                <div className="bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-200" />
                  <span>Brgy. {beneficiary.barangay}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition flex items-center gap-2 backdrop-blur-sm border border-white/20 active:scale-95"
              title="I-print ang Attendance Record"
            >
              <Printer className="w-4 h-4" />
              <span>Print Record</span>
            </button>
            <button
              onClick={() => fetchAttendance(true)}
              disabled={refreshing}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-md transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
              title="I-refresh ang Attendance Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Rate Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
            <div className={`p-2 rounded-xl ${stats.compliance_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : stats.compliance_rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.compliance_rate}%</span>
            <span className="text-[11px] font-semibold text-slate-400">
              {stats.compliance_rate >= 85 ? 'Matatag na Pagsunod' : 'Kailangan Paunlarin'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                stats.compliance_rate >= 80
                  ? 'bg-emerald-500'
                  : stats.compliance_rate >= 50
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, stats.compliance_rate))}%` }}
            />
          </div>
        </div>

        {/* Present Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dinaluhan (Present)</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{stats.present_count}</span>
            <span className="text-xs text-slate-400 font-semibold">pulong dinaluhan</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium">
            Opisyal na na-scan gamit ang RFID card
          </p>
        </div>

        {/* Absent Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hindi Nadalo (Absent)</span>
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-600">{stats.absent_count}</span>
            <span className="text-xs text-slate-400 font-semibold">pulong hindi dinaluhan</span>
          </div>
          <p className="text-[11px] text-red-600 font-medium">
            Walang naitalang RFID scan sa itinakdang oras
          </p>
        </div>

        {/* Pending Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nakatakda (Pending)</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{stats.pending_count}</span>
            <span className="text-xs text-slate-400 font-semibold">paparating na pulong</span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium">
            Dalhin ang RFID card pagpunta sa venue
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              statusFilter === 'all'
                ? 'bg-dswd-blue text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Lahat ({stats.total_meetings})
          </button>
          <button
            onClick={() => setStatusFilter('Present')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'Present'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            Present ({stats.present_count})
          </button>
          <button
            onClick={() => setStatusFilter('Absent')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'Absent'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Absent ({stats.absent_count})
          </button>
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              statusFilter === 'Pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending ({stats.pending_count})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Maghanap ng pulong o venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-dswd-blue transition"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-500 shadow-sm">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-3 text-dswd-blue" />
          <p className="font-bold text-base text-slate-800">Kinukuha ang iyong attendance records...</p>
          <p className="text-xs text-slate-400 mt-1">Pakihintay habang kinukuha ang opisyal na talaan sa DSWD server.</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center text-red-800 shadow-sm space-y-2">
          <AlertTriangle className="w-10 h-10 mx-auto text-red-600" />
          <p className="font-black text-lg">{error}</p>
          <button
            onClick={() => fetchAttendance(false)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
          >
            Subukan Muli
          </button>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-500 shadow-sm space-y-3">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <CalendarCheck className="w-8 h-8" />
          </div>
          <div>
            <p className="font-black text-slate-800 text-lg">Walang Nahanap na Attendance Records</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {statusFilter !== 'all' || searchQuery
                ? 'Walang meeting na tumutugma sa iyong napiling filter o search keyword.'
                : 'Kasalukuyang wala pang nakatakdang opisyal na pagpupulong para sa iyong barangay at kategorya.'}
            </p>
          </div>
          {(statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition"
            >
              I-clear ang Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((meeting) => {
            const isPresent = meeting.attendance_status === 'Present';
            const isAbsent = meeting.attendance_status === 'Absent';
            const isPending = meeting.attendance_status === 'Pending';

            return (
              <div
                key={`meeting-${meeting.id}`}
                className={`bg-white border rounded-2xl p-6 shadow-sm transition relative overflow-hidden ${
                  isPresent
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : isAbsent
                    ? 'border-red-200 hover:border-red-300'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Status Indicator Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isPresent
                      ? 'bg-emerald-500'
                      : isAbsent
                      ? 'bg-red-500'
                      : 'bg-amber-400'
                  }`}
                />

                <div className="space-y-4">
                  {/* Top Row: Tags and Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status Badge */}
                      {isPresent ? (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>ATTENDANCE CONFIRMED (PRESENT)</span>
                        </span>
                      ) : isAbsent ? (
                        <span className="bg-red-100 text-red-900 border border-red-300 font-black px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 shadow-sm">
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>MARKED ABSENT</span>
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-900 border border-amber-300 font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 shadow-sm">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>ATTENDANCE PENDING (UPCOMING)</span>
                        </span>
                      )}

                      {/* Target Program Category Pill */}
                      {Array.isArray(meeting.target_programs) &&
                        meeting.target_programs.map((prog, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-50 text-blue-900 border border-blue-200 font-semibold px-2.5 py-0.5 rounded-lg text-[11px]"
                          >
                            {prog}
                          </span>
                        ))}
                    </div>

                    {/* Date Tag */}
                    <span className="text-xs text-slate-400 font-medium">
                      Nilikha noong: {new Date(meeting.created_at || meeting.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Meeting Title & Description */}
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
                      {meeting.title}
                    </h2>
                    {meeting.message && (
                      <p className="text-sm text-slate-600 mt-2 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                        {meeting.message}
                      </p>
                    )}
                  </div>

                  {/* Schedule & Venue Details Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 text-xs text-slate-700">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Petsa: {meeting.event_date || 'Nakatakda'}</span>
                    </div>

                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Oras: {meeting.event_time || 'N/A'} {meeting.end_time ? `- ${meeting.end_time}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-bold text-slate-900 sm:col-span-1 truncate">
                      <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                      <span className="truncate">Venue: {meeting.venue || 'Municipal/Barangay Hall'}</span>
                    </div>
                  </div>

                  {/* Verification Status Details Container */}
                  {isPresent && (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold">Matagumpay na na-scan ang iyong RFID Card!</p>
                          <p className="text-emerald-700 text-[11px] mt-0.5">
                            Naitala ang iyong personal na pagdalo sa opisyal na listahan para sa programang ito.
                          </p>
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        <span className="font-mono text-[11px] font-black text-emerald-800 block">
                          Scanned: {meeting.scanned_at ? new Date(meeting.scanned_at).toLocaleString() : 'Present'}
                        </span>
                        {meeting.ScannedByStaff && (
                          <span className="text-[10px] text-emerald-700 font-medium block">
                            Staff: {meeting.ScannedByStaff.first_name} {meeting.ScannedByStaff.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isAbsent && (
                    <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-950">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1.5 bg-red-100 text-red-700 rounded-lg shrink-0">
                          <XCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold">Hindi naitala ang iyong pagdalo sa aktibidad na ito.</p>
                          <p className="text-red-700 text-[11px] mt-0.5">
                            Kung mayroon kang balidong dahilan (hal. medikal o emerhensiya), mangyaring makipag-ugnayan sa iyong Barangay Staff upang makapagsumite ng justification.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isPending && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold">Paparating na Pulong — Magdala ng RFID Card</p>
                          <p className="text-amber-800 text-[11px] mt-0.5">
                            Pumunta sa venue bago magsimula ang oras upang mai-tap ang iyong RFID card sa scanner ng Barangay Staff.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RFID Guidelines & Advisory Card */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3 print:hidden">
        <div className="flex items-center gap-2 text-dswd-blue font-bold text-sm">
          <Info className="w-4 h-4 text-blue-600" />
          <span>Gabay sa Paggamit ng RFID Card para sa Attendance</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-black text-slate-800 block">1. Dalhin ang RFID Card</span>
            <p>Huwag kalimutang dalhin ang iyong opisyal na BeniAid RFID card sa bawat assembly, FDS, at consultation.</p>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-black text-slate-800 block">2. I-tap sa Scanner</span>
            <p>I-tap ang card sa RFID scanner ng nakatalagang Barangay Staff sa entrada ng venue upang maitalang Present.</p>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-black text-slate-800 block">3. Subaybayan Online</span>
            <p>Maaari mong buksan ang pahinang ito anumang oras upang suriin ang iyong compliance percentage at records.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

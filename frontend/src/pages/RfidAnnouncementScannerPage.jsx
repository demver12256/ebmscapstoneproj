import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Smartphone, CheckCircle, AlertCircle, Clock, Download, Users, ArrowLeft, Calendar, MapPin, Ban, XCircle } from 'lucide-react';
import { announcementApi } from '../services/api';
import * as XLSX from 'xlsx';

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

export default function RfidAnnouncementScannerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedId = searchParams.get('id');

  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState('');
  const [eventName, setEventName] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [scannedRecords, setScannedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({ total_expected: 0, total_present: 0, total_absent: 0, percentage: 0 });
  const rfidInputRef = useRef(null);

  // Load announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await announcementApi.list();
        const allAnn = res.data?.data || [];
        setAnnouncements(allAnn);

        // Auto-select if preselected
        if (preselectedId) {
          const found = allAnn.find((a) => a.id === Number(preselectedId));
          if (found) {
            setSelectedAnnouncement(String(found.id));
            setEventName(found.title);
          }
        }
      } catch (err) {
        console.error('Failed to load announcements:', err);
        setError('Failed to load announcements');
      }
    };
    fetchAnnouncements();
  }, [preselectedId]);

  // Load attendance stats when announcement is selected
  useEffect(() => {
    const loadStats = async () => {
      if (!selectedAnnouncement) {
        setStats({ total_expected: 0, total_present: 0, total_absent: 0, percentage: 0 });
        setScannedRecords([]);
        setEventName('');
        return;
      }

      try {
        const ann = announcements.find((a) => a.id === Number(selectedAnnouncement));
        if (ann) {
          setEventName(ann.title);
        }

        const res = await announcementApi.getAttendanceStats(selectedAnnouncement);
        const data = res.data?.data;
        if (data) {
          setStats(data.stats || { total_expected: 0, total_present: 0, total_absent: 0, percentage: 0 });
          // Build scanned records from present attendees
          const presentAttendees = data.present_attendees || [];
          setScannedRecords(
            presentAttendees.map((att) => ({
              id: att.id,
              rfid: att.Beneficiary?.RFID_number || 'N/A',
              name: `${att.Beneficiary?.first_name || ''} ${att.Beneficiary?.last_name || ''}`.trim(),
              beneficiary_id_code: att.Beneficiary?.beneficiary_id_code,
              category: att.Beneficiary?.category,
              barangay: att.Beneficiary?.Barangay?.barangay_name || 'N/A',
              time: att.scanned_at
                ? new Date(att.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Present',
              status: 'recorded',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load attendance stats:', err);
      }
    };
    loadStats();
  }, [selectedAnnouncement, announcements]);

  useEffect(() => {
    if (rfidInputRef.current && selectedAnnouncement) {
      rfidInputRef.current.focus();
    }
  }, [selectedAnnouncement]);

  const handleExportToExcel = async () => {
    if (!selectedAnnouncement) {
      setError('Please select an announcement first');
      return;
    }

    try {
      // Fetch full attendance stats including absent beneficiaries
      const res = await announcementApi.getAttendanceStats(selectedAnnouncement);
      const data = res.data?.data;
      
      if (!data) {
        setError('Failed to load attendance data');
        return;
      }

      const selectedAnn = announcements.find((a) => a.id === Number(selectedAnnouncement));
      const presentAttendees = data.present_attendees || [];
      const absentAttendees = data.absent_attendees || [];

      // Prepare Excel data
      const worksheetData = [
        ['RFID Announcement Attendance Record'],
        ['Announcement:', eventName],
        ['Event Date:', selectedAnn?.event_date || 'N/A'],
        ['Venue:', selectedAnn?.venue || 'N/A'],
        ['Date Exported:', new Date().toLocaleDateString()],
        ['Total Expected:', data.stats?.total_expected || 0],
        ['Total Present:', data.stats?.total_present || 0],
        ['Total Absent:', data.stats?.total_absent || 0],
        [],
        ['PRESENT ATTENDEES'],
        ['#', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Barangay', 'Category', 'Time Scanned'],
      ];

      // Add present attendees
      presentAttendees.forEach((att, index) => {
        worksheetData.push([
          index + 1,
          att.Beneficiary?.RFID_number || 'N/A',
          `${att.Beneficiary?.first_name || ''} ${att.Beneficiary?.last_name || ''}`.trim(),
          att.Beneficiary?.beneficiary_id_code || 'N/A',
          att.Beneficiary?.Barangay?.barangay_name || 'N/A',
          att.Beneficiary?.category || 'N/A',
          att.scanned_at ? new Date(att.scanned_at).toLocaleString() : 'N/A',
        ]);
      });

      // Add separator and absent section
      worksheetData.push([]);
      worksheetData.push(['ABSENT BENEFICIARIES']);
      worksheetData.push(['#', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Barangay', 'Category', 'Contact Number']);

      // Add absent beneficiaries
      absentAttendees.forEach((att, index) => {
        worksheetData.push([
          index + 1,
          att.Beneficiary?.RFID_number || 'N/A',
          `${att.Beneficiary?.first_name || ''} ${att.Beneficiary?.last_name || ''}`.trim(),
          att.Beneficiary?.beneficiary_id_code || 'N/A',
          att.Beneficiary?.Barangay?.barangay_name || 'N/A',
          att.Beneficiary?.category || 'N/A',
          att.Beneficiary?.contact_number || 'N/A',
        ]);
      });

      // Create worksheet and workbook
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

      // Auto-size columns
      const maxWidth = worksheetData.reduce((w, r) => Math.max(w, r.length), 10);
      worksheet['!cols'] = Array(maxWidth).fill({ wch: 18 });

      // Download file
      const fileName = `${eventName.replace(/\s+/g, '_')}_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setSuccess('Excel file exported successfully with absent beneficiaries list!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to export attendance:', err);
      setError('Failed to export attendance data');
      setTimeout(() => setError(null), 3000);
    }
  };

  const activeAnnouncements = announcements.filter(isAnnouncementActiveForAttendance);
  const endedAnnouncements = announcements.filter((a) => !isAnnouncementActiveForAttendance(a));
  const selectedAnn = announcements.find((a) => a.id === Number(selectedAnnouncement));
  const isSelectedEnded = selectedAnn ? !isAnnouncementActiveForAttendance(selectedAnn) : false;

  const handleScan = async (e) => {
    e.preventDefault();

    if (!selectedAnnouncement) {
      setError('Please select an announcement event first');
      return;
    }

    if (isSelectedEnded) {
      setError('BAWAL NA ANG ATTENDANCE: Ang anunsyo o aktibidad na ito ay tapos na. Hindi na maaaring magtala ng attendance ang staff.');
      return;
    }

    if (!rfidInput.trim()) {
      setError('Please scan an RFID card');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const scannedCode = rfidInput.trim();

      const res = await announcementApi.scanRfid(selectedAnnouncement, {
        RFID_number: scannedCode,
      });

      const data = res.data;
      setSuccess(`✓ ${data.beneficiary?.first_name} ${data.beneficiary?.last_name} - Attendance recorded!`);

      // Prepend to scanned records
      setScannedRecords((prev) => [
        {
          id: Date.now(),
          rfid: scannedCode,
          name: `${data.beneficiary?.first_name || ''} ${data.beneficiary?.last_name || ''}`.trim(),
          beneficiary_id_code: data.beneficiary?.beneficiary_id_code,
          category: data.beneficiary?.category,
          barangay: data.beneficiary?.barangay_name || 'N/A',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'recorded',
        },
        ...prev,
      ]);

      // Update stats if returned
      if (data.stats) {
        setStats(data.stats);
      }

      setRfidInput('');
      if (rfidInputRef.current) {
        rfidInputRef.current.focus();
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to record attendance';
      setError(errorMsg);
      setRfidInput('');
      setTimeout(() => {
        if (rfidInputRef.current) rfidInputRef.current.focus();
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Smartphone className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">RFID Attendance Scanner</h1>
          <p className="text-sm text-slate-600 mt-1">Tap RFID cards to record attendance for events and programs.</p>
        </div>
      </div>

      {/* Attendance Closed Notice */}
      {isSelectedEnded && (
        <div className="rounded-xl bg-red-50 border-2 border-red-300 p-4 flex items-start gap-3">
          <Ban className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900 text-base">⛔ ISINARA NA ANG ATTENDANCE (Tapos na ang Aktibidad)</p>
            <p className="text-sm text-red-700 mt-1">
              Ang anunsyo o aktibidad na ito ay nagwakas na noong <strong>{selectedAnn?.event_date || 'nakaraang petsa'}</strong>.
              Ayon sa patakaran ng sistema, <strong>hindi na pinahihintulutan ang staff na magtala ng attendance</strong> matapos ang opisyal na pagtatapos ng anunsyo.
            </p>
          </div>
        </div>
      )}

      {/* Event Setup */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Event Setup</h2>

        {announcements.length === 0 && !error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">No announcement events available</p>
              <p>There are currently no published announcement events. Please contact the admin to create and publish an announcement event first.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Announcement Event Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Announcement Event
            </label>
            <select
              value={selectedAnnouncement}
              onChange={(e) => setSelectedAnnouncement(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">-- Pumili ng Anunsyo / Aktibidad --</option>
              {activeAnnouncements.length > 0 && (
                <optgroup label="🟢 Aktibong mga Anunsyo (Bukás para sa Attendance)">
                  {activeAnnouncements.map((ann) => (
                    <option key={ann.id} value={ann.id}>
                      {ann.title} - {ann.priority} ({ann.event_date || 'Walang petsa'})
                    </option>
                  ))}
                </optgroup>
              )}
              {endedAnnouncements.length > 0 && (
                <optgroup label="⛔ Mga Tapos Nang Anunsyo (Sarado na ang Attendance)">
                  {endedAnnouncements.map((ann) => (
                    <option key={ann.id} value={ann.id} disabled>
                      {ann.title} ({ann.event_date || 'Tapos na'}) [TAPOS NA / SARADO]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Event Name (Auto-populated) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Event Name
            </label>
            <input
              type="text"
              value={eventName}
              readOnly
              placeholder="Select an announcement event first"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 text-sm cursor-not-allowed"
            />
          </div>
        </div>

        {/* Event Details (when selected) */}
        {selectedAnn && (
          <div className={`rounded-lg p-4 space-y-2 border ${isSelectedEnded ? 'bg-red-50 border-red-200 text-red-900' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-start gap-3">
              <Users className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelectedEnded ? 'text-red-600' : 'text-blue-600'}`} />
              <div className="text-sm">
                <p className={`font-medium ${isSelectedEnded ? 'text-red-800' : 'text-blue-700'}`}>Target Beneficiaries: {stats.total_expected}</p>
                <p className={isSelectedEnded ? 'text-red-600' : 'text-blue-600'}>
                  {isSelectedEnded
                    ? 'SARADO: Hindi na maaaring magtala ng attendance dahil tapos na ang aktibidad.'
                    : 'Only enrolled beneficiaries matching the selected programs and barangays can be scanned for this event.'}
                </p>
              </div>
            </div>
            <div className={`flex flex-wrap items-center gap-4 text-xs font-semibold pt-1 ${isSelectedEnded ? 'text-red-700' : 'text-blue-800'}`}>
              {selectedAnn.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {selectedAnn.event_date} {selectedAnn.event_time && `at ${selectedAnn.event_time}`}
                </span>
              )}
              {selectedAnn.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedAnn.venue}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Attendance Stats Cards */}
        {selectedAnnouncement && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <span className="text-xs font-bold text-blue-700 uppercase block">Expected</span>
              <span className="text-2xl font-black text-blue-950">{stats.total_expected}</span>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <span className="text-xs font-bold text-green-700 uppercase block">Present</span>
              <span className="text-2xl font-black text-green-950">{stats.total_present}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <span className="text-xs font-bold text-slate-500 uppercase block">Absent</span>
              <span className="text-2xl font-black text-slate-700">{stats.total_absent}</span>
            </div>
          </div>
        )}
      </div>

      {/* RFID Scanner Input */}
      <div className={`rounded-lg border-2 p-6 space-y-4 ${
        isSelectedEnded ? 'bg-red-50/40 border-red-200' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isSelectedEnded ? 'RFID Scanner Closed' : 'RFID Scanner Ready'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {isSelectedEnded ? 'Hindi na tumatanggap ng attendance para sa aktibidad na ito' : 'Tap cards here to record attendance'}
            </p>
          </div>
          <div className={`w-4 h-4 rounded-full ${isSelectedEnded ? 'bg-red-500' : selectedAnnouncement ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        </div>

        <form onSubmit={handleScan} className="space-y-3">
          <input
            ref={rfidInputRef}
            type="text"
            value={rfidInput}
            onChange={(e) => setRfidInput(e.target.value)}
            placeholder={isSelectedEnded ? "Sarado na ang attendance para sa tapos nang aktibidad na ito..." : "Tap RFID card here..."}
            disabled={!selectedAnnouncement || isSelectedEnded}
            className={`w-full px-6 py-4 border-2 rounded-lg text-center text-lg font-mono focus:outline-none transition-all ${
              isSelectedEnded
                ? 'border-red-300 bg-red-50 text-red-500 cursor-not-allowed'
                : selectedAnnouncement
                ? 'border-blue-400 bg-white focus:ring-2 focus:ring-blue-500'
                : 'border-slate-300 bg-slate-100 cursor-not-allowed text-slate-500'
            }`}
            autoComplete="off"
          />

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedAnnouncement || isSelectedEnded}
            className={`w-full py-3 font-semibold rounded-lg transition-colors text-white ${
              isSelectedEnded
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {loading ? 'Recording...' : isSelectedEnded ? '⛔ Sarado na ang Attendance (Tapos na)' : 'Tap card or press Enter'}
          </button>
        </form>
      </div>

      {/* Scanned Records */}
      {scannedRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Scanned Attendees ({scannedRecords.length})</h2>
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scannedRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{record.name}</p>
                    <p className="text-xs text-slate-600 font-mono">
                      {record.rfid} • {record.beneficiary_id_code} • {record.barangay}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-700 font-medium">{record.time}</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                    Recorded
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Box */}
      {!selectedAnnouncement ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-medium">Scanner not ready</p>
            <p>Select a distribution event to begin scanning RFID cards for qualified beneficiaries.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">
            <p className="font-medium">Scanner is active and ready</p>
            <p>
              Event: <span className="font-semibold">{eventName}</span> | Expected:{' '}
              <span className="font-semibold">{stats.total_expected} beneficiaries</span> | Present:{' '}
              <span className="font-semibold">{stats.total_present}</span> ({stats.percentage}%)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

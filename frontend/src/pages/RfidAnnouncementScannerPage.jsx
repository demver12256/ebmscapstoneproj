import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Smartphone, CheckCircle, AlertCircle, Clock, Download, Users, ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { announcementApi } from '../services/api';
import * as XLSX from 'xlsx';

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

  // Load published announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await announcementApi.list();
        const allAnn = res.data?.data || [];
        // Only published announcements
        const published = allAnn.filter(
          (a) => a.status === 'published'
        );
        setAnnouncements(published);

        // Auto-select if preselected
        if (preselectedId) {
          const found = published.find((a) => a.id === Number(preselectedId));
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

  const handleScan = async (e) => {
    e.preventDefault();

    if (!selectedAnnouncement) {
      setError('Please select an announcement event first');
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

  const selectedAnn = announcements.find((a) => a.id === Number(selectedAnnouncement));

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
              <option value="">-- Choose an announcement event --</option>
              {announcements.map((ann) => (
                <option key={ann.id} value={ann.id}>
                  {ann.title} - {ann.priority} ({ann.event_date || 'No date'})
                </option>
              ))}
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
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-2">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Target Beneficiaries: {stats.total_expected}</p>
                <p>Only enrolled beneficiaries matching the selected programs and barangays can be scanned for this event.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-blue-800 font-semibold pt-1">
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">RFID Scanner Ready</h2>
            <p className="text-sm text-slate-600 mt-1">Tap cards here to record attendance</p>
          </div>
          <div className={`w-4 h-4 rounded-full animate-pulse ${selectedAnnouncement ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <form onSubmit={handleScan} className="space-y-3">
          <input
            ref={rfidInputRef}
            type="text"
            value={rfidInput}
            onChange={(e) => setRfidInput(e.target.value)}
            placeholder="Tap RFID card here..."
            disabled={!selectedAnnouncement}
            className={`w-full px-6 py-4 border-2 rounded-lg text-center text-lg font-mono focus:outline-none transition-all ${
              selectedAnnouncement
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
            disabled={loading || !selectedAnnouncement}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Recording...' : 'Tap card or press Enter'}
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

import { useState, useEffect, useRef } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Clock, Download, Users, XCircle, Ban } from 'lucide-react';
import { announcementApi } from '../services/api';
import * as XLSX from 'xlsx';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';

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

export default function RfidAttendancePage() {
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState('');
  const [eventName, setEventName] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [scannedRecords, setScannedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const rfidInputRef = useRef(null);
  const recordPagination = usePagination(scannedRecords, 10);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await announcementApi.list({ has_attendance: true });
        const allAnnouncements = res.data.data || [];
        setAnnouncements(allAnnouncements);
      } catch (err) {
        console.error('Failed to load announcements:', err);
        setError('Failed to load announcements');
      }
    };
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    const loadAnnouncementDetails = async () => {
      if (!selectedAnnouncement) {
        setEventName('');
        return;
      }

      try {
        const announcement = announcements.find(a => a.id === Number(selectedAnnouncement));
        if (announcement) {
          setEventName(announcement.title);
        }
      } catch (err) {
        console.error('Failed to load announcement details:', err);
        setError('Failed to load announcement details');
      }
    };
    loadAnnouncementDetails();
  }, [selectedAnnouncement, announcements]);

  useEffect(() => {
    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  }, [selectedAnnouncement]);

  const handleExportToExcel = () => {
    if (scannedRecords.length === 0) {
      setError('No records to export');
      return;
    }

    const selectedAnnouncementData = announcements.find(a => a.id === Number(selectedAnnouncement));
    
    const worksheetData = [
      ['RFID Attendance Record'],
      ['Event:', eventName],
      ['Venue:', selectedAnnouncementData?.venue || 'N/A'],
      ['Date:', new Date().toLocaleDateString()],
      ['Total Scanned:', scannedRecords.length],
      [],
      ['#', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Category', 'Time Scanned', 'Status']
    ];

    scannedRecords.forEach((record, index) => {
      worksheetData.push([
        index + 1,
        record.rfid,
        record.name,
        record.beneficiary_id_code || 'N/A',
        record.category || 'N/A',
        record.time,
        record.status
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    const maxWidth = worksheetData.reduce((w, r) => Math.max(w, r.length), 10);
    worksheet['!cols'] = Array(maxWidth).fill({ wch: 15 });

    const fileName = `Attendance_${eventName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const selectedAnnouncementData = announcements.find((a) => a.id === Number(selectedAnnouncement));
  const isSelectedEnded = selectedAnnouncementData && !isAnnouncementActiveForAttendance(selectedAnnouncementData);
  const activeAnnouncements = announcements.filter(isAnnouncementActiveForAttendance);
  const endedAnnouncements = announcements.filter((a) => !isAnnouncementActiveForAttendance(a));

  const handleScan = async () => {
    if (!selectedAnnouncement) {
      setError('Please select an announcement first');
      return;
    }

    if (isSelectedEnded) {
      setError('BAWAL NA ANG ATTENDANCE: Ang aktibidad na ito ay tapos na. Hindi na maaaring magtala ng attendance ang staff.');
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
      const rfidNumber = rfidInput.trim();
      const now = new Date();
      const scanDate = now.toISOString().split('T')[0];
      const scanTime = now.toTimeString().split(' ')[0];

      // Check for duplicate scan in today's records
      const isDuplicate = scannedRecords.some(
        (r) => r.rfid === rfidNumber && r.date === scanDate
      );

      if (isDuplicate) {
        setError(`RFID ${rfidNumber} already scanned for this event today`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        setLoading(false);
        return;
      }

      // Record attendance via announcement API
      const response = await announcementApi.scanRfid(selectedAnnouncement, {
        rfid_number: rfidNumber
      });

      const beneficiary = response.data.beneficiary;

      setSuccess(`✓ ${beneficiary.first_name} ${beneficiary.last_name} - Attendance recorded!`);
      setScannedRecords([
        {
          id: Date.now(),
          rfid: rfidNumber,
          name: `${beneficiary.first_name} ${beneficiary.last_name}`,
          beneficiary_id_code: beneficiary.beneficiary_id_code,
          category: beneficiary.category,
          time: scanTime,
          date: scanDate,
          status: 'present'
        },
        ...scannedRecords
      ]);

      setRfidInput('');
      if (rfidInputRef.current) {
        rfidInputRef.current.focus();
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error:', err);
      
      if (err.response) {
        const status = err.response.status;
        const message = err.response.data?.message || err.message;
        
        if (status === 409) {
          setError(`⚠️ Duplicate scan: ${message}`);
        } else if (status === 404) {
          setError(`❌ RFID not found: ${message}`);
        } else {
          setError(`Error: ${message}`);
        }
      } else if (err.request) {
        setError('❌ Network error: Cannot connect to server');
      } else {
        setError(err.message || 'Failed to record attendance');
      }
      
      setTimeout(() => setError(null), 5000);
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
          <p className="text-sm text-slate-600 mt-1">Tap RFID cards to record attendance for announcements and events.</p>
        </div>
      </div>

      {/* Scanner Setup */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Event Setup</h2>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!error && announcements.length === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">No announcements available</p>
              <p>There are currently no announcements with attendance tracking enabled.</p>
            </div>
          </div>
        )}

        {isSelectedEnded && (
          <div className="rounded-lg bg-red-100 border-2 border-red-300 p-4 flex items-start gap-3 animate-fadeIn">
            <Ban className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-900">
              <p className="font-black uppercase tracking-wide">⛔ ISINARA NA ANG ATTENDANCE (Tapos na ang Aktibidad)</p>
              <p className="mt-1 font-medium text-red-800">
                Ang aktibidad na <strong>"{selectedAnnouncementData?.title}"</strong> ay opisyal nang tapos o lumipas na ang itinakdang schedule. <strong>Hindi na pinapayagan ang mga kawani (Staff) na mag-record ng attendance</strong> para rito.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Announcement Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Announcement/Event
            </label>
            <select
              value={selectedAnnouncement}
              onChange={(e) => {
                setSelectedAnnouncement(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent text-sm ${
                isSelectedEnded ? 'border-red-400 bg-red-50 text-red-950 font-bold' : 'border-slate-300 focus:ring-blue-500'
              }`}
            >
              <option value="">-- Pumili ng Aktibong Anunsyo / Event --</option>
              {activeAnnouncements.length > 0 && (
                <optgroup label="🟢 Aktibong mga Anunsyo (Bukás para sa Attendance)">
                  {activeAnnouncements.map((announcement) => (
                    <option key={announcement.id} value={announcement.id}>
                      {announcement.title} {announcement.event_date && `(${new Date(announcement.event_date).toLocaleDateString()})`}
                    </option>
                  ))}
                </optgroup>
              )}
              {endedAnnouncements.length > 0 && (
                <optgroup label="⛔ Mga Tapos Nang Anunsyo (Sarado na ang Attendance)">
                  {endedAnnouncements.map((announcement) => (
                    <option key={announcement.id} value={announcement.id} disabled className="text-slate-400 bg-slate-100 italic">
                      {announcement.title} {announcement.event_date && `(${new Date(announcement.event_date).toLocaleDateString()})`} — [TAPOS NA / SARADO]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Event Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Event Name
            </label>
            <input
              type="text"
              value={isSelectedEnded ? `[TAPOS NA] ${eventName}` : eventName}
              readOnly
              placeholder="Select an event first"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm cursor-not-allowed ${
                isSelectedEnded ? 'border-red-300 bg-red-50 text-red-800 font-bold' : 'border-slate-300 bg-slate-50 text-slate-700'
              }`}
            />
          </div>
        </div>
      </div>

      {/* RFID Scanner Input */}
      <div className={`bg-white rounded-lg shadow-sm border-2 p-6 transition ${
        isSelectedEnded
          ? 'border-red-300 bg-red-50/50'
          : selectedAnnouncement
          ? 'border-green-300 bg-green-50'
          : 'border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${isSelectedEnded ? 'text-red-900' : 'text-slate-900'}`}>
            {isSelectedEnded ? 'Attendance Closed (Sarado Na)' : 'RFID Scanner Ready'}
          </h2>
          <div className={`flex items-center gap-2 text-sm ${
            isSelectedEnded ? 'text-red-600 font-bold' : selectedAnnouncement ? 'text-green-600' : 'text-slate-400'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              isSelectedEnded ? 'bg-red-500' : selectedAnnouncement ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
            }`} />
            {isSelectedEnded ? 'Sarado / Bawal Mag-scan' : selectedAnnouncement ? 'Ready to scan' : 'Not ready'}
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          {isSelectedEnded
            ? 'Isinara na ang pagtanggap ng RFID attendance para sa natapos nang event na ito.'
            : 'Tap cards here to record attendance'}
        </p>

        <input
          ref={rfidInputRef}
          type="text"
          value={rfidInput}
          onChange={(e) => setRfidInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleScan();
            }
          }}
          placeholder={isSelectedEnded ? 'Sarado na ang attendance para sa event na ito...' : 'Tap RFID card here...'}
          disabled={!selectedAnnouncement || isSelectedEnded || loading}
          className="w-full px-4 py-3 text-center text-lg border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
        />

        <button
          onClick={handleScan}
          disabled={!selectedAnnouncement || isSelectedEnded || !rfidInput.trim() || loading}
          className={`w-full mt-3 px-4 py-3 text-white font-semibold rounded-lg transition ${
            isSelectedEnded
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
          }`}
        >
          {isSelectedEnded ? '⛔ Sarado na ang Attendance' : loading ? 'Processing...' : 'Tap card or press Enter'}
        </button>

        {!selectedAnnouncement && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">Scanner not ready</p>
              <p>Select an announcement/event to begin scanning RFID cards for attendance.</p>
            </div>
          </div>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-lg bg-green-50 border-2 border-green-300 p-4 flex items-start gap-3 animate-pulse">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div className="text-sm text-green-700 font-medium">{success}</div>
        </div>
      )}

      {/* Scanned Records */}
      {scannedRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Scanned Records ({scannedRecords.length})
            </h2>
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">RFID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recordPagination.paginatedData.map((record, index) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{recordPagination.startIndex + index + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs">{record.rfid}</td>
                    <td className="px-4 py-3 font-medium">{record.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{record.beneficiary_id_code}</td>
                    <td className="px-4 py-3 text-xs">{record.category}</td>
                    <td className="px-4 py-3">{record.time}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                currentPage={recordPagination.currentPage}
                totalPages={recordPagination.totalPages}
                onPageChange={recordPagination.goToPage}
                totalItems={recordPagination.totalItems}
                itemsPerPage={10}
                startIndex={recordPagination.startIndex}
                endIndex={recordPagination.endIndex}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

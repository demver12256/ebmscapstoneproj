import { useState, useEffect, useRef } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Clock, Download, Ban, QrCode, Camera, CameraOff, RefreshCw, CreditCard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { announcementApi } from '../services/api';
import * as XLSX from 'xlsx';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';
import { getAnnouncementEndDateTime } from '../utils/announcementSchedule';

// Helper to determine if announcement is active for attendance recording
const isAnnouncementActiveForAttendance = (ann) => {
  if (!ann) return false;
  if (ann.status === 'completed' || ann.status === 'archived') return false;
  if (ann.status !== 'published') return false;

  const now = new Date();
  const eventEndTime = getAnnouncementEndDateTime(ann);
  if (eventEndTime && now > eventEndTime) return false;

  if (ann.expiration_date) {
    const [y, m, d] = String(ann.expiration_date).split('-').map(Number);
    if (y && m && d) {
      const expirationTime = new Date(y, m - 1, d, 23, 59, 59);
      if (now > expirationTime) return false;
    }
  }

  return true;
};

// Deduplicate scanned attendance records so each beneficiary only ever appears once
const deduplicateAttendanceRecords = (records) => {
  const seen = new Set();
  const result = [];
  for (const r of records) {
    const keys = [
      r.beneficiary_id ? `id:${r.beneficiary_id}` : null,
      r.beneficiary_id_code ? `code:${String(r.beneficiary_id_code).trim().toLowerCase()}` : null,
      r.rfid && r.rfid !== 'N/A (QR Pass)' ? `rfid:${String(r.rfid).trim().toLowerCase()}` : null,
      r.name ? `name:${String(r.name).trim().toLowerCase()}` : null,
    ].filter(Boolean);

    if (keys.some((k) => seen.has(k))) {
      continue;
    }
    keys.forEach((k) => seen.add(k));
    result.push(r);
  }
  return result;
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
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const rfidInputRef = useRef(null);
  const recordPagination = usePagination(scannedRecords, 10);

  // Camera QR Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const html5QrCodeRef = useRef(null);
  const isProcessingScanRef = useRef(false);

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
        setScannedRecords([]);
        return;
      }

      try {
        const announcement = announcements.find(a => a.id === Number(selectedAnnouncement));
        if (announcement) {
          setEventName(announcement.title);
        }

        const statsRes = await announcementApi.getAttendanceStats(selectedAnnouncement);
        const presentAttendees = statsRes.data?.data?.present_attendees || [];
        const existingRecords = presentAttendees.map((item) => {
          const ben = item.Beneficiary || {};
          const scannedDateObj = item.scanned_at ? new Date(item.scanned_at) : new Date();
          return {
            id: item.id || `${ben.id}-${item.scanned_at}`,
            beneficiary_id: ben.id,
            rfid: ben.RFID_number || 'N/A (QR Pass)',
            qr_code: null,
            name: `${ben.first_name || ''} ${ben.last_name || ''}`.trim(),
            beneficiary_id_code: ben.beneficiary_id_code,
            category: ben.category,
            time: scannedDateObj.toTimeString().split(' ')[0],
            date: scannedDateObj.toISOString().split('T')[0],
            status: 'present',
          };
        });
        setScannedRecords(deduplicateAttendanceRecords(existingRecords));
      } catch (err) {
        console.error('Failed to load announcement details:', err);
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

  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const playDuplicateBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {}
  };

  const executeScan = async (rawInput) => {
    const code = String(rawInput || '').trim();
    if (!code) {
      setError('Mag-tap ng RFID card o i-scan ang QR code');
      return;
    }

    if (!selectedAnnouncement) {
      setError('Pumili muna ng aktibidad/announcement sa itaas');
      return;
    }

    if (isSelectedEnded) {
      setError('BAWAL NA ANG ATTENDANCE: Ang aktibidad na ito ay tapos na. Hindi na maaaring magtala ng attendance ang staff.');
      return;
    }

    if (isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setDuplicateWarning(null);

    try {
      const now = new Date();
      const scanDate = now.toISOString().split('T')[0];
      const scanTime = now.toTimeString().split(' ')[0];

      // Record attendance via announcement API
      const response = await announcementApi.scanRfid(selectedAnnouncement, {
        rfid_number: code,
        RFID_number: code,
      });

      const beneficiary = response.data.beneficiary;
      const isDuplicate = Boolean(response.data.already_present || response.data.duplicate);

      if (isDuplicate) {
        playDuplicateBeep();
        const scannedAtText = beneficiary?.scanned_at
          ? new Date(beneficiary.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : 'kanina';
        setDuplicateWarning(
          `Nakapag-attendance na si ${beneficiary?.first_name || ''} ${beneficiary?.last_name || ''} (${beneficiary?.beneficiary_id_code || 'N/A'}) sa aktibidad na ito (kaninang ${scannedAtText}). Hindi na kailangang i-scan ulit ang RFID o QR Code.`
        );
        setTimeout(() => setDuplicateWarning(null), 6000);
      } else {
        playSuccessBeep();
        setSuccess(`✓ ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.beneficiary_id_code}) - Naitala ang Attendance!`);
        setTimeout(() => setSuccess(null), 4000);
      }

      if (beneficiary) {
        const scannedAtObj = beneficiary.scanned_at ? new Date(beneficiary.scanned_at) : now;
        setScannedRecords((prev) =>
          deduplicateAttendanceRecords([
            ...prev,
            {
              id: beneficiary.id || Date.now(),
              beneficiary_id: beneficiary.id,
              rfid: beneficiary.RFID_number || 'N/A (QR Pass)',
              qr_code: code.startsWith('EBMS-QR:') ? code : null,
              name: `${beneficiary.first_name} ${beneficiary.last_name}`.trim(),
              beneficiary_id_code: beneficiary.beneficiary_id_code,
              category: beneficiary.category,
              time: scannedAtObj.toTimeString().split(' ')[0] || scanTime,
              date: scannedAtObj.toISOString().split('T')[0] || scanDate,
              status: 'present',
            },
          ])
        );
      }

      setRfidInput('');
      if (rfidInputRef.current) {
        rfidInputRef.current.focus();
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message;
      if (status === 409) {
        playDuplicateBeep();
        setError(null);
        setDuplicateWarning(message || 'Nakapag-attendance na ang benepisyaryo sa aktibidad na ito.');
        setRfidInput('');
        setTimeout(() => setDuplicateWarning(null), 6000);
      } else if (status === 404) {
        setError(`❌ Hindi rehistrado ang RFID o QR Pass: ${message}`);
        setTimeout(() => setError(null), 5000);
      } else {
        setError(`Error: ${message}`);
        setTimeout(() => setError(null), 5000);
      }
    } finally {
      setLoading(false);
      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 1500);
    }
  };

  const handleScan = () => {
    executeScan(rfidInput);
  };

  const startCameraScanner = async () => {
    if (!selectedAnnouncement) {
      setError('Pumili muna ng aktibidad/announcement sa itaas bago buksan ang camera');
      return;
    }
    if (isSelectedEnded) {
      setError('Sarado na ang attendance para sa event na ito.');
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setIsCameraActive(true);
      setCameraLoading(false);
      setCameraError('Naka-block ang live camera sa HTTP address. Patakbuhin ang npm run start:camera sa frontend folder, i-install ang ebms-local-ca.cer sa phone, at buksan ang HTTPS address na ipi-print ng terminal.');
      return;
    }

    setIsCameraActive(true);
    setCameraLoading(true);
    setCameraError(null);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-camera-reader');
        html5QrCodeRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            if (!isProcessingScanRef.current) {
              setRfidInput(decodedText);
              const scanPromise = executeScan(decodedText);
              await stopCameraScanner();
              await scanPromise;
            }
          },
          () => {}
        );
        setCameraLoading(false);
      } catch (err) {
        console.error('Camera init error:', err);
        const failedScanner = html5QrCodeRef.current;
        if (failedScanner) {
          try {
            if (failedScanner.isScanning) await failedScanner.stop();
            await failedScanner.clear();
          } catch (cleanupError) {
            console.warn('Camera startup cleanup error:', cleanupError);
          }
          html5QrCodeRef.current = null;
        }
        setCameraError(err.name === 'NotAllowedError'
          ? 'Hindi pinayagan ang camera. I-enable ang camera permission para sa site sa browser settings, pagkatapos ay subukang muli.'
          : err.name === 'NotFoundError'
            ? 'Walang camera na makita sa device na ito.'
            : err.message || 'Hindi ma-access ang camera. Pakitiyak na pinayagan ang camera permission sa browser.');
        setCameraLoading(false);
      }
    }, 250);
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.error('Stop camera error:', e);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
    setCameraError(null);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedAnnouncement || isSelectedEnded) {
      if (isCameraActive) {
        stopCameraScanner();
      }
    }
  }, [selectedAnnouncement, isSelectedEnded, isCameraActive]);

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

      {/* RFID & QR CODE SCANNER CARD */}
      <div className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition ${
        isSelectedEnded
          ? 'border-red-300 bg-red-50/50'
          : selectedAnnouncement
          ? 'border-emerald-400 bg-gradient-to-b from-white to-emerald-50/30'
          : 'border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-lg font-bold ${isSelectedEnded ? 'text-red-900' : 'text-slate-900'}`}>
                {isSelectedEnded ? 'Attendance Closed (Sarado Na)' : 'RFID & QR Code Scanner Ready'}
              </h2>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                RFID + QR Dual Scan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSelectedEnded
                ? 'Isinara na ang pagtanggap ng attendance para sa natapos nang event na ito.'
                : 'I-tap ang RFID card o i-scan ang Digital QR Pass ng benepisyaryo para sa attendance'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
              isSelectedEnded 
                ? 'bg-red-100 text-red-700' 
                : selectedAnnouncement 
                ? 'bg-emerald-100 text-emerald-800' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${
                isSelectedEnded ? 'bg-red-500' : selectedAnnouncement ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`} />
              {isSelectedEnded ? 'Sarado' : selectedAnnouncement ? 'Ready to Scan' : 'Select Event'}
            </div>

            {/* Toggle Camera QR Scanner Button */}
            {!isSelectedEnded && selectedAnnouncement && (
              <button
                type="button"
                onClick={isCameraActive ? stopCameraScanner : startCameraScanner}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
                  isCameraActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    Isara ang Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    I-scan gamit ang Camera (QR)
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* LIVE CAMERA QR SCANNER VIEWPORT */}
        {isCameraActive && (
          <div className="mb-5 p-4 bg-slate-900 rounded-2xl border-2 border-blue-500 shadow-lg text-white space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
                <QrCode className="w-4 h-4 text-yellow-400 animate-pulse" />
                {cameraError ? 'Live Camera Unavailable' : 'Live Camera QR Scanner Active'}
              </div>
              <button
                type="button"
                onClick={stopCameraScanner}
                className="text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg text-white font-semibold transition"
              >
                ✕ Isara Camera
              </button>
            </div>

            {cameraLoading && (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                <p className="text-xs text-slate-300">Binubuksan ang camera...</p>
              </div>
            )}

            {cameraError && (
              <div className="p-3 bg-red-900/60 border border-red-500/50 rounded-xl text-xs text-red-200">
                {cameraError}
              </div>
            )}

            {/* Html5Qrcode video mount div */}
            <div className="flex justify-center overflow-hidden rounded-xl bg-black">
              <div id="qr-camera-reader" className="w-full max-w-sm rounded-xl overflow-hidden" />
            </div>

            <p className="text-center text-[11px] text-slate-300">
              Itapat ang QR code pass ng benepisyaryo sa harap ng camera para awtomatikong maitala ang attendance.
            </p>
          </div>
        )}

        {/* TAP CARD / HARDWARE BARCODE SCANNER INPUT */}
        <div className="space-y-3">
          <div className="relative">
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
              placeholder={
                isSelectedEnded
                  ? 'Sarado na ang attendance para sa event na ito...'
                  : 'I-tap ang RFID card o i-scan ang QR code dito (o i-type ang code)...'
              }
              disabled={!selectedAnnouncement || isSelectedEnded || loading}
              className="w-full px-4 py-3.5 text-center text-base sm:text-lg font-mono font-bold border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed transition"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 text-slate-400 pointer-events-none">
              <CreditCard className="w-4 h-4" />
              <span className="text-[11px] font-sans">RFID</span>
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 text-slate-400 pointer-events-none">
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span className="text-[11px] font-sans text-emerald-700 font-bold">QR Pass</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleScan}
              disabled={!selectedAnnouncement || isSelectedEnded || !rfidInput.trim() || loading}
              className={`flex-1 py-3 px-4 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs ${
                isSelectedEnded
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              {isSelectedEnded
                ? '⛔ Sarado na ang Attendance'
                : loading
                ? 'Kinukumpirma...'
                : 'I-record ang Attendance (Enter)'}
            </button>

            {!isCameraActive && !isSelectedEnded && selectedAnnouncement && (
              <button
                type="button"
                onClick={startCameraScanner}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Camera className="w-4 h-4" />
                Buksan ang Camera QR Scanner
              </button>
            )}
          </div>
        </div>

        {!selectedAnnouncement && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-bold">Scanner not ready</p>
              <p className="mt-0.5">Pumili ng aktibidad/announcement sa itaas para magsimulang mag-scan ng RFID cards o QR codes para sa attendance.</p>
            </div>
          </div>
        )}
      </div>

      {/* Success / Duplicate Warning Messages */}
      {duplicateWarning && (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-400 p-4 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-black uppercase tracking-wide text-amber-800">⚠️ Nakapag-Attendance Na Siya!</p>
            <p className="mt-1 font-semibold">{duplicateWarning}</p>
          </div>
        </div>
      )}

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

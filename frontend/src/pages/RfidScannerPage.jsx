import { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Clock, Download, Users, RefreshCw, QrCode, Camera, CameraOff, CreditCard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { distributionApi } from '../services/api';
import * as XLSX from 'xlsx';

export default function RfidScannerPage() {
  const [distributionEvents, setDistributionEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [qualifiedBeneficiaries, setQualifiedBeneficiaries] = useState([]);
  const [eventName, setEventName] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [scannedRecords, setScannedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraCaptureMode, setCameraCaptureMode] = useState(false);
  const rfidInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const cameraCaptureInputRef = useRef(null);
  const isProcessingScanRef = useRef(false);

  const fetchDistributionEvents = async () => {
    try {
      console.log('Fetching distribution events...');
      setRefreshing(true);
      // Load all events first, then filter for scheduled/ongoing
      const res = await distributionApi.listEvents();
      console.log('API Response:', res.data);
      const allEvents = res.data.data || [];
      console.log('All events:', allEvents);
      
      // Filter events that are scheduled or ongoing
      const availableEvents = allEvents.filter(
        event => event.status === 'scheduled' || event.status === 'ongoing'
      );
      console.log('Available events (scheduled/ongoing):', availableEvents);
      
      setDistributionEvents(availableEvents);
      setSuccess('Events refreshed successfully');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Failed to load distribution events:', err);
      setError('Failed to load distribution events');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDistributionEvents();
  }, []);

  useEffect(() => {
    const loadQualifiedBeneficiaries = async () => {
      if (!selectedEvent) {
        setQualifiedBeneficiaries([]);
        setEventName('');
        return;
      }

      try {
        const event = distributionEvents.find(e => e.id === Number(selectedEvent));
        if (event) {
          setEventName(event.title);
          
          // Get transactions (qualified beneficiaries) for this event
          const txnRes = await distributionApi.getTransactions(selectedEvent);
          const transactions = txnRes.data.data || [];
          
          // Filter only pending transactions (not yet released)
          const qualified = transactions
            .filter(txn => txn.status === 'pending' && txn.Beneficiary)
            .map(txn => txn.Beneficiary);
          
          setQualifiedBeneficiaries(qualified);
        }
      } catch (err) {
        console.error('Failed to load qualified beneficiaries:', err);
        setError('Failed to load qualified beneficiaries');
      }
    };
    loadQualifiedBeneficiaries();
  }, [selectedEvent, distributionEvents]);

  useEffect(() => {
    if (rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  }, [selectedEvent]);

  const handleExportToExcel = async () => {
    if (!selectedEvent) {
      setError('Please select a distribution event first');
      return;
    }

    try {
      const selectedEventData = distributionEvents.find(e => e.id === Number(selectedEvent));
      const res = await distributionApi.getTransactions(selectedEvent);
      const allTxns = res.data?.data || [];

      if (allTxns.length === 0 && scannedRecords.length === 0) {
        setError('No records found for this distribution event');
        return;
      }

      const claimedTxns = allTxns.filter(t => t.status === 'released');
      const unclaimedTxns = allTxns.filter(t => t.status === 'pending');

      const worksheetData = [
        ['BeniAid DISTRIBUTION SESSION REPORT'],
        ['Event Title:', selectedEventData?.title || eventName],
        ['Program:', selectedEventData?.Program?.name || 'N/A'],
        ['Barangay:', selectedEventData?.Barangay?.barangay_name || 'N/A'],
        ['Date:', new Date().toLocaleDateString()],
        ['Total Eligible:', allTxns.length],
        ['Total Claimed (Naka-Claim):', claimedTxns.length],
        ['Total Unclaimed (Hindi Naka-Claim):', unclaimedTxns.length],
        [],
        ['========================================================================================'],
        ['1. CLAIMED BENEFICIARIES (NAKA-CLAIM)'],
        ['========================================================================================'],
        ['#', 'Transaction #', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Barangay', 'Category', 'Claim Date & Time', 'Regular Amount (₱)', 'Retro Amount (₱)', 'Retro Periods', 'Total Released (₱)', 'Released By Staff', 'Status']
      ];

      claimedTxns.forEach((txn, index) => {
        const ben = txn.Beneficiary || {};
        const staff = txn.ReleasedByStaff ? `${txn.ReleasedByStaff.first_name || ''} ${txn.ReleasedByStaff.last_name || ''}`.trim() : 'N/A';
        const regAmt = parseFloat(txn.amount || 0);
        const retroAmt = parseFloat(txn.retro_amount || 0);
        worksheetData.push([
          index + 1,
          txn.transaction_number || 'N/A',
          ben.RFID_number || 'N/A',
          `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'N/A',
          ben.beneficiary_id_code || 'N/A',
          ben.Barangay?.barangay_name || selectedEventData?.Barangay?.barangay_name || 'N/A',
          ben.category || 'N/A',
          txn.released_at ? new Date(txn.released_at).toLocaleString() : 'N/A',
          regAmt,
          retroAmt,
          txn.retro_periods || 0,
          regAmt + retroAmt,
          staff,
          'Claimed'
        ]);
      });

      worksheetData.push([]);
      worksheetData.push(['========================================================================================']);
      worksheetData.push(['2. UNCLAIMED BENEFICIARIES (HINDI NAKA-CLAIM)']);
      worksheetData.push(['========================================================================================']);
      worksheetData.push(['#', 'Transaction #', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Barangay', 'Category', 'Contact Number', 'Regular Amount (₱)', 'Retro Amount (₱)', 'Total Allocated (₱)', 'Status']);

      unclaimedTxns.forEach((txn, index) => {
        const ben = txn.Beneficiary || {};
        const regAmt = parseFloat(txn.amount || 0);
        const retroAmt = parseFloat(txn.retro_amount || 0);
        worksheetData.push([
          index + 1,
          txn.transaction_number || 'N/A',
          ben.RFID_number || 'N/A',
          `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'N/A',
          ben.beneficiary_id_code || 'N/A',
          ben.Barangay?.barangay_name || selectedEventData?.Barangay?.barangay_name || 'N/A',
          ben.category || 'N/A',
          ben.contact_number || 'N/A',
          regAmt,
          retroAmt,
          regAmt + retroAmt,
          'Unclaimed'
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Distribution Summary');

      worksheet['!cols'] = Array(11).fill({ wch: 18 });

      const fileName = `${eventName.replace(/\s+/g, '_')}_Distribution_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setSuccess('Excel report exported successfully with Claimed & Unclaimed lists!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      setError('Failed to export distribution Excel report');
    }
  };

  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Audio not supported or blocked
    }
  };

  const executeScan = async (rawInput) => {
    if (!selectedEvent) {
      setError('Pumili muna ng Distribution Event bago mag-scan.');
      return;
    }

    const cleanInput = (rawInput || '').trim();
    if (!cleanInput) {
      setError('Pakilagay o i-scan ang RFID card o QR code.');
      return;
    }

    if (loading || isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const now = new Date();
      const distributionDate = now.toISOString().split('T')[0];
      const releaseTime = now.toTimeString().split(' ')[0];

      const selectedEventData = distributionEvents.find(e => e.id === Number(selectedEvent));
      if (!selectedEventData) {
        setError('Selected event not found. Please refresh and try again.');
        return;
      }

      if (selectedEventData.status !== 'ongoing') {
        setError(`❌ Distribution session is not active (Status: ${selectedEventData.status}). Pakisabihan ang admin na simulan ang session.`);
        return;
      }

      // Fetch latest transactions for this event so QR and RFID matching never uses stale state
      const txnRes = await distributionApi.getTransactions(selectedEvent);
      const transactions = txnRes.data.data || [];

      const qrToken = cleanInput.replace(/^EBMS-QR:/i, '').trim();
      const matchesInput = (b) => {
        if (!b) return false;
        const rfidVal = String(b.RFID_number || '').trim().toLowerCase();
        const qrVal = String(b.qr_token || b.qr_code_token || '').trim().toLowerCase();
        const qrFullVal = String(b.qr_code || '').trim().toLowerCase();
        const codeVal = String(b.beneficiary_id_code || '').trim().toLowerCase();
        const rawLower = cleanInput.toLowerCase();
        const tokenLower = qrToken.toLowerCase();

        const matchesRfid = rfidVal && (rfidVal === rawLower || rfidVal === tokenLower);
        const matchesQr =
          (qrVal && (qrVal === tokenLower || qrVal === rawLower)) ||
          (qrFullVal && (qrFullVal === rawLower || qrFullVal === `ebms-qr:${tokenLower}`));
        const matchesCode = codeVal && (codeVal === tokenLower || codeVal === rawLower);
        return Boolean(matchesRfid || matchesQr || matchesCode);
      };

      const matchedTxn =
        transactions.find((t) => t.status === 'pending' && matchesInput(t.Beneficiary)) ||
        transactions.find((t) => matchesInput(t.Beneficiary));

      const beneficiary = matchedTxn?.Beneficiary || qualifiedBeneficiaries.find(matchesInput);

      if (!beneficiary || !matchedTxn) {
        setError(`Walang kwalipikadong benepisyaryo na may hawak ng RFID / QR Code: "${cleanInput}"`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        return;
      }

      const isDuplicateLocal = scannedRecords.some(
        (r) => r.beneficiaryId === beneficiary.id && r.date === distributionDate
      );

      if (matchedTxn.status === 'released' || isDuplicateLocal) {
        setError(`⚠️ Naka-claim na: Si ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.beneficiary_id_code || 'N/A'}) ay nakatanggap na ng benepisyo sa event na ito! Hindi na kailangang i-scan ulit ang RFID o QR Code.`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        return;
      }

      if (matchedTxn.status !== 'pending') {
        setError(`Walang nakabinbing ayuda (pending transaction) para kay ${beneficiary.first_name} ${beneficiary.last_name}`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        return;
      }

      const transaction = matchedTxn;
      const isRfidScan = Boolean(
        beneficiary.RFID_number &&
        beneficiary.RFID_number.trim().toLowerCase() === cleanInput.toLowerCase()
      );

      await distributionApi.releaseBenefit(selectedEvent, transaction.id, {
        verification_method: isRfidScan ? 'rfid' : 'qr_code',
        signature_data: isRfidScan ? 'RFID_VERIFIED' : 'QR_VERIFIED',
        notes: `Released via ${isRfidScan ? 'RFID Card' : 'QR Code Pass'} scan at ${releaseTime}`
      });

      playSuccessBeep();

      const regularAmt = parseFloat(transaction.amount || 0);
      const retroAmt = parseFloat(transaction.retro_amount || 0);
      const totalPayout = regularAmt + retroAmt;
      const retroPeriods = transaction.retro_periods || 0;
      const isNonCash = transaction.disbursement_type === 'in_kind' || Boolean(transaction.item_name);

      const successMsg = isNonCash && totalPayout === 0
        ? `✅ ${beneficiary.first_name} ${beneficiary.last_name} (${beneficiary.beneficiary_id_code || 'N/A'}) - Na-release na ang benepisyo: ${transaction.item_name || 'In-Kind Relief Package'} (${isRfidScan ? 'RFID Card' : 'QR Pass'})!`
        : retroPeriods > 0
          ? `✅ ${beneficiary.first_name} ${beneficiary.last_name} - Na-release ang benepisyo! Kabuuan: ₱${totalPayout.toLocaleString('en-PH', { minimumFractionDigits: 2 })} (Regular: ₱${regularAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })} + Retro: ₱${retroAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })} para sa ${retroPeriods} period(s))`
          : `✅ ${beneficiary.first_name} ${beneficiary.last_name} - Na-release ang benepisyo! Halaga: ₱${regularAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

      setSuccess(successMsg);

      const newRecord = {
        id: Date.now(),
        beneficiaryId: beneficiary.id,
        rfid: isRfidScan ? (beneficiary.RFID_number || 'RFID') : (beneficiary.beneficiary_id_code || 'QR PASS'),
        name: `${beneficiary.first_name} ${beneficiary.last_name}`,
        beneficiary_id_code: beneficiary.beneficiary_id_code,
        category: beneficiary.category,
        amount: totalPayout,
        item_name: transaction.item_name || null,
        regular_amount: regularAmt,
        retro_amount: retroAmt,
        retro_periods: retroPeriods,
        time: releaseTime,
        date: distributionDate,
        status: 'released',
        verificationMethod: isRfidScan ? 'RFID Card' : 'QR Pass'
      };

      setScannedRecords((prev) => [newRecord, ...prev]);
      const remainingPending = transactions
        .filter((t) => t.status === 'pending' && t.id !== transaction.id && t.Beneficiary)
        .map((t) => t.Beneficiary);
      setQualifiedBeneficiaries(remainingPending);
      setRfidInput('');

      setTimeout(() => {
        if (rfidInputRef.current) rfidInputRef.current.focus();
      }, 100);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error:', err);
      if (err.response) {
        const status = err.response.status;
        const message = err.response.data?.message || err.message;
        const errorCode = err.response.data?.error_code;
        
        if (errorCode === 'SESSION_NOT_ACTIVE') {
          setError(`❌ ${message} - Pakisabihan ang admin na simulan ang distribution session, pagkatapos ay i-click ang Refresh.`);
        } else if (status === 409 || errorCode === 'ALREADY_RELEASED') {
          setError(`⚠️ Naka-claim na: ${message}`);
        } else if (status === 404) {
          setError(`❌ Hindi nahanap: ${message}`);
        } else {
          setError(`Error: ${message}`);
        }
      } else if (err.request) {
        setError('❌ Network error: Hindi makakonekta sa server');
      } else {
        setError(err.message || 'Nabigong mag-record ng benepisyo');
      }
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 800);
    }
  };

  const executeScanRef = useRef(executeScan);
  executeScanRef.current = executeScan;

  const handleScan = (e) => {
    e.preventDefault();
    executeScan(rfidInput);
  };

  const openCameraCapture = () => {
    setCameraCaptureMode(true);
    setCameraError(null);
    setCameraLoading(false);
    setIsCameraActive(true);
    cameraCaptureInputRef.current?.click();
  };

  const stopCameraScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera QR scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
    setCameraError(null);
    setCameraCaptureMode(false);
  }, []);

  const startCameraScanner = async () => {
    if (!selectedEvent) {
      setError('Pumili muna ng Distribution Event bago buksan ang camera scanner.');
      return;
    }

    const currentEvent = distributionEvents.find(e => e.id === Number(selectedEvent));
    if (currentEvent && currentEvent.status !== 'ongoing') {
      setError(`Distribution session status is "${currentEvent.status}". Kailangan muna itong simulan bago makapag-scan.`);
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      openCameraCapture();
      return;
    }

    setCameraError(null);
    setCameraLoading(true);
    setIsCameraActive(true);
    setCameraCaptureMode(false);

    setTimeout(async () => {
      try {
        const qrContainer = document.getElementById('qr-dist-camera-reader');
        if (!qrContainer) {
          throw new Error('Camera reader container not found');
        }

        const html5QrCode = new Html5Qrcode('qr-dist-camera-reader');
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            console.log('Camera scanned QR code:', decodedText);
            if (!isProcessingScanRef.current && executeScanRef.current) {
              executeScanRef.current(decodedText);
            }
          },
          () => {}
        );
        setCameraLoading(false);
      } catch (err) {
        console.error('Failed to start camera scanner:', err);
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
            : err.message || 'Hindi ma-access ang camera. Siguraduhing pinayagan ang camera permission.');
        setCameraLoading(false);
        setIsCameraActive(false);
      }
    }, 250);
  };

  const handleCameraImageSelected = async (event) => {
    const imageFile = event.target.files?.[0];
    event.target.value = '';
    if (!imageFile) return;

    setCameraLoading(true);
    setCameraError(null);
    let scanner;
    try {
      scanner = new Html5Qrcode('qr-dist-camera-reader');
      html5QrCodeRef.current = scanner;
      const decodedText = await scanner.scanFile(imageFile, false);
      await scanner.clear();
      html5QrCodeRef.current = null;
      setIsCameraActive(false);
      setCameraCaptureMode(false);
      setCameraLoading(false);
      if (executeScanRef.current) {
        await executeScanRef.current(decodedText);
      }
    } catch (err) {
      console.error('QR image scan error:', err);
      setCameraError('Hindi mabasa ang QR code sa larawan. Subukang kunan itong muli nang malinaw at malapit.');
      setCameraLoading(false);
    } finally {
      if (scanner && html5QrCodeRef.current === scanner) {
        try {
          await scanner.clear();
        } catch (clearError) {
          console.warn('QR image cleanup error:', clearError);
        }
        html5QrCodeRef.current = null;
      }
    }
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
    if (!selectedEvent) {
      if (isCameraActive) {
        stopCameraScanner();
      }
    }
  }, [selectedEvent, isCameraActive, stopCameraScanner]);

  return (
    <div className="space-y-6">
      <input
        ref={cameraCaptureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraImageSelected}
        className="hidden"
        aria-label="Kunan o pumili ng larawan ng QR code"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">RFID Distribution Scanner</h1>
            <p className="text-sm text-slate-600 mt-1">Tap RFID cards to verify and release benefits for distribution events.</p>
          </div>
        </div>
        <button
          onClick={fetchDistributionEvents}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Events'}
        </button>
      </div>

      {/* Scanner Setup */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Event Setup</h2>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Error loading events</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!error && distributionEvents.length === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-medium">No distribution events available</p>
              <p>There are currently no scheduled or ongoing distribution events. Please contact the admin to create and publish a distribution event first.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Distribution Event Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Distribution Event
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">-- Choose a distribution event --</option>
              {distributionEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} {event.target_category || event.Program?.name ? `(${event.target_category || event.Program?.name})` : ''} - {event.distribution_date ? new Date(event.distribution_date).toLocaleDateString() : 'No date set'}
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
              placeholder="Select a distribution event first"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 text-sm cursor-not-allowed"
            />
          </div>
        </div>

        {/* Qualified Beneficiaries Count */}
        {selectedEvent && (
          <>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Qualified Beneficiaries: {qualifiedBeneficiaries.length}</p>
                <p>Only enrolled beneficiaries with pending status can be scanned for this event.</p>
              </div>
            </div>
            
            {/* Event Status Indicator */}
            {(() => {
              const currentEvent = distributionEvents.find(e => e.id === Number(selectedEvent));
              if (!currentEvent) return null;
              
              const statusColors = {
                scheduled: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                ongoing: 'bg-green-50 border-green-200 text-green-700',
                completed: 'bg-gray-50 border-gray-200 text-gray-700'
              };
              
              const statusMessages = {
                scheduled: '⏸️ Session not started - Ask admin to start the session before scanning',
                ongoing: '✅ Session active - Ready to scan RFID cards',
                completed: '✓ Session completed - No more scans allowed'
              };
              
              return (
                <div className={`rounded-lg border p-4 flex items-start gap-3 ${statusColors[currentEvent.status] || statusColors.scheduled}`}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm flex-1">
                    <p className="font-medium">Event Status: {currentEvent.status.toUpperCase()}</p>
                    <p>{statusMessages[currentEvent.status] || 'Unknown status'}</p>
                    {currentEvent.status === 'completed' && (
                      <button
                        onClick={handleExportToExcel}
                        className="mt-3 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors inline-flex items-center justify-center shadow-sm"
                        title="Export Excel Report (Claimed & Unclaimed Lists)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Dual Scanner Card: RFID + Camera QR Scanner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 rounded-xl border-2 border-blue-200 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                <CreditCard className="w-3.5 h-3.5" />
                RFID Tap Card
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                <QrCode className="w-3.5 h-3.5" />
                QR Code Scanner
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-2">Distribution Scanner Ready</h2>
            <p className="text-sm text-slate-600">
              I-tap ang RFID card o gamitin ang camera scanner para sa QR pass ng kwalipikadong benepisyaryo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isCameraActive ? stopCameraScanner : startCameraScanner}
              disabled={!selectedEvent || (cameraCaptureMode && cameraLoading)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                !selectedEvent
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : isCameraActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {cameraLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {cameraCaptureMode ? 'Binabasa ang QR image...' : 'Binubuksan ang Camera...'}
                </>
              ) : isCameraActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  Itigil ang Camera
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  📷 Buksan ang Camera QR Scanner
                </>
              )}
            </button>
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                selectedEvent ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
              }`}
              title={selectedEvent ? 'Scanner Active' : 'Pumili muna ng event'}
            />
          </div>
        </div>

        {/* Live Camera Viewfinder Modal / Inline View */}
        {isCameraActive && (
          <div className="rounded-xl border-2 border-emerald-400 bg-black/95 p-4 text-center text-white space-y-3">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-medium px-2">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
                {cameraCaptureMode ? 'QR Photo Scanner' : 'Live Camera QR Scanner Active'}
              </span>
              <span>{cameraCaptureMode ? 'Kunan o pumili ng QR image' : 'Itutok ang QR Code ng benepisyaryo sa kahon'}</span>
            </div>

            {cameraCaptureMode && (
              <div className="space-y-3">
                <div className="rounded-lg border border-blue-400/40 bg-blue-900/40 p-3 text-xs text-blue-100">
                  Kailangan ng HTTPS para sa live camera preview, pero hindi secure ang URL na ito. Kunan ang QR code o pumili ng malinaw na larawan para mabasa ito.
                </div>
                {cameraLoading ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-100">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Binabasa ang QR image...
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => cameraCaptureInputRef.current?.click()}
                    className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
                  >
                    <Camera className="h-4 w-4" />
                    Kunan / pumili ulit ng QR image
                  </button>
                )}
              </div>
            )}
            
            <div
              id="qr-dist-camera-reader"
              className={`w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black ${cameraCaptureMode ? 'hidden' : ''}`}
              style={{ minHeight: cameraCaptureMode ? 0 : '260px' }}
            />

            <p className="text-xs text-slate-300">
              {cameraCaptureMode
                ? 'Pagkatapos makunan ang QR, awtomatiko itong babasahin at ibe-verify ang benepisyaryo.'
                : 'Awtomatikong mare-release ang ayuda oras na mabasa ang QR Pass token.'}
            </p>
          </div>
        )}

        {cameraError && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-rose-700">{cameraError}</p>
              {!cameraCaptureMode && (
                <button
                  type="button"
                  onClick={openCameraCapture}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
                >
                  <Camera className="h-4 w-4" />
                  Kunan ng QR photo
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleScan} className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <QrCode className="w-5 h-5 text-blue-500" />
            </div>
            <input
              ref={rfidInputRef}
              type="text"
              value={rfidInput}
              onChange={(e) => setRfidInput(e.target.value)}
              placeholder={
                selectedEvent
                  ? "I-tap ang RFID card o i-scan gamit ang barcode/QR scanner..."
                  : "Pumili muna ng distribution event sa itaas..."
              }
              disabled={!selectedEvent || loading}
              className={`w-full pl-12 pr-6 py-4 border-2 rounded-xl text-center text-base sm:text-lg font-mono focus:outline-none transition-all shadow-inner ${
                selectedEvent
                  ? 'border-blue-400 bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-600'
                  : 'border-slate-300 bg-slate-100 cursor-not-allowed text-slate-400'
              }`}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-2 animate-fade-in">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 font-medium">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedEvent || !rfidInput.trim()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Pinoproseso ang scan...
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                I-proseso ang RFID o QR Pass
              </>
            )}
          </button>
        </form>
      </div>

      {/* Scanned Records */}
      {scannedRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Today's Scans ({scannedRecords.length})</h2>
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
                    <p className="text-xs text-slate-600 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>{record.rfid}</span>
                      {record.category && <span>• {record.category}</span>}
                      {record.verificationMethod && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          record.verificationMethod.includes('QR')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {record.verificationMethod}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-700">
                    ₱{parseFloat(record.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {record.retro_periods > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        ⚡ +₱{parseFloat(record.retro_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} ({record.retro_periods}p)
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-medium">
                      {record.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Box */}
      {!selectedEvent ? (
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
            <p>Event: <span className="font-semibold">{eventName}</span> | Qualified: <span className="font-semibold">{qualifiedBeneficiaries.length} beneficiaries</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

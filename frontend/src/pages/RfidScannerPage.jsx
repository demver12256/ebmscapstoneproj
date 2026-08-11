import { useState, useEffect, useRef } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Clock, Download, Users, RefreshCw } from 'lucide-react';
import { attendanceApi, distributionApi } from '../services/api';
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
  const rfidInputRef = useRef(null);

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
        ['EBMS DISTRIBUTION SESSION REPORT'],
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
        ['#', 'Transaction #', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Barangay', 'Category', 'Claim Date & Time', 'Amount Released (₱)', 'Released By Staff', 'Status']
      ];

      claimedTxns.forEach((txn, index) => {
        const ben = txn.Beneficiary || {};
        const staff = txn.ReleasedByStaff ? `${txn.ReleasedByStaff.first_name || ''} ${txn.ReleasedByStaff.last_name || ''}`.trim() : 'N/A';
        worksheetData.push([
          index + 1,
          txn.transaction_number || 'N/A',
          ben.RFID_number || 'N/A',
          `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'N/A',
          ben.beneficiary_id_code || 'N/A',
          ben.Barangay?.barangay_name || selectedEventData?.Barangay?.barangay_name || 'N/A',
          ben.category || 'N/A',
          txn.released_at ? new Date(txn.released_at).toLocaleString() : 'N/A',
          parseFloat(txn.amount || 0),
          staff,
          'Claimed'
        ]);
      });

      worksheetData.push([]);
      worksheetData.push(['========================================================================================']);
      worksheetData.push(['2. UNCLAIMED BENEFICIARIES (HINDI NAKA-CLAIM)']);
      worksheetData.push(['========================================================================================']);
      worksheetData.push(['#', 'Transaction #', 'RFID Number', 'Beneficiary Name', 'ID Code', 'Barangay', 'Category', 'Contact Number', 'Allocated Amount (₱)', 'Status']);

      unclaimedTxns.forEach((txn, index) => {
        const ben = txn.Beneficiary || {};
        worksheetData.push([
          index + 1,
          txn.transaction_number || 'N/A',
          ben.RFID_number || 'N/A',
          `${ben.first_name || ''} ${ben.last_name || ''}`.trim() || 'N/A',
          ben.beneficiary_id_code || 'N/A',
          ben.Barangay?.barangay_name || selectedEventData?.Barangay?.barangay_name || 'N/A',
          ben.category || 'N/A',
          ben.contact_number || 'N/A',
          parseFloat(txn.amount || 0),
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

  const handleScan = async (e) => {
    e.preventDefault();
    
    if (!selectedEvent) {
      setError('Please select a distribution event first');
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
      const distributionDate = now.toISOString().split('T')[0];
      const releaseTime = now.toTimeString().split(' ')[0];

      // Verify event status is 'ongoing' before attempting release
      const selectedEventData = distributionEvents.find(e => e.id === Number(selectedEvent));
      if (!selectedEventData) {
        setError('Selected event not found. Please refresh and try again.');
        setLoading(false);
        return;
      }

      if (selectedEventData.status !== 'ongoing') {
        setError(`❌ Distribution session is not active (Status: ${selectedEventData.status}). Please ask the admin to start the session first.`);
        setLoading(false);
        return;
      }

      // Find beneficiary by RFID number from qualified list
      const beneficiary = qualifiedBeneficiaries.find((b) => b.RFID_number === rfidNumber);
      
      if (!beneficiary) {
        setError(`No qualified beneficiary found with RFID: ${rfidNumber}`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        setLoading(false);
        return;
      }

      // Check for duplicate scan in today's records
      const isDuplicate = scannedRecords.some(
        (r) => r.rfid === rfidNumber && r.date === distributionDate
      );

      if (isDuplicate) {
        setError(`${beneficiary.first_name} ${beneficiary.last_name} already claimed benefits for this event`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        setLoading(false);
        return;
      }

      // Get the transaction for this beneficiary
      const txnRes = await distributionApi.getTransactions(selectedEvent);
      const transactions = txnRes.data.data || [];
      const transaction = transactions.find(txn => 
        txn.beneficiary_id === beneficiary.id && txn.status === 'pending'
      );

      if (!transaction) {
        setError(`No pending transaction found for ${beneficiary.first_name} ${beneficiary.last_name}`);
        setRfidInput('');
        setTimeout(() => {
          if (rfidInputRef.current) rfidInputRef.current.focus();
        }, 100);
        setLoading(false);
        return;
      }

      // Release the benefit via distribution API
      await distributionApi.releaseBenefit(selectedEvent, transaction.id, {
        verification_method: 'rfid',
        signature_data: 'RFID_VERIFIED', // Required by backend - mark as RFID verified
        notes: `Released via RFID scan at ${releaseTime}`
      });

      setSuccess(`✅ ${beneficiary.first_name} ${beneficiary.last_name} - Benefit released! Amount: ₱${parseFloat(transaction.amount).toLocaleString()}`);
      setScannedRecords([
        {
          id: Date.now(),
          rfid: rfidNumber,
          name: `${beneficiary.first_name} ${beneficiary.last_name}`,
          beneficiary_id_code: beneficiary.beneficiary_id_code,
          category: beneficiary.category,
          amount: transaction.amount,
          time: releaseTime,
          date: distributionDate,
          status: 'released'
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
      
      // Handle different error types
      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        const message = err.response.data?.message || err.message;
        const errorCode = err.response.data?.error_code;
        
        if (errorCode === 'SESSION_NOT_ACTIVE') {
          // Session not active - needs to be started
          setError(`❌ ${message} - Please ask the admin to start the distribution session first, then click the Refresh button.`);
        } else if (status === 409 || errorCode === 'ALREADY_RELEASED') {
          // Conflict - duplicate release
          setError(`⚠️ Already claimed: ${message}`);
        } else if (status === 404) {
          // Not found - invalid RFID
          setError(`❌ RFID not found: ${message}`);
        } else {
          setError(`Error: ${message}`);
        }
      } else if (err.request) {
        // Request made but no response
        setError('❌ Network error: Cannot connect to server');
      } else {
        // Other errors
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
                  {event.Program?.eligibility_category || event.Program?.category} - {event.Program?.name || 'N/A'} ({event.distribution_date ? new Date(event.distribution_date).toLocaleDateString() : 'No date set'})
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

      {/* RFID Scanner Input */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">RFID Scanner Ready</h2>
            <p className="text-sm text-slate-600 mt-1">Tap cards here to record attendance</p>
          </div>
          <div className={`w-4 h-4 rounded-full animate-pulse ${selectedEvent ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <form onSubmit={handleScan} className="space-y-3">
          <input
            ref={rfidInputRef}
            type="text"
            value={rfidInput}
            onChange={(e) => setRfidInput(e.target.value)}
            placeholder="Tap RFID card here..."
            disabled={!selectedEvent}
            className={`w-full px-6 py-4 border-2 rounded-lg text-center text-lg font-mono focus:outline-none transition-all ${
              selectedEvent
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
            disabled={loading || !selectedEvent}
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
                    <p className="text-xs text-slate-600 font-mono">{record.rfid}</p>
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

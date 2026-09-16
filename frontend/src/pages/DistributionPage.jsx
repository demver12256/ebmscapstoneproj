import { useEffect, useState, useCallback } from 'react';
import { 
  Package, Plus, Calendar, MapPin, Users, DollarSign, 
  Eye, Edit, Trash2, CheckCircle, XCircle, Clock,
  Play, Square, AlertCircle, TrendingUp, Filter, RefreshCw, Archive, Download, AlertTriangle,
  Zap, CreditCard, Smartphone, Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { distributionApi, programApi, barangayApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isNonCashProgram, getNonCashDetails } from '../utils/nonCashPrograms';

export default function DistributionPage() {
  const { user } = useAuth();
  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('all');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEligibleModal, setShowEligibleModal] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    program_id: '',
    barangay_id: '',
    distribution_date: '',
    venue: '',
    budget: '',
    amount_per_beneficiary: '',
    assigned_staff_id: '',
    notes: '',
    target_category: '', // 4Ps, Senior Citizen, PWD, etc.
    item_name: '',
    item_quantity: '1',
    item_unit: 'package',
    benefit_type: 'Cash'
  });
  
  // Reference data
  const [programs, setPrograms] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [staff, setStaff] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Track if barangay/category were auto-filled from program
  const [programAutoFilled, setProgramAutoFilled] = useState(false);
  
  // Selected event for viewing details
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eligibleBeneficiaries, setEligibleBeneficiaries] = useState([]);
  const [eligibleMeta, setEligibleMeta] = useState({ total: 0, qualified_count: 0, program_name: '' });
  const [disbursingDigital, setDisbursingDigital] = useState(false);

  // Status badge configuration
  const STATUS_CONFIG = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit },
    scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Calendar },
    ongoing: { label: 'Ongoing', color: 'bg-yellow-100 text-yellow-700', icon: Play },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500', icon: Square }
  };

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (barangayFilter !== 'all') params.barangay_id = barangayFilter;
      
      const res = await distributionApi.listEvents(params);
      const rawEvents = res.data.data || [];
      const scopedEvents = isMswdoAdmin
        ? rawEvents.filter(e => e.agency === 'MSWDO' || e.Program?.agency === 'MSWDO')
        : user?.role === 'admin'
        ? rawEvents.filter(e => !e.agency || e.agency === 'DSWD' || e.Program?.agency === 'DSWD')
        : rawEvents;
      setEvents(scopedEvents);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load distribution events');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, barangayFilter, isMswdoAdmin, user?.role]);

  const loadDashboardStats = useCallback(async () => {
    try {
      const params = {};
      if (barangayFilter !== 'all') params.barangay_id = barangayFilter;
      const res = await distributionApi.getDashboardStats(params);
      setStats(res.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load stats:', err);
      console.error('Error response:', err.response?.data);
      // Don't show error to user for stats - it's not critical
    }
  }, [barangayFilter]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [programsRes, barangaysRes, usersRes] = await Promise.all([
        programApi.list(),
        barangayApi.list(),
        userApi.list()
      ]);
      const rawProgs = programsRes.data.data || [];
      const scopedProgs = isMswdoAdmin
        ? rawProgs.filter(p => p.agency === 'MSWDO')
        : user?.role === 'admin'
        ? rawProgs.filter(p => !p.agency || p.agency === 'DSWD')
        : rawProgs;
      setPrograms(scopedProgs);
      setBarangays(barangaysRes.data.data || []);
      // Filter users to only staff/barangay roles
      const staffUsers = (usersRes.data.data || []).filter(
        u => u.role === 'staff' || u.role === 'barangay'
      );
      setStaff(staffUsers);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  }, [isMswdoAdmin, user?.role]);

  // Load reference data on mount
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Load events & dashboard stats when filters change or on mount
  useEffect(() => {
    loadEvents();
    loadDashboardStats();
  }, [loadEvents, loadDashboardStats]);

  // Real-time polling: auto-refresh every 5s if ongoing/scheduled, or every 10s otherwise
  useEffect(() => {
    const hasOngoingEvents = events.some(e => e.status === 'ongoing' || e.status === 'scheduled');
    const pollInterval = hasOngoingEvents ? 5000 : 10000;
    
    const interval = setInterval(() => {
      loadEvents();
      loadDashboardStats();
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [events, loadEvents, loadDashboardStats]);

  // Handle program selection — auto-fill barangay & category from program data
  const handleProgramChange = async (programId) => {
    if (!programId) {
      setFormData(prev => ({ ...prev, program_id: '', barangay_id: '', target_category: '' }));
      setProgramAutoFilled(false);
      setEligibleBeneficiaries([]);
      setEligibleMeta({ total: 0, qualified_count: 0, program_name: '' });
      return;
    }

    const selectedProgram = programs.find(p => p.id === parseInt(programId));
    if (!selectedProgram) {
      setFormData(prev => ({ ...prev, program_id: programId }));
      return;
    }

    // Auto-fill barangay and category from program
    const isNonCash = isNonCashProgram(selectedProgram.name, selectedProgram.benefit_type);
    const nonCashDetails = isNonCash ? getNonCashDetails(selectedProgram.name) : null;

    const updatedForm = {
      ...formData,
      program_id: programId,
      barangay_id: selectedProgram.barangay_id ? String(selectedProgram.barangay_id) : '',
      target_category: selectedProgram.eligibility_category || '',
      benefit_type: isNonCash ? (nonCashDetails?.type || 'In-Kind') : 'Cash',
      amount_per_beneficiary: isNonCash ? '0' : (selectedProgram.amount ? selectedProgram.amount.toString() : ''),
      item_name: isNonCash ? (nonCashDetails?.default_item || '') : '',
      item_quantity: '1',
      item_unit: 'package',
    };
    setFormData(updatedForm);
    setProgramAutoFilled(true);

    // Auto-trigger preview of eligible beneficiaries
    if (selectedProgram.barangay_id) {
      setLoading(true);
      try {
        const res = await programApi.getEnrolledBeneficiaries(programId);
        let enrolledBeneficiaries = res.data.data || [];

        // AUTO-ENROLL: If no enrolled beneficiaries, trigger auto-enrollment
        if (enrolledBeneficiaries.length === 0) {
          try {
            const autoEnrollRes = await programApi.autoEnrollBeneficiaries(programId);
            const updatedRes = await programApi.getEnrolledBeneficiaries(programId);
            enrolledBeneficiaries = updatedRes.data.data || [];
            setSuccess(autoEnrollRes.data.message || `Successfully auto-enrolled ${autoEnrollRes.data?.data?.newly_enrolled || 0} beneficiary(ies)`);
            setTimeout(() => setSuccess(null), 5000);
          } catch (autoEnrollError) {
            console.error('Auto-enrollment failed:', autoEnrollError);
          }
        }

        // Filter by barangay
        enrolledBeneficiaries = enrolledBeneficiaries.filter(
          b => b.barangay_id === parseInt(selectedProgram.barangay_id)
        );

        // Filter by category if program has one
        if (selectedProgram.eligibility_category) {
          enrolledBeneficiaries = enrolledBeneficiaries.filter(
            b => b.category && b.category.includes(selectedProgram.eligibility_category)
          );
        }

        // Filter by approved status
        const qualifiedBeneficiaries = enrolledBeneficiaries.filter(b => b.status === 'Approved');

        // Suggest default amount per beneficiary from program if available (only for cash)
        if (!isNonCash && selectedProgram.amount && !formData.amount_per_beneficiary) {
          setFormData(prev => ({
            ...prev,
            amount_per_beneficiary: selectedProgram.amount.toString()
          }));
        }

        setEligibleBeneficiaries(qualifiedBeneficiaries);
        setEligibleMeta({
          total: enrolledBeneficiaries.length,
          qualified_count: qualifiedBeneficiaries.length,
          program_name: selectedProgram.name || '',
        });
      } catch (err) {
        console.error('Failed to load enrolled beneficiaries:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const selectedProgram = programs.find(p => p.id === parseInt(formData.program_id));
      const isNonCash = isNonCashProgram(selectedProgram?.name, formData.benefit_type || selectedProgram?.benefit_type);
      const nonCashDetails = isNonCash ? getNonCashDetails(selectedProgram?.name) : null;

      const amountPerBen = isNonCash ? 0 : parseFloat(formData.amount_per_beneficiary || 0);
      const benCount = eligibleMeta.qualified_count || 1;
      const computedBudget = isNonCash ? 0 : (amountPerBen * benCount);

      await distributionApi.createEvent({
        ...formData,
        agency: isMswdoAdmin ? 'MSWDO' : 'DSWD',
        amount_per_beneficiary: amountPerBen,
        budget: computedBudget,
        benefit_type: isNonCash ? (formData.benefit_type || nonCashDetails?.type || 'In-Kind') : 'Cash',
        item_name: isNonCash ? (formData.item_name || nonCashDetails?.default_item || 'In-Kind Package') : null,
        item_quantity: isNonCash ? (parseInt(formData.item_quantity, 10) || 1) : 1,
        item_unit: isNonCash ? (formData.item_unit || 'package') : null,
        venue: formData.venue?.trim() || null,
      });
      setSuccess('Distribution event created successfully!');
      setFormData({
        title: '',
        program_id: '',
        barangay_id: '',
        distribution_date: '',
        venue: '',
        budget: '',
        amount_per_beneficiary: '',
        assigned_staff_id: '',
        notes: '',
        target_category: '',
        item_name: '',
        item_quantity: '1',
        item_unit: 'package',
        benefit_type: 'Cash'
      });
      await loadEvents();
      await loadDashboardStats();
      setTimeout(() => {
        setShowCreateModal(false);
        setSuccess(null);
      }, 2000);
    } catch (err) {
      console.error('Create event error:', err);
      console.error('Error response:', err.response?.data);
      
      // Extract specific error message from backend
      let errorMessage = 'Failed to create distribution event';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // If there are specific field errors, display them
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const fieldErrors = err.response.data.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        errorMessage += ` - ${fieldErrors}`;
      }
      
      // If there are missing fields, display them
      if (err.response?.data?.missing_fields && Array.isArray(err.response.data.missing_fields)) {
        errorMessage += ` (Missing: ${err.response.data.missing_fields.join(', ')})`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewEligible = async () => {
    if (!formData.program_id || !formData.barangay_id) {
      setError('Please select both program and barangay first');
      return;
    }
    
    setLoading(true);
    try {
      // Get the selected program
      const selectedProgram = programs.find(p => p.id === parseInt(formData.program_id));
      
      // Get enrolled beneficiaries for the program
      const res = await programApi.getEnrolledBeneficiaries(formData.program_id);
      let enrolledBeneficiaries = res.data.data || [];
      
      // AUTO-ENROLL: If no enrolled beneficiaries, trigger auto-enrollment
      if (enrolledBeneficiaries.length === 0) {
        console.log('No enrolled beneficiaries found. Triggering auto-enrollment...');
        try {
          const autoEnrollRes = await programApi.autoEnrollBeneficiaries(formData.program_id);
          console.log('Auto-enrollment result:', autoEnrollRes.data);
          
          // Reload enrolled beneficiaries after auto-enrollment
          const updatedRes = await programApi.getEnrolledBeneficiaries(formData.program_id);
          enrolledBeneficiaries = updatedRes.data.data || [];
          
          // Show success message
          setSuccess(autoEnrollRes.data.message || `Successfully auto-enrolled ${autoEnrollRes.data.data.newly_enrolled} beneficiary(ies)`);
          setTimeout(() => setSuccess(null), 5000);
        } catch (autoEnrollError) {
          console.error('Auto-enrollment failed:', autoEnrollError);
          // Continue with empty list if auto-enrollment fails
        }
      }
      
      // Filter by barangay (should already match, but double-check)
      enrolledBeneficiaries = enrolledBeneficiaries.filter(
        b => b.barangay_id === parseInt(formData.barangay_id)
      );
      
      // Further filter by target_category if specified
      if (formData.target_category) {
        enrolledBeneficiaries = enrolledBeneficiaries.filter(
          b => b.category && b.category.includes(formData.target_category)
        );
      }
      
      // Filter by status = Approved (extra validation)
      const qualifiedBeneficiaries = enrolledBeneficiaries.filter(
        b => b.status === 'Approved'
      );
      
      setEligibleBeneficiaries(qualifiedBeneficiaries);
      setEligibleMeta({
        total: enrolledBeneficiaries.length,
        qualified_count: qualifiedBeneficiaries.length,
        program_name: selectedProgram?.name || '',
      });
      setShowEligibleModal(true);
    } catch (err) {
      setError(err.message || 'Failed to load enrolled beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishEvent = async (eventId) => {
    let confirmMsg = 'Are you sure you want to publish this event? This will create transactions for all eligible beneficiaries and send notifications.';
    
    try {
      const previewRes = await distributionApi.getRetroPreview(eventId);
      if (previewRes.data?.success) {
        const preview = previewRes.data.data;
        if (preview.beneficiaries_with_retro > 0) {
          confirmMsg = `⚡ RETROACTIVE PAYMENTS DETECTED:\n\n` +
            `• ${preview.beneficiaries_with_retro} beneficiaries will receive retroactive backpay for missed past periods.\n` +
            `• Regular Total: ₱${parseFloat(preview.regular_total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n` +
            `• Retroactive Backpay: +₱${parseFloat(preview.retro_total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n` +
            `• Grand Total Required: ₱${parseFloat(preview.grand_total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n` +
            `• Available Budget: ₱${parseFloat(preview.available_budget).toLocaleString('en-PH', { minimumFractionDigits: 2 })}\n\n` +
            (preview.budget_sufficient
              ? '✅ Budget is sufficient to cover regular + retro payments. Proceed with publishing?'
              : `⚠️ INSUFFICIENT BUDGET! Deficit: ₱${parseFloat(preview.deficit).toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Publishing will be rejected unless budget is increased.\n\nAttempt to publish anyway?`);
        }
      }
    } catch (err) {
      console.warn('Could not check retro preview before publish:', err);
    }

    if (!window.confirm(confirmMsg)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await distributionApi.publishEvent(eventId);
      const retroCount = res.data?.summary?.beneficiaries_with_retro || 0;
      const retroInfo = retroCount > 0 ? ` (${retroCount} with retroactive backpay)` : '';
      setSuccess(`Event published successfully! Notifications sent to staff and beneficiaries${retroInfo}.`);
      await loadEvents();
      await loadDashboardStats();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Publish event error:', err);
      console.error('Error response:', err.response?.data);
      
      const errorData = err.response?.data;
      
      if (errorData?.error_code === 'INSUFFICIENT_BUDGET_WITH_RETRO') {
        const details = errorData.details;
        setError(`Insufficient Budget for Retroactive Payments: Grand Total ₱${parseFloat(details?.grand_total || 0).toLocaleString()} (Regular: ₱${parseFloat(details?.regular_total || 0).toLocaleString()} + Retro: ₱${parseFloat(details?.retro_total || 0).toLocaleString()}). You need ₱${parseFloat(details?.deficit || 0).toLocaleString()} more.`);
      } else if (errorData?.error_code === 'INSUFFICIENT_BUDGET') {
        const deficit = parseFloat(errorData.details?.deficit || 0);
        setError(`Insufficient Budget: You need ₱${deficit.toLocaleString()} more.`);
      } else if (errorData?.message) {
        let errorMessage = errorData.message;
        if (errorData.debug) {
          errorMessage += ` (Debug: ${JSON.stringify(errorData.debug)})`;
        }
        setError(errorMessage);
      } else {
        setError(err.message || 'Failed to publish event');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      await distributionApi.deleteEvent(eventId);
      setSuccess('Event deleted successfully');
      await loadEvents();
      await loadDashboardStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (eventId) => {
    if (!window.confirm('Are you sure you want to start this distribution session? Staff will be able to release benefits once started.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await distributionApi.startSession(eventId);
      setSuccess('Distribution session started successfully! Staff can now begin releasing benefits.');
      await loadEvents();
      await loadDashboardStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async (eventId) => {
    if (!window.confirm('Are you sure you want to end this distribution session? No more benefits can be released after ending.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await distributionApi.endSession(eventId);
      const message = res.data?.message || 'Distribution session ended successfully';
      setSuccess(message);
      await loadEvents();
      await loadDashboardStats();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to end session');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async (eventData) => {
    if (!eventData || !eventData.id) return;
    setLoading(true);
    try {
      const res = await distributionApi.getTransactions(eventData.id);
      const transactions = res.data?.data || [];

      const claimedTxns = transactions.filter(t => t.status === 'released');
      const unclaimedTxns = transactions.filter(t => t.status === 'pending');

      const programName = eventData.Program?.name || 'N/A';
      const barangayName = eventData.Barangay?.barangay_name || 'N/A';
      const amountPerBen = parseFloat(eventData.amount_per_beneficiary || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
      const totalBudget = parseFloat(eventData.budget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

      const worksheetData = [
        ['EBMS BENEFIT DISTRIBUTION REPORT'],
        ['Event Title:', eventData.title],
        ['Program:', programName],
        ['Barangay:', barangayName],
        ['Distribution Date:', eventData.distribution_date || 'N/A'],
        ['Venue:', eventData.venue || 'N/A'],
        ['Total Budget:', `₱${totalBudget}`],
        ['Amount per Beneficiary:', `₱${amountPerBen}`],
        ['Status:', (eventData.status || '').toUpperCase()],
        ['Total Eligible:', transactions.length],
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
          ben.Barangay?.barangay_name || barangayName,
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
          ben.Barangay?.barangay_name || barangayName,
          ben.category || 'N/A',
          ben.contact_number || 'N/A',
          parseFloat(txn.amount || 0),
          'Unclaimed'
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Distribution Report');

      worksheet['!cols'] = Array(11).fill({ wch: 18 });

      const cleanTitle = (eventData.title || 'Distribution').replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `${cleanTitle}_Report_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      setSuccess('Excel report downloaded successfully with Claimed & Unclaimed lists!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      setError('Failed to export Excel report');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (eventId) => {
    setLoading(true);
    try {
      const res = await distributionApi.getEvent(eventId);
      let eventData = res.data.data;
      
      // If event is in draft status and has 0 beneficiaries, calculate eligible count
      if (eventData.status === 'draft' && (eventData.total_beneficiaries === 0 || eventData.total_beneficiaries === null)) {
        try {
          const countRes = await distributionApi.getEligibleCount(eventId);
          if (countRes.data.success) {
            const eligibleData = countRes.data.data;
            // Augment event data with eligible count
            eventData.total_beneficiaries = eligibleData.eligible_count;
            eventData.eligible_count_preview = eligibleData.eligible_count;
            eventData.budget_sufficient = eligibleData.budget_sufficient;
            eventData.budget_deficit = eligibleData.budget_deficit;
            eventData.total_required_amount = eligibleData.total_required;
          }
        } catch (err) {
          console.warn('Could not load eligible count for draft event:', err);
        }
      }
      
      // For draft events, load eligible beneficiaries list to show in the modal
      if (eventData.status === 'draft') {
        try {
          // Get enrolled beneficiaries from the program
          const programRes = await programApi.getEnrolledBeneficiaries(eventData.program_id);
          const enrolledBeneficiaries = programRes.data.data || [];
          
          // Filter based on target category if specified
          const qualifiedBeneficiaries = eventData.target_category
            ? enrolledBeneficiaries.filter(b => 
                b.category && b.category.toLowerCase().includes(eventData.target_category.toLowerCase())
              )
            : enrolledBeneficiaries;
          
          // Store as preview transactions for display
          eventData.Transactions = qualifiedBeneficiaries.map((b, index) => ({
            id: `preview-${index}`,
            beneficiary_id: b.id,
            status: 'pending',
            amount: parseFloat(eventData.amount_per_beneficiary),
            retro_amount: 0,
            retro_periods: 0,
            Beneficiary: b,
            is_preview: true // Mark as preview
          }));
        } catch (err) {
          console.warn('Could not load eligible beneficiaries for draft event:', err);
        }
      }

      // Fetch retroactive payment preview for both draft and published events
      try {
        const retroRes = await distributionApi.getRetroPreview(eventId);
        if (retroRes.data?.success) {
          eventData.retroPreview = retroRes.data.data;

          // If draft, merge calculated retro values into preview transactions
          if (eventData.status === 'draft' && eventData.Transactions && retroRes.data.data.retro_breakdown) {
            const retroMap = new Map();
            retroRes.data.data.retro_breakdown.forEach(r => retroMap.set(r.beneficiary_id, r));

            eventData.Transactions = eventData.Transactions.map(txn => {
              const r = retroMap.get(txn.beneficiary_id);
              if (r) {
                return {
                  ...txn,
                  retro_amount: r.retro_amount,
                  retro_periods: r.retro_periods,
                  retro_details: r.retro_details,
                };
              }
              return txn;
            });
          }
        }
      } catch (err) {
        console.warn('Could not load retro preview for event:', err);
      }
      
      // Fetch digital payout summary
      try {
        if (eventData.status !== 'draft') {
          const payoutRes = await distributionApi.getPayoutSummary(eventId);
          if (payoutRes.data?.success) {
            eventData.payoutSummary = payoutRes.data.data;
          }
        }
      } catch (err) {
        console.warn('Could not load payout summary for event:', err);
      }
      
      setSelectedEvent(eventData);
      setShowDetailsModal(true);
    } catch (err) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleDisburseDigital = async (eventId) => {
    if (!window.confirm('Sigurado ka ba na gusto mong iproseso ang Digital Disbursements para sa event na ito?\n\nAwtomatikong ike-credit ang payout sa mga verified GCash/Maya/Landbank accounts ng mga benepisyaryo at magpapadala ng confirmation notification.')) {
      return;
    }

    setDisbursingDigital(true);
    try {
      const res = await distributionApi.disburseDigital(eventId);
      if (res.data?.success) {
        alert(`✅ ${res.data.message}\nTotal Na-disburse: ₱${parseFloat(res.data.data?.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${res.data.data?.disbursed_count || 0} benepisyaryo)`);
        await handleViewDetails(eventId);
        loadEvents();
      }
    } catch (err) {
      alert(`Error sa digital disbursement: ${err.response?.data?.message || err.message}`);
    } finally {
      setDisbursingDigital(false);
    }
  };

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEvents = events.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(events.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const StatusBadge = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black tracking-tight">Distribution & Assistance Module</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-xl">
            Create, manage, and monitor benefit distributions and assistance events in real time.
            {lastUpdated && (
              <span className="ml-2 text-xs text-yellow-300 font-semibold">
                • Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => { loadEvents(); loadDashboardStats(); }}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2.5 rounded-xl shadow transition border border-white/20 text-sm disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {['admin','mswdo_admin'].includes(user?.role) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-yellow-500/20 transition transform active:scale-95 text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Create Distribution
            </button>
          )}
          <button
            onClick={() => setStatusFilter(statusFilter === 'archived' ? 'all' : 'archived')}
            className={`flex items-center gap-1.5 font-bold px-3.5 py-2.5 rounded-xl shadow transition text-sm whitespace-nowrap ${
              statusFilter === 'archived'
                ? 'bg-yellow-400 text-slate-950 border border-yellow-400'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <Archive className="w-4 h-4 text-purple-300" />
            <span>Archived ({events.filter(e => e.status === 'archived').length})</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-blue-600">Total Events</p>
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{stats.events?.total || 0}</p>
            <p className="text-xs text-blue-600 mt-1">All distribution events</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-green-600">Completed</p>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{stats.events?.completed || 0}</p>
            <p className="text-xs text-green-600 mt-1">Successfully completed</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-yellow-600">Release Rate</p>
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900">
              {stats.transactions?.release_percentage || 0}%
            </p>
            <p className="text-xs text-yellow-600 mt-1">Benefits released</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-purple-600">Total Released</p>
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-900">
              ₱{parseFloat(stats.transactions?.total_amount_released || 0).toLocaleString()}
            </p>
            <p className="text-xs text-purple-600 mt-1">Amount distributed</p>
          </div>
        </div>
      )}

      {/* Events List Tab */}
      <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">Filters:</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600 whitespace-nowrap">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1); // Reset to first page when filtering
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 min-w-[150px]"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Barangay Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600 whitespace-nowrap">Barangay:</label>
                  <select
                    value={barangayFilter}
                    onChange={(e) => {
                      setBarangayFilter(e.target.value);
                      setCurrentPage(1); // Reset to first page when filtering
                    }}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 min-w-[150px]"
                  >
                    <option value="all">All Barangays</option>
                    {barangays.map((barangay) => (
                      <option key={barangay.id} value={barangay.id}>
                        {barangay.barangay_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                {(statusFilter !== 'all' || barangayFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setBarangayFilter('all');
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Results Count */}
              <div className="text-sm text-slate-600 whitespace-nowrap">
                {events.length} {events.length === 1 ? 'event' : 'events'} found
              </div>
            </div>
          </div>

          {/* Events Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="text-sm text-slate-600 mt-2">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No distribution events found</p>
                {['admin','mswdo_admin'].includes(user?.role) && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Create Your First Distribution
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Event Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Program & Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{event.title}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(event.distribution_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-slate-900">{event.Program?.name}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
                              <MapPin className="w-3 h-3" />
                              {event.Barangay?.barangay_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {isNonCashProgram(event.Program?.name || event.title, event.benefit_type) ? (
                              <>
                                <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                                  {getNonCashDetails(event.Program?.name || event.title)?.badge || '📦 In-Kind Goods'}
                                </span>
                                <p className="text-xs text-slate-600 mt-1 truncate max-w-[170px]" title={event.item_name || getNonCashDetails(event.Program?.name || event.title)?.assistance_type}>
                                  {event.item_name || getNonCashDetails(event.Program?.name || event.title)?.assistance_type}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-purple-600">
                                  ₱{parseFloat(event.budget || 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-600">
                                  ₱{parseFloat(event.amount_per_beneficiary || 0).toLocaleString()}/beneficiary
                                </p>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-3 h-3 text-slate-600" />
                              <span className="text-xs">
                                {event.total_released || 0} / {event.total_beneficiaries || 0}
                              </span>
                            </div>
                            <div className="w-24 bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all"
                                style={{
                                  width: `${event.total_beneficiaries > 0 
                                    ? (event.total_released / event.total_beneficiaries * 100) 
                                    : 0}%`
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={event.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewDetails(event.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            
                            {/* Draft Status Actions */}
                            {event.status === 'draft' && ['admin','mswdo_admin'].includes(user?.role) && (
                              <>
                                <button
                                  onClick={() => handlePublishEvent(event.id)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Publish Event"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Event"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            
                            {/* Scheduled Status Actions - START SESSION */}
                            {event.status === 'scheduled' && (['admin','mswdo_admin'].includes(user?.role) || user?.role === 'staff' || user?.role === 'barangay') && (
                              <button
                                onClick={() => handleStartSession(event.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                title="Start Distribution Session"
                              >
                                <Play className="w-4 h-4" />
                                Start Session
                              </button>
                            )}
                            
                            {/* Quick Disburse Digital on event card */}
                            {['admin', 'mswdo_admin'].includes(user?.role) && ['scheduled', 'ongoing'].includes(event.status) && event.Transactions?.some(t => (t.disbursement_type === 'digital' || t.Beneficiary?.payout_preference === 'digital') && t.status === 'pending') && (
                              <button
                                onClick={() => handleDisburseDigital(event.id)}
                                disabled={disbursingDigital}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-xs cursor-pointer"
                                title="Disburse Pending Digital Payouts (GCash/Bank)"
                              >
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                Disburse Digital
                              </button>
                            )}

                            {/* Ongoing Status Actions - END SESSION */}
                            {event.status === 'ongoing' && (['admin','mswdo_admin'].includes(user?.role) || user?.role === 'staff' || user?.role === 'barangay') && (
                              <button
                                onClick={() => handleEndSession(event.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                title="End Distribution Session"
                              >
                                <Square className="w-4 h-4" />
                                End Session
                              </button>
                            )}

                            {/* Completed Status Actions - EXPORT EXCEL REPORT ONLY WHEN SESSION HAS ENDED */}
                            {event.status === 'completed' && (
                               <button
                                 onClick={() => handleExportExcel(event)}
                                 className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                 title="Export Excel Report (Claimed & Unclaimed Lists)"
                               >
                                 <Download className="w-4 h-4" />
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && events.length > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-4 bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, events.length)} of {events.length} events
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index + 1}
                    onClick={() => paginate(index + 1)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === index + 1
                        ? 'bg-purple-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">Create Distribution Event</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setError(null);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCreateEvent} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Cash Assistance for Senior Citizens - Q1 2026"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Program */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Benefit Program *
                </label>
                <select
                  value={formData.program_id}
                  onChange={(e) => handleProgramChange(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select Program</option>
                  {programs.filter(p => p.status === 'active' || String(p.id) === String(formData.program_id)).map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name} {program.eligibility_category ? `[${program.eligibility_category}]` : ''}
                    </option>
                  ))}
                </select>
                {programAutoFilled && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    ✅ Barangay at category auto-filled mula sa program settings
                  </p>
                )}
              </div>

              {/* Barangay */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target Barangay *
                </label>
                <select
                  value={formData.barangay_id}
                  onChange={(e) => { setFormData({ ...formData, barangay_id: e.target.value }); setProgramAutoFilled(false); }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${programAutoFilled ? 'border-green-400 bg-green-50' : 'border-slate-300'}`}
                  required
                >
                  <option value="">Select Barangay</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.barangay_name}
                    </option>
                  ))}
                </select>
                {programAutoFilled && formData.barangay_id && (
                  <p className="text-xs text-green-600 mt-1">📍 Auto-filled from program</p>
                )}
              </div>

              {/* Target Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Target Category
                </label>
                <select
                  value={formData.target_category}
                  onChange={(e) => { setFormData({ ...formData, target_category: e.target.value }); setProgramAutoFilled(false); }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${programAutoFilled && formData.target_category ? 'border-green-400 bg-green-50' : 'border-slate-300'}`}
                >
                  <option value="">All Categories</option>
                  <option value="4Ps Household Beneficiaries">4Ps Household Beneficiaries</option>
                  <option value="Senior Citizens (Social Pension)">Senior Citizens (Social Pension)</option>
                  <option value="Persons with Disabilities (PWD)">Persons with Disabilities (PWD)</option>
                </select>
                {programAutoFilled && formData.target_category ? (
                  <p className="text-xs text-green-600 mt-1">🏷️ Auto-filled from program: {formData.target_category}</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    Leave blank to include all categories, or select specific category to filter beneficiaries
                  </p>
                )}
              </div>

              {/* Distribution Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Distribution Date *
                </label>
                <input
                  type="date"
                  value={formData.distribution_date}
                  onChange={(e) => setFormData({ ...formData, distribution_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Amount per Beneficiary OR Non-Cash In-Kind Package Fields */}
              {(() => {
                const currentProg = programs.find(p => p.id === parseInt(formData.program_id));
                const isFormNonCash = isNonCashProgram(currentProg?.name, formData.benefit_type || currentProg?.benefit_type);
                const formNonCashDetails = isFormNonCash ? getNonCashDetails(currentProg?.name) : null;

                if (isFormNonCash) {
                  return (
                    <div className="md:col-span-2 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-2 border-purple-200 rounded-xl p-4 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-3 pb-2 border-b border-purple-200/60">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎁</span>
                          <div>
                            <h4 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                              In-Kind / Non-Cash Distribution
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                {formNonCashDetails?.badge || '📦 In-Kind'}
                              </span>
                            </h4>
                            <p className="text-xs text-purple-700">
                              <strong>Uri ng Tulong:</strong> {formNonCashDetails?.assistance_type || 'Goods / Services (Hindi Cash)'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                          ✓ Walang Cash Amount na Kinakailangan
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Pangalan ng Package / Kagamitan / Serbisyo *
                          </label>
                          <input
                            type="text"
                            value={formData.item_name || ''}
                            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                            placeholder="Hal. Family Food Pack, Hot Meals, Wheelchair, Vocational Training..."
                            className="w-full px-3 py-2 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white font-medium text-slate-900"
                            required
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            Para kanino: <span className="font-semibold text-slate-700">{formNonCashDetails?.target}</span>
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Dami Bawat Benepisyaryo
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={formData.item_quantity || '1'}
                              onChange={(e) => setFormData({ ...formData, item_quantity: e.target.value })}
                              className="w-20 px-3 py-2 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white font-bold text-center text-slate-900"
                              required
                            />
                            <span className="text-xs text-slate-600 font-medium">package / unit</span>
                          </div>
                          {eligibleMeta.qualified_count > 0 && (
                            <p className="text-[11px] text-purple-900 font-bold mt-1">
                              Kabuuan: {(parseInt(formData.item_quantity || 1, 10) * eligibleMeta.qualified_count)} units para sa {eligibleMeta.qualified_count} benepisyaryo
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Amount per Beneficiary (₱) *
                    </label>
                    <input
                      type="number"
                      value={formData.amount_per_beneficiary}
                      onChange={(e) => setFormData({ ...formData, amount_per_beneficiary: e.target.value })}
                      placeholder="e.g., 1000"
                      min="1"
                      step="0.01"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-semibold text-slate-900"
                      required
                    />
                    {formData.amount_per_beneficiary && eligibleMeta.qualified_count > 0 ? (
                      <p className="text-xs text-green-600 mt-1 font-medium">
                        ₱{parseFloat(formData.amount_per_beneficiary || 0).toLocaleString()} × {eligibleMeta.qualified_count} qualified beneficiaries = ₱{(parseFloat(formData.amount_per_beneficiary || 0) * eligibleMeta.qualified_count).toLocaleString()} estimated total
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">
                        Manual: Ilagay ang halaga na matatanggap ng bawat benepisyaryo
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Venue */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Venue <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="e.g., Barangay Hall - Main Hall (Optional)"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Assigned Staff */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Assign Staff *
                </label>
                <select
                  value={formData.assigned_staff_id}
                  onChange={(e) => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select Staff Member</option>
                  {staff
                    .filter(s => !formData.barangay_id || s.barangay_id === parseInt(formData.barangay_id))
                    .map((staffMember) => (
                      <option key={staffMember.id} value={staffMember.id}>
                        {staffMember.first_name} {staffMember.last_name} ({staffMember.email})
                      </option>
                    ))}
                </select>
                {formData.barangay_id && staff.filter(s => s.barangay_id === parseInt(formData.barangay_id)).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No staff assigned to this barangay</p>
                )}
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional instructions or information..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Preview Eligible Button */}
            <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handlePreviewEligible}
                disabled={!formData.program_id || !formData.barangay_id}
                className="px-6 py-2.5 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview Eligible Beneficiaries
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Creating...' : 'Create Draft Event'}
              </button>
            </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showDetailsModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">{selectedEvent.title}</h2>
                <StatusBadge status={selectedEvent.status} />
              </div>
              <div className="flex items-center gap-3">
                {selectedEvent.status === 'completed' && (
                  <button
                    onClick={() => handleExportExcel(selectedEvent)}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Export Excel Report (Claimed & Unclaimed Lists)"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedEvent(null);
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">

              {/* Event Info Card */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 mb-1">Event ID</p>
                    <p className="text-lg font-mono font-bold text-slate-900">#{selectedEvent.id}</p>
                  </div>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-purple-600" />
                  <p className="text-sm font-semibold text-slate-700">Program</p>
                </div>
                <p className="text-base text-slate-900">{selectedEvent.Program?.name}</p>
                <p className="text-xs text-slate-600">{selectedEvent.Program?.code}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  <p className="text-sm font-semibold text-slate-700">Location</p>
                </div>
                <p className="text-base text-slate-900">{selectedEvent.Barangay?.barangay_name}</p>
                <p className="text-xs text-slate-600">{selectedEvent.venue}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <p className="text-sm font-semibold text-slate-700">Date</p>
                </div>
                <p className="text-base text-slate-900">
                  {new Date(selectedEvent.distribution_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-blue-600">Total Beneficiaries</p>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-900">{selectedEvent.total_beneficiaries || 0}</p>
              {selectedEvent.status === 'draft' && selectedEvent.total_beneficiaries > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  📋 Preview (will be finalized on publish)
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-green-600">Released</p>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900">{selectedEvent.total_released || 0}</p>
              <p className="text-xs text-green-600 mt-1">
                {selectedEvent.total_beneficiaries > 0
                  ? ((selectedEvent.total_released / selectedEvent.total_beneficiaries) * 100).toFixed(1)
                  : 0}% complete
              </p>
            </div>

            <div className={`bg-gradient-to-br ${
              selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                ? 'from-amber-100 to-orange-100 border-amber-300'
                : 'from-amber-50 to-amber-100 border-amber-200'
            } rounded-xl p-6 border shadow-sm`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-bold ${
                  selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                    ? 'text-amber-900'
                    : 'text-amber-600'
                }`}>
                  {selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                    ? 'Unclaimed'
                    : 'Pending'}
                </p>
                {selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                  ? <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />
                  : <Clock className="w-5 h-5 text-amber-600" />}
              </div>
              <p className="text-3xl font-bold text-amber-900">
                {(selectedEvent.total_beneficiaries || 0) - (selectedEvent.total_released || 0)}
              </p>
              {(selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])) && (
                <p className="text-xs text-amber-800 font-semibold mt-1">Not Claimed</p>
              )}
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-purple-600">
                  {isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type) ? 'Assistance Type' : 'Budget'}
                </p>
                {isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type) ? (
                  <Package className="w-5 h-5 text-purple-600" />
                ) : (
                  <DollarSign className="w-5 h-5 text-purple-600" />
                )}
              </div>
              {isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type) ? (
                <>
                  <p className="text-lg font-bold text-purple-900 truncate" title={selectedEvent.item_name || getNonCashDetails(selectedEvent.Program?.name || selectedEvent.title)?.assistance_type}>
                    {selectedEvent.item_name || getNonCashDetails(selectedEvent.Program?.name || selectedEvent.title)?.default_item || 'In-Kind Assistance'}
                  </p>
                  <p className="text-xs text-purple-700 font-semibold mt-1">
                    {getNonCashDetails(selectedEvent.Program?.name || selectedEvent.title)?.badge || '📦 Non-Cash / In-Kind'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-purple-900">
                    ₱{parseFloat(selectedEvent.budget || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    ₱{parseFloat(selectedEvent.amount_per_beneficiary || 0).toLocaleString()}/person
                  </p>
                </>
              )}
            </div>
              </div>

              {/* Progress Bar */}
              {selectedEvent.total_beneficiaries > 0 && (
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <p className="text-sm font-semibold text-slate-700 mb-3">Distribution Progress</p>
              <div className="w-full bg-slate-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-purple-600 to-purple-400 h-4 rounded-full transition-all flex items-center justify-end pr-2"
                  style={{
                    width: `${(selectedEvent.total_released / selectedEvent.total_beneficiaries * 100)}%`
                  }}
                >
                  <span className="text-xs font-semibold text-white">
                    {((selectedEvent.total_released / selectedEvent.total_beneficiaries) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-600 font-medium">
                <span>{selectedEvent.total_released} released</span>
                <span>
                  {selectedEvent.total_beneficiaries - selectedEvent.total_released}{' '}
                  {selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                    ? 'unclaimed'
                    : 'pending'}
                </span>
              </div>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-semibold text-amber-900 mb-1">Notes:</p>
                  <p className="text-sm text-amber-800">{selectedEvent.notes}</p>
                </div>
              )}

              {/* Retroactive Payment Summary Alert (Cash Only) */}
              {!isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type) && selectedEvent.retroPreview?.beneficiaries_with_retro > 0 && (
                <div className={`p-4 rounded-xl border ${selectedEvent.retroPreview.budget_sufficient ? 'bg-indigo-50/80 border-indigo-200' : 'bg-rose-50 border-rose-300'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 w-full">
                      <span className="text-2xl flex-shrink-0">⚡</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            Retroactive Payment (Backpay) Applied
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {selectedEvent.retroPreview.beneficiaries_with_retro} Beneficiaries
                            </span>
                          </h4>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedEvent.retroPreview.budget_sufficient ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {selectedEvent.retroPreview.budget_sufficient ? '✓ Budget Sufficient' : `Deficit: ₱${parseFloat(selectedEvent.retroPreview.deficit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Beneficiaries who missed past completed distributions will receive retroactive backpay together with this period's payout.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block text-[11px]">Regular Payout</span>
                            <span className="font-bold text-slate-900">₱{parseFloat(selectedEvent.retroPreview.regular_total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-indigo-600 font-medium block text-[11px]">Total Retro Pay</span>
                            <span className="font-bold text-indigo-700">+₱{parseFloat(selectedEvent.retroPreview.retro_total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-700 font-medium block text-[11px]">Grand Total Payout</span>
                            <span className="font-bold text-green-700">₱{parseFloat(selectedEvent.retroPreview.grand_total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="text-slate-500 block text-[11px]">Event Budget</span>
                            <span className="font-bold text-slate-900">₱{parseFloat(selectedEvent.budget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hybrid Disbursement Channels (Digital vs. Cash OTC) - Cash Only */}
              {!isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type) && (selectedEvent.payoutSummary || selectedEvent.Transactions?.some(t => t.disbursement_type === 'digital' || t.Beneficiary?.payout_preference === 'digital')) && (
                <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-blue-50 rounded-2xl p-6 border border-purple-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          Hybrid Disbursement Channels
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold border border-purple-200">
                            Digital & Physical Cash
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          DSWD Standard: Automated digital crediting for verified accounts (GCash/Maya/Landbank) and physical OTC payout via RFID.
                        </p>
                      </div>
                    </div>

                    {/* Disburse Digital Button for Admin */}
                    {['admin', 'mswdo_admin'].includes(user?.role) && 
                      ((selectedEvent.payoutSummary?.digital?.pending > 0) || 
                       (selectedEvent.Transactions?.filter(t => (t.disbursement_type === 'digital' || t.Beneficiary?.payout_preference === 'digital') && t.status === 'pending').length > 0)) && 
                      selectedEvent.status !== 'completed' && (
                      <button
                        onClick={() => handleDisburseDigital(selectedEvent.id)}
                        disabled={disbursingDigital}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {disbursingDigital ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Digital Payouts...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 fill-current" />
                            <span>Disburse Digital Payouts ({selectedEvent.payoutSummary?.digital?.pending ?? selectedEvent.Transactions?.filter(t => (t.disbursement_type === 'digital' || t.Beneficiary?.payout_preference === 'digital') && t.status === 'pending').length} Pending)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Digital Channel */}
                    <div className="bg-white rounded-xl p-4 border border-purple-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm text-slate-900">Digital Crediting</span>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-200">
                          GCash / Maya / Landbank
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">Qualified</span>
                          <span className="text-base font-bold text-slate-900">{selectedEvent.payoutSummary.digital?.total || 0}</span>
                        </div>
                        <div className="bg-green-50 p-2 rounded-lg border border-green-100">
                          <span className="text-[11px] text-green-700 block font-medium">Credited</span>
                          <span className="text-base font-bold text-green-700">{selectedEvent.payoutSummary.digital?.released || 0}</span>
                        </div>
                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                          <span className="text-[11px] text-amber-700 block font-medium">Pending</span>
                          <span className="text-base font-bold text-amber-700">{selectedEvent.payoutSummary.digital?.pending || 0}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="text-slate-500">Total Credited Amount:</span>
                        <span className="font-bold text-purple-700">
                          ₱{parseFloat(selectedEvent.payoutSummary.digital?.amount_released || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Physical Cash OTC Channel */}
                    <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-2xs">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm text-slate-900">Physical Claiming</span>
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                          Cash OTC via RFID
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[11px] text-slate-500 block">Total</span>
                          <span className="text-base font-bold text-slate-900">{selectedEvent.payoutSummary.cash_otc?.total || 0}</span>
                        </div>
                        <div className="bg-green-50 p-2 rounded-lg border border-green-100">
                          <span className="text-[11px] text-green-700 block font-medium">Claimed</span>
                          <span className="text-base font-bold text-green-700">{selectedEvent.payoutSummary.cash_otc?.released || 0}</span>
                        </div>
                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                          <span className="text-[11px] text-amber-700 block font-medium">Unclaimed</span>
                          <span className="text-base font-bold text-amber-700">{selectedEvent.payoutSummary.cash_otc?.pending || 0}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="text-slate-500">Total Claimed Amount:</span>
                        <span className="font-bold text-blue-700">
                          ₱{parseFloat(selectedEvent.payoutSummary.cash_otc?.amount_released || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enrolled Beneficiaries List */}
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      {selectedEvent.status === 'draft' && selectedEvent.Transactions?.[0]?.is_preview ? 'Eligible Beneficiaries (Preview)' : 'Enrolled Beneficiaries'}
                    </h3>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-green-600 font-semibold">
                        {selectedEvent.Transactions?.filter(t => t.status === 'released').length || 0} Released
                      </span>
                      <span className={`text-sm font-semibold ${
                        selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                          ? 'text-amber-800 font-extrabold'
                          : 'text-amber-600'
                      }`}>
                        {selectedEvent.Transactions?.filter(t => t.status === 'pending').length || 0}{' '}
                        {selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])
                          ? 'Unclaimed'
                          : 'Pending'}
                      </span>
                      <span className="text-sm text-slate-600">
                        Total: {selectedEvent.Transactions?.length || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Preview Notice for Draft Events */}
                  {selectedEvent.status === 'draft' && selectedEvent.Transactions?.[0]?.is_preview && (
                    <div className="p-3 bg-blue-50 border-t border-blue-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-800">
                        <span className="font-semibold">Preview Mode:</span> These beneficiaries are currently enrolled in the program. 
                        Transactions will be finalized when you publish this distribution event.
                      </p>
                    </div>
                  )}
                </div>

                {selectedEvent.Transactions && selectedEvent.Transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        {(() => {
                          const isSelectedNonCash = isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type);
                          return (
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Beneficiary</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                                {isSelectedNonCash ? 'Type' : 'Method'}
                              </th>
                              {isSelectedNonCash ? (
                                <>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Package / Item Name</th>
                                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Quantity</th>
                                </>
                              ) : (
                                <>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Regular</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Retro Pay</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total Payout</th>
                                </>
                              )}
                              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                            </tr>
                          );
                        })()}
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEvent.Transactions.map((txn, index) => {
                          const isSelectedNonCash = isNonCashProgram(selectedEvent.Program?.name || selectedEvent.title, selectedEvent.benefit_type);
                          return (
                            <tr key={txn.id} className={`hover:bg-slate-50 ${
                              (selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0])) && txn.status !== 'released'
                                ? 'bg-amber-50/70 border-l-4 border-l-amber-500'
                                : txn.status === 'pending'
                                ? 'bg-amber-50/30'
                                : ''
                            }`}>
                              <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-900">
                                  {txn.Beneficiary?.first_name} {txn.Beneficiary?.last_name}
                                </p>
                                <p className="text-xs text-slate-600">{txn.Beneficiary?.Barangay?.barangay_name}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-mono text-xs">{txn.Beneficiary?.beneficiary_id_code}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                  txn.Beneficiary?.category?.includes('4Ps') ? 'bg-blue-100 text-blue-700' :
                                  txn.Beneficiary?.category?.includes('Senior') ? 'bg-green-100 text-green-700' :
                                  txn.Beneficiary?.category?.includes('PWD') ? 'bg-purple-100 text-purple-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {txn.Beneficiary?.category || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isSelectedNonCash ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    🎁 In-Kind
                                  </span>
                                ) : txn.disbursement_type === 'digital' || txn.Beneficiary?.payout_preference === 'digital' ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                      ⚡ {txn.payout_provider || txn.Beneficiary?.payout_provider || 'Digital'}
                                    </span>
                                    {txn.payout_reference_number && (
                                      <span className="text-[10px] font-mono text-slate-500 mt-0.5 max-w-[130px] truncate" title={txn.payout_reference_number}>
                                        {txn.payout_reference_number}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                    🏢 Cash OTC
                                  </span>
                                )}
                              </td>
                              {isSelectedNonCash ? (
                                <>
                                  <td className="px-4 py-3 text-left">
                                    <span className="font-semibold text-slate-800 text-xs">
                                      {txn.item_name || selectedEvent.item_name || getNonCashDetails(selectedEvent.Program?.name || selectedEvent.title)?.default_item || 'In-Kind Package'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                      {txn.item_quantity || selectedEvent.item_quantity || 1} {selectedEvent.item_unit || 'pkg'}
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-right">
                                    <span className="text-slate-700 font-medium">
                                      ₱{parseFloat(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {parseFloat(txn.retro_amount || 0) > 0 ? (
                                      <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-xs border border-indigo-200">
                                        ⚡ +₱{parseFloat(txn.retro_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        <span className="text-[10px] text-indigo-500 font-normal">({txn.retro_periods}p)</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <p className="font-bold text-green-700">
                                      ₱{(parseFloat(txn.amount || 0) + parseFloat(txn.retro_amount || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </p>
                                  </td>
                                </>
                              )}
                            <td className="px-4 py-3 text-center">
                              {txn.status === 'released' ? (
                                txn.disbursement_type === 'digital' ? (
                                  txn.beneficiary_acknowledged_at ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300" title={`Confirmed received by beneficiary on ${new Date(txn.beneficiary_acknowledged_at).toLocaleString()}`}>
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                      ⚡ Credited & Confirmed ✓
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold" title="Credited to e-wallet, waiting for beneficiary in-app acknowledgment">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      ⚡ Credited (Pending Conf.)
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Released
                                  </span>
                                )
                              ) : txn.status === 'verified' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Verified
                                </span>
                              ) : (selectedEvent.status === 'completed' || (selectedEvent.distribution_date && String(selectedEvent.distribution_date).split('T')[0] < new Date().toISOString().split('T')[0]) || txn.status === 'unclaimed') ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-extrabold border border-amber-300">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  Unclaimed
                                </span>
                              ) : (txn.disbursement_type === 'digital' || txn.Beneficiary?.payout_preference === 'digital') && txn.status === 'pending' ? (
                                <div className="inline-flex flex-col items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold border border-purple-200">
                                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                                    Pending Digital
                                  </span>
                                  {['admin', 'mswdo_admin'].includes(user?.role) && selectedEvent.status !== 'completed' && (
                                    <button
                                      onClick={() => handleDisburseDigital(selectedEvent.id)}
                                      disabled={disbursingDigital}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[11px] font-bold shadow-xs transition cursor-pointer"
                                      title="Disburse digital payout via GCash/Bank"
                                    >
                                      <Zap className="w-3 h-3 fill-current" />
                                      Disburse Now
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5" />
                                  {txn.is_preview ? 'Eligible' : 'Pending'}
                                </span>
                              )}
                            </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No beneficiaries enrolled yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eligible Beneficiaries Modal */}
      {showEligibleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Sticky Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Enrolled Beneficiaries Preview</h2>
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-semibold text-green-600">{eligibleMeta.qualified_count} qualified</span>
                  {' '}out of{' '}
                  <span className="font-semibold">{eligibleMeta.total} enrolled beneficiaries</span>
                  {' '}in program "{eligibleMeta.program_name}"
                </p>
              </div>
              <button onClick={() => { setShowEligibleModal(false); setEligibleBeneficiaries([]); }} className="text-slate-500 hover:text-slate-700">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Selection Criteria */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">Selection Criteria:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 flex-shrink-0" />
                    <span>Program: <strong>{programs.find(p => p.id === parseInt(formData.program_id))?.name || 'N/A'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span>Barangay: <strong>{barangays.find(b => b.id === parseInt(formData.barangay_id))?.barangay_name || 'N/A'}</strong></span>
                  </div>
                  {formData.target_category && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span>Category Filter: <strong>{formData.target_category}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Status: <strong>Approved beneficiaries</strong></span>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Total Enrolled</p>
                  <p className="text-2xl font-bold text-slate-900">{eligibleMeta.total}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 mb-1">Qualified</p>
                  <p className="text-2xl font-bold text-green-700">{eligibleMeta.qualified_count}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-500 mb-1">Not Qualified</p>
                  <p className="text-2xl font-bold text-red-600">{eligibleMeta.total - eligibleMeta.qualified_count}</p>
                </div>
                {(() => {
                  const isModalProgNonCash = isNonCashProgram(programs.find(p => p.id === parseInt(formData.program_id))?.name, formData.benefit_type);
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-purple-600 mb-1">
                        {isModalProgNonCash ? 'Assistance' : 'Amount Each'}
                      </p>
                      <p className="text-sm font-bold text-purple-700 truncate" title={formData.item_name || 'In-Kind'}>
                        {isModalProgNonCash ? (formData.item_name || 'In-Kind Package') : `₱${parseFloat(formData.amount_per_beneficiary || 0).toLocaleString()}`}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Estimated Distribution / Payout Plan */}
              {(() => {
                const isModalProgNonCash = isNonCashProgram(programs.find(p => p.id === parseInt(formData.program_id))?.name, formData.benefit_type);
                if (isModalProgNonCash) {
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-purple-900 mb-3">In-Kind Distribution Plan (Walang Cash):</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-purple-600 mb-1">Qualified Beneficiaries</p>
                          <p className="text-2xl font-bold text-purple-900">{eligibleMeta.qualified_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 mb-1">Package / Item Name</p>
                          <p className="text-base font-bold text-purple-900 truncate">{formData.item_name || 'In-Kind Package'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 mb-1">Estimated Total Goods to Prepare</p>
                          <p className="text-2xl font-bold text-purple-900">{(eligibleMeta.qualified_count * (parseInt(formData.item_quantity, 10) || 1))} units</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (formData.amount_per_beneficiary && eligibleMeta.qualified_count > 0) {
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-purple-900 mb-3">Estimated Payout Calculation (Qualified Only):</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-purple-600 mb-1">Qualified Beneficiaries</p>
                          <p className="text-2xl font-bold text-purple-900">{eligibleMeta.qualified_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 mb-1">Amount per Beneficiary</p>
                          <p className="text-2xl font-bold text-purple-900">₱{parseFloat(formData.amount_per_beneficiary).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 mb-1">Estimated Total Budget Needed</p>
                          <p className="text-2xl font-bold text-purple-900">₱{(eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary || 0)).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Category Breakdown */}
              {eligibleBeneficiaries.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-900 mb-3">Category Breakdown:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(
                      eligibleBeneficiaries.reduce((acc, b) => {
                        const cat = b.category || 'Uncategorized';
                        acc[cat] = (acc[cat] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([cat, count]) => (
                      <span key={cat} className="px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs font-medium text-slate-700">
                        {cat}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Beneficiaries Table */}
              {eligibleBeneficiaries.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-slate-900 mb-2">No Enrolled Beneficiaries</p>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    No beneficiaries are enrolled in this program yet.
                    {formData.target_category ? ` (Filtered by category: "${formData.target_category}")` : ''}
                    <br />
                    <span className="text-purple-600 font-medium">Please enroll beneficiaries in the program first.</span>
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Beneficiary</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">RFID</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Enrolled</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Qualified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {eligibleBeneficiaries.map((b, index) => (
                        <tr key={b.id || b.beneficiary_id} className={`transition-colors ${b.status === 'Approved' ? 'hover:bg-green-50' : 'bg-slate-50 opacity-70 hover:bg-slate-100'}`}>
                          <td className="px-4 py-3 text-slate-500 font-medium">{index + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{b.last_name}, {b.first_name} {b.middle_name || ''}</p>
                            <p className="text-xs text-slate-500 font-mono">{b.beneficiary_id_code || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              b.category?.includes('4Ps') ? 'bg-blue-100 text-blue-700' :
                              b.category?.includes('Senior') ? 'bg-green-100 text-green-700' :
                              b.category?.includes('PWD') ? 'bg-purple-100 text-purple-700' :
                              b.category?.includes('Solo Parent') ? 'bg-pink-100 text-pink-700' :
                              b.category?.includes('Indigenous') ? 'bg-orange-100 text-orange-700' :
                              b.category?.includes('Youth') ? 'bg-cyan-100 text-cyan-700' :
                              b.category?.includes('Pregnant') ? 'bg-rose-100 text-rose-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {b.category || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{b.contact_number || '—'}</td>
                          <td className="px-4 py-3 font-mono text-slate-600 text-xs">{b.RFID_number || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <CheckCircle className="w-5 h-5 text-green-500 mx-auto" title="Enrolled in program" />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {b.status === 'Approved' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                <CheckCircle className="w-3.5 h-3.5" /> Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 cursor-help" title="Not approved">
                                <XCircle className="w-3.5 h-3.5" /> No
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-5 border-t border-slate-200 flex justify-between items-center bg-white rounded-b-xl">
              <div className="text-sm text-slate-600">
                {(() => {
                  const isModalProgNonCash = isNonCashProgram(programs.find(p => p.id === parseInt(formData.program_id))?.name, formData.benefit_type);
                  if (isModalProgNonCash) {
                    return (
                      <span>
                        <span className="font-semibold text-green-600">{eligibleMeta.qualified_count}</span> qualified will each receive{' '}
                        <span className="font-semibold text-purple-700">{formData.item_name || 'In-Kind Package'}</span>
                        {' '}(Total: {eligibleMeta.qualified_count * (parseInt(formData.item_quantity, 10) || 1)} units)
                      </span>
                    );
                  }
                  return (
                    <span>
                      <span className="font-semibold text-green-600">{eligibleMeta.qualified_count}</span> qualified will receive{' '}
                      <span className="font-semibold">₱{parseFloat(formData.amount_per_beneficiary || 0).toLocaleString()}</span> each
                      {formData.amount_per_beneficiary && eligibleMeta.qualified_count > 0 && (
                        <span className="ml-2 text-slate-500">
                          — Total: ₱{(eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary)).toLocaleString()}
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={() => { setShowEligibleModal(false); setEligibleBeneficiaries([]); }}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

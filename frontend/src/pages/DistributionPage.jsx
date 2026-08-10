import { useEffect, useState, useCallback } from 'react';
import { 
  Package, Plus, Calendar, MapPin, Users, DollarSign, 
  Eye, Edit, Trash2, CheckCircle, XCircle, Clock,
  Play, Square, AlertCircle, TrendingUp, Filter, RefreshCw, Archive
} from 'lucide-react';
import { distributionApi, programApi, barangayApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DistributionPage() {
  const { user } = useAuth();
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
    target_category: '' // 4Ps, Senior Citizen, PWD, etc.
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
      setEvents(res.data.data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load distribution events');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, barangayFilter]);

  const loadDashboardStats = useCallback(async () => {
    try {
      const res = await distributionApi.getDashboardStats();
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
      console.error('Error response:', err.response?.data);
      // Don't show error to user for stats - it's not critical
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    try {
      const [programsRes, barangaysRes, usersRes] = await Promise.all([
        programApi.list(),
        barangayApi.list(),
        userApi.list()
      ]);
      setPrograms(programsRes.data.data || []);
      setBarangays(barangaysRes.data.data || []);
      // Filter users to only staff/barangay roles
      const staffUsers = (usersRes.data.data || []).filter(
        u => u.role === 'staff' || u.role === 'barangay'
      );
      setStaff(staffUsers);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  }, []);

  // Load reference data on mount
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Load events & dashboard stats when filters change or on mount
  useEffect(() => {
    loadEvents();
    loadDashboardStats();
  }, [loadEvents, loadDashboardStats]);

  // Auto-refresh every 5 seconds if there are ongoing events
  useEffect(() => {
    const hasOngoingEvents = events.some(e => e.status === 'ongoing' || e.status === 'scheduled');
    
    if (hasOngoingEvents) {
      const interval = setInterval(() => {
        loadEvents();
        loadDashboardStats();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
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
    const updatedForm = {
      ...formData,
      program_id: programId,
      barangay_id: selectedProgram.barangay_id ? String(selectedProgram.barangay_id) : '',
      target_category: selectedProgram.eligibility_category || '',
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

        // Auto-calculate amount per beneficiary
        const eligibleCount = qualifiedBeneficiaries.length;
        if (updatedForm.budget && eligibleCount > 0) {
          const totalBudget = parseFloat(updatedForm.budget);
          const amountPerBeneficiary = totalBudget / eligibleCount;
          setFormData(prev => ({
            ...prev,
            amount_per_beneficiary: amountPerBeneficiary.toFixed(2)
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
      await distributionApi.createEvent(formData);
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
        target_category: ''
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
      
      // Auto-calculate Amount per Beneficiary based on Total Budget and Eligible Count
      const eligibleCount = qualifiedBeneficiaries.length;
      if (formData.budget && eligibleCount > 0) {
        const totalBudget = parseFloat(formData.budget);
        const amountPerBeneficiary = totalBudget / eligibleCount;
        
        // Update formData with calculated amount
        setFormData(prev => ({
          ...prev,
          amount_per_beneficiary: amountPerBeneficiary.toFixed(2)
        }));
      }
      
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
    if (!window.confirm('Are you sure you want to publish this event? This will create transactions for all eligible beneficiaries and send notifications.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await distributionApi.publishEvent(eventId);
      setSuccess('Event published successfully! Notifications sent to staff and beneficiaries.');
      await loadEvents();
      await loadDashboardStats();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Publish event error:', err);
      console.error('Error response:', err.response?.data);
      
      // Extract error from response
      const errorData = err.response?.data;
      
      if (errorData?.error_code === 'INSUFFICIENT_BUDGET') {
        const deficit = parseFloat(errorData.details?.deficit || 0);
        setError(`Insufficient Budget: You need ₱${deficit.toLocaleString()} more.`);
      } else if (errorData?.message) {
        // Show the specific error message from backend
        let errorMessage = errorData.message;
        
        // If there are debug details, add them
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
            Beneficiary: b,
            is_preview: true // Mark as preview
          }));
        } catch (err) {
          console.warn('Could not load eligible beneficiaries for draft event:', err);
        }
      }
      
      setSelectedEvent(eventData);
      setShowDetailsModal(true);
    } catch (err) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
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
          {user?.role === 'admin' && (
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
                {user?.role === 'admin' && (
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
                            <p className="font-semibold text-purple-600">
                              ₱{parseFloat(event.budget).toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-600">
                              ₱{parseFloat(event.amount_per_beneficiary).toLocaleString()}/beneficiary
                            </p>
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
                            {event.status === 'draft' && user?.role === 'admin' && (
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
                            {event.status === 'scheduled' && (user?.role === 'admin' || user?.role === 'staff' || user?.role === 'barangay') && (
                              <button
                                onClick={() => handleStartSession(event.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                title="Start Distribution Session"
                              >
                                <Play className="w-4 h-4" />
                                Start Session
                              </button>
                            )}
                            
                            {/* Ongoing Status Actions - END SESSION */}
                            {event.status === 'ongoing' && (user?.role === 'admin' || user?.role === 'staff' || user?.role === 'barangay') && (
                              <button
                                onClick={() => handleEndSession(event.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                title="End Distribution Session"
                              >
                                <Square className="w-4 h-4" />
                                End Session
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

              {/* Venue */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Venue *
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="e.g., Barangay Hall - Main Hall"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Total Budget (₱) *
                </label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  placeholder="e.g., 150000"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Amount per Beneficiary */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount per Beneficiary (₱) *
                </label>
                <input
                  type="number"
                  value={formData.amount_per_beneficiary}
                  readOnly
                  placeholder="Auto-calculated after preview"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 cursor-not-allowed"
                  required
                />
                {formData.amount_per_beneficiary && eligibleMeta.qualified_count > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    ₱{parseFloat(formData.budget || 0).toLocaleString()} ÷ {eligibleMeta.qualified_count} beneficiaries = ₱{parseFloat(formData.amount_per_beneficiary).toLocaleString()} each
                  </p>
                )}
                {!formData.amount_per_beneficiary && (
                  <p className="text-xs text-slate-500 mt-1">
                    Click "Preview Eligible Beneficiaries" to auto-calculate
                  </p>
                )}
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

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-amber-600">Pending</p>
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-3xl font-bold text-amber-900">
                {(selectedEvent.total_beneficiaries || 0) - (selectedEvent.total_released || 0)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-purple-600">Budget</p>
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">
                ₱{parseFloat(selectedEvent.budget).toLocaleString()}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                ₱{parseFloat(selectedEvent.amount_per_beneficiary).toLocaleString()}/person
              </p>
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
              <div className="flex justify-between mt-2 text-xs text-slate-600">
                <span>{selectedEvent.total_released} released</span>
                <span>{selectedEvent.total_beneficiaries - selectedEvent.total_released} pending</span>
                  </div>
                </div>
              )}

              {selectedEvent.notes && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-semibold text-amber-900 mb-1">Notes:</p>
                  <p className="text-sm text-amber-800">{selectedEvent.notes}</p>
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
                      <span className="text-sm text-amber-600 font-semibold">
                        {selectedEvent.Transactions?.filter(t => t.status === 'pending').length || 0} Pending
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
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Beneficiary</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedEvent.Transactions.map((txn, index) => (
                          <tr key={txn.id} className={`hover:bg-slate-50 ${
                            txn.status === 'pending' ? 'bg-amber-50' : ''
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
                            <td className="px-4 py-3 text-right">
                              <p className="font-bold text-green-600">
                                ₱{parseFloat(txn.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {txn.status === 'released' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                  <CheckCircle className="w-3 h-3" />
                                  Released
                                </span>
                              ) : txn.status === 'verified' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                  <CheckCircle className="w-3 h-3" />
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                                  <Clock className="w-3 h-3" />
                                  {txn.is_preview ? 'Eligible' : 'Pending'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
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
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-purple-600 mb-1">Amount Each</p>
                  <p className="text-xl font-bold text-purple-700">₱{parseFloat(formData.amount_per_beneficiary || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Budget Calculation */}
              {formData.amount_per_beneficiary && eligibleMeta.qualified_count > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-purple-900 mb-3">Budget Calculation (Qualified Only):</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-purple-600 mb-1">Qualified Count</p>
                      <p className="text-2xl font-bold text-purple-900">{eligibleMeta.qualified_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 mb-1">Amount per Person</p>
                      <p className="text-2xl font-bold text-purple-900">₱{parseFloat(formData.amount_per_beneficiary).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 mb-1">Total Required</p>
                      <p className="text-2xl font-bold text-purple-900">₱{(eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary || 0)).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 mb-1">Available Budget</p>
                      <p className="text-2xl font-bold text-purple-900">₱{parseFloat(formData.budget || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  {formData.budget && (
                    (eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary)) > parseFloat(formData.budget) ? (
                      <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold">⚠️ Insufficient Budget!</p>
                          <p className="text-xs mt-1">Need ₱{((eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary)) - parseFloat(formData.budget)).toLocaleString()} more</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold">✓ Budget is Sufficient!</p>
                          <p className="text-xs mt-1">Remaining: ₱{(parseFloat(formData.budget) - (eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary))).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

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
                <span className="font-semibold text-green-600">{eligibleMeta.qualified_count}</span> qualified will receive{' '}
                <span className="font-semibold">₱{parseFloat(formData.amount_per_beneficiary || 0).toLocaleString()}</span> each
                {formData.amount_per_beneficiary && eligibleMeta.qualified_count > 0 && (
                  <span className="ml-2 text-slate-500">
                    — Total: ₱{(eligibleMeta.qualified_count * parseFloat(formData.amount_per_beneficiary)).toLocaleString()}
                  </span>
                )}
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

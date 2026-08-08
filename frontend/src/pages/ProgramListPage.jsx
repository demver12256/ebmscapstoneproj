import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { programApi, barangayApi, beneficiaryApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Briefcase, Plus, X, Edit2, Trash2, ToggleLeft, ToggleRight, Filter, MapPin, Eye, Archive, ArchiveRestore, UserPlus, Users, Calendar } from 'lucide-react';

const CATEGORIES = [
  '4Ps Household Beneficiaries',
  'Senior Citizens (Social Pension)',
  'Persons with Disabilities (PWD)'
];

// Program descriptions mapping
const PROGRAM_DESCRIPTIONS = {
  '4Ps Household Beneficiaries': {
    'Regular Cash Grant': 'Regular monthly cash assistance for qualified 4Ps households',
    'Education Grant': 'Educational assistance for children of 4Ps beneficiaries',
    'Health Grant': 'Health-related assistance and medical support',
    'Rice Assistance (kapag may implementasyon ng DSWD o national government)': 'Rice subsidy program (subject to DSWD/national government implementation)',
    'Family Development Sessions (FDS)': 'Educational and family development programs',
    'Sustainable Livelihood Program (SLP) Referral': 'Skills training and livelihood opportunities referral',
    'Cash-for-Work Program (kung available)': 'Employment assistance and work opportunities',
    'Disaster Relief Assistance': 'Emergency assistance during disasters and calamities',
    'Educational Assistance': 'Comprehensive educational support programs',
    'Assistance to Individuals in Crisis Situation (AICS)': 'Emergency assistance for individuals in crisis situations',
  },
  'Senior Citizens (Social Pension)': {
    'Social Pension for Indigent Senior Citizens (SocPen)': 'Monthly social pension for indigent senior citizens aged 60 and above',
    'Centenarian Benefits': 'Special benefits and cash gifts for centenarians',
    'Medical Assistance': 'Healthcare support and medical services',
    'Funeral Assistance': 'Financial assistance for funeral and burial expenses',
    'Assistive Devices Distribution': 'Distribution of medical aids and assistive devices',
    'Relief Assistance': 'General relief assistance during hardships',
    'AICS (Assistance to Individuals in Crisis Situation)': 'Emergency assistance for individuals in crisis situations',
    'Livelihood Assistance (kung kwalipikado)': 'Livelihood support for qualified senior citizens',
    'Health and Wellness Programs': 'Health promotion and wellness activities',
    'Senior Citizens Information and Referral Services': 'Information and referral services for senior citizens',
  },
  'Persons with Disabilities (PWD)': {
    'PWD ID Registration and Renewal': 'Registration and renewal of PWD identification cards',
    'Assistive Devices Distribution (wheelchair, cane, hearing aid, crutches, atbp.)': 'Distribution of assistive devices (wheelchairs, canes, hearing aids, crutches, etc.)',
    'Medical Assistance': 'Healthcare support and medical services for PWD',
    'Educational Assistance': 'Educational support and scholarships for PWD',
    'Livelihood Assistance': 'Income-generating livelihood programs for PWD',
    'Skills Training Program': 'Vocational and technical skills training for PWD',
    'Physical Rehabilitation Services': 'Physical rehabilitation and therapy services',
    'Occupational Therapy Referral': 'Referral services for occupational therapy',
    'Employment Facilitation': 'Job placement and employment assistance',
    'Transportation Assistance': 'Transportation support for PWD',
    'Disaster Assistance': 'Emergency assistance during disasters',
    'AICS (Assistance to Individuals in Crisis Situation)': 'Emergency assistance for PWD in crisis situations',
  },
};

const PROGRAMS_BY_CATEGORY = {
  '4Ps Household Beneficiaries': [
    'Regular Cash Grant',
    'Education Grant',
    'Health Grant',
    'Rice Assistance (kapag may implementasyon ng DSWD o national government)',
    'Family Development Sessions (FDS)',
    'Sustainable Livelihood Program (SLP) Referral',
    'Cash-for-Work Program (kung available)',
    'Disaster Relief Assistance',
    'Educational Assistance',
    'Assistance to Individuals in Crisis Situation (AICS)',
  ],
  'Senior Citizens (Social Pension)': [
    'Social Pension for Indigent Senior Citizens (SocPen)',
    'Centenarian Benefits',
    'Medical Assistance',
    'Funeral Assistance',
    'Assistive Devices Distribution',
    'Relief Assistance',
    'AICS (Assistance to Individuals in Crisis Situation)',
    'Livelihood Assistance (kung kwalipikado)',
    'Health and Wellness Programs',
    'Senior Citizens Information and Referral Services',
  ],
  'Persons with Disabilities (PWD)': [
    'PWD ID Registration and Renewal',
    'Assistive Devices Distribution (wheelchair, cane, hearing aid, crutches, atbp.)',
    'Medical Assistance',
    'Educational Assistance',
    'Livelihood Assistance',
    'Skills Training Program',
    'Physical Rehabilitation Services',
    'Occupational Therapy Referral',
    'Employment Facilitation',
    'Transportation Assistance',
    'Disaster Assistance',
    'AICS (Assistance to Individuals in Crisis Situation)',
  ],
};

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  barangay_id: '',
  total_budget: '',
  allocated_budget: '',
  start_date: '',
  end_date: '',
  status: 'draft',
};

export default function ProgramListPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [programs, setPrograms] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Program Details Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [enrolledBeneficiaries, setEnrolledBeneficiaries] = useState([]);
  const [eligibleBeneficiaries, setEligibleBeneficiaries] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Admin filters
  const [filterBarangay, setFilterBarangay] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // View mode: 'active' or 'archived'
  const [viewMode, setViewMode] = useState('active');
  
  // Archived Programs Modal
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedPrograms, setArchivedPrograms] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Find barangay name for non-admin header label
  const userBarangayName = barangays.find(b => b.id === user?.barangay_id)?.barangay_name || '';

  // Helper to safely get program options for any category variation
  const getProgramOptions = (category) => {
    if (!category) return [];
    if (PROGRAMS_BY_CATEGORY[category]) return PROGRAMS_BY_CATEGORY[category];
    const foundKey = Object.keys(PROGRAMS_BY_CATEGORY).find(
      (k) => k.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(k.toLowerCase())
    );
    return foundKey ? PROGRAMS_BY_CATEGORY[foundKey] : [];
  };

  const programOptions = getProgramOptions(form.category);

  const getErrorMessage = (err, fallback) => {
    if (typeof err === 'string') return err;
    return err?.message || fallback;
  };

  const loadPrograms = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const params = {};
      
      if (isAdmin) {
        if (filterBarangay) params.barangay_id = filterBarangay;
        if (filterStatus) params.status = filterStatus;
      }

      const programsResponse = await programApi.list(params);
      // Filter out archived programs from main list
      const activePrograms = (programsResponse.data.data || []).filter(p => p.status !== 'archived');
      setPrograms(activePrograms);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load programs'));
    } finally {
      setLoading(false);
    }
  };

  const loadBarangays = async () => {
    if (!token || !isAdmin) return;

    try {
      const barangaysResponse = await barangayApi.list();
      setBarangays(barangaysResponse.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load barangays'));
    }
  };

  useEffect(() => {
    loadBarangays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterBarangay, filterStatus]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // If program name is selected, auto-fill the description
    if (name === 'name' && form.category && value) {
      let description = PROGRAM_DESCRIPTIONS[form.category]?.[value];
      if (!description) {
        const foundCategoryKey = Object.keys(PROGRAM_DESCRIPTIONS).find(
          (k) => k.toLowerCase().includes(form.category.toLowerCase()) || form.category.toLowerCase().includes(k.toLowerCase())
        );
        description = foundCategoryKey ? (PROGRAM_DESCRIPTIONS[foundCategoryKey]?.[value] || '') : '';
      }
      setForm((prev) => ({
        ...prev,
        [name]: value,
        description: description || prev.description
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const openCreateModal = () => {
    setEditingProgram(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (program) => {
    setEditingProgram(program);
    setForm({
      name: program.name || '',
      description: program.description || '',
      category: program.eligibility_category || program.category || '',
      barangay_id: program.barangay_id || '',
      total_budget: program.total_budget || '',
      allocated_budget: program.allocated_budget || '',
      start_date: program.start_date || '',
      end_date: program.end_date || '',
      status: program.status || 'draft',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        eligibility_category: form.category,
        barangay_id: Number(form.barangay_id),
        total_budget: Number(form.total_budget) || 0,
        allocated_budget: Number(form.allocated_budget) || 0,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
      };

      if (editingProgram) {
        await programApi.update(editingProgram.id, payload);
        setSuccess('Program updated successfully!');
      } else {
        const res = await programApi.create(payload);
        const autoEnrolled = res.data?.auto_enrolled_count || 0;
        if (autoEnrolled > 0) {
          setSuccess(`Program created successfully! ${autoEnrolled} eligible beneficiary(ies) automatically enrolled.`);
        } else {
          setSuccess('Program created successfully!');
        }
      }
      setShowModal(false);
      setEditingProgram(null);
      setForm({ ...EMPTY_FORM });
      await loadPrograms();
      setTimeout(() => setSuccess(null), 6000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save program'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (program) => {
    try {
      await programApi.toggleStatus(program.id);
      await loadPrograms();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to toggle program status'));
    }
  };

  const handleViewDetails = async (program) => {
    setSelectedProgram(program);
    setShowDetailsModal(true);
    setDetailsLoading(true);
    
    try {
      // Get enrolled beneficiaries
      const enrolledRes = await programApi.getEnrolledBeneficiaries(program.id);
      const enrolledBeneficiariesData = enrolledRes.data.data || [];
      setEnrolledBeneficiaries(enrolledBeneficiariesData);
      
      // Get all approved beneficiaries for the same barangay and category
      const allBeneficiariesRes = await beneficiaryApi.list();
      const allBeneficiaries = allBeneficiariesRes.data.data || [];
      
      // Get enrolled beneficiary IDs
      const enrolledIds = enrolledBeneficiariesData.map(b => b.id);
      
      // Filter eligible beneficiaries (approved, same barangay, same category, not enrolled)
      const normalizeCategory = (cat) => cat?.toLowerCase().replace(/ies$/i, 'y').replace(/s$/i, '');
      const programCat = normalizeCategory(program.eligibility_category || program.category);
      
      const eligible = allBeneficiaries.filter(b => {
        if (b.status !== 'Approved') return false;
        if (b.barangay_id !== program.barangay_id) return false;
        if (enrolledIds.includes(b.id)) return false;
        
        // Check category match
        const beneficiaryCat = normalizeCategory(b.category);
        const hasMatchingCategory = b.category && (
          beneficiaryCat === programCat || 
          beneficiaryCat?.includes(programCat) ||
          b.category?.toLowerCase().includes((program.eligibility_category || program.category || '').toLowerCase())
        );
        
        return hasMatchingCategory;
      });
      
      setEligibleBeneficiaries(eligible);

      // AUTO-ENROLL: If there are eligible beneficiaries but no enrolled beneficiaries, auto-enroll them
      if (eligible.length > 0 && enrolledBeneficiariesData.length === 0) {
        console.log(`Auto-enrolling ${eligible.length} eligible beneficiaries...`);
        try {
          const autoEnrollRes = await programApi.autoEnrollBeneficiaries(program.id);
          console.log('Auto-enrollment result:', autoEnrollRes.data);
          
          // Reload enrolled beneficiaries after auto-enrollment
          const updatedEnrolledRes = await programApi.getEnrolledBeneficiaries(program.id);
          setEnrolledBeneficiaries(updatedEnrolledRes.data.data || []);
          
          // Clear eligible list since they're now enrolled
          setEligibleBeneficiaries([]);
          
          setSuccess(autoEnrollRes.data.message || `Successfully auto-enrolled ${autoEnrollRes.data.data.newly_enrolled} beneficiary(ies)`);
          setTimeout(() => setSuccess(null), 5000);
        } catch (autoEnrollError) {
          console.error('Auto-enrollment failed:', autoEnrollError);
          // Don't show error to user, just log it - enrollment can still be done manually
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load beneficiaries'));
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleArchive = async (program) => {
    if (!window.confirm(`Are you sure you want to archive "${program.name}"? This will change its status to archived.`)) {
      return;
    }
    
    try {
      await programApi.update(program.id, { ...program, status: 'archived' });
      setError(null);
      await loadPrograms();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to archive program'));
    }
  };

  const handleUnarchive = async (program) => {
    if (!window.confirm(`Unarchive "${program.name}"? This will change its status to inactive.`)) {
      return;
    }
    
    try {
      await programApi.update(program.id, { ...program, status: 'inactive' });
      setError(null);
      await loadArchivedPrograms(); // Reload archived list
      await loadPrograms(); // Reload main list
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unarchive program'));
    }
  };

  const loadArchivedPrograms = async () => {
    setLoadingArchived(true);
    try {
      const params = { status: 'archived' };
      if (isAdmin && filterBarangay) params.barangay_id = filterBarangay;
      
      const response = await programApi.list(params);
      setArchivedPrograms(response.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load archived programs'));
    } finally {
      setLoadingArchived(false);
    }
  };

  const openArchivedModal = () => {
    setShowArchivedModal(true);
    loadArchivedPrograms();
  };

  const handleDelete = async (program) => {
    try {
      await programApi.remove(program.id);
      setDeleteConfirm(null);
      await loadPrograms();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete program'));
    }
  };

  const columns = [
    { header: 'Program Name', accessor: 'name' },
    { header: 'Barangay', accessor: 'Barangay', cell: (row) => (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
        <MapPin className="w-3 h-3" />
        {row.Barangay?.barangay_name || '—'}
      </span>
    )},
    { header: 'Category', accessor: 'category', cell: (row) => {
      const cat = row.eligibility_category || row.category || '';
      return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          cat.includes('4Ps') ? 'bg-blue-100 text-blue-800' :
          cat.includes('Senior') ? 'bg-red-100 text-red-800' :
          cat.includes('PWD') ? 'bg-amber-100 text-amber-800' :
          'bg-slate-100 text-slate-800'
        }`}>{cat || '—'}</span>
      );
    }},
    { header: 'Status', accessor: 'status', cell: (row) => (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
        row.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
        row.status === 'draft' ? 'bg-slate-100 text-slate-800' :
        row.status === 'completed' ? 'bg-blue-100 text-blue-800' :
        row.status === 'inactive' ? 'bg-orange-100 text-orange-800' :
        row.status === 'archived' ? 'bg-gray-100 text-gray-600' :
        'bg-slate-100 text-slate-800'
      }`}>{row.status}</span>
    )},
    { header: 'Duration', accessor: 'start_date', cell: (row) => `${row.start_date || '—'} - ${row.end_date || '—'}` },
    ...(isAdmin ? [{
      header: 'Actions',
      accessor: 'id',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleViewDetails(row)}
            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
            title="Edit Program"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition ${
              row.status === 'active'
                ? 'text-orange-600 hover:bg-orange-50'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {row.status === 'active' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleArchive(row)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            title="Archive Program"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Briefcase className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Programs</h1>
            <p className="text-sm text-slate-600 mt-1">
              {isAdmin
                ? 'Create and manage benefit programs for LGU/MSWD operations.'
                : `Showing programs assigned to Barangay ${userBarangayName || 'your barangay'}.`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openCreateModal} className="gap-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap">
            <Plus className="h-4 w-4" />
            Create Program
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-start gap-3">
          <span className="text-lg">✅</span>
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Non-admin barangay indicator */}
      {!isAdmin && userBarangayName && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span>
            You are viewing programs exclusively assigned to <strong>Barangay {userBarangayName}</strong>.
            Programs from other barangays are not accessible.
          </span>
        </div>
      )}

      {/* Admin filters */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-700">
            <Filter className="w-4 h-4" />
            Filter Programs
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">By Barangay</label>
              <select
                value={filterBarangay}
                onChange={(e) => setFilterBarangay(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              >
                <option value="">All Barangays</option>
                {barangays.map((brgy) => (
                  <option key={brgy.id} value={brgy.id}>{brgy.barangay_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">By Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Total Programs</p>
          <p className="text-3xl font-bold text-purple-600">{loading ? '...' : programs.length}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
          <p className="text-sm font-medium text-slate-600 mb-2">Active Programs</p>
          <p className="text-3xl font-bold text-emerald-600">
            {loading ? '...' : programs.filter(p => p.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="text-sm text-slate-600 mt-2">Loading programs...</p>
          </div>
        ) : programs.length === 0 ? (
          <div className="p-8 text-center">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">
              {viewMode === 'archived' 
                ? 'No archived programs found.'
                : isAdmin
                ? 'No programs found. Click "Create Program" to get started.'
                : 'No benefit programs found for your assigned barangay.'}
            </p>
          </div>
        ) : (
          <>
            <Table columns={columns} data={programs} />
            {/* View Archived Programs Button */}
            <div className="px-4 py-3 border-t-2 border-slate-200 bg-slate-50">
              <button
                onClick={openArchivedModal}
                className="text-sm font-semibold text-slate-700 hover:text-purple-600 transition-colors flex items-center gap-2"
              >
                <Archive className="w-4 h-4" />
                View Archived Programs
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3">
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Program</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-xs text-red-600 mb-4">
              This will also remove all related enrollments, distribution events, and transactions. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Program Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl my-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setShowModal(false); setEditingProgram(null); }} className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-purple-100 rounded-lg">
                {editingProgram ? <Edit2 className="w-4 h-4 text-purple-600" /> : <Plus className="w-4 h-4 text-purple-600" />}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingProgram ? 'Edit Program' : 'Create New Program'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingProgram ? 'Update the program details.' : 'Fill in the details to create a new benefit program.'}
                </p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  required
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Program Name</label>
                {form.category ? (
                  programOptions.length > 0 ? (
                    <select
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      required
                    >
                      <option value="">Select Program</option>
                      {programOptions.map((prog) => (
                        <option key={prog} value={prog}>{prog}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter program name"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      required
                    />
                  )
                ) : (
                  <div className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Please select a category first
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Program description and objectives..."
                  rows="2"
                  readOnly={form.name ? true : false}
                  className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200 ${form.name ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                />
                {form.name && (
                  <p className="text-xs text-slate-500 mt-1">✓ Description auto-filled from program</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Barangay <span className="text-red-500">*</span>
                </label>
                <select
                  name="barangay_id"
                  value={form.barangay_id}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  required
                >
                  <option value="">Select Barangay</option>
                  {barangays.map((brgy) => (
                    <option key={brgy.id} value={brgy.id}>{brgy.barangay_name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  This program will only be visible to staff and beneficiaries of the selected barangay.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <Input
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                  <Input
                    name="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button variant="secondary" type="button" onClick={() => { setShowModal(false); setEditingProgram(null); }}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
                  {submitting ? 'Saving...' : (editingProgram ? 'Update Program' : 'Create Program')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Program Details Modal */}
      {showDetailsModal && selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedProgram.name}</h2>
                <p className="text-sm text-slate-600 mt-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {selectedProgram.Barangay?.barangay_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedProgram(null);
                  setEnrolledBeneficiaries([]);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Program Info */}
              <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Program Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Category</p>
                    <p className="font-semibold">{selectedProgram.eligibility_category || 'All Categories'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Status</p>
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                      selectedProgram.status === 'active' ? 'bg-green-100 text-green-700' :
                      selectedProgram.status === 'draft' ? 'bg-slate-100 text-slate-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {selectedProgram.status}
                    </span>
                  </div>
                  
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total Enrolled</p>
                    <p className="font-semibold text-2xl text-purple-600">{enrolledBeneficiaries.length}</p>
                  </div>
                </div>

                {selectedProgram.description && (
                  <div className="mt-4 pt-4 border-t border-slate-300">
                    <p className="text-sm text-slate-500 mb-1">Description</p>
                    <p className="text-slate-700">{selectedProgram.description}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-300 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Start Date
                    </p>
                    <p className="font-semibold">{selectedProgram.start_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      End Date
                    </p>
                    <p className="font-semibold">{selectedProgram.end_date || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Enrolled Beneficiaries Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">
                    <Users className="w-5 h-5 inline mr-2" />
                    Enrolled Beneficiaries ({enrolledBeneficiaries.length})
                  </h3>
                </div>

                {detailsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <p className="text-sm text-slate-600 mt-2">Loading beneficiaries...</p>
                  </div>
                ) : enrolledBeneficiaries.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">No beneficiaries enrolled yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg mb-6">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50 border-b border-green-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase">Enrolled Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {enrolledBeneficiaries.map((beneficiary) => (
                          <tr key={beneficiary.id} className="hover:bg-green-50">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">
                                {beneficiary.first_name} {beneficiary.last_name}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-mono">{beneficiary.beneficiary_id_code}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm">{beneficiary.category}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm">{new Date(beneficiary.enrollment_date).toLocaleDateString()}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                {beneficiary.enrollment_status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Eligible Beneficiaries for Enrollment */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">
                    <UserPlus className="w-5 h-5 inline mr-2" />
                    Eligible Beneficiaries ({eligibleBeneficiaries.length})
                  </h3>
                </div>

                {detailsLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <p className="text-sm text-slate-600 mt-2">Loading eligible beneficiaries...</p>
                  </div>
                ) : eligibleBeneficiaries.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">No eligible beneficiaries available</p>
                    <p className="text-xs text-slate-500 mt-1">All matching beneficiaries are already enrolled in this program</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-50 border-b border-purple-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Barangay</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-purple-700 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eligibleBeneficiaries.map((beneficiary) => (
                          <tr key={beneficiary.id} className="hover:bg-purple-50 transition">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">
                                {beneficiary.first_name} {beneficiary.last_name}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-mono text-slate-600">{beneficiary.beneficiary_id_code}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                {beneficiary.category}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-600">{beneficiary.Barangay?.barangay_name || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                {beneficiary.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedProgram(null);
                  setEnrolledBeneficiaries([]);
                  setEligibleBeneficiaries([]);
                }}
                className="px-6 py-2 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived Programs Modal */}
      {showArchivedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Archive className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Archived Programs</h2>
                  <p className="text-sm text-slate-600 mt-1">View and manage archived benefit programs.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowArchivedModal(false);
                  setArchivedPrograms([]);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingArchived ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="text-sm text-slate-600 mt-2">Loading archived programs...</p>
                </div>
              ) : archivedPrograms.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                  <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No archived programs found</p>
                  <p className="text-sm text-slate-500 mt-1">Programs that you archive will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Program Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Barangay</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Duration</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                        {isAdmin && <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {archivedPrograms.map((program) => (
                        <tr key={program.id} className="hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900">{program.name}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <MapPin className="w-3 h-3" />
                              {program.Barangay?.barangay_name || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {program.eligibility_category || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{program.start_date || '—'} - {program.end_date || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              archived
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleViewDetails(program)}
                                  className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleUnarchive(program)}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                  title="Unarchive Program"
                                >
                                  <ArchiveRestore className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setShowArchivedModal(false);
                  setArchivedPrograms([]);
                }}
                className="px-6 py-2 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

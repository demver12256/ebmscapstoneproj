import { useEffect, useState } from 'react';
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

// Program descriptions mapping (Updated 2026 DSWD & MSWDO Standards)
const PROGRAM_DESCRIPTIONS = {
  '4Ps Household Beneficiaries': {
    '4Ps Health & Nutrition Cash Grant': 'Monthly health subsidy (₱750/month) for qualified 4Ps households compliant with regular health center check-ups and child immunization.',
    '4Ps First 1,000 Days (F1KD) Nutrition Subsidy': 'Conditional cash grant for pregnant women, nursing mothers, and children aged 0-24 months to address malnutrition and stunting.',
    '4Ps Education Grant - Elementary': 'Educational cash assistance (₱300/month per child) for elementary school students of 4Ps households (up to 10 months/year).',
    '4Ps Education Grant - Junior High School': 'Educational cash assistance (₱500/month per child) for junior high school students of 4Ps households (up to 10 months/year).',
    '4Ps Education Grant - Senior High School': 'Educational cash assistance (₱700/month per child) for senior high school students of 4Ps households (up to 10 months/year).',
    '4Ps Rice Subsidy Allowance': 'Monthly rice assistance cash subsidy (₱600/month per household) to augment staple food and grain security.',
    '4Ps Family Development Sessions (FDS)': 'Mandatory monthly modular workshops on responsible parenting, home management, health, financial literacy, and disaster resilience.',
    'Sustainable Livelihood Program (SLP) Referral & Seed Capital': 'Micro-enterprise development or employment facilitation capital grant for graduating 4Ps households under Kilos Unlad.',
    'Cash-for-Work / Climate & Disaster Resiliency': 'Temporary community employment and financial assistance for disaster risk reduction and community rehabilitation.',
    'Assistance to Individuals in Crisis Situation (AICS) - Emergency Relief': 'Immediate emergency financial assistance for medical, burial, and transportation crises.',
    // Backward compatibility aliases
    'Regular Cash Grant': 'Regular monthly cash assistance for qualified 4Ps households',
    'Education Grant': 'Educational assistance for children of 4Ps beneficiaries',
    'Health Grant': 'Health-related assistance and medical support',
    'Rice Assistance (kapag may implementasyon ng DSWD o national government)': 'Rice subsidy program (subject to DSWD/national government implementation)',
    'Rice Assistance': 'Rice subsidy program to augment food security',
    'Disaster Relief Assistance': 'Emergency assistance during disasters and calamities',
    'Educational Assistance': 'Comprehensive educational support programs',
  },
  'Senior Citizens (Social Pension)': {
    // MSWDO Municipal Programs (Local Level)
    'MSWDO Local Social Pension (Municipal Counterpart)': 'Monthly municipal social pension (₱500–₱1,000/month) for indigent senior citizens waitlisted or uncovered by national SocPen.',
    'Senior Citizens Birthday Cash Incentive & Gift Pack': 'Annual birthday cash gift (₱500–₱2,000) and nutritious grocery package for registered senior citizens under municipal ordinance.',
    'Senior Citizens Longevity Milestone Award (70, 75, 80+)': 'Municipal longevity cash incentive (₱5,000–₱10,000) honoring senior citizens reaching milestone ages prior to centenarian status.',
    'OSCA Free Assistive Mobility Devices (Wheelchairs & Canes)': 'Free distribution of standard wheelchairs, walkers, quad canes, and hearing aids for frail, mobility-impaired, or bedridden seniors.',
    'MSWDO Senior Maintenance Medicine & Health Subsidy': 'Free maintenance medicines (hypertension, diabetes), vitamins, and geriatric vaccinations in partnership with the Rural Health Unit (RHU).',
    'Local Senior Burial & Funeral Assistance (Damayan)': 'Municipal burial and mortuary cash aid (₱3,000–₱10,000) to support bereaved indigent senior citizen families.',
    'Bedridden Senior Home Care & Mobile Payout Service': 'House-to-house delivery of pensions, medical wellness monitoring, and basic care packages for immobile or bedridden seniors.',
    'Elderly Filipino Week & Senior Wellness Celebration': 'Annual municipal celebration featuring health screenings, socialization, sports and arts festivals, and wellness gift packs.',
    // National DSWD Programs
    'Social Pension for Indigent Senior Citizens (SocPen)': 'Monthly social pension (₱1,000/month; ₱6,000 semestrally under RA 11916) for indigent seniors aged 60 and above without permanent income or other pensions.',
    'Expanded Centenarian Milestone Cash Gift (Ages 80, 85, 90, 95)': 'Cash grant of ₱10,000 for elderly Filipinos reaching age milestones of 80, 85, 90, and 95 (under RA 11982) with official letter of felicitation.',
    'Centenarian Cash Gift (100 Years Old)': 'National cash gift of ₱100,000 and Presidential Letter of Felicitation for Filipino centenarians reaching 100 years of age (RA 10868).',
    'Assistive Devices Allocation (Wheelchairs, Walking Canes, Hearing Aids)': 'Free distribution of wheelchairs, walkers, quad canes, and hearing assistive devices for frail and indigent senior citizens.',
    'AICS Senior Medical & Hospitalization Assistance': 'Emergency financial assistance, guarantee letters (GL), laboratory aid, and maintenance medicine subsidies for indigent elderly.',
    'AICS Senior Funeral and Burial Assistance': 'Financial assistance (₱5,000 - ₱10,000+) to support indigent families with senior citizen mortuary and burial expenses.',
    'Senior Citizens Health & Geriatric Wellness Program': 'Periodic medical check-ups, geriatric consultations, health screening, and wellness activities in coordination with OSCA.',
    'Senior Citizens OSCA Assistance & Referral Services': 'Information dissemination, senior privileges enforcement, and referral coordination with OSCA and DSWD/NCSC.',
    'Emergency Food & Calamity Relief for Seniors': 'Emergency family food packs and priority relief assistance during typhoons, floods, and natural disasters.',
    // Backward compatibility aliases
    'Centenarian Benefits': 'Special benefits and cash gifts for centenarians',
    'Medical Assistance': 'Healthcare support and medical services',
    'Funeral Assistance': 'Financial assistance for funeral and burial expenses',
    'Assistive Devices Distribution': 'Distribution of medical aids and assistive devices',
    'Relief Assistance': 'General relief assistance during hardships',
    'AICS (Assistance to Individuals in Crisis Situation)': 'Emergency assistance for individuals in crisis situations',
    'Livelihood Assistance (kung kwalipikado)': 'Livelihood support for qualified senior citizens',
    'Health and Wellness Programs': 'Health promotion and wellness activities',
  },
  'Persons with Disabilities (PWD)': {
    // MSWDO Municipal Programs (Local Level)
    'MSWDO Local PWD Monthly Financial Allowance': 'Monthly or quarterly municipal financial stipend (₱500–₱1,000/month funded via the 1% LGU PWD budget) for indigent PWDs.',
    'PDAO Free Assistive Devices (Wheelchairs, Crutches, Canes)': 'Provision of customized wheelchairs, crutches, walking canes, white canes, and hearing aids via PDAO and MSWDO.',
    'PWD Microenterprise & Livelihood Capital Grant': 'Start-up capital assistance (₱5,000–₱15,000) and livelihood toolkits for sari-sari stores, craft making, and home-based micro-businesses.',
    'PWD Educational Subsidy & SPED Assistance': 'Annual educational financial assistance (₱2,000–₱5,000/year) and school supplies for learners with disabilities and SPED students.',
    'PWD Medical & Physical Therapy Referral Assistance': 'Subsidized physical therapy, occupational therapy sessions, medical supplies, and maintenance medicine support via RHU/partner clinics.',
    'PWD Inclusive Skills & Vocational Training Program': 'Free skills training, tech-voc livelihood courses, and computer literacy workshops in partnership with TESDA and PDAO.',
    'Disaster Priority Relief & Evacuation for PWD Households': 'Targeted disaster evacuation registry, priority rescue support, and specialized emergency food and hygiene packs.',
    'PWD Inclusive LGU Employment Facilitation (1% Mandate)': 'Workplace accommodation advocacy and priority contractual/temporary job placement within the Municipal Hall and barangays.',
    'PDAO / PWD ID & Purchase Booklet Issuance': 'Official municipal registration, digitized PWD ID, and medicine/grocery discount booklets for statutory 20% discount and VAT exemption.',
    'AICS Municipal Emergency Financial Relief for PWD': 'Immediate emergency financial, medical, and transportation assistance for PWD individuals and families in crisis.',
    // National DSWD Programs
    'PWD ID Registration and Benefit Card Issuance': 'Official municipal registration and ID issuance for statutory 20% discounts, VAT exemption, and government social protection.',
    'Assistive Mobility Devices Distribution (Wheelchairs, Crutches, White Canes)': 'Distribution of mobility and sensory assistive devices including wheelchairs, crutches, white canes, and hearing aids.',
    'PWD Medical, Diagnostic & Physical Therapy Assistance': 'Medical subsidies, physical and occupational therapy coverage, assistive prosthetics, and maintenance medicines via AICS.',
    'PWD Sustainable Livelihood Program (SLP-PWD Seed Capital)': 'Capital seed funding and livelihood toolkits for micro-enterprises, sari-sari stores, craft making, and home-based businesses.',
    'PWD Skills & Vocational Tech-Voc Training': 'Free vocational training, livelihood workshops, and skills enhancement programs in partnership with TESDA and DSWD centers.',
    'PWD Educational Assistance & SPED Learning Grant': 'Financial support, stipend, and learning supplies for learners with disabilities and Special Education (SPED) students.',
    'Local PWD Monthly / Quarterly Cash Allowance': 'LGU/municipal financial stipend to augment daily living, transportation, and nutritional needs of indigent PWDs.',
    'PWD Inclusive Employment Facilitation': 'Job matching, workplace accommodation advocacy, and employment facilitation with local businesses and government offices.',
    'AICS (Assistance to Individuals in Crisis Situation) for PWD': 'Immediate emergency financial and medical aid for PWD individuals and families encountering severe hardship or crisis.',
    'Disaster Preparedness & Priority Evacuation Relief': 'Disability-inclusive emergency relief, special dietary/hygiene packs, and priority disaster evacuation support.',
    // Backward compatibility aliases
    'PWD ID Registration and Renewal': 'Registration and renewal of PWD identification cards',
    'Assistive Devices Distribution (wheelchair, cane, hearing aid, crutches, atbp.)': 'Distribution of assistive devices (wheelchairs, canes, hearing aids, crutches, etc.)',
    'Medical Assistance': 'Healthcare support and medical services for PWD',
    'Educational Assistance': 'Educational support and scholarships for PWD',
    'Livelihood Assistance': 'Income-generating livelihood programs for PWD',
    'Skills Training Program': 'Vocational and technical skills training for PWD',
    'Physical Rehabilitation Services': 'Physical rehabilitation and therapy services',
  },
};

// Standard DSWD Programs (National Mandates)
const PROGRAMS_BY_CATEGORY = {
  '4Ps Household Beneficiaries': [
    '4Ps Health & Nutrition Cash Grant',
    '4Ps First 1,000 Days (F1KD) Nutrition Subsidy',
    '4Ps Education Grant - Elementary',
    '4Ps Education Grant - Junior High School',
    '4Ps Education Grant - Senior High School',
    '4Ps Rice Subsidy Allowance',
    '4Ps Family Development Sessions (FDS)',
    'Sustainable Livelihood Program (SLP) Referral & Seed Capital',
    'Cash-for-Work / Climate & Disaster Resiliency',
    'Assistance to Individuals in Crisis Situation (AICS) - Emergency Relief',
  ],
  'Senior Citizens (Social Pension)': [
    'Social Pension for Indigent Senior Citizens (SocPen)',
    'Expanded Centenarian Milestone Cash Gift (Ages 80, 85, 90, 95)',
    'Centenarian Cash Gift (100 Years Old)',
    'Assistive Devices Allocation (Wheelchairs, Walking Canes, Hearing Aids)',
    'AICS Senior Medical & Hospitalization Assistance',
    'AICS Senior Funeral and Burial Assistance',
    'Senior Citizens Health & Geriatric Wellness Program',
    'Senior Citizens OSCA Assistance & Referral Services',
    'Emergency Food & Calamity Relief for Seniors',
  ],
  'Persons with Disabilities (PWD)': [
    'PWD ID Registration and Benefit Card Issuance',
    'Assistive Mobility Devices Distribution (Wheelchairs, Crutches, White Canes)',
    'PWD Medical, Diagnostic & Physical Therapy Assistance',
    'PWD Sustainable Livelihood Program (SLP-PWD Seed Capital)',
    'PWD Skills & Vocational Tech-Voc Training',
    'PWD Educational Assistance & SPED Learning Grant',
    'Local PWD Monthly / Quarterly Cash Allowance',
    'PWD Inclusive Employment Facilitation',
    'AICS (Assistance to Individuals in Crisis Situation) for PWD',
    'Disaster Preparedness & Priority Evacuation Relief',
  ],
};

// Dedicated MSWDO Municipal Programs (Local Level for MSWDO Admin - Senior & PWD Only)
const MSWDO_PROGRAMS_BY_CATEGORY = {
  'Senior Citizens (Social Pension)': [
    'MSWDO Local Social Pension (Municipal Counterpart)',
    'Senior Citizens Birthday Cash Incentive & Gift Pack',
    'Senior Citizens Longevity Milestone Award (70, 75, 80+)',
    'OSCA Free Assistive Mobility Devices (Wheelchairs & Canes)',
    'MSWDO Senior Maintenance Medicine & Health Subsidy',
    'Local Senior Burial & Funeral Assistance (Damayan)',
    'Bedridden Senior Home Care & Mobile Payout Service',
    'Elderly Filipino Week & Senior Wellness Celebration',
    'Social Pension for Indigent Senior Citizens (SocPen)',
    'Expanded Centenarian Milestone Cash Gift (Ages 80, 85, 90, 95)',
    'Centenarian Cash Gift (100 Years Old)',
  ],
  'Persons with Disabilities (PWD)': [
    'MSWDO Local PWD Monthly Financial Allowance',
    'PDAO Free Assistive Devices (Wheelchairs, Crutches, Canes)',
    'PWD Microenterprise & Livelihood Capital Grant',
    'PWD Educational Subsidy & SPED Assistance',
    'PWD Medical & Physical Therapy Referral Assistance',
    'PWD Inclusive Skills & Vocational Training Program',
    'Disaster Priority Relief & Evacuation for PWD Households',
    'PWD Inclusive LGU Employment Facilitation (1% Mandate)',
    'PDAO / PWD ID & Purchase Booklet Issuance',
    'AICS Municipal Emergency Financial Relief for PWD',
  ],
};

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  barangay_ids: [], // array for multiple select
  barangay_id: '',  // used for edit (single)
  total_budget: '',
  allocated_budget: '',
  start_date: '',
  end_date: '',
  status: 'active',
};

export default function ProgramListPage() {
  const { user, token } = useAuth();
  const isAdmin = ['admin','mswdo_admin'].includes(user?.role);
  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const displayCategories = isMswdoAdmin
    ? [
        'Senior Citizens (Social Pension)',
        'Persons with Disabilities (PWD)'
      ]
    : CATEGORIES;
  const [programs, setPrograms] = useState([]);
  const [allPrograms, setAllPrograms] = useState([]);
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
  const [isCustomProgramName, setIsCustomProgramName] = useState(false);
  
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
  const [viewMode] = useState('active');
  
  // Archived Programs Modal
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedPrograms, setArchivedPrograms] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Find barangay name for non-admin header label
  const userBarangayName = user?.Barangay?.barangay_name || barangays.find(b => Number(b.id) === Number(user?.barangay_id))?.barangay_name || '';

  // Helper to safely get program options for any category variation
  const getProgramOptions = (category) => {
    if (!category) return [];
    const source = isMswdoAdmin ? MSWDO_PROGRAMS_BY_CATEGORY : PROGRAMS_BY_CATEGORY;
    if (source[category]) return source[category];
    const foundKey = Object.keys(source).find(
      (k) => k.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(k.toLowerCase())
    );
    if (foundKey) return source[foundKey];
    // Fallback to general list if not found in MSWDO
    if (PROGRAMS_BY_CATEGORY[category]) return PROGRAMS_BY_CATEGORY[category];
    const fallbackKey = Object.keys(PROGRAMS_BY_CATEGORY).find(
      (k) => k.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(k.toLowerCase())
    );
    return fallbackKey ? PROGRAMS_BY_CATEGORY[fallbackKey] : [];
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
      
      if (isAdmin && filterBarangay) params.barangay_id = filterBarangay;
      if (filterStatus) params.status = filterStatus;

      const programsResponse = await programApi.list(params);
      const allFetched = programsResponse.data.data || [];

      // AUTO-ARCHIVE: automatically archive programs whose end_date has passed
      if (isAdmin) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const toArchive = allFetched.filter(p => {
          if (!p.end_date) return false;
          const endDate = new Date(p.end_date);
          endDate.setHours(0, 0, 0, 0);
          return endDate < today && p.status !== 'archived' && p.status !== 'completed';
        });
        for (const p of toArchive) {
          try {
            await programApi.update(p.id, { status: 'archived', eligibility_category: p.eligibility_category || p.category });
          } catch (e) {
            console.error('Auto-archive failed for program', p.id, e);
          }
        }
        if (toArchive.length > 0) {
          // Re-fetch after auto-archiving
          const refreshed = await programApi.list(params);
          const refreshedAll = refreshed.data.data || [];
          setAllPrograms(refreshedAll);
          setPrograms(refreshedAll.filter(p => p.status !== 'archived'));
          return;
        }
      }

      // MSWDO can only access Senior Citizens and PWD programs (4Ps is strictly DSWD)
      const allowedPrograms = isMswdoAdmin
        ? allFetched.filter(p => {
            const cat = String(p.eligibility_category || p.category || '').toLowerCase();
            return (cat.includes('senior') || cat.includes('pwd') || cat.includes('disabilit')) && !cat.includes('4ps') && !cat.includes('pantawid');
          })
        : allFetched;

      setAllPrograms(allowedPrograms);
      // Filter out archived programs from main table list
      setPrograms(allowedPrograms.filter(p => p.status !== 'archived'));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load programs'));
    } finally {
      setLoading(false);
    }
  };

  const loadBarangays = async () => {
    if (!token) return;

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
  }, [token]);

  useEffect(() => {
    loadPrograms();
    loadArchivedPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterBarangay, filterStatus]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // If custom program name option selected
    if (name === 'name' && value === '__custom__') {
      setIsCustomProgramName(true);
      setForm((prev) => ({ ...prev, name: '' }));
      return;
    }

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
    setIsCustomProgramName(false);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (program) => {
    setEditingProgram(program);
    const progCategory = program.eligibility_category || program.category || '';
    const availableOptions = getProgramOptions(progCategory);
    const isCustom = program.name && !availableOptions.includes(program.name);
    setIsCustomProgramName(Boolean(isCustom));
    setForm({
      name: program.name || '',
      description: program.description || '',
      category: progCategory,
      barangay_id: program.barangay_id || '',
      barangay_ids: program.barangay_id ? [String(program.barangay_id)] : [],
      total_budget: program.total_budget || '',
      allocated_budget: program.allocated_budget || '',
      start_date: program.start_date || '',
      end_date: program.end_date || '',
      status: program.status || 'draft',
    });
    setFormError(null);
    setShowModal(true);
  };

  // Toggle barangay selection
  const toggleBarangay = (brgyId) => {
    setForm(prev => {
      const id = String(brgyId);
      const current = prev.barangay_ids.map(String);
      const updated = current.includes(id)
        ? current.filter(b => b !== id)
        : [...current, id];
      return { ...prev, barangay_ids: updated, barangay_id: updated[0] || '' };
    });
  };

  // Select/deselect all barangays
  const toggleAllBarangays = () => {
    setForm(prev => {
      const allIds = barangays.map(b => String(b.id));
      const allSelected = allIds.every(id => prev.barangay_ids.map(String).includes(id));
      const updated = allSelected ? [] : allIds;
      return { ...prev, barangay_ids: updated, barangay_id: updated[0] || '' };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editingProgram) {
        // Edit: single barangay (barangay_ids[0] or barangay_id)
        const barangayId = form.barangay_ids.length > 0 ? Number(form.barangay_ids[0]) : Number(form.barangay_id);
        const payload = {
          name: form.name,
          description: form.description,
          eligibility_category: form.category,
          barangay_id: barangayId,
          total_budget: Number(form.total_budget) || 0,
          allocated_budget: Number(form.allocated_budget) || 0,
          start_date: form.start_date,
          end_date: form.end_date,
          status: form.status,
        };
        await programApi.update(editingProgram.id, payload);
        setSuccess('Program updated successfully!');
      } else {
        // Create: one program per selected barangay
        if (form.barangay_ids.length === 0) {
          setFormError('Please select at least one barangay.');
          setSubmitting(false);
          return;
        }
        let totalAutoEnrolled = 0;
        for (const bId of form.barangay_ids) {
          const payload = {
            name: form.name,
            description: form.description,
            eligibility_category: form.category,
            barangay_id: Number(bId),
            total_budget: Number(form.total_budget) || 0,
            allocated_budget: Number(form.allocated_budget) || 0,
            start_date: form.start_date,
            end_date: form.end_date,
            status: form.status,
          };
          const res = await programApi.create(payload);
          totalAutoEnrolled += res.data?.auto_enrolled_count || 0;
        }
        const count = form.barangay_ids.length;
        if (totalAutoEnrolled > 0) {
          setSuccess(`${count} program(s) created! ${totalAutoEnrolled} eligible beneficiary(ies) automatically enrolled.`);
        } else {
          setSuccess(`${count} program(s) created successfully across ${count} barangay(s)!`);
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
      await programApi.update(program.id, { status: 'archived', eligibility_category: program.eligibility_category || program.category });
      setError(null);
      await loadPrograms();
      await loadArchivedPrograms();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to archive program'));
    }
  };

  const handleUnarchive = async (program) => {
    // Determine the correct status: if end_date has passed, set to 'completed' to prevent auto-archive
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = program.end_date ? new Date(program.end_date) : null;
    if (endDate) endDate.setHours(0, 0, 0, 0);
    const isExpired = endDate && endDate < today;
    const newStatus = isExpired ? 'completed' : 'active';

    if (!window.confirm(`Unarchive "${program.name}"? This will change its status to ${newStatus}.`)) {
      return;
    }
    
    try {
      await programApi.update(program.id, { status: newStatus, eligibility_category: program.eligibility_category || program.category });
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
      const rawArchived = response.data.data || [];
      const allowedArchived = isMswdoAdmin
        ? rawArchived.filter(p => {
            const cat = String(p.eligibility_category || p.category || '').toLowerCase();
            return (cat.includes('senior') || cat.includes('pwd') || cat.includes('disabilit')) && !cat.includes('4ps') && !cat.includes('pantawid');
          })
        : rawArchived;
      setArchivedPrograms(allowedArchived);
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
    {
      header: 'Actions',
      accessor: 'id',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {/* View Enrolled — visible to ALL users (admin and staff) */}
          <button
            onClick={() => handleViewDetails(row)}
            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
            title="View Enrolled Beneficiaries"
          >
            <Users className="w-4 h-4 text-blue-600" />
          </button>

          {/* Archive Program — visible to ALL users (admin and staff) */}
          <button
            onClick={() => handleArchive(row)}
            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
            title="Archive Program"
          >
            <Archive className="w-4 h-4 text-purple-600" />
          </button>

          {/* Admin-only actions */}
          {isAdmin && (
            <>
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
                onClick={() => setDeleteConfirm(row)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                title="Delete Program"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black tracking-tight">Benefit Programs Module</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl">
            {isMswdoAdmin
              ? 'MSWDO: Primary focus on Senior Citizens & PWD programs. (4Ps programs are managed exclusively by DSWD).'
              : isAdmin
              ? 'Create and manage municipal benefit programs, set eligibility categories, and oversee assistance allocations.'
              : `Showing programs assigned to ${userBarangayName ? `Barangay ${userBarangayName}` : 'your assigned barangay'}.`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg hover:shadow-yellow-500/20 transition transform active:scale-95 text-sm"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              Create Program
            </button>
          )}
          <button
            onClick={openArchivedModal}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl shadow transition border border-white/20 text-sm"
          >
            <Archive className="w-5 h-5 text-purple-300" />
            <span>Archived ({archivedPrograms.length})</span>
          </button>
        </div>
      </div>

      {isMswdoAdmin && (
        <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-4 flex items-start gap-3">
          <span className="text-xl">🏥</span>
          <div>
            <p className="text-sm font-bold text-purple-900">MSWDO Program Scope: Senior Citizens & PWD Only</p>
            <p className="text-xs text-purple-700">MSWDO administers programs for Senior Citizens (Social Pension) and Persons with Disabilities (PWD). 4Ps programs are managed exclusively by DSWD and are not accessible to MSWDO.</p>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 hover:shadow-md transition-shadow cursor-default">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Total Programs</p>
          <p className="text-2xl font-bold text-purple-600">{loading ? '...' : allPrograms.length}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200 hover:shadow-md transition-shadow cursor-default">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Active</p>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? '...' : allPrograms.filter(p => p.status === 'active').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200 hover:shadow-md transition-shadow cursor-default">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Inactive</p>
          <p className="text-2xl font-bold text-amber-600">
            {loading ? '...' : allPrograms.filter(p => p.status === 'inactive').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200 hover:shadow-md transition-shadow cursor-default">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Draft</p>
          <p className="text-2xl font-bold text-slate-600">
            {loading ? '...' : allPrograms.filter(p => p.status === 'draft').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 hover:shadow-md transition-shadow cursor-default">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Completed</p>
          <p className="text-2xl font-bold text-blue-600">
            {loading ? '...' : allPrograms.filter(p => p.status === 'completed').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-5 border border-rose-200 hover:shadow-md transition-shadow cursor-default">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Archived</p>
          <p className="text-2xl font-bold text-rose-600">
            {loading ? '...' : allPrograms.filter(p => p.status === 'archived').length}
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
                  <option value="">{isMswdoAdmin ? 'Select Category (Senior Citizens, PWD)' : 'Select Category'}</option>
                  {displayCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Program Name</label>
                  {form.category && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomProgramName(!isCustomProgramName);
                        if (!isCustomProgramName) setForm((prev) => ({ ...prev, name: '' }));
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium transition"
                    >
                      {isCustomProgramName ? (isMswdoAdmin ? '← Choose from MSWDO Presets' : '← Choose from DSWD Presets') : '+ Enter Custom Program Name'}
                    </button>
                  )}
                </div>
                {form.category ? (
                  !isCustomProgramName && programOptions.length > 0 ? (
                    <select
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      required
                    >
                      <option value="">{isMswdoAdmin ? 'Select MSWDO Municipal Program' : 'Select Official DSWD Program'}</option>
                      {programOptions.map((prog) => (
                        <option key={prog} value={prog}>{prog}</option>
                      ))}
                      <option value="__custom__">+ Enter Custom Program Name...</option>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                />
                {form.name && !isCustomProgramName && (
                  <p className="text-xs text-slate-500 mt-1">
                    ✓ Description auto-filled from {isMswdoAdmin ? 'MSWDO municipal standards' : 'official DSWD guidelines'} (editable)
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Barangay <span className="text-red-500">*</span>
                    {form.barangay_ids.length > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {form.barangay_ids.length} selected
                      </span>
                    )}
                  </label>
                  {!editingProgram && (
                    <button
                      type="button"
                      onClick={toggleAllBarangays}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium transition"
                    >
                      {barangays.length > 0 && barangays.every(b => form.barangay_ids.map(String).includes(String(b.id)))
                        ? 'Deselect All'
                        : 'Select All'
                      }
                    </button>
                  )}
                </div>
                <div className="w-full rounded-lg border border-slate-300 bg-white overflow-hidden">
                  {editingProgram ? (
                    // Edit mode: single select (keep existing behavior)
                    <select
                      value={form.barangay_ids[0] || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, barangay_ids: [e.target.value], barangay_id: e.target.value }))}
                      className="w-full px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-500"
                      required
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((brgy) => (
                        <option key={brgy.id} value={brgy.id}>{brgy.barangay_name}</option>
                      ))}
                    </select>
                  ) : (
                    // Create mode: checkbox multi-select
                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                      {barangays.map((brgy) => {
                        const isChecked = form.barangay_ids.map(String).includes(String(brgy.id));
                        return (
                          <label
                            key={brgy.id}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition hover:bg-purple-50 ${
                              isChecked ? 'bg-purple-50' : 'bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleBarangay(brgy.id)}
                              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <span className={`text-sm select-none ${
                              isChecked ? 'text-purple-800 font-medium' : 'text-slate-700'
                            }`}>
                              {brgy.barangay_name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {editingProgram
                    ? 'Update the barangay this program is assigned to.'
                    : 'A separate program record will be created for each selected barangay.'}
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
                </select>
                <p className="text-xs text-slate-400 mt-1">⚠️ Programs are automatically archived when their end date has passed.</p>
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
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
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
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
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
                                <ArchiveRestore className="w-4 h-4 text-emerald-600" />
                              </button>
                            </div>
                          </td>
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

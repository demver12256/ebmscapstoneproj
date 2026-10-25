import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Users,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  BarChart2,
  BellRing,
  CheckSquare,
  Square,
  User,
  Download,
  Smartphone,
  Check,
  Archive,
  ArchiveRestore,
  Sparkles,
  Building2,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { announcementApi, programApi, barangayApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';
import { getAnnouncementEndDateTime } from '../utils/announcementSchedule';

export const TARGET_CATEGORIES = [
  '4Ps Household Beneficiaries',
  'Senior Citizens (Social Pension)',
  'Persons with Disabilities (PWD)',
];

export const OFFICIAL_MEETING_PRESETS = [
  // ── 4Ps (Pantawid Pamilyang Pilipino Program - DSWD) ──
  {
    id: '4ps-fds',
    program: '4Ps',
    sector: '4Ps Household Beneficiaries',
    sectorLabel: '4Ps (DSWD Family Development Session)',
    title: '4Ps: Family Development Session (FDS)',
    message: 'Buwanang Family Development Session (FDS) para sa lahat ng 4Ps household beneficiaries. Tatalakayin ang responsableng pagiging magulang, kalusugan, nutrisyon, at edukasyon ng mga bata. Mangyaring dalhin ang inyong RFID Beneficiary Card para sa attendance verification.',
    event_time: '08:00',
    end_time: '11:30',
    venue: 'Barangay Covered Court',
    priority: 'High',
    target_categories: ['4Ps Household Beneficiaries'],
  },
  {
    id: '4ps-program-orientation',
    program: '4Ps',
    sector: '4Ps Household Beneficiaries',
    sectorLabel: '4Ps (Program Activity)',
    title: '4Ps: Program Orientation',
    message: 'Oryentasyon ukol sa mga patakaran, karapatan, at responsibilidad ng mga benepisyaryo ng Pantawid Pamilyang Pilipino Program (4Ps). Pagsusuri ng compliance rules, RFID card verification, at gabay sa paggamit ng mga serbisyong pampamahalaan.',
    event_time: '08:30',
    end_time: '12:00',
    venue: 'Bongabong Municipal Gymnasium',
    priority: 'Medium',
    target_categories: ['4Ps Household Beneficiaries'],
  },
  {
    id: '4ps-financial-literacy',
    program: '4Ps',
    sector: '4Ps Household Beneficiaries',
    sectorLabel: '4Ps (Program Activity)',
    title: '4Ps: Financial Literacy Session',
    message: 'Pagsasanay sa wastong paghawak ng pera, pagbabadyet ng sambahayan, pag-iimpok (savings), at mga oportunidad sa micro-livelihood sa ilalim ng Sustainable Livelihood Program (SLP) module.',
    event_time: '09:00',
    end_time: '12:00',
    venue: 'Barangay Multi-Purpose Hall',
    priority: 'Medium',
    target_categories: ['4Ps Household Beneficiaries'],
  },

  // ── Senior Citizens (OSCA / MSWDO) ──
  {
    id: 'senior-social-pension-orientation',
    program: 'Senior',
    sector: 'Senior Citizens (Social Pension)',
    sectorLabel: 'Senior Citizens (Social Pension)',
    title: 'Senior Citizens: Social Pension Orientation',
    message: 'Oryentasyon at balidasyon para sa mga benepisyaryo ng Social Pension for Indigent Senior Citizens. Tatalakayin ang mga patakaran sa pagtanggap ng stipend, verification ng senior documents, at nakatakdang payout schedule.',
    event_time: '09:00',
    end_time: '12:00',
    venue: 'OSCA Office / Municipal Session Hall',
    priority: 'Medium',
    target_categories: ['Senior Citizens (Social Pension)'],
  },
  {
    id: 'senior-citizen-assembly',
    program: 'Senior',
    sector: 'Senior Citizens (Social Pension)',
    sectorLabel: 'Senior Citizens (Senior Citizen Assembly)',
    title: 'Senior Citizens: Senior Citizen Assembly',
    message: 'Pangkalahatang pagpupulong at asembleya ng mga Senior Citizens kasama ang OSCA at MSWDO para sa updates sa mga bagong benepisyo, lokal na ordinansa, at kapakanan ng mga nakatatanda sa komunidad.',
    event_time: '08:30',
    end_time: '12:00',
    venue: 'Bongabong Municipal Gymnasium',
    priority: 'Medium',
    target_categories: ['Senior Citizens (Social Pension)'],
  },
  {
    id: 'senior-health-wellness',
    program: 'Senior',
    sector: 'Senior Citizens (Social Pension)',
    sectorLabel: 'Senior Citizens (Health & Wellness Session)',
    title: 'Senior Citizens: Health/Wellness Session',
    message: 'Libreng konsultasyong medikal, geriatric wellness checkup, pamamahagi ng maintenance medicines para sa altapresyon at diabetes, pamimigay ng bitamina, at blood pressure monitoring para sa mga Senior Citizens.',
    event_time: '08:00',
    end_time: '14:00',
    venue: 'Rural Health Unit / Barangay Health Center',
    priority: 'High',
    target_categories: ['Senior Citizens (Social Pension)'],
  },

  // ── Persons with Disabilities (PDAO / MSWDO) ──
  {
    id: 'pwd-orientation',
    program: 'PWD',
    sector: 'Persons with Disabilities (PWD)',
    sectorLabel: 'Persons with Disabilities (PWD Orientation)',
    title: 'PWD: PWD Orientation',
    message: 'Komprehensibong oryentasyon ukol sa mga karapatan at pribilehiyo ng mga Persons with Disabilities (PWD) alinsunod sa RA 7277 at RA 10754 (20% discount sa bilihin, gamot, pamasahe, at VAT exemption), PhilHealth benefits, at mga proteksyon sa batas.',
    event_time: '09:00',
    end_time: '12:00',
    venue: 'PDAO Center / Municipal Multi-Purpose Hall',
    priority: 'Medium',
    target_categories: ['Persons with Disabilities (PWD)'],
  },
  {
    id: 'pwd-assembly-consultation',
    program: 'PWD',
    sector: 'Persons with Disabilities (PWD)',
    sectorLabel: 'Persons with Disabilities (PWD Assembly/Consultation)',
    title: 'PWD: PWD Assembly/Consultation',
    message: 'Pangkalahatang konsultasyon at asembleya ng PDAO kasama ang MSWDO upang dinggin ang mga pangangailangan ng PWD community, accessibility concerns, assistive device applications, at suportang medikal.',
    event_time: '09:00',
    end_time: '13:00',
    venue: 'Bongabong Municipal Gymnasium / Covered Court',
    priority: 'Medium',
    target_categories: ['Persons with Disabilities (PWD)'],
  },
  {
    id: 'pwd-skills-training',
    program: 'PWD',
    sector: 'Persons with Disabilities (PWD)',
    sectorLabel: 'Persons with Disabilities (Skills/Capability Training)',
    title: 'PWD: Skills/Capability Training',
    message: 'Pagsasanay sa kasanayan at pangkabuhayan (skills & capability development) na angkop sa kakayahan ng mga Persons with Disabilities upang magkaroon ng sariling hanapbuhay at produktibong kabuhayan.',
    event_time: '08:30',
    end_time: '15:00',
    venue: 'Bongabong Skills Training Center / Multi-Purpose Hall',
    priority: 'Medium',
    target_categories: ['Persons with Disabilities (PWD)'],
  },
];

const calculatePriorityFromDate = (dateStr) => {
  if (!dateStr) return 'Medium';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return 'Medium';

  const eventDate = new Date(year, month - 1, day);
  eventDate.setHours(0, 0, 0, 0);

  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return 'Urgent';
  } else if (diffDays <= 3) {
    return 'High';
  } else if (diffDays <= 7) {
    return 'Medium';
  } else {
    return 'Low';
  }
};

const getAnnouncementStatusDisplay = (status) => {
  const normalized = String(status || 'draft').toLowerCase();
  const styles = {
    published: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-purple-100 text-purple-800',
    pending_approval: 'bg-amber-100 text-amber-800',
    rejected: 'bg-rose-100 text-rose-800',
    draft: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-blue-100 text-blue-800',
    archived: 'bg-amber-100 text-amber-800',
  };
  const labels = {
    pending_approval: 'Pending Approval',
    rejected: 'Rejected',
  };
  return {
    label: labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1),
    className: styles[normalized] || 'bg-slate-100 text-slate-700',
  };
};

const getAttendanceStatusDisplay = (status) => {
  const normalized = ['Present', 'Absent', 'Pending'].includes(status) ? status : 'Pending';
  const styles = {
    Present: 'bg-emerald-100 text-emerald-800',
    Absent: 'bg-rose-100 text-rose-800',
    Pending: 'bg-slate-100 text-slate-700',
  };
  return { label: normalized.toUpperCase(), className: styles[normalized] };
};

const getSmsStatusDisplay = (status) => {
  const presentations = {
    queued: { label: 'QUEUED', className: 'bg-amber-100 text-amber-800' },
    sent: { label: 'ACCEPTED BY PHILSMS', className: 'bg-emerald-100 text-emerald-800' },
    failed: { label: 'FAILED', className: 'bg-rose-100 text-rose-800' },
    no_mobile: { label: 'NO MOBILE', className: 'bg-slate-100 text-slate-700' },
    not_queued: { label: 'NOT QUEUED', className: 'bg-slate-100 text-slate-700' },
    not_applicable: { label: '—', className: 'bg-slate-100 text-slate-500' },
  };
  return presentations[status] || presentations.not_queued;
};

export default function AnnouncementManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDswdStaff = user?.role === 'staff' || user?.role === 'barangay';
  const isBarangayStaff = false; // DSWD Staff has municipal coverage, not locked to single barangay
  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const isMswdoStaff = user?.role === 'mswdo_staff';
  const isSeniorOnlyAdmin = user?.role === 'senior_citizen_admin';
  const isSeniorStaff = user?.role === 'senior_citizen_staff';
  const isSeniorAdmin = isSeniorOnlyAdmin || isSeniorStaff;
  const isPwdOnlyAdmin = user?.role === 'pwd_admin';
  const isPwdStaff = user?.role === 'pwd_staff';
  const isPwdAdmin = isPwdOnlyAdmin || isPwdStaff;
  const isSectorAdmin = isMswdoAdmin || isMswdoStaff || isSeniorAdmin || isPwdAdmin;
  const [announcements, setAnnouncements] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Filters state
  const [filterProgram, setFilterProgram] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewBeneficiaries, setPreviewBeneficiaries] = useState([]);
  const [showPreviewBeneficiaries, setShowPreviewBeneficiaries] = useState(false);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Recipient Stats / Audit Modal
  const [selectedAnnouncementStats, setSelectedAnnouncementStats] = useState(null);

  const activeAllowedCategories = useMemo(() => {
    if (isSeniorAdmin) return ['Senior Citizens (Social Pension)'];
    if (isPwdAdmin) return ['Persons with Disabilities (PWD)'];
    if (isMswdoAdmin || isMswdoStaff) return ['Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)'];
    return TARGET_CATEGORIES;
  }, [isSeniorAdmin, isPwdAdmin, isMswdoAdmin, isMswdoStaff]);

  const availablePresets = useMemo(() => {
    if (isSeniorAdmin) return OFFICIAL_MEETING_PRESETS.filter((p) => p.program === 'Senior' || p.sector.includes('Senior'));
    if (isPwdAdmin) return OFFICIAL_MEETING_PRESETS.filter((p) => p.program === 'PWD' || p.sector.includes('PWD') || p.sector.includes('Disabilit'));
    if (isMswdoAdmin || isMswdoStaff) return OFFICIAL_MEETING_PRESETS.filter((p) => p.program !== '4Ps');
    return OFFICIAL_MEETING_PRESETS;
  }, [isSeniorAdmin, isPwdAdmin, isMswdoAdmin, isMswdoStaff]);

  // Form State
  const [bgySelectionMode, setBgySelectionMode] = useState('single'); // 'single' | 'multiple'
  const [bgySearchFilter, setBgySearchFilter] = useState('');
  const [sitioSelectionMode, setSitioSelectionMode] = useState('all'); // 'all' | 'specific'
  const [availableSitios, setAvailableSitios] = useState([]);
  const [customSitioInput, setCustomSitioInput] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    event_date: '',
    event_time: '08:00',
    end_time: '17:00',
    venue: '',
    priority: 'Medium',
    status: 'published',
    expiration_date: '',
    assigned_staff_id: '',
    target_categories: [...activeAllowedCategories],
    target_programs: [],
    target_barangays: [],
    target_sitios: [],
    notify_mswdo: false,
    notify_senior: false,
    notify_pwd: false,
  });

  // Load programs & barangays for dropdowns/target options
  const fetchMetadata = async () => {
    try {
      const [progRes, bgryRes, userRes] = await Promise.all([
        programApi.list(),
        barangayApi.list(),
        userApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      const loadedPrograms = progRes.data?.data || progRes.data || [];
      const loadedBarangays = bgryRes.data?.data || bgryRes.data || [];
      const loadedUsers = userRes.data?.data || userRes.data || [];
      setPrograms(loadedPrograms);
      setBarangays(loadedBarangays);
      setStaffList(loadedUsers.filter((u) => ['staff', 'barangay', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'].includes(u.role)));

      setFormData((prev) => ({
        ...prev,
        target_categories: (prev.target_categories && prev.target_categories.length > 0) ? prev.target_categories : [...activeAllowedCategories],
        target_programs: loadedPrograms.map((p) => p.id),
        target_barangays: prev.target_barangays || [],
        target_sitios: prev.target_sitios || [],
      }));
    } catch (err) {
      console.error('Failed to load programs/barangays metadata:', err);
    }
  };

  // Load announcements
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterProgram) params.program_id = filterProgram;
      if (filterBarangay) params.barangay_id = filterBarangay;
      if (filterPriority) params.priority = filterPriority;
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;

      const res = await announcementApi.list(params);
      let list = res.data?.data || [];
      if (['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff'].includes(user?.role)) {
        if (isSeniorAdmin) {
          list = list.filter((a) => {
            const isSeniorAuthor = ['senior_citizen_admin', 'senior_citizen_staff'].includes(a.CreatedBy?.role) || a.created_by_user_id === user?.id;
            const isAssigned = a.assigned_staff_id === user?.id;
            const targets = Array.isArray(a.target_programs) ? a.target_programs : [];
            const textMatch = targets.some((t) => String(t).toLowerCase().includes('senior'));
            const titleMatch = (a.title || '').toLowerCase().includes('senior') || (a.title || '').toLowerCase().includes('osca');
            const isNotified = isSeniorOnlyAdmin && (Boolean(a.notify_senior) || textMatch || titleMatch);
            return isSeniorAuthor || isAssigned || isNotified;
          });
        } else if (isPwdAdmin) {
          list = list.filter((a) => {
            const isPwdAuthor = ['pwd_admin', 'pwd_staff'].includes(a.CreatedBy?.role) || a.created_by_user_id === user?.id;
            const isAssigned = a.assigned_staff_id === user?.id;
            const targets = Array.isArray(a.target_programs) ? a.target_programs : [];
            const textMatch = targets.some((t) => String(t).toLowerCase().includes('pwd') || String(t).toLowerCase().includes('disabil'));
            const titleMatch = (a.title || '').toLowerCase().includes('pwd') || (a.title || '').toLowerCase().includes('pdao');
            const isNotified = isPwdOnlyAdmin && (Boolean(a.notify_pwd) || textMatch || titleMatch);
            return isPwdAuthor || isAssigned || isNotified;
          });
        } else {
          list = list.filter((a) => {
            const isAuthor = a.created_by_user_id === user?.id || a.CreatedBy?.id === user?.id;
            const isMswdoAgency = ['mswdo_admin', 'mswdo_staff'].includes(a.CreatedBy?.role);
            const isNotified = isMswdoAdmin && Boolean(a.notify_mswdo);
            const isAssigned = a.assigned_staff_id === user?.id;
            return isAuthor || isMswdoAgency || isNotified || isAssigned;
          });
        }
      }
      setAnnouncements(list);
    } catch (err) {
      setError(err.message || 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterBarangay, filterPriority, filterStatus, searchQuery, user, isSeniorAdmin, isPwdAdmin, isSeniorOnlyAdmin, isPwdOnlyAdmin, isMswdoAdmin]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Live preview counter when target selections change
  const updateTargetPreview = useCallback(async (categories, bIds, sitios) => {
    const activeCats = categories || [];
    const activeBgrais = bIds || [];
    const activeSitios = sitios || [];

    if (activeBgrais.length === 0) {
      setPreviewCount(0);
      setPreviewBeneficiaries([]);
      setAvailableSitios([]);
      return;
    }
    if (activeCats.length === 0) {
      setPreviewCount(0);
      setPreviewBeneficiaries([]);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await announcementApi.previewTargetCount({
        target_categories: JSON.stringify(activeCats),
        target_barangays: JSON.stringify(activeBgrais),
        target_sitios: JSON.stringify(activeSitios),
      });
      setPreviewCount(res.data?.count || 0);
      setPreviewBeneficiaries(Array.isArray(res.data?.beneficiaries) ? res.data.beneficiaries : []);
      if (Array.isArray(res.data?.available_sitios)) {
        setAvailableSitios(res.data.available_sitios);
      }
    } catch (err) {
      console.error('Failed to update target preview count:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      updateTargetPreview(
        formData.target_categories || [],
        formData.target_barangays || [],
        formData.target_sitios || []
      );
    }
  }, [formData.target_categories, formData.target_barangays, formData.target_sitios, isModalOpen, updateTargetPreview]);

  const parseBarangayIds = (input) => {
    if (!input) return [];
    let bIds = [];
    if (typeof input === 'string') {
      try { bIds = JSON.parse(input); } catch (e) { bIds = [input]; }
    } else if (Array.isArray(input)) {
      bIds = input;
    } else {
      bIds = [input];
    }
    if (!Array.isArray(bIds)) bIds = [bIds];
    return bIds.map(Number).filter((id) => !isNaN(id) && id > 0);
  };

  const parseSitios = (input) => {
    if (!input) return [];
    let list = [];
    if (typeof input === 'string') {
      try { list = JSON.parse(input); } catch (e) { list = [input]; }
    } else if (Array.isArray(input)) {
      list = input;
    } else {
      list = [input];
    }
    if (!Array.isArray(list)) list = [list];
    return list.map((s) => String(s || '').trim()).filter((s) => s.length > 0);
  };

  const mapCategoriesToProgramIds = (selectedCategories, allPrograms) => {
    if (!selectedCategories || selectedCategories.length === 0) return [];
    if (selectedCategories.length === TARGET_CATEGORIES.length) return allPrograms.map((p) => p.id);

    return allPrograms
      .filter((p) => {
        const pCat = (p.eligibility_category || p.category || '').toLowerCase();
        return selectedCategories.some((c) => {
          const normC = c.toLowerCase();
          return pCat.includes(normC) || normC.includes(pCat) ||
            (normC.includes('4ps') && pCat.includes('4ps')) ||
            (normC.includes('senior') && pCat.includes('senior')) ||
            (normC.includes('pwd') && pCat.includes('pwd'));
        });
      })
      .map((p) => p.id);
  };

  // Reset form
  const handleOpenCreateModal = () => {
    setEditingAnnouncement(null);
    setBgySelectionMode('single');
    setBgySearchFilter('');
    setSitioSelectionMode('all');
    setAvailableSitios([]);
    setCustomSitioInput('');
    setPreviewBeneficiaries([]);
    setShowPreviewBeneficiaries(false);
    setPreviewSearchQuery('');
    const staffBarangayTarget = isBarangayStaff && user?.barangay_id ? [Number(user.barangay_id)] : [];
    setFormData({
      title: '',
      message: '',
      event_date: new Date().toISOString().split('T')[0],
      event_time: '08:00',
      end_time: '17:00',
      venue: '',
      venue_barangay: '',
      venue_detail: '',
      priority: 'Medium',
      status: isBarangayStaff ? 'pending_approval' : 'published',
      expiration_date: '',
      target_categories: [...activeAllowedCategories],
      target_programs: mapCategoriesToProgramIds(activeAllowedCategories, programs),
      target_barangays: staffBarangayTarget,
      target_sitios: [],
      notify_mswdo: false,
      notify_senior: false,
      notify_pwd: false,
      assigned_staff_id: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ann) => {
    setEditingAnnouncement(ann);
    setShowPreviewBeneficiaries(false);
    setPreviewSearchQuery('');
    const existingVenue = ann.venue || '';
    let foundBarangay = '';
    let foundDetail = existingVenue;

    // Check if existing venue matches any barangay name
    const matchedB = barangays.find((b) => existingVenue.toLowerCase().includes(b.barangay_name.toLowerCase()));
    if (matchedB) {
      foundBarangay = matchedB.barangay_name;
      foundDetail = existingVenue
        .replace(new RegExp(`^Barangay\\s+${matchedB.barangay_name}\\s*-?\\s*`, 'i'), '')
        .replace(new RegExp(`${matchedB.barangay_name}`, 'i'), '')
        .trim();
    }

    const annPrograms = Array.isArray(ann.target_programs) ? ann.target_programs : [];
    const matchedCategories = activeAllowedCategories.filter((cat) => {
      const catProgIds = mapCategoriesToProgramIds([cat], programs);
      return catProgIds.some((id) => annPrograms.includes(id));
    });

    const parsedTargetBarangays = isBarangayStaff && user?.barangay_id
      ? [Number(user.barangay_id)]
      : parseBarangayIds(ann.target_barangays);
    const parsedTargetSitios = parseSitios(ann.target_sitios);
    setBgySelectionMode(parsedTargetBarangays.length === 1 ? 'single' : 'multiple');
    setBgySearchFilter('');
    setSitioSelectionMode(parsedTargetSitios.length > 0 ? 'specific' : 'all');
    setCustomSitioInput('');

    setFormData({
      title: ann.title || '',
      message: ann.message || '',
      event_date: ann.event_date || '',
      event_time: ann.event_time || '',
      end_time: ann.end_time || '',
      venue: existingVenue,
      venue_barangay: foundBarangay,
      venue_detail: foundDetail,
      priority: ann.priority || 'Medium',
      status: isBarangayStaff
        ? (ann.status === 'draft' ? 'draft' : 'pending_approval')
        : (ann.status || 'published'),
      expiration_date: ann.expiration_date || '',
      target_categories: matchedCategories.length > 0 ? matchedCategories : [...activeAllowedCategories],
      target_programs: annPrograms.length > 0 ? annPrograms : programs.map((p) => p.id),
      target_barangays: parsedTargetBarangays,
      target_sitios: parsedTargetSitios,
      notify_mswdo: !!ann.notify_mswdo,
      notify_senior: !!ann.notify_senior,
      notify_pwd: !!ann.notify_pwd,
      assigned_staff_id: ann.assigned_staff_id || '',
    });
    setIsModalOpen(true);
  };

  // Toggle Category Selection
  const toggleCategoryTarget = (catName) => {
    setFormData((prev) => {
      const currentCats = prev.target_categories || [...activeAllowedCategories];
      const exists = currentCats.includes(catName);
      const updatedCats = exists
        ? currentCats.filter((c) => c !== catName)
        : [...currentCats, catName];

      const matchingPrograms = mapCategoriesToProgramIds(updatedCats, programs);

      return {
        ...prev,
        target_categories: updatedCats,
        target_programs: matchingPrograms,
      };
    });
  };

  const toggleAllCategories = () => {
    setFormData((prev) => {
      const currentCats = prev.target_categories || [...activeAllowedCategories];
      const allSelected = currentCats.length === activeAllowedCategories.length;
      const updatedCats = allSelected ? [] : [...activeAllowedCategories];
      const matchingPrograms = allSelected ? [] : mapCategoriesToProgramIds(activeAllowedCategories, programs);

      return {
        ...prev,
        target_categories: updatedCats,
        target_programs: matchingPrograms,
      };
    });
  };

  // Toggle Barangay Selection
  const toggleBarangayTarget = (bId) => {
    if (isBarangayStaff) return;
    const numId = Number(bId);
    setFormData((prev) => {
      const currentBarangays = parseBarangayIds(prev.target_barangays);
      const exists = currentBarangays.includes(numId);
      const updated = exists
        ? currentBarangays.filter((id) => id !== numId)
        : [...currentBarangays, numId];
      return { ...prev, target_barangays: updated };
    });
  };

  const toggleAllBarangays = () => {
    if (isBarangayStaff) return;
    setFormData((prev) => {
      const currentBarangays = parseBarangayIds(prev.target_barangays);
      const allSelected = currentBarangays.length === barangays.length;
      return {
        ...prev,
        target_barangays: allSelected ? [] : barangays.map((b) => Number(b.id)),
        target_sitios: [],
      };
    });
    setSitioSelectionMode('all');
  };

  const toggleSitioTarget = (sitioName) => {
    const trimmed = String(sitioName || '').trim();
    if (!trimmed) return;
    setSitioSelectionMode('specific');
    setFormData((prev) => {
      const current = parseSitios(prev.target_sitios);
      const exists = current.some((s) => s.toLowerCase() === trimmed.toLowerCase());
      const updated = exists
        ? current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())
        : [...current, trimmed];
      return { ...prev, target_sitios: updated };
    });
  };

  const handleAddCustomSitio = () => {
    const trimmed = String(customSitioInput || '').trim();
    if (!trimmed) return;
    setSitioSelectionMode('specific');
    setFormData((prev) => {
      const current = parseSitios(prev.target_sitios);
      if (current.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return { ...prev, target_sitios: [...current, trimmed] };
    });
    setCustomSitioInput('');
  };

  // Submit announcement
  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawCats = formData.target_categories || [];
    const activeCats = isSeniorAdmin
      ? ['Senior Citizens (Social Pension)']
      : isPwdAdmin
      ? ['Persons with Disabilities (PWD)']
      : rawCats;
    if (activeCats.length === 0) {
      alert('Please select at least one target category');
      return;
    }
    const effectiveBarangays = isBarangayStaff && user?.barangay_id
      ? [Number(user.barangay_id)]
      : formData.target_barangays;
    if (effectiveBarangays.length === 0) {
      alert('Please select at least one target barangay');
      return;
    }
    const activeSitios = sitioSelectionMode === 'specific' ? parseSitios(formData.target_sitios) : [];
    if (sitioSelectionMode === 'specific' && activeSitios.length === 0) {
      alert('Pumili o maglagay ng kahit isang Sitio, o piliin ang "Lahat ng Sitio".');
      return;
    }

    const targetsSenior = activeCats.some((c) => String(c).toLowerCase().includes('senior'));
    const targetsPwd = activeCats.some((c) => String(c).toLowerCase().includes('pwd') || String(c).toLowerCase().includes('disabil'));

    const payload = {
      ...formData,
      notify_senior: formData.notify_senior || targetsSenior,
      notify_pwd: formData.notify_pwd || targetsPwd,
      status: isBarangayStaff
        ? (formData.status === 'draft' ? 'draft' : 'pending_approval')
        : formData.status,
      target_categories: activeCats,
      target_programs: activeCats,
      target_barangays: effectiveBarangays,
      target_sitios: activeSitios,
    };

    setModalLoading(true);
    try {
      if (editingAnnouncement) {
        await announcementApi.update(editingAnnouncement.id, payload);
        setSuccessMessage(
          isBarangayStaff
            ? 'Announcement updated and submitted for DSWD Admin approval!'
            : 'Announcement updated successfully!'
        );
      } else {
        await announcementApi.create(payload);
        setSuccessMessage(
          isBarangayStaff
            ? 'Announcement submitted! Naghihintay na ito ng Approval mula sa DSWD Admin bago ma-publish at ma-text sa mga benepisyaryo.'
            : (payload.status === 'published'
                ? 'Announcement published. SMS messages are queued for PhilSMS dispatch.'
                : 'Announcement draft saved. SMS messages will be queued when it is published.')
        );
      }
      setIsModalOpen(false);
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      alert(err.message || 'Error saving announcement');
    } finally {
      setModalLoading(false);
    }
  };

  // Approve Staff Announcement (DSWD Admin)
  const handleApprove = async (ann) => {
    if (!window.confirm(`Aprubahan at i-publish ang announcement na "${ann.title}"? Agad na ipapadala ang SMS at Notification sa mga benepisyaryo.`)) {
      return;
    }
    try {
      const res = await announcementApi.approve(ann.id);
      setSuccessMessage(res.data?.message || 'Announcement approved and published successfully!');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      alert(err.message || 'Failed to approve announcement');
    }
  };

  // Reject Staff Announcement (DSWD Admin)
  const handleReject = async (ann) => {
    const reason = window.prompt(`Ilagay ang dahilan kung bakit hindi na-approve ang "${ann.title}" (Opsyonal):`, '');
    if (reason === null) return; // Cancelled prompt
    try {
      const res = await announcementApi.reject(ann.id, { reason });
      setSuccessMessage(res.data?.message || 'Announcement rejected and Staff notified.');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      alert(err.message || 'Failed to reject announcement');
    }
  };

  // Resend Announcement
  const handleResend = async (annId) => {
    if (!window.confirm('Are you sure you want to resend notifications for this announcement?')) return;
    try {
      const res = await announcementApi.resend(annId);
      setSuccessMessage(res.data?.message || 'Announcement notifications resent successfully!');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to resend announcement');
    }
  };

  // Delete Announcement
  const handleDelete = async (annId) => {
    if (!window.confirm('Are you sure you want to delete this announcement permanently? This action cannot be undone.')) return;
    try {
      await announcementApi.remove(annId);
      setSuccessMessage('Announcement deleted successfully');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to delete announcement');
    }
  };

  // Archive Announcement
  const handleArchive = async (annId) => {
    if (!window.confirm('Are you sure you want to archive this announcement? It will be moved to the Archived Announcements section.')) return;
    try {
      await announcementApi.update(annId, { status: 'archived' });
      setSuccessMessage('Announcement archived successfully');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to archive announcement');
    }
  };

  // Unarchive / Restore Announcement
  const handleUnarchive = async (annId) => {
    try {
      await announcementApi.update(annId, { status: 'published' });
      setSuccessMessage('Announcement restored to Published status successfully');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to restore announcement');
    }
  };

  // Check if announcement is currently active (published and end time not passed)
  const isAnnouncementActive = (ann) => {
    if (ann.status === 'completed' || ann.status === 'archived') return false;
    const present = ann.present_count || 0;
    const total = ann.recipient_count || (ann.Recipients ? ann.Recipients.length : 0);
    if (total > 0 && present >= total) return false;
    if (ann.status !== 'published') return false;
    if (!ann.event_date) return true;

    const endTime = getAnnouncementEndDateTime(ann);
    return !endTime || new Date() < endTime;
  };

  // View Recipient Stats Modal
  const handleViewStats = async (annId) => {
    try {
      const res = await announcementApi.get(annId);
      setSelectedAnnouncementStats(res.data?.data || null);
    } catch (err) {
      alert(err.message || 'Failed to load announcement recipient stats');
    }
  };

  // Complete Activity and Notify Absent Beneficiaries
  const handleCompleteActivity = async (ann) => {
    if (!window.confirm(`Complete "${ann.title}" and notify all absent beneficiaries? This will mark all pending beneficiaries as absent and send them notifications.`)) {
      return;
    }
    try {
      const res = await announcementApi.completeActivity(ann.id);
      setSuccessMessage(res.data?.message || 'Activity completed and absent beneficiaries notified!');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to complete activity');
    }
  };

  // Export Attendance Report
  const handleExportReport = async (ann) => {
    try {
      const res = await announcementApi.exportAttendanceReport(ann.id);
      const data = res.data;

      // Construct CSV content
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += `BeniAid ATTENDANCE REPORT\n`;
      csvContent += `Activity Title: "${data.event.title}"\n`;
      csvContent += `Announcement Status: ${data.event.status || 'N/A'}\n`;
      csvContent += `Date: ${data.event.event_date || 'N/A'}, Venue: ${data.event.venue || 'N/A'}\n`;
      csvContent += `Total Expected: ${data.summary.total_recipients}, Present: ${data.summary.total_present}, Absent: ${data.summary.total_absent}, Pending: ${data.summary.total_pending || 0}\n\n`;

      csvContent += `No.,Beneficiary ID Code,Beneficiary Name,Barangay,RFID Number,Contact,Attendance Status,Announcement SMS Status,Absence SMS Status,Scan Timestamp,Facilitated By\n`;

      data.report.forEach((row) => {
        csvContent += `${row.row_number},"${row.beneficiary_id_code}","${row.beneficiary_name}","${row.barangay}","${row.rfid_number}","${row.contact_number}","${row.attendance_status}","${row.sms_status}","${row.absence_sms_status}","${row.scanned_at}","${row.facilitated_by}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Attendance_Report_${ann.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage('Attendance report exported successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to export attendance report');
    }
  };

  // Helper getters
  const getProgramNames = (pIds) => {
    if (!Array.isArray(pIds) || pIds.length === 0) return 'None';
    if (pIds.length === programs.length) return 'All Programs';
    return programs
      .filter((p) => pIds.includes(p.id))
      .map((p) => p.code || p.name)
      .join(', ');
  };

  const getBarangayNames = (bIdsInput) => {
    const bIds = parseBarangayIds(bIdsInput);
    if (bIds.length === 0) return 'None';
    if (bIds.length === barangays.length) return 'All Barangays';
    return barangays
      .filter((b) => bIds.includes(Number(b.id)))
      .map((b) => b.barangay_name)
      .join(', ');
  };

  const totalRecipients = announcements.reduce((sum, a) => sum + (a.recipient_count || 0), 0);
  const totalPresent = announcements.reduce((sum, a) => sum + (a.present_count || 0), 0);
  const avgAttendanceRate = totalRecipients > 0 ? Math.round((totalPresent / totalRecipients) * 100) : 0;
  const [pageSize, setPageSize] = useState(10);
  const visibleAnnouncements = announcements.filter((a) => (
    filterStatus === 'archived' ? a.status === 'archived' : a.status !== 'archived'
  ));
  const announcementPagination = usePagination(visibleAnnouncements, pageSize);
  const archivedAnnouncements = announcements.filter((a) => a.status === 'archived');
  const archivedPagination = usePagination(archivedAnnouncements, pageSize);
  const recipientPagination = usePagination(selectedAnnouncementStats?.Recipients || [], 10);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              Community Broadcast
            </span>
            <span className="text-xs text-slate-400">• Bongabong, Oriental Mindoro</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Announcements & Attendance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create targeted municipal announcements, notify staff, and monitor RFID attendance in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowArchivedModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs active:scale-95"
          >
            <Archive className="w-3.5 h-3.5 text-slate-500" />
            <span>Archived ({announcements.filter((a) => a.status === 'archived').length})</span>
          </button>

          {['admin', 'mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff', 'senior_citizen_staff', 'pwd_staff', 'staff', 'barangay'].includes(user?.role) && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBarangayStaff ? 'Create Barangay Announcement' : 'New Announcement'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Pending Approval Banner for DSWD Admin or Staff */}
      {announcements.some((a) => a.status === 'pending_approval') && (
        <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-extrabold text-xs uppercase tracking-wide text-amber-900">
                {user?.role === 'admin'
                  ? `⏳ May ${announcements.filter((a) => a.status === 'pending_approval').length} na Staff Announcement na Naghihintay ng Iyong Approval`
                  : `⏳ May ${announcements.filter((a) => a.status === 'pending_approval').length} na Announcement na Naghihintay ng Approval ng DSWD Admin`}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {user?.role === 'admin'
                  ? 'I-click ang "Approve" button sa listahan sa ibaba upang ma-publish ang anunsyo at maipadala ang SMS sa mga benepisyaryo.'
                  : 'Ma-papublish at ma-tetext ito sa mga benepisyaryo ng iyong barangay sa oras na ma-approve ng DSWD Admin.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'pending_approval' ? '' : 'pending_approval')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shrink-0 self-start sm:self-auto"
          >
            {filterStatus === 'pending_approval' ? 'Ipakita Lahat' : 'Tingnan ang Pending'}
          </button>
        </div>
      )}

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold text-xs">{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Events</span>
            <BellRing className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{announcements.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total created announcements</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Recipients</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600">{totalRecipients}</p>
          <p className="text-xs text-slate-400 mt-1">Notified beneficiaries</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Attendees</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{totalPresent}</p>
          <p className="text-xs text-slate-400 mt-1">Scanned via RFID reader</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Rate</span>
            <BarChart2 className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600">{avgAttendanceRate}%</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${avgAttendanceRate}%` }} />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Filter className="w-4 h-4 text-dswd-blue" />
          <span>Filter & Search Activities</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, message, venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Programs</option>
              {programs
                .filter((p) => {
                  const cat = (p.eligibility_category || p.category || p.name || '').toLowerCase();
                  if (isSeniorAdmin) return cat.includes('senior');
                  if (isPwdAdmin) return cat.includes('pwd') || cat.includes('disabil');
                  if (isMswdoAdmin || isMswdoStaff) return !cat.includes('4ps');
                  return true;
                })
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code || p.eligibility_category})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <select
              value={filterBarangay}
              onChange={(e) => setFilterBarangay(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Barangays</option>
              {barangays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.barangay_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
              <option value="Urgent">Urgent Priority</option>
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="pending_approval">Pending DSWD Approval</option>
              <option value="published">Published</option>
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Announcements & Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-dswd-blue" />
            <p className="font-semibold text-sm">Loading announcements & attendance records...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold text-sm">{error}</p>
          </div>
        ) : visibleAnnouncements.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700">No Announcements Found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filter parameters or create a new announcement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-5">Activity Title & Content</th>
                  <th className="py-3.5 px-4">Target Audience</th>
                  <th className="py-3.5 px-4">Schedule & Venue</th>
                  <th className="py-3.5 px-4">Priority & Status</th>
                  <th className="py-3.5 px-4">RFID Attendance Progress</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {announcementPagination.paginatedData.map((ann) => {
                  const presentCount = ann.present_count || 0;
                  const totalExpected = ann.recipient_count || 0;
                  const attPercentage = totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0;
                  return (
                    <tr key={ann.id} className="hover:bg-slate-50/80 transition">
                      {/* Title & Description */}
                      <td className="py-4 px-5 max-w-sm">
                        <div className="space-y-1">
                          <p className="font-extrabold text-slate-900 leading-snug">{ann.title}</p>
                          <p className="text-xs text-slate-600 line-clamp-2">{ann.message}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 flex-wrap">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>
                              Created by: <strong className="text-slate-600">{ann.CreatedBy?.first_name || 'Admin'} {ann.CreatedBy?.last_name || ''}</strong>
                            </span>
                            {ann.CreatedBy?.role === 'admin' && (
                              <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                DSWD
                              </span>
                            )}
                            {['mswdo_admin', 'senior_citizen_admin', 'pwd_admin'].includes(ann.CreatedBy?.role) && (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                MSWDO
                              </span>
                            )}
                            {(ann.CreatedBy?.role === 'staff' || ann.CreatedBy?.role === 'barangay') && (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                                DSWD Staff
                              </span>
                            )}
                            {ann.AssignedStaff && (
                              <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                📋 Staff: {ann.AssignedStaff.first_name} {ann.AssignedStaff.last_name} ({ann.AssignedStaff.role === 'mswdo_staff' ? 'MSWDO Staff' : 'DSWD Staff'})
                              </span>
                            )}
                            <span>•</span>
                            <span>{new Date(ann.created_at || ann.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </td>

                      {/* Target Audience */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-xs">
                          <div>
                            <span className="font-semibold text-slate-400 block text-[10px] uppercase">Programs:</span>
                            <span className="inline-block bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                              {getProgramNames(ann.target_programs)}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400 block text-[10px] uppercase">Barangays:</span>
                            <span className="inline-block bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                              {getBarangayNames(ann.target_barangays)}
                            </span>
                          </div>
                          {parseSitios(ann.target_sitios).length > 0 && (
                            <div>
                              <span className="font-semibold text-slate-400 block text-[10px] uppercase">Target Sitio:</span>
                              <span className="inline-block bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded-md border border-amber-300">
                                📍 {parseSitios(ann.target_sitios).join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="pt-0.5 flex flex-wrap gap-1">
                            {ann.notify_mswdo && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                <BellRing className="w-2.5 h-2.5 text-indigo-600" />
                                <span>+ MSWDO</span>
                              </span>
                            )}
                            {ann.notify_senior && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                <BellRing className="w-2.5 h-2.5 text-blue-600" />
                                <span>+ OSCA / Senior</span>
                              </span>
                            )}
                            {ann.notify_pwd && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                <BellRing className="w-2.5 h-2.5 text-amber-600" />
                                <span>+ PDAO / PWD</span>
                              </span>
                            )}
                            {!ann.notify_mswdo && !ann.notify_senior && !ann.notify_pwd && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                Direct Only (Barangay & Beneficiary)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Schedule & Venue */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-xs">
                          {ann.event_date ? (
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                {ann.event_date}{' '}
                                {ann.event_time &&
                                  `at ${ann.event_time}${ann.end_time ? ` - ${ann.end_time}` : ''}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No event date</span>
                          )}
                          {ann.venue ? (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span className="line-clamp-1">{ann.venue}</span>
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Priority & Status */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div>
                            {ann.priority === 'Urgent' ? (
                              <span className="bg-red-100 text-red-800 font-black px-2 py-0.5 rounded-md text-xs border border-red-300">
                                🔴 URGENT
                              </span>
                            ) : ann.priority === 'High' ? (
                              <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-md text-xs border border-orange-200">
                                🟠 HIGH
                              </span>
                            ) : ann.priority === 'Medium' ? (
                              <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md text-xs border border-blue-200">
                                🔵 MEDIUM
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-xs">
                                ⚪ LOW
                              </span>
                            )}
                          </div>

                          <div>
                            {ann.status === 'completed' || (totalExpected > 0 && presentCount >= totalExpected) ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-purple-600" /> Completed
                              </span>
                            ) : ann.status === 'published' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Published
                              </span>
                            ) : ann.status === 'pending_approval' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Approval
                              </span>
                            ) : ann.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                                <X className="w-3 h-3" /> Rejected
                              </span>
                            ) : ann.status === 'scheduled' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Scheduled
                              </span>
                            ) : ann.status === 'draft' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                                Draft
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                Archived
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* RFID Attendance Progress */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5 w-40">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-700">{presentCount} / {totalExpected} Present</span>
                            <span className="text-emerald-600 font-black">{attPercentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${attPercentage}%` }}
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            {isAnnouncementActive(ann) && (user?.role === 'staff' || user?.role === 'barangay') && (
                              <button
                                onClick={() => navigate(`/dashboard/announcement-scanner?id=${ann.id}`)}
                                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm transition"
                              >
                                <Smartphone className="w-3 h-3 text-amber-600" /> Start Scanner
                              </button>
                            )}
                            <button
                              onClick={() => handleViewStats(ann.id)}
                              className="text-[11px] font-bold text-dswd-blue hover:underline"
                            >
                              View Stats
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {user?.role === 'admin' && ann.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApprove(ann)}
                                title="Approve & Publish Announcement"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-xs transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleReject(ann)}
                                title="Reject Announcement"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleExportReport(ann)}
                            title="Export Attendance Report (CSV/Excel)"
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {ann.status === 'published' && (
                            ann.created_by_user_id === user?.id ||
                            (user?.role === 'admin' && !['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'].includes(ann.CreatedBy?.role)) ||
                            (['mswdo_admin', 'senior_citizen_admin', 'pwd_admin'].includes(user?.role) && ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'].includes(ann.CreatedBy?.role))
                          ) && (
                            <button
                              onClick={() => handleResend(ann.id)}
                              title="Resend notifications"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {(ann.created_by_user_id === user?.id ||
                            (user?.role === 'admin' && !['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'].includes(ann.CreatedBy?.role)) ||
                            (['mswdo_admin', 'senior_citizen_admin', 'pwd_admin'].includes(user?.role) && ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'].includes(ann.CreatedBy?.role)) ||
                            (isBarangayStaff &&
                              Number(ann.created_by_user_id) === Number(user?.id) &&
                              ['pending_approval', 'rejected', 'draft'].includes(ann.status))) && (
                            <button
                              onClick={() => handleOpenEditModal(ann)}
                              title="Edit announcement"
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {(ann.created_by_user_id === user?.id ||
                            (user?.role === 'admin' && !['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'].includes(ann.CreatedBy?.role)) ||
                            (['mswdo_admin', 'senior_citizen_admin', 'pwd_admin'].includes(user?.role) && ['mswdo_admin', 'senior_citizen_admin', 'pwd_admin', 'mswdo_staff'].includes(ann.CreatedBy?.role))) && (
                            <button
                              onClick={() => handleArchive(ann.id)}
                              title="Archive announcement"
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-200 px-5 py-3.5 bg-slate-50/50">
              <Pagination
                currentPage={announcementPagination.currentPage}
                totalPages={announcementPagination.totalPages}
                onPageChange={announcementPagination.goToPage}
                totalItems={announcementPagination.totalItems}
                itemsPerPage={pageSize}
                onItemsPerPageChange={(newSize) => {
                  setPageSize(newSize);
                  announcementPagination.goToPage(1);
                }}
                startIndex={announcementPagination.startIndex}
                endIndex={announcementPagination.endIndex}
                alwaysShow={true}
                itemLabel="anunsyo"
              />
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT ANNOUNCEMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-4 transform transition-all border border-slate-200">
            <div className="bg-gradient-to-r from-dswd-blue to-indigo-900 px-5 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-6 h-6 text-yellow-400" />
                <h3 className="font-black text-xl">
                  {editingAnnouncement ? 'Edit Announcement' : 'Create Targeted Announcement'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto max-h-[80vh]">
              {/* Quick Fill from DSWD / MSWDO Meeting Presets */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-2 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-dswd-blue uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>
                      {isSeniorAdmin
                        ? 'Pumili sa OSCA Official Meeting Templates:'
                        : isPwdAdmin
                        ? 'Pumili sa PDAO Official Meeting Templates:'
                        : isMswdoAdmin || isMswdoStaff
                        ? 'Pumili sa MSWDO Official Meeting Templates:'
                        : 'Pumili sa DSWD / MSWDO Official Meeting Templates:'}
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Auto-fill details & target audience
                  </span>
                </div>
                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) return;
                    const preset = availablePresets.find((p) => p.id === selectedId);
                    if (preset) {
                      setFormData((prev) => {
                        const autoPriority = prev.event_date ? calculatePriorityFromDate(prev.event_date) : preset.priority;
                        const targetsSenior = (preset.target_categories || []).some((c) => String(c).toLowerCase().includes('senior'));
                        const targetsPwd = (preset.target_categories || []).some((c) => String(c).toLowerCase().includes('pwd') || String(c).toLowerCase().includes('disabil'));
                        return {
                          ...prev,
                          title: preset.title,
                          message: preset.message,
                          venue: preset.venue,
                          priority: autoPriority || preset.priority,
                          event_time: preset.event_time,
                          end_time: preset.end_time,
                          target_categories: preset.target_categories,
                          target_programs: mapCategoriesToProgramIds(preset.target_categories, programs),
                          notify_senior: targetsSenior ? true : prev.notify_senior,
                          notify_pwd: targetsPwd ? true : prev.notify_pwd,
                          target_barangays: isBarangayStaff && user?.barangay_id
                            ? [Number(user.barangay_id)]
                            : (prev.target_barangays.length > 0 ? prev.target_barangays : barangays.map((b) => b.id)),
                        };
                      });
                    }
                  }}
                  defaultValue=""
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer hover:border-blue-400 transition"
                >
                  <option value="">-- Pumili ng Opisyal na Meeting Template (Quick Fill) --</option>
                  {['4Ps Household Beneficiaries', 'Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)'].map((sec) => {
                    const presetsInSec = availablePresets.filter((p) => p.sector === sec);
                    if (presetsInSec.length === 0) return null;
                    const groupLabel = sec.includes('4Ps')
                      ? '🔵 DSWD 4Ps Meetings'
                      : sec.includes('Senior')
                      ? (isSeniorAdmin ? '👵 OSCA Senior Citizens Meetings' : '👵 OSCA / MSWDO Senior Citizens Meetings')
                      : (isPwdAdmin ? '♿ PDAO PWD Assemblies & Meetings' : '♿ PDAO / MSWDO PWD Assemblies & Meetings');
                    return (
                      <optgroup key={sec} label={groupLabel}>
                        {presetsInSec.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Announcement Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 4Ps Family Development Session"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Event Date</label>
                    <input
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const autoPriority = calculatePriorityFromDate(newDate);
                        setFormData({
                          ...formData,
                          event_date: newDate,
                          priority: autoPriority,
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formData.event_time}
                      onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">End Time</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Announcement Description & Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Write the full announcement details and instructions here..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* VENUE SECTION */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-700 uppercase">Venue / Location</label>
                <input
                  type="text"
                  placeholder="e.g., Covered Court, Barangay Hall, MSWD Office"
                  value={formData.venue || ''}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                />
              </div>

              {/* ASSIGNED STAFF SECTION */}
              <div className="space-y-1">
                <label className="block text-xs font-black text-slate-700 uppercase">
                  Assign Staff to Assist Attendance (Optional)
                </label>
                <select
                  value={formData.assigned_staff_id || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="">-- Walang Naka-assign (Pumili ng Staff) --</option>
                  {staffList
                    .filter((s) => {
                      if (isSeniorAdmin) {
                        return s.role === 'senior_citizen_staff';
                      }
                      if (isPwdAdmin) {
                        return s.role === 'pwd_staff';
                      }
                      if (isMswdoAdmin || isMswdoStaff) {
                        return s.role === 'mswdo_staff';
                      }
                      return s.role === 'staff' || s.role === 'barangay';
                    })
                    .map((s) => {
                      const roleLabel =
                        s.role === 'senior_citizen_staff' ? 'Senior Staff' :
                        s.role === 'pwd_staff' ? 'PWD Staff' :
                        s.role === 'mswdo_staff' ? 'MSWDO Staff' :
                        ['staff', 'barangay'].includes(s.role) ? 'DSWD Staff' :
                        (s.email || 'Staff');
                      return (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name} ({roleLabel})
                        </option>
                      );
                    })}
                </select>
                {(() => {
                  const filteredCount = staffList.filter((s) => {
                    if (isSeniorAdmin) return s.role === 'senior_citizen_staff';
                    if (isPwdAdmin) return s.role === 'pwd_staff';
                    if (isMswdoAdmin || isMswdoStaff) return s.role === 'mswdo_staff';
                    return s.role === 'staff' || s.role === 'barangay';
                  }).length;

                  if (filteredCount === 0) {
                    return (
                      <p className="text-[11px] text-amber-600 font-semibold mt-1">
                        {isSeniorAdmin
                          ? 'Walang nahanap na Senior Citizen Staff. Mangyaring gumawa muna ng Senior Staff account sa Users page.'
                          : isPwdAdmin
                          ? 'Walang nahanap na PWD Staff. Mangyaring gumawa muna ng PWD Staff account sa Users page.'
                          : 'Walang nahanap na MSWDO Staff. Mangyaring gumawa muna ng MSWDO Staff account sa Users page.'}
                      </p>
                    );
                  }

                  return (
                    <p className="text-[11px] text-slate-500">
                      {isSeniorAdmin
                        ? 'Piliin ang Senior Citizen Staff na mamamahala sa pag-scan ng RFID attendance para sa aktibidad na ito.'
                        : isPwdAdmin
                        ? 'Piliin ang PWD Staff na mamamahala sa pag-scan ng RFID attendance para sa aktibidad na ito.'
                        : (isMswdoAdmin || isMswdoStaff)
                        ? 'Piliin ang MSWDO Staff na mamamahala sa pag-scan ng RFID attendance para sa aktibidad na ito.'
                        : 'Piliin ang Staff na mag-aasikaso ng RFID attendance.'}
                    </p>
                  );
                })()}
              </div>

              {/* TARGET AUDIENCE SELECTION SECTION */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewBeneficiaries((prev) => !prev)}
                    className={`w-full flex items-center justify-between border rounded-xl p-3 text-left transition cursor-pointer select-none ${
                      showPreviewBeneficiaries
                        ? 'bg-blue-100/90 border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-blue-50/70 hover:bg-blue-100/60 border-blue-200 hover:border-blue-300'
                    }`}
                    title="I-click upang makita ang mga benepisyaryo na makakatanggap ng announcement"
                  >
                    <div className="flex items-center gap-2.5 text-blue-950 font-bold text-xs">
                      <Users className="w-4 h-4 text-dswd-blue shrink-0" />
                      <div>
                        <span className="block text-xs font-extrabold text-blue-950">Target Audience Selection</span>
                        <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1 mt-0.5">
                          <Eye className="w-3 h-3" />
                          <span>
                            {showPreviewBeneficiaries
                              ? 'Itago ang listahan ng mga makakatanggap'
                              : 'I-click dito upang makita ang mga benepisyaryong makakatanggap'}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <span className="text-[11px] text-blue-800 font-medium block">Matching Beneficiaries:</span>
                        <span className="text-base font-black text-dswd-blue underline decoration-dotted underline-offset-2">
                          {previewLoading ? 'Calculating...' : `${previewCount} Beneficiaries`}
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white/80 border border-blue-200 flex items-center justify-center text-dswd-blue shrink-0">
                        {showPreviewBeneficiaries ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Collapsible Matching Beneficiaries List */}
                  {showPreviewBeneficiaries && (
                    <div className="bg-white border-2 border-blue-200 rounded-xl p-3 space-y-2.5 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-dswd-blue" />
                            <span>Mga Benepisyaryong Makakatanggap ({previewBeneficiaries.length})</span>
                          </h5>
                          <p className="text-[11px] text-slate-500">
                            Sila ang makakatanggap ng SMS at In-App Notification kapag na-publish ang anunsyo.
                          </p>
                        </div>
                        {previewBeneficiaries.length > 3 && (
                          <div className="relative w-full sm:w-52">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={previewSearchQuery}
                              onChange={(e) => setPreviewSearchQuery(e.target.value)}
                              placeholder="Hanapin ang pangalan / sitio..."
                              className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      {previewLoading ? (
                        <div className="py-6 text-center text-xs font-semibold text-slate-500">
                          Kinakalkula ang mga tugmang benepisyaryo...
                        </div>
                      ) : previewBeneficiaries.length === 0 ? (
                        <div className="py-5 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          {formData.target_barangays.length === 0
                            ? 'Pumili muna ng Target Barangay sa ibaba upang makita ang mga benepisyaryo.'
                            : 'Walang tugmang Approved na benepisyaryo para sa napiling Category, Barangay, at Sitio.'}
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                          {previewBeneficiaries
                            .filter((b) => {
                              if (!previewSearchQuery.trim()) return true;
                              const q = previewSearchQuery.toLowerCase();
                              return (
                                (b.full_name || '').toLowerCase().includes(q) ||
                                (b.beneficiary_id_code || '').toLowerCase().includes(q) ||
                                (b.sitio || '').toLowerCase().includes(q) ||
                                (b.barangay_name || '').toLowerCase().includes(q) ||
                                (b.category || '').toLowerCase().includes(q)
                              );
                            })
                            .map((b, idx) => (
                              <div
                                key={b.id || idx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2 hover:bg-blue-50/40 transition text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-slate-900">
                                      {idx + 1}. {b.full_name || `${b.first_name} ${b.last_name}`}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                      {b.beneficiary_id_code}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                      Brgy. {b.barangay_name}
                                    </span>
                                    {b.sitio ? (
                                      <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded">
                                        📍 Sitio: {b.sitio}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">Walang naka-set na Sitio</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex sm:flex-col items-start sm:items-end justify-between gap-1 shrink-0">
                                  <span className="inline-block bg-blue-50 text-blue-800 font-bold text-[10px] px-2 py-0.5 rounded border border-blue-200">
                                    {b.category}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                    <Smartphone className="w-3 h-3 text-slate-400" />
                                    {b.contact_number || 'No mobile'}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Target Categories */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-slate-700">
                        Target Categories <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllCategories}
                        className="text-xs font-bold text-dswd-blue hover:underline"
                      >
                        {(formData.target_categories || activeAllowedCategories).length === activeAllowedCategories.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {activeAllowedCategories.map((cat) => {
                        const selected = (formData.target_categories || activeAllowedCategories).includes(cat);
                        return (
                          <div
                            key={cat}
                            onClick={() => toggleCategoryTarget(cat)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition text-xs font-bold ${selected
                              ? 'bg-blue-100/80 text-blue-950 border-2 border-blue-400 shadow-sm'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                          >
                            {selected ? (
                              <CheckSquare className="w-4 h-4 text-dswd-blue shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                            <span className="truncate">{cat}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Target Barangays Selection */}
                  <div className="border border-slate-200 rounded-xl p-3 space-y-2.5 bg-slate-50/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Target Barangay <span className="text-red-500">*</span></span>
                      </label>
                      {isBarangayStaff ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                          🔒 Sariling Barangay Lamang
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setBgySelectionMode('single');
                              if (formData.target_barangays.length > 1) {
                                setFormData(prev => ({ ...prev, target_barangays: [prev.target_barangays[0]] }));
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md transition ${
                              bgySelectionMode === 'single'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Isang Barangay
                          </button>
                          <button
                            type="button"
                            onClick={() => setBgySelectionMode('multiple')}
                            className={`px-2 py-0.5 rounded-md transition ${
                              bgySelectionMode === 'multiple'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Maramihan / Lahat
                          </button>
                        </div>
                      )}
                    </div>

                    {isBarangayStaff ? (
                      <div className="w-full px-3 py-2.5 bg-emerald-50 border-2 border-emerald-400 rounded-xl font-extrabold text-sm text-emerald-950 flex items-center justify-between shadow-2xs">
                        <span>
                          Barangay {barangays.find((b) => Number(b.id) === Number(user?.barangay_id))?.barangay_name || user?.barangay || 'Assigned Barangay'}
                        </span>
                        <span className="text-[10px] font-bold bg-white text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          Assigned Barangay
                        </span>
                      </div>
                    ) : bgySelectionMode === 'single' ? (
                      /* Single Barangay Mode (Instant 1-click selection) */
                      <div className="space-y-2">
                        <select
                          value={formData.target_barangays.length === 1 ? formData.target_barangays[0] : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSitioSelectionMode('all');
                            setFormData((prev) => ({
                              ...prev,
                              target_barangays: val ? [Number(val)] : [],
                              target_sitios: [],
                            }));
                          }}
                          className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-xl font-bold text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 shadow-sm outline-none"
                        >
                          <option value="">-- Piliin ang Barangay kung saan ididirekta (hal. Anilao) --</option>
                          {barangays.map((b) => (
                            <option key={b.id} value={b.id}>
                              Barangay {b.barangay_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      /* Multiple Barangays Mode */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            placeholder="Maghanap ng barangay..."
                            value={bgySearchFilter}
                            onChange={(e) => setBgySearchFilter(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={toggleAllBarangays}
                            className="text-xs font-bold text-dswd-blue hover:underline whitespace-nowrap"
                          >
                            {formData.target_barangays.length === barangays.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {barangays
                            .filter((b) => b.barangay_name.toLowerCase().includes(bgySearchFilter.toLowerCase()))
                            .map((b) => {
                              const selected = formData.target_barangays.map(Number).includes(Number(b.id));
                              return (
                                <div
                                  key={b.id}
                                  onClick={() => toggleBarangayTarget(b.id)}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition text-xs font-bold ${
                                    selected
                                      ? 'bg-emerald-100/90 text-emerald-950 border-2 border-emerald-400 shadow-sm'
                                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                  }`}
                                >
                                  {selected ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-300 shrink-0" />
                                  )}
                                  <span className="truncate">{b.barangay_name}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Target Sitio (Per-Sitio Announcement Filter) */}
                    <div className="pt-2 border-t border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>Target Sitio <span className="text-[10px] font-semibold text-slate-400 normal-case">(Per Sitio o Lahat)</span></span>
                        </label>
                        <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => {
                              setSitioSelectionMode('all');
                              setFormData((prev) => ({ ...prev, target_sitios: [] }));
                            }}
                            className={`px-2 py-0.5 rounded-md transition ${
                              sitioSelectionMode === 'all'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Lahat ng Sitio
                          </button>
                          <button
                            type="button"
                            onClick={() => setSitioSelectionMode('specific')}
                            className={`px-2 py-0.5 rounded-md transition ${
                              sitioSelectionMode === 'specific'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Per Sitio Lamang
                          </button>
                        </div>
                      </div>

                      {sitioSelectionMode === 'specific' && (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 space-y-2">
                          {formData.target_barangays.length === 0 ? (
                            <p className="text-[11px] text-amber-800 font-semibold">
                              ⚠️ Pumili muna ng Target Barangay sa itaas upang lumabas ang mga rehistradong Sitio.
                            </p>
                          ) : (
                            <>
                              {availableSitios.length > 0 ? (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-bold uppercase text-amber-900 block">
                                    Piliin ang Sitio (mga rehistradong Sitio sa napiling Barangay):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                    {availableSitios.map((item) => {
                                      const selected = parseSitios(formData.target_sitios).some(
                                        (s) => s.toLowerCase() === item.sitio.toLowerCase()
                                      );
                                      return (
                                        <button
                                          key={item.sitio}
                                          type="button"
                                          onClick={() => toggleSitioTarget(item.sitio)}
                                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                            selected
                                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                              : 'bg-white text-slate-700 border-amber-300 hover:bg-amber-100/60'
                                          }`}
                                        >
                                          {selected ? (
                                            <CheckSquare className="w-3.5 h-3.5 text-white shrink-0" />
                                          ) : (
                                            <Square className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                          )}
                                          <span>{item.sitio}</span>
                                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                            selected ? 'bg-amber-800 text-amber-100' : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {item.count}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-600 font-medium">
                                  Walang naka-record na partikular na Sitio sa mga kasalukuyang benepisyaryo ng barangay na ito, ngunit maaari kang mag-type ng Sitio sa ibaba:
                                </p>
                              )}

                              {/* Custom Sitio Input */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <input
                                  type="text"
                                  value={customSitioInput}
                                  onChange={(e) => setCustomSitioInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddCustomSitio();
                                    }
                                  }}
                                  placeholder="Mag-type ng Sitio (hal. Sitio Centro)..."
                                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-800"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddCustomSitio}
                                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shrink-0"
                                >
                                  + Idagdag
                                </button>
                              </div>

                              {/* Selected Sitios Chips */}
                              {parseSitios(formData.target_sitios).length > 0 && (
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/80">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="text-[10px] font-extrabold text-amber-900 uppercase mr-1">Napiling Sitio:</span>
                                    {parseSitios(formData.target_sitios).map((sitio) => (
                                      <span
                                        key={sitio}
                                        className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-400 px-2 py-0.5 rounded-md text-[11px] font-bold"
                                      >
                                        📍 {sitio}
                                        <button
                                          type="button"
                                          onClick={() => toggleSitioTarget(sitio)}
                                          className="text-amber-700 hover:text-red-600 font-black ml-0.5"
                                          title="Alisin ang Sitio"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, target_sitios: [] }))}
                                    className="text-[10px] font-bold text-red-600 hover:underline shrink-0"
                                  >
                                    I-clear
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Directing Notice Banner */}
                    {formData.target_barangays.length === 1 ? (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-xs text-emerald-950 font-bold flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span>
                            Direktang Target: <strong>Barangay {barangays.find((b) => Number(b.id) === Number(formData.target_barangays[0]))?.barangay_name || 'Napili'}</strong>
                            {parseSitios(formData.target_sitios).length > 0 ? (
                              <span className="text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md ml-1">
                                📍 Sitio: {parseSitios(formData.target_sitios).join(', ')} lamang
                              </span>
                            ) : (
                              ' (Lahat ng Sitio)'
                            )}
                          </span>
                          <p className="text-[11px] font-medium text-emerald-800 mt-0.5">
                            {parseSitios(formData.target_sitios).length > 0
                              ? `Ang mga rehistradong benepisyaryo lamang sa Sitio ${parseSitios(formData.target_sitios).join(', ')} ng barangay na ito ang makakatanggap ng SMS/notification at makakakita sa anunsyo.`
                              : 'Ang mga Staff at Benepisyaryo lamang ng barangay na ito ang makakatanggap ng notification at makakakita sa anunsyo.'}
                          </p>
                        </div>
                      </div>
                    ) : formData.target_barangays.length > 1 ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-xs text-blue-900 font-semibold flex items-center gap-1.5 flex-wrap">
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          Naka-target sa <strong>{formData.target_barangays.length}</strong> na mga Barangay
                          {parseSitios(formData.target_sitios).length > 0
                            ? ` (📍 Sitio: ${parseSitios(formData.target_sitios).join(', ')} lamang)`
                            : ' (Lahat ng Sitio)'}.
                        </span>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-2 text-xs text-amber-900 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Pumili ng Barangay kung saan ididirekta ang anunsyo.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Staff Approval Notice */}
              {isBarangayStaff && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-950">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold uppercase tracking-wide text-amber-900">
                      ⏳ Kinakailangan ng Approval ng DSWD Admin
                    </p>
                    <p className="text-[11px] font-medium text-amber-800 mt-0.5">
                      Ang gagawin mong announcement para sa iyong Barangay ay ipapadala muna sa DSWD Admin para sa review at approval bago ito ma-publish at ma-text sa mga benepisyaryo.
                    </p>
                  </div>
                </div>
              )}

              {/* Inter-Office Notification Scope Options (DSWD Admin & MSWDO Admin) */}
              {(user?.role === 'admin' || user?.role === 'mswdo_admin') && formData.status === 'published' && (
                <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/80 border-2 border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5 tracking-wide">
                      <BellRing className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Notification Scope & Inter-Office Coordination</span>
                    </label>
                    {(() => {
                      const selectedCount = (formData.notify_mswdo ? 1 : 0) + (formData.notify_senior ? 1 : 0) + (formData.notify_pwd ? 1 : 0);
                      return (
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-xs ${
                          selectedCount > 0 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}>
                          {selectedCount > 0 ? `🔔 +${selectedCount} Tanggapan na Ma-nonotify` : '📢 Direct Lamang (Barangay + Benepisyaryo)'}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Pumili kung nais mong magpadala rin ng opisyal na abiso sa iba pang tanggapan para sa koordinasyon ng aktibidad (i-click ang mga nais i-notify):
                  </p>

                  <div className={`grid grid-cols-1 ${user?.role === 'admin' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5 pt-1`}>
                    {/* Option: Notify MSWDO (for DSWD Admin) */}
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, notify_mswdo: !prev.notify_mswdo }))}
                        className={`flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition select-none cursor-pointer ${
                          formData.notify_mswdo
                            ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white/70 border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                            formData.notify_mswdo ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {formData.notify_mswdo && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>🏢 MSWDO Admin</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight">
                            Magpadala ng opisyal na abiso sa MSWDO para sa koordinasyon.
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Option: Notify Senior Citizen Admin (OSCA) */}
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, notify_senior: !prev.notify_senior }))}
                      className={`flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition select-none cursor-pointer ${
                        formData.notify_senior
                          ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-500/20'
                          : 'bg-white/70 border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          formData.notify_senior ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {formData.notify_senior && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>👴 Senior Admin (OSCA)</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Magpadala ng opisyal na abiso sa Office of Senior Citizens Affairs.
                        </p>
                      </div>
                    </button>

                    {/* Option: Notify PWD Admin (PDAO) */}
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, notify_pwd: !prev.notify_pwd }))}
                      className={`flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition select-none cursor-pointer ${
                        formData.notify_pwd
                          ? 'bg-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
                          : 'bg-white/70 border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          formData.notify_pwd ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {formData.notify_pwd && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>♿ PWD Admin (PDAO)</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Magpadala ng opisyal na abiso sa Persons with Disability Affairs Office.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center gap-4">
                  <label className="text-xs font-bold text-slate-700">Action Status:</label>
                  {isBarangayStaff ? (
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="pending_approval"
                        checked={formData.status !== 'draft'}
                        onChange={() => setFormData({ ...formData, status: 'pending_approval' })}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      For DSWD Approval
                    </label>
                  ) : (
                    <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="published"
                        checked={formData.status === 'published'}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="text-dswd-blue focus:ring-blue-500"
                      />
                      Publish & Notify
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={formData.status === 'draft'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="text-slate-500 focus:ring-slate-400"
                    />
                    Save as Draft
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="flex items-center gap-2 bg-dswd-blue hover:bg-blue-800 text-white font-bold px-6 py-2 rounded-xl text-sm shadow-md transition disabled:opacity-50"
                  >
                    {modalLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isBarangayStaff
                      ? (formData.status === 'draft' ? 'Save Draft' : 'Submit for DSWD Approval')
                      : editingAnnouncement
                        ? 'Update Announcement'
                        : (formData.status === 'published'
                            ? (() => {
                                const extraNames = [];
                                if (formData.notify_mswdo) extraNames.push('MSWDO');
                                if (formData.notify_senior) extraNames.push('Senior');
                                if (formData.notify_pwd) extraNames.push('PWD');
                                return extraNames.length > 0
                                  ? `Publish & Notify (+ ${extraNames.join(', ')})`
                                  : 'Publish & Notify Direct';
                              })()
                            : 'Save Draft')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECIPIENT STATS & AUDIT LOG MODAL */}
      {selectedAnnouncementStats && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8 border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg">Activity Recipient & Attendance Monitoring Log</h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncementStats(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h4 className="font-black text-slate-900 text-lg">{selectedAnnouncementStats.title}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${getAnnouncementStatusDisplay(selectedAnnouncementStats.status).className}`}>
                    {getAnnouncementStatusDisplay(selectedAnnouncementStats.status).label}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{selectedAnnouncementStats.message}</p>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600 pt-2 border-t border-slate-200">
                  <span>Recipients: <strong className="text-slate-900">{selectedAnnouncementStats.recipient_count}</strong></span>
                  <span>Present Attendees: <strong className="text-emerald-700">{selectedAnnouncementStats.present_count}</strong></span>
                  <span>Absentees: <strong className="text-slate-500">{selectedAnnouncementStats.absent_count}</strong></span>
                  <span>Pending Attendance: <strong className="text-amber-700">{selectedAnnouncementStats.pending_count || 0}</strong></span>
                  <span>Attendance Rate: <strong className="text-blue-700">{selectedAnnouncementStats.attendance_percentage}%</strong></span>
                  <span>Announcement SMS queued: <strong className="text-amber-700">{selectedAnnouncementStats.sms_summary?.queued || 0}</strong></span>
                  <span>Announcement SMS accepted: <strong className="text-emerald-700">{selectedAnnouncementStats.sms_summary?.accepted || 0}</strong></span>
                  <span>Absence SMS queued: <strong className="text-amber-700">{selectedAnnouncementStats.absence_sms_summary?.queued || 0}</strong></span>
                  <span>Absence SMS accepted: <strong className="text-emerald-700">{selectedAnnouncementStats.absence_sms_summary?.accepted || 0}</strong></span>
                  <span>Absence SMS failed: <strong className="text-rose-700">{selectedAnnouncementStats.absence_sms_summary?.failed || 0}</strong></span>
                  <span>Announcement SMS no mobile: <strong className="text-slate-500">{selectedAnnouncementStats.sms_summary?.no_mobile || 0}</strong></span>
                  <span>Absence SMS no mobile: <strong className="text-slate-500">{selectedAnnouncementStats.absence_sms_summary?.no_mobile || 0}</strong></span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-bold">Inter-Office Notice:</span>
                  {selectedAnnouncementStats.notify_mswdo && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      + MSWDO Admin Notified
                    </span>
                  )}
                  {selectedAnnouncementStats.notify_senior && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                      + Senior Admin (OSCA) Notified
                    </span>
                  )}
                  {selectedAnnouncementStats.notify_pwd && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                      + PWD Admin (PDAO) Notified
                    </span>
                  )}
                  {!selectedAnnouncementStats.notify_mswdo && !selectedAnnouncementStats.notify_senior && !selectedAnnouncementStats.notify_pwd && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      Direct Lamang (Walang ibang tanggapan)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Beneficiary Recipient & Scan Details</h5>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleViewStats(selectedAnnouncementStats.id)}
                      className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh status
                    </button>
                    <button
                      onClick={() => handleExportReport(selectedAnnouncementStats)}
                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Excel/CSV
                    </button>
                  </div>
                </div>

                {selectedAnnouncementStats.Recipients?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No recipients recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[1080px] text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Beneficiary ID & Name</th>
                          <th className="py-2.5 px-4">Barangay</th>
                          <th className="py-2.5 px-4">Attendance Status</th>
                          <th className="py-2.5 px-4">Announcement SMS</th>
                          <th className="py-2.5 px-4">Absence SMS</th>
                          <th className="py-2.5 px-4">Scan Timestamp</th>
                          <th className="py-2.5 px-4">Facilitated By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {recipientPagination.paginatedData.map((r) => {
                          const attendanceDisplay = getAttendanceStatusDisplay(r.attendance_status);
                          const smsDisplay = getSmsStatusDisplay(r.sms_status);
                          const absenceSmsDisplay = getSmsStatusDisplay(r.absence_sms_status);
                          return (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4">
                              <p className="font-bold text-slate-900">{r.Beneficiary?.first_name} {r.Beneficiary?.last_name}</p>
                              <p className="text-[10px] text-slate-500">{r.Beneficiary?.beneficiary_id_code || 'N/A'}</p>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {r.Beneficiary?.Barangay?.barangay_name || 'N/A'}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${attendanceDisplay.className}`}>
                                {attendanceDisplay.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${smsDisplay.className}`}>
                                {smsDisplay.label}
                              </span>
                              {r.sms_status === 'failed' && r.sms_failure_reason ? (
                                <p className="mt-1 max-w-[220px] truncate text-[10px] text-rose-700" title={r.sms_failure_reason}>
                                  {r.sms_failure_reason}
                                </p>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${absenceSmsDisplay.className}`}>
                                {absenceSmsDisplay.label}
                              </span>
                              {r.absence_sms_status === 'failed' && r.absence_sms_failure_reason ? (
                                <p className="mt-1 max-w-[220px] truncate text-[10px] text-rose-700" title={r.absence_sms_failure_reason}>
                                  {r.absence_sms_failure_reason}
                                </p>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500">
                              {r.ScannedByStaff ? `${r.ScannedByStaff.first_name} ${r.ScannedByStaff.last_name}` : '—'}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="border-t border-slate-200 px-4 py-3">
                      <Pagination
                        currentPage={recipientPagination.currentPage}
                        totalPages={recipientPagination.totalPages}
                        onPageChange={recipientPagination.goToPage}
                        totalItems={recipientPagination.totalItems}
                        itemsPerPage={10}
                        startIndex={recipientPagination.startIndex}
                        endIndex={recipientPagination.endIndex}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVED ANNOUNCEMENTS MODAL */}
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
                  <h2 className="text-2xl font-bold text-slate-900">Archived Announcements</h2>
                  <p className="text-sm text-slate-600 mt-1">View and manage archived municipal announcements.</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchivedModal(false)}
                className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {archivedAnnouncements.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                  <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No archived announcements found</p>
                  <p className="text-sm text-slate-500 mt-1">Announcements that you archive will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Announcement Title</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Target Audience</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Schedule & Venue</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {archivedPagination.paginatedData.map((ann) => (
                          <tr key={ann.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              <p className="font-bold text-slate-900">{ann.title}</p>
                              <p className="text-xs text-slate-500 line-clamp-1">{ann.message}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                {ann.target_categories ? (
                                  Array.isArray(ann.target_categories)
                                    ? ann.target_categories.join(', ')
                                    : String(ann.target_categories)
                                ) : 'All Beneficiaries'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {ann.event_date ? (
                                <div className="text-xs space-y-0.5">
                                  <p className="font-semibold text-slate-800">
                                    📅 {ann.event_date} {ann.event_time && `at ${ann.event_time}`}{ann.end_time ? ` - ${ann.end_time}` : ''}
                                  </p>
                                  {ann.venue && <p className="text-slate-500">📍 {ann.venue}</p>}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                archived
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleUnarchive(ann.id)}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition flex items-center gap-1 font-bold text-xs"
                                  title="Unarchive Announcement"
                                >
                                  <ArchiveRestore className="w-4 h-4" />
                                  <span>Unarchive</span>
                                </button>
                                <button
                                  onClick={() => handleDelete(ann.id)}
                                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50">
                    <Pagination
                      currentPage={archivedPagination.currentPage}
                      totalPages={archivedPagination.totalPages}
                      onPageChange={archivedPagination.goToPage}
                      totalItems={archivedPagination.totalItems}
                      itemsPerPage={pageSize}
                      onItemsPerPageChange={(newSize) => {
                        setPageSize(newSize);
                        archivedPagination.goToPage(1);
                      }}
                      startIndex={archivedPagination.startIndex}
                      endIndex={archivedPagination.endIndex}
                      alwaysShow={true}
                itemLabel="anunsyo"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowArchivedModal(false)}
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

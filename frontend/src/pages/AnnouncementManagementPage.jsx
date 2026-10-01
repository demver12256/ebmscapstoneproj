import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { announcementApi, programApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';

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

export default function AnnouncementManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [previewLoading, setPreviewLoading] = useState(false);

  // Recipient Stats / Audit Modal
  const [selectedAnnouncementStats, setSelectedAnnouncementStats] = useState(null);

  const activeAllowedCategories = TARGET_CATEGORIES;
  const availablePresets = OFFICIAL_MEETING_PRESETS;

  // Form State
  const [bgySelectionMode, setBgySelectionMode] = useState('single'); // 'single' | 'multiple'
  const [bgySearchFilter, setBgySearchFilter] = useState('');
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
    target_categories: [...activeAllowedCategories],
    target_programs: [],
    target_barangays: [],
    notify_mswdo: false,
  });

  // Load programs & barangays for dropdowns/target options
  const fetchMetadata = async () => {
    try {
      const [progRes, bgryRes] = await Promise.all([
        programApi.list(),
        barangayApi.list(),
      ]);
      const loadedPrograms = progRes.data?.data || progRes.data || [];
      const loadedBarangays = bgryRes.data?.data || bgryRes.data || [];
      setPrograms(loadedPrograms);
      setBarangays(loadedBarangays);

      setFormData((prev) => ({
        ...prev,
        target_categories: (prev.target_categories && prev.target_categories.length > 0) ? prev.target_categories : [...activeAllowedCategories],
        target_programs: loadedPrograms.map((p) => p.id),
        target_barangays: prev.target_barangays || [],
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
      if (user?.role === 'mswdo_admin') {
        list = list.filter((a) => a.created_by_user_id === user.id || a.notify_mswdo);
      }
      setAnnouncements(list);
    } catch (err) {
      setError(err.message || 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterBarangay, filterPriority, filterStatus, searchQuery, user]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Live preview counter when target selections change
  const updateTargetPreview = useCallback(async (categories, bIds) => {
    const activeCats = categories || [];
    const activeBgrais = bIds || [];

    if (activeCats.length === 0 || activeBgrais.length === 0) {
      setPreviewCount(0);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await announcementApi.previewTargetCount({
        target_categories: JSON.stringify(activeCats),
        target_barangays: JSON.stringify(activeBgrais),
      });
      setPreviewCount(res.data?.count || 0);
    } catch (err) {
      console.error('Failed to update target preview count:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      updateTargetPreview(formData.target_categories || [], formData.target_barangays || []);
    }
  }, [formData.target_categories, formData.target_barangays, isModalOpen, updateTargetPreview]);

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
      status: 'published',
      expiration_date: '',
      target_categories: [...activeAllowedCategories],
      target_programs: mapCategoriesToProgramIds(activeAllowedCategories, programs),
      target_barangays: [], // Default to empty so admin MUST explicitly pick the target barangay
      notify_mswdo: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ann) => {
    setEditingAnnouncement(ann);
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

    const parsedTargetBarangays = parseBarangayIds(ann.target_barangays);
    setBgySelectionMode(parsedTargetBarangays.length === 1 ? 'single' : 'multiple');
    setBgySearchFilter('');

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
      status: ann.status || 'published',
      expiration_date: ann.expiration_date || '',
      target_categories: matchedCategories.length > 0 ? matchedCategories : [...activeAllowedCategories],
      target_programs: annPrograms.length > 0 ? annPrograms : programs.map((p) => p.id),
      target_barangays: parsedTargetBarangays,
      notify_mswdo: !!ann.notify_mswdo,
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
    setFormData((prev) => {
      const currentBarangays = parseBarangayIds(prev.target_barangays);
      const allSelected = currentBarangays.length === barangays.length;
      return {
        ...prev,
        target_barangays: allSelected ? [] : barangays.map((b) => Number(b.id)),
      };
    });
  };

  // Submit announcement
  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeCats = formData.target_categories || [];
    if (activeCats.length === 0) {
      alert('Please select at least one target category');
      return;
    }
    if (formData.target_barangays.length === 0) {
      alert('Please select at least one target barangay');
      return;
    }

    const payload = {
      ...formData,
      target_categories: activeCats,
      target_programs: activeCats,
    };

    setModalLoading(true);
    try {
      if (editingAnnouncement) {
        await announcementApi.update(editingAnnouncement.id, payload);
        setSuccessMessage('Announcement updated successfully!');
      } else {
        await announcementApi.create(payload);
        setSuccessMessage('Announcement created, published, and notifications dispatched successfully!');
      }
      setIsModalOpen(false);
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Error saving announcement');
    } finally {
      setModalLoading(false);
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
    if (ann.status !== 'published') return false;
    if (!ann.event_date) return true;

    const timeToCheck = ann.end_time || ann.event_time;
    if (!timeToCheck) return true;

    const [year, month, day] = ann.event_date.split('-').map(Number);
    if (!year || !month || !day) return true;

    let hours = 23;
    let minutes = 59;
    const timeMatch = String(timeToCheck).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      hours = h;
      minutes = m;
    }

    const endTime = new Date(year, month - 1, day, hours, minutes, 59);
    return new Date() < endTime;
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
      csvContent += `Date: ${data.event.event_date || 'N/A'}, Venue: ${data.event.venue || 'N/A'}\n`;
      csvContent += `Total Expected: ${data.summary.total_recipients}, Present: ${data.summary.total_present}, Absent: ${data.summary.total_absent}\n\n`;

      csvContent += `No.,Beneficiary ID Code,Beneficiary Name,Barangay,RFID Number,Contact,Attendance Status,Scan Timestamp,Facilitated By\n`;

      data.report.forEach((row) => {
        csvContent += `${row.row_number},"${row.beneficiary_id_code}","${row.beneficiary_name}","${row.barangay}","${row.rfid_number}","${row.contact_number}","${row.attendance_status}","${row.scanned_at}","${row.facilitated_by}"\n`;
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
  const visibleAnnouncements = announcements.filter((a) => (
    filterStatus === 'archived' ? a.status === 'archived' : a.status !== 'archived'
  ));
  const announcementPagination = usePagination(visibleAnnouncements, 10);
  const archivedAnnouncements = announcements.filter((a) => a.status === 'archived');
  const archivedPagination = usePagination(archivedAnnouncements, 10);
  const recipientPagination = usePagination(selectedAnnouncementStats?.Recipients || [], 10);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-dswd-blue via-blue-800 to-indigo-900 text-white rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black tracking-tight">Announcement & Attendance Module</h1>
          </div>
          <p className="text-blue-100 text-sm max-w-2xl">
            Create targeted municipal announcements, notify assigned Barangay Staff, facilitate RFID-based event attendance, and monitor attendance reports in real time.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {['admin','mswdo_admin'].includes(user?.role) && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg hover:shadow-yellow-500/20 transition transform active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              New Announcement
            </button>
          )}
          <button
            onClick={() => setShowArchivedModal(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl shadow transition border border-white/20"
          >
            <Archive className="w-5 h-5 text-purple-300" />
            <span>Archived ({announcements.filter((a) => a.status === 'archived').length})</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold text-sm">{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Announcements</span>
            <BellRing className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{announcements.length}</p>
          <p className="text-xs text-slate-500 mt-1">Total created events</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Targeted Recipients</span>
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{totalRecipients}</p>
          <p className="text-xs text-slate-500 mt-1">Notified beneficiaries</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Present Attendees</span>
            <CheckCircle2 className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{totalPresent}</p>
          <p className="text-xs text-slate-500 mt-1">Scanned via RFID reader</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Attendance Rate</span>
            <BarChart2 className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{avgAttendanceRate}%</p>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full" style={{ width: `${avgAttendanceRate}%` }} />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
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
              {programs.map((p) => (
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
              <option value="published">Published</option>
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
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
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>
                              Created by: <strong className="text-slate-600">{ann.CreatedBy?.first_name || 'Admin'} {ann.CreatedBy?.last_name || ''}</strong>
                            </span>
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
                          <div className="pt-0.5">
                            {ann.notify_mswdo ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                <BellRing className="w-2.5 h-2.5 text-indigo-600" />
                                <span>+ MSWDO Notified</span>
                              </span>
                            ) : (
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
                            {ann.status === 'published' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Published
                              </span>
                            ) : ann.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Completed
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleExportReport(ann)}
                            title="Export Attendance Report (CSV/Excel)"
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {ann.status === 'published' && (
                            <button
                              onClick={() => handleResend(ann.id)}
                              title="Resend notifications"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                          {['admin','mswdo_admin'].includes(user?.role) && (
                            <button
                              onClick={() => handleOpenEditModal(ann)}
                              title="Edit announcement"
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleArchive(ann.id)}
                            title="Archive announcement"
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-200 px-5 py-3">
              <Pagination
                currentPage={announcementPagination.currentPage}
                totalPages={announcementPagination.totalPages}
                onPageChange={announcementPagination.goToPage}
                totalItems={announcementPagination.totalItems}
                itemsPerPage={10}
                startIndex={announcementPagination.startIndex}
                endIndex={announcementPagination.endIndex}
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
                    <span>Pumili sa DSWD / MSWDO Official Meeting Templates:</span>
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
                          target_barangays: prev.target_barangays.length > 0 ? prev.target_barangays : barangays.map((b) => b.id),
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
                      ? '👵 OSCA / MSWDO Senior Citizens Meetings'
                      : '♿ PDAO / MSWDO PWD Assemblies & Meetings';
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

              {/* TARGET AUDIENCE SELECTION SECTION */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 text-blue-950 font-bold text-xs">
                    <Users className="w-4 h-4 text-dswd-blue" />
                    <span>Target Audience Selection</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-blue-800 font-medium block">Matching Beneficiaries:</span>
                    <span className="text-base font-black text-dswd-blue">
                      {previewLoading ? 'Calculating...' : `${previewCount} Beneficiaries`}
                    </span>
                  </div>
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
                    </div>

                    {/* Single Barangay Mode (Instant 1-click selection) */}
                    {bgySelectionMode === 'single' ? (
                      <div className="space-y-2">
                        <select
                          value={formData.target_barangays.length === 1 ? formData.target_barangays[0] : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              target_barangays: val ? [Number(val)] : [],
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

                    {/* Directing Notice Banner */}
                    {formData.target_barangays.length === 1 ? (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-xs text-emerald-950 font-bold flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span>
                            Direktang Target: <strong>Barangay {barangays.find((b) => Number(b.id) === Number(formData.target_barangays[0]))?.barangay_name || 'Napili'}</strong> lamang.
                          </span>
                          <p className="text-[11px] font-medium text-emerald-800 mt-0.5">
                            Ang mga Staff at Benepisyaryo lamang ng barangay na ito ang makakatanggap ng notification at makakakita sa anunsyo.
                          </p>
                        </div>
                      </div>
                    ) : formData.target_barangays.length > 1 ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-xs text-blue-900 font-semibold flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Naka-target sa <strong>{formData.target_barangays.length}</strong> na mga Barangay.</span>
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

              {/* DSWD Publish Notification Options (Direct to Barangay/Beneficiary vs Include MSWDO) */}
              {user?.role === 'admin' && formData.status === 'published' && (
                <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-purple-50/80 border-2 border-blue-200 rounded-2xl p-3.5 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5 tracking-wide">
                      <BellRing className="w-4 h-4 text-dswd-blue shrink-0" />
                      <span>Notification Scope & Distribution (DSWD Options)</span>
                    </label>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border bg-white shadow-xs text-slate-700">
                      {formData.notify_mswdo ? '🔔 Option 2: + MSWDO' : '📢 Option 1: Direct'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Pumili kung nais mo bang direktang i-anunsyo lamang sa Barangay at Benepisyaryo, o isama rin si MSWDO sa abiso:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                    {/* Option 1: Direct only */}
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, notify_mswdo: false }))}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition select-none cursor-pointer ${
                        !formData.notify_mswdo
                          ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-500/20'
                          : 'bg-white/70 border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          !formData.notify_mswdo ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                        }`}>
                          {!formData.notify_mswdo && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>Direct Lamang</span>
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200">
                            Barangay + Benepisyaryo
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Direktang ipapadala ang announcement sa mga benepisyaryo at Barangay Staff lamang. <strong className="text-slate-800">Hindi ma-nonotify si MSWDO.</strong>
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Direct + Also Notify MSWDO */}
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, notify_mswdo: true }))}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition select-none cursor-pointer ${
                        formData.notify_mswdo
                          ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                          : 'bg-white/70 border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.notify_mswdo ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                        }`}>
                          {formData.notify_mswdo && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>Direct + Notify MSWDO</span>
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-indigo-200">
                            + MSWDO Admin
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Bukod sa mga benepisyaryo at Barangay Staff, <strong className="text-indigo-900">makakatanggap din ng abiso ang MSWDO</strong> para sa koordinasyon.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center gap-4">
                  <label className="text-xs font-bold text-slate-700">Action Status:</label>
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
                    {editingAnnouncement
                      ? 'Update Announcement'
                      : (formData.status === 'published'
                          ? (formData.notify_mswdo ? 'Publish & Notify (+ MSWDO)' : 'Publish & Notify Direct')
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
                <h4 className="font-black text-slate-900 text-lg">{selectedAnnouncementStats.title}</h4>
                <p className="text-xs text-slate-600">{selectedAnnouncementStats.message}</p>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600 pt-2 border-t border-slate-200">
                  <span>Recipients: <strong className="text-slate-900">{selectedAnnouncementStats.recipient_count}</strong></span>
                  <span>Present Attendees: <strong className="text-emerald-700">{selectedAnnouncementStats.present_count}</strong></span>
                  <span>Absentees: <strong className="text-slate-500">{selectedAnnouncementStats.absent_count}</strong></span>
                  <span>Attendance Rate: <strong className="text-blue-700">{selectedAnnouncementStats.attendance_percentage}%</strong></span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Beneficiary Recipient & Scan Details</h5>
                  <button
                    onClick={() => handleExportReport(selectedAnnouncementStats)}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Excel/CSV
                  </button>
                </div>

                {selectedAnnouncementStats.Recipients?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No recipients recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Beneficiary ID & Name</th>
                          <th className="py-2.5 px-4">Barangay</th>
                          <th className="py-2.5 px-4">Attendance Status</th>
                          <th className="py-2.5 px-4">Scan Timestamp</th>
                          <th className="py-2.5 px-4">Facilitated By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {recipientPagination.paginatedData.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4">
                              <p className="font-bold text-slate-900">{r.Beneficiary?.first_name} {r.Beneficiary?.last_name}</p>
                              <p className="text-[10px] text-slate-500">{r.Beneficiary?.beneficiary_id_code || 'N/A'}</p>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {r.Beneficiary?.Barangay?.barangay_name || 'N/A'}
                            </td>
                            <td className="py-2.5 px-4">
                              {r.attendance_status === 'Present' ? (
                                <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full text-[10px]">
                                  PRESENT
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                  PENDING / ABSENT
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {r.scanned_at ? new Date(r.scanned_at).toLocaleString() : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500">
                              {r.ScannedByStaff ? `${r.ScannedByStaff.first_name} ${r.ScannedByStaff.last_name}` : '—'}
                            </td>
                          </tr>
                        ))}
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
                  <div className="border-t border-slate-200 px-4 py-3">
                    <Pagination
                      currentPage={archivedPagination.currentPage}
                      totalPages={archivedPagination.totalPages}
                      onPageChange={archivedPagination.goToPage}
                      totalItems={archivedPagination.totalItems}
                      itemsPerPage={10}
                      startIndex={archivedPagination.startIndex}
                      endIndex={archivedPagination.endIndex}
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

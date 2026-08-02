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
  Eye,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  FileText,
  BarChart2,
  BellRing,
  CheckSquare,
  Square,
  User,
  Download,
  Smartphone,
  Check,
} from 'lucide-react';
import { announcementApi, programApi, barangayApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Recipient Stats / Audit Modal
  const [selectedAnnouncementStats, setSelectedAnnouncementStats] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    event_date: '',
    event_time: '',
    venue: '',
    priority: 'Medium',
    status: 'published',
    expiration_date: '',
    target_programs: [],
    target_barangays: [],
  });

  // Load programs & barangays for dropdowns/target options
  const fetchMetadata = async () => {
    try {
      const [progRes, bgryRes] = await Promise.all([
        programApi.list(),
        barangayApi.list(),
      ]);
      setPrograms(progRes.data?.data || progRes.data || []);
      setBarangays(bgryRes.data?.data || bgryRes.data || []);
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
      setAnnouncements(res.data?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterBarangay, filterPriority, filterStatus, searchQuery]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Live preview counter when target selections change
  const updateTargetPreview = useCallback(async (pIds, bIds) => {
    if (!pIds.length || !bIds.length) {
      setPreviewCount(0);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await announcementApi.previewTargetCount({
        target_programs: JSON.stringify(pIds),
        target_barangays: JSON.stringify(bIds),
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
      updateTargetPreview(formData.target_programs, formData.target_barangays);
    }
  }, [formData.target_programs, formData.target_barangays, isModalOpen, updateTargetPreview]);

  // Reset form
  const handleOpenCreateModal = () => {
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      message: '',
      event_date: '',
      event_time: '',
      venue: '',
      venue_barangay: '',
      venue_detail: '',
      priority: 'Medium',
      status: 'published',
      expiration_date: '',
      target_programs: programs.map((p) => p.id),
      target_barangays: barangays.map((b) => b.id),
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

    setFormData({
      title: ann.title || '',
      message: ann.message || '',
      event_date: ann.event_date || '',
      event_time: ann.event_time || '',
      venue: existingVenue,
      venue_barangay: foundBarangay,
      venue_detail: foundDetail,
      priority: ann.priority || 'Medium',
      status: ann.status || 'published',
      expiration_date: ann.expiration_date || '',
      target_programs: Array.isArray(ann.target_programs) ? ann.target_programs : [],
      target_barangays: Array.isArray(ann.target_barangays) ? ann.target_barangays : [],
    });
    setIsModalOpen(true);
  };

  // Toggle Program Selection
  const toggleProgramTarget = (pId) => {
    setFormData((prev) => {
      const exists = prev.target_programs.includes(pId);
      const updated = exists
        ? prev.target_programs.filter((id) => id !== pId)
        : [...prev.target_programs, pId];
      return { ...prev, target_programs: updated };
    });
  };

  const toggleAllPrograms = () => {
    setFormData((prev) => {
      const allSelected = prev.target_programs.length === programs.length;
      return {
        ...prev,
        target_programs: allSelected ? [] : programs.map((p) => p.id),
      };
    });
  };

  // Toggle Barangay Selection
  const toggleBarangayTarget = (bId) => {
    setFormData((prev) => {
      const exists = prev.target_barangays.includes(bId);
      const updated = exists
        ? prev.target_barangays.filter((id) => id !== bId)
        : [...prev.target_barangays, bId];
      return { ...prev, target_barangays: updated };
    });
  };

  const toggleAllBarangays = () => {
    setFormData((prev) => {
      const allSelected = prev.target_barangays.length === barangays.length;
      return {
        ...prev,
        target_barangays: allSelected ? [] : barangays.map((b) => b.id),
      };
    });
  };

  // Submit announcement
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.target_programs.length === 0) {
      alert('Please select at least one benefit program');
      return;
    }
    if (formData.target_barangays.length === 0) {
      alert('Please select at least one target barangay');
      return;
    }

    setModalLoading(true);
    try {
      if (editingAnnouncement) {
        await announcementApi.update(editingAnnouncement.id, formData);
        setSuccessMessage('Announcement updated successfully!');
      } else {
        await announcementApi.create(formData);
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
    if (!window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) return;
    try {
      await announcementApi.remove(annId);
      setSuccessMessage('Announcement deleted successfully');
      fetchAnnouncements();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to delete announcement');
    }
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

  // Export Attendance Report
  const handleExportReport = async (ann) => {
    try {
      const res = await announcementApi.exportAttendanceReport(ann.id);
      const data = res.data;

      // Construct CSV content
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += `DSWD/MSWD EBMS ATTENDANCE REPORT\n`;
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

  const getBarangayNames = (bIds) => {
    if (!Array.isArray(bIds) || bIds.length === 0) return 'None';
    if (bIds.length === barangays.length) return 'All Barangays';
    return barangays
      .filter((b) => bIds.includes(b.id))
      .map((b) => b.barangay_name)
      .join(', ');
  };

  const totalRecipients = announcements.reduce((sum, a) => sum + (a.recipient_count || 0), 0);
  const totalPresent = announcements.reduce((sum, a) => sum + (a.present_count || 0), 0);
  const avgAttendanceRate = totalRecipients > 0 ? Math.round((totalPresent / totalRecipients) * 100) : 0;

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
        <div>
          {user?.role === 'admin' && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg hover:shadow-yellow-500/20 transition transform active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              New Announcement
            </button>
          )}
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
        ) : announcements.length === 0 ? (
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
                {announcements.map((ann) => {
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
                        </div>
                      </td>

                      {/* Schedule & Venue */}
                      <td className="py-4 px-4">
                        <div className="space-y-1 text-xs">
                          {ann.event_date ? (
                            <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{ann.event_date} {ann.event_time && `at ${ann.event_time}`}</span>
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
                            <button
                              onClick={() => navigate(`/dashboard/announcement-scanner?id=${ann.id}`)}
                              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm transition"
                            >
                              <Smartphone className="w-3 h-3 text-amber-600" /> Start Scanner
                            </button>
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
                          <button
                            onClick={() => handleOpenEditModal(ann)}
                            title="Edit announcement"
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            title="Delete announcement"
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Event Date</label>
                    <input
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Time</label>
                    <input
                      type="text"
                      placeholder="9:00 AM"
                      value={formData.event_time}
                      onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase">Venue / Location</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Barangay</label>
                    <select
                      value={formData.venue_barangay || ''}
                      onChange={(e) => {
                        const bName = e.target.value;
                        setFormData({
                          ...formData,
                          venue_barangay: bName,
                          venue: bName ? `Barangay ${bName}${formData.venue_detail ? ` - ${formData.venue_detail}` : ''}` : formData.venue_detail || '',
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- Select Barangay --</option>
                      {barangays.map((b) => (
                        <option key={b.id} value={b.barangay_name}>{b.barangay_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Specific Location / Hall</label>
                    <input
                      type="text"
                      placeholder="e.g., Covered Court, Barangay Hall"
                      value={formData.venue_detail || ''}
                      onChange={(e) => {
                        const detail = e.target.value;
                        setFormData({
                          ...formData,
                          venue_detail: detail,
                          venue: formData.venue_barangay
                            ? `Barangay ${formData.venue_barangay}${detail ? ` - ${detail}` : ''}`
                            : detail,
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                {formData.venue && (
                  <p className="text-[11px] text-slate-500 font-semibold">
                    📍 Full venue: <span className="text-slate-800">{formData.venue}</span>
                  </p>
                )}
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
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-slate-700">
                        Benefit Programs <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllPrograms}
                        className="text-[10px] font-bold text-dswd-blue hover:underline"
                      >
                        {formData.target_programs.length === programs.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {programs.map((p) => {
                        const selected = formData.target_programs.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleProgramTarget(p.id)}
                            className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition text-[11px] font-semibold ${
                              selected ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {selected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-dswd-blue shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{p.name} ({p.code || p.eligibility_category})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-slate-700">
                        Target Barangays <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={toggleAllBarangays}
                        className="text-[10px] font-bold text-dswd-blue hover:underline"
                      >
                        {formData.target_barangays.length === barangays.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {barangays.map((b) => {
                        const selected = formData.target_barangays.includes(b.id);
                        return (
                          <div
                            key={b.id}
                            onClick={() => toggleBarangayTarget(b.id)}
                            className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition text-[11px] font-semibold ${
                              selected ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {selected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{b.barangay_name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

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
                    Publish & Notify Beneficiaries + Staff
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
                    {editingAnnouncement ? 'Update Announcement' : 'Publish Announcement'}
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
                        {selectedAnnouncementStats.Recipients.map((r) => (
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

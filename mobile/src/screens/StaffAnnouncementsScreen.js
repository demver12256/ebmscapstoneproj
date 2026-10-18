import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Modal,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { announcementApi, barangayApi } from '../services/api';
import {
  isAnnouncementActiveForAttendance,
  getAnnouncementTiming,
} from '../utils/announcementSchedule';

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
    message:
      'Buwanang Family Development Session (FDS) para sa lahat ng 4Ps household beneficiaries. Tatalakayin ang responsableng pagiging magulang, kalusugan, nutrisyon, at edukasyon ng mga bata. Mangyaring dalhin ang inyong RFID Beneficiary Card para sa attendance verification.',
    event_time: '08:00 AM',
    end_time: '11:30 AM',
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
    message:
      'Oryentasyon ukol sa mga patakaran, karapatan, at responsibilidad ng mga benepisyaryo ng Pantawid Pamilyang Pilipino Program (4Ps). Pagsusuri ng compliance rules, RFID card verification, at gabay sa paggamit ng mga serbisyong pampamahalaan.',
    event_time: '08:30 AM',
    end_time: '12:00 PM',
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
    message:
      'Pagsasanay sa wastong paghawak ng pera, pagbabadyet ng sambahayan, pag-iimpok (savings), at mga oportunidad sa micro-livelihood sa ilalim ng Sustainable Livelihood Program (SLP) module.',
    event_time: '09:00 AM',
    end_time: '12:00 PM',
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
    message:
      'Oryentasyon at balidasyon para sa mga benepisyaryo ng Social Pension for Indigent Senior Citizens. Tatalakayin ang mga patakaran sa pagtanggap ng stipend, verification ng senior documents, at nakatakdang payout schedule.',
    event_time: '09:00 AM',
    end_time: '12:00 PM',
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
    message:
      'Pangkalahatang pagpupulong at asembleya ng mga Senior Citizens kasama ang OSCA at MSWDO para sa updates sa mga bagong benepisyo, lokal na ordinansa, at kapakanan ng mga nakatatanda sa komunidad.',
    event_time: '08:30 AM',
    end_time: '12:00 PM',
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
    message:
      'Libreng konsultasyong medikal, geriatric wellness checkup, pamamahagi ng maintenance medicines para sa altapresyon at diabetes, pamimigay ng bitamina, at blood pressure monitoring para sa mga Senior Citizens.',
    event_time: '08:00 AM',
    end_time: '02:00 PM',
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
    message:
      'Komprehensibong oryentasyon ukol sa mga karapatan at pribilehiyo ng mga Persons with Disabilities (PWD) alinsunod sa RA 7277 at RA 10754 (20% discount sa bilihin, gamot, pamasahe, at VAT exemption), PhilHealth benefits, at mga proteksyon sa batas.',
    event_time: '09:00 AM',
    end_time: '12:00 PM',
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
    message:
      'Pangkalahatang konsultasyon at asembleya ng PDAO kasama ang MSWDO upang dinggin ang mga pangangailangan ng PWD community, accessibility concerns, assistive device applications, at suportang medikal.',
    event_time: '09:00 AM',
    end_time: '01:00 PM',
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
    message:
      'Pagsasanay sa kasanayan at pangkabuhayan (skills & capability development) na angkop sa kakayahan ng mga Persons with Disabilities upang magkaroon ng sariling hanapbuhay at produktibong kabuhayan.',
    event_time: '08:30 AM',
    end_time: '03:00 PM',
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
  const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays <= 2 && diffDays >= 0) return 'Urgent';
  if (diffDays <= 5 && diffDays >= 0) return 'High';
  return 'Medium';
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffAnnouncementsScreen = ({ onBack, onOpenDrawer, onNavigate, user, darkMode = false }) => {
  const isBarangayStaff = user?.role === 'staff' || user?.role === 'barangay';

  const [announcements, setAnnouncements] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedAnn, setSelectedAnn] = useState(null);

  // Create Modal State
  const [createModal, setCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);

  // Target Audience Selection & Matching Preview State
  const [previewCount, setPreviewCount] = useState(0);
  const [previewBeneficiaries, setPreviewBeneficiaries] = useState([]);
  const [showPreviewBeneficiaries, setShowPreviewBeneficiaries] = useState(false);
  const [previewSearchQuery, setPreviewSearchQuery] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [availableSitios, setAvailableSitios] = useState([]);

  // Sitio Mode & Custom Sitio
  const [sitioSelectionMode, setSitioSelectionMode] = useState('all'); // 'all' | 'specific'
  const [customSitioInput, setCustomSitioInput] = useState('');

  // Barangay selection mode for Admin
  const [bgySelectionMode, setBgySelectionMode] = useState('single'); // 'single' | 'multiple'

  // Form State
  const [form, setForm] = useState({
    title: '',
    message: '',
    venue: '',
    event_date: '',
    event_time: '08:00 AM',
    end_time: '12:00 PM',
    priority: 'Medium',
    status: isBarangayStaff ? 'pending_approval' : 'published',
    expiration_date: '',
    has_attendance: true,
    target_categories: [...TARGET_CATEGORIES],
    target_barangays: isBarangayStaff && user?.barangay_id ? [Number(user.barangay_id)] : [],
    target_sitios: [],
    notify_mswdo: false,
  });

  const loadAnnouncements = useCallback(async () => {
    try {
      setError('');
      const [annRes, brgyRes] = await Promise.all([
        announcementApi.list().catch(() => ({ data: { data: [] } })),
        barangayApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      setAnnouncements(annRes.data?.data || []);
      setBarangays(brgyRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnnouncements();
  };

  // Live preview counter when target selections change
  const updateTargetPreview = useCallback(async (categories, bIds, sitios) => {
    const activeCats = categories || [];
    const activeBgrais = bIds || [];
    const activeSitios = sitios || [];

    if (activeBgrais.length === 0 || activeCats.length === 0) {
      setPreviewCount(0);
      setPreviewBeneficiaries([]);
      setAvailableSitios([]);
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
      console.warn('Failed to update target preview count:', err?.message);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (createModal) {
      updateTargetPreview(form.target_categories, form.target_barangays, form.target_sitios);
    }
  }, [createModal, form.target_categories, form.target_barangays, form.target_sitios, updateTargetPreview]);

  const handleOpenCreateModal = () => {
    const initialBarangay = isBarangayStaff && user?.barangay_id
      ? [Number(user.barangay_id)]
      : (barangays[0] ? [Number(barangays[0].id)] : []);

    setForm({
      title: '',
      message: '',
      venue: '',
      event_date: '',
      event_time: '08:00 AM',
      end_time: '12:00 PM',
      priority: 'Medium',
      status: isBarangayStaff ? 'pending_approval' : 'published',
      expiration_date: '',
      has_attendance: true,
      target_categories: [...TARGET_CATEGORIES],
      target_barangays: initialBarangay,
      target_sitios: [],
      notify_mswdo: false,
    });
    setSitioSelectionMode('all');
    setCustomSitioInput('');
    setShowPreviewBeneficiaries(false);
    setPreviewSearchQuery('');
    setCreateModal(true);
  };

  const handleSelectTemplate = (preset) => {
    const autoPriority = form.event_date ? calculatePriorityFromDate(form.event_date) : preset.priority;
    setForm((prev) => ({
      ...prev,
      title: preset.title,
      message: preset.message,
      venue: preset.venue,
      priority: autoPriority || preset.priority,
      event_time: preset.event_time,
      end_time: preset.end_time,
      target_categories: preset.target_categories,
    }));
    setTemplateModalVisible(false);
  };

  const toggleAllCategories = () => {
    if (form.target_categories.length === TARGET_CATEGORIES.length) {
      setForm((prev) => ({ ...prev, target_categories: [] }));
    } else {
      setForm((prev) => ({ ...prev, target_categories: [...TARGET_CATEGORIES] }));
    }
  };

  const toggleCategoryTarget = (cat) => {
    setForm((prev) => {
      const exists = prev.target_categories.includes(cat);
      if (exists) {
        return { ...prev, target_categories: prev.target_categories.filter((c) => c !== cat) };
      }
      return { ...prev, target_categories: [...prev.target_categories, cat] };
    });
  };

  const toggleSitioTarget = (sitioName) => {
    setForm((prev) => {
      const exists = prev.target_sitios.some((s) => s.toLowerCase() === sitioName.toLowerCase());
      if (exists) {
        return {
          ...prev,
          target_sitios: prev.target_sitios.filter((s) => s.toLowerCase() !== sitioName.toLowerCase()),
        };
      }
      return {
        ...prev,
        target_sitios: [...prev.target_sitios, sitioName],
      };
    });
  };

  const handleAddCustomSitio = () => {
    if (!customSitioInput.trim()) return;
    const clean = customSitioInput.trim();
    if (!form.target_sitios.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setForm((prev) => ({ ...prev, target_sitios: [...prev.target_sitios, clean] }));
    }
    setCustomSitioInput('');
  };

  const handleCreateAnnouncement = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      Alert.alert('Kailangan ang Impormasyon', 'Pakilagay ang Pamagat ng Anunsyo at ang Detalye/Mensahe.');
      return;
    }
    if (form.target_categories.length === 0) {
      Alert.alert('Kailangan ang Kategorya', 'Pumili ng kahit isang Target Category bago magpatuloy.');
      return;
    }
    if (form.target_barangays.length === 0) {
      Alert.alert('Kailangan ang Barangay', 'Pumili ng kahit isang Target Barangay bago magpatuloy.');
      return;
    }

    setCreating(true);
    try {
      const finalSitios = sitioSelectionMode === 'all' ? [] : form.target_sitios;
      const finalStatus = isBarangayStaff
        ? (form.status === 'draft' ? 'draft' : 'pending_approval')
        : form.status;

      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        venue: form.venue.trim() || undefined,
        event_date: form.event_date.trim() || undefined,
        event_time: form.event_time.trim() || undefined,
        end_time: form.end_time.trim() || undefined,
        priority: form.priority,
        status: finalStatus,
        expiration_date: form.expiration_date.trim() || undefined,
        has_attendance: form.has_attendance,
        target_categories: form.target_categories,
        target_programs: form.target_categories,
        target_barangays: form.target_barangays,
        target_sitios: finalSitios,
        notify_mswdo: user?.role === 'admin' ? !!form.notify_mswdo : false,
      };

      await announcementApi.create(payload);
      Alert.alert(
        'Tagumpay',
        isBarangayStaff
          ? (finalStatus === 'draft'
              ? 'Nai-save ang draft ng anunsyo.'
              : 'Naisumite na ang anunsyo para sa DSWD Admin Approval bago mai-publish at ma-text sa mga benepisyaryo.')
          : 'Matagumpay na nai-publish ang bagong anunsyo!'
      );
      setCreateModal(false);
      loadAnnouncements();
    } catch (err) {
      Alert.alert('Submission Failed', err?.response?.data?.message || err.message || 'Hindi naisumite ang anunsyo.');
    } finally {
      setCreating(false);
    }
  };

  const assignedBarangay =
    barangays.find((b) => Number(b.id) === Number(user?.barangay_id)) ||
    (form.target_barangays.length > 0
      ? barangays.find((b) => Number(b.id) === Number(form.target_barangays[0]))
      : null);

  const filteredItems = announcements.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.content && a.content.toLowerCase().includes(q)) ||
      (a.message && a.message.toLowerCase().includes(q)) ||
      (a.venue && a.venue.toLowerCase().includes(q));

    if (filterType === 'attendance') return matchSearch && a.has_attendance;
    if (filterType === 'published') return matchSearch && a.status === 'published';
    if (filterType === 'pending_approval') return matchSearch && a.status === 'pending_approval';
    if (filterType === 'draft') return matchSearch && a.status === 'draft';
    return matchSearch;
  });

  const getPriorityStyle = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent' || p === 'high') return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    if (p === 'low') return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }; // Medium / Normal
  };

  const handleSelectAnnouncement = (item) => {
    const timing = getAnnouncementTiming(item);
    const isActive = isAnnouncementActiveForAttendance(item);
    if (!isActive || timing === 'ended') {
      Alert.alert(
        'Anunsyo ay Lumipas Na (Expired)',
        'Ang anunsyo o aktibidad na ito ay tapos na. Ang mga paparating (incoming) at kasalukuyang (current) anunsyo lamang ang maaaring buksan para sa attendance at detalye.'
      );
      return;
    }
    setSelectedAnn(item);
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={darkMode ? '#0f172a' : '#ffffff'} />

      {/* Top Header */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onOpenDrawer} style={styles.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.menuIcon, darkMode && styles.darkText]}>☰</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Announcements</Text>
            <Text style={styles.headerSub}>Public notices & community event bulletins</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={handleOpenCreateModal} style={styles.createBtn}>
            <Text style={styles.createBtnText}>+ Mag-anunsyo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadAnnouncements} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search announcement title or venue..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChips}>
          {[
            { key: 'all', label: 'All' },
            { key: 'published', label: 'Published' },
            { key: 'pending_approval', label: 'For DSWD Approval' },
            { key: 'attendance', label: 'With Attendance' },
            { key: 'draft', label: 'Draft' },
          ].map((st) => {
            const isSel = filterType === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                onPress={() => setFilterType(st.key)}
                style={[styles.chip, isSel && styles.chipActive]}
              >
                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Announcements List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading announcements...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadAnnouncements} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📢</Text>
              <Text style={styles.emptyTitle}>No Announcements</Text>
              <Text style={styles.emptySub}>No bulletins matching your filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const priorityStyle = getPriorityStyle(item.priority);
            const timing = getAnnouncementTiming(item);
            const isEnded = timing === 'ended';
            const isCurrent = timing === 'current';
            const isPendingApproval = item.status === 'pending_approval';

            return (
              <TouchableOpacity
                style={[styles.annCard, darkMode && styles.darkCard, isEnded && { opacity: 0.65 }]}
                onPress={() => handleSelectAnnouncement(item)}
                activeOpacity={isEnded ? 0.9 : 0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.annTitle, darkMode && styles.darkText]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.dateSub}>
                      📅 {formatDate(item.event_date || item.publish_date || item.created_at)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg, borderColor: priorityStyle.border }]}>
                      <Text style={[styles.priorityBadgeText, { color: priorityStyle.text }]}>
                        {(item.priority || 'Normal').toUpperCase()}
                      </Text>
                    </View>
                    {isPendingApproval ? (
                      <View style={[styles.timingBadge, { backgroundColor: '#fef3c7', borderColor: '#fcd34d' }]}>
                        <Text style={[styles.timingBadgeText, { color: '#b45309' }]}>FOR DSWD APPROVAL</Text>
                      </View>
                    ) : (
                      <View style={[styles.timingBadge, isEnded ? styles.timingEnded : isCurrent ? styles.timingCurrent : styles.timingUpcoming]}>
                        <Text style={[styles.timingBadgeText, isEnded ? styles.timingEndedTxt : isCurrent ? styles.timingCurrentTxt : styles.timingUpcomingTxt]}>
                          {isEnded ? 'TAPOS NA' : isCurrent ? 'KASALUKUYAN' : 'PAPARATING'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {item.venue ? (
                  <Text style={styles.venueText}>📍 Venue: {item.venue}</Text>
                ) : null}

                {item.target_sitios && (
                  <Text style={styles.sitioText}>
                    🏡 Sitio: {Array.isArray(item.target_sitios) ? item.target_sitios.join(', ') : item.target_sitios}
                  </Text>
                )}

                {(item.message || item.content) ? (
                  <Text style={[styles.contentSnippet, darkMode && styles.darkSub]} numberOfLines={2}>
                    {item.message || item.content}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  {item.has_attendance ? (
                    <View style={[styles.attendancePill, isEnded && { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[styles.attendancePillText, isEnded && { color: '#64748b' }]}>
                        {isEnded ? 'Attendance Closed' : '📲 Attendance Required'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.generalNoticeText}>📢 General Notice</Text>
                  )}
                  {item.has_attendance && !isEnded && (
                    <TouchableOpacity
                      style={styles.openScannerBtn}
                      onPress={() => onNavigate && onNavigate('attendanceScanner')}
                    >
                      <Text style={styles.openScannerText}>📱 Scan Attendees</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Announcement Detail Modal */}
      <Modal visible={!!selectedAnn} transparent animationType="slide" onRequestClose={() => setSelectedAnn(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>{selectedAnn?.title}</Text>
                <Text style={styles.dateSub}>
                  📅 {formatDate(selectedAnn?.event_date || selectedAnn?.publish_date)} • {(selectedAnn?.priority || 'Normal').toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedAnn(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Venue / Location</Text>
                <Text style={styles.infoVal}>{selectedAnn?.venue || 'Municipal Hall'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Target Scope</Text>
                <Text style={styles.infoVal}>{selectedAnn?.target_barangays || 'All Barangays'}</Text>
              </View>
              {selectedAnn?.target_sitios ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Target Sitio</Text>
                  <Text style={styles.infoVal}>
                    {Array.isArray(selectedAnn.target_sitios) ? selectedAnn.target_sitios.join(', ') : selectedAnn.target_sitios}
                  </Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoVal, { fontWeight: '700', color: selectedAnn?.status === 'pending_approval' ? '#b45309' : '#15803d' }]}>
                  {selectedAnn?.status === 'pending_approval' ? 'FOR DSWD APPROVAL' : (selectedAnn?.status || 'PUBLISHED').toUpperCase()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Attendance Status</Text>
                <Text style={styles.infoVal}>{selectedAnn?.has_attendance ? 'Required (RFID/QR)' : 'Not Required'}</Text>
              </View>

              <View style={styles.contentBox}>
                <Text style={styles.contentBoxTitle}>Announcement Details</Text>
                <Text style={[styles.contentBody, darkMode && styles.darkSub]}>{selectedAnn?.message || selectedAnn?.content}</Text>
              </View>

              {selectedAnn?.has_attendance && (
                <TouchableOpacity
                  style={styles.launchAttendanceBtn}
                  onPress={() => {
                    setSelectedAnn(null);
                    if (onNavigate) onNavigate('attendanceScanner');
                  }}
                >
                  <Text style={styles.launchAttendanceBtnText}>📲 Open Attendance Scanner</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ━━━ CREATE TARGETED ANNOUNCEMENT MODAL (Matches Web App Exactly) ━━━ */}
      <Modal visible={createModal} animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <SafeAreaView style={styles.createModalPage}>
          {/* Header */}
          <View style={styles.createModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 24 }}>📣</Text>
              <Text style={styles.createModalHeaderTitle}>Create Targeted Announcement</Text>
            </View>
            <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.createModalCloseBtn}>
              <Text style={styles.createModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.createModalBody} keyboardShouldPersistTaps="handled">
            {/* Quick Fill from DSWD / MSWDO Meeting Templates */}
            <View style={styles.templateBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.templateBoxLabel}>✨ Pumili sa DSWD / MSWDO Templates:</Text>
                <Text style={styles.templateBoxSub}>Auto-fill details</Text>
              </View>

              <TouchableOpacity
                style={styles.templateSelectBtn}
                onPress={() => setTemplateModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.templateSelectBtnText} numberOfLines={1}>
                  {form.title ? `Naka-fill: ${form.title}` : '-- Pumili ng Opisyal na Meeting Template (Quick Fill) ▾ --'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Announcement Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                ANNOUNCEMENT TITLE <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Hal. 4Ps Family Development Session / General Assembly"
                placeholderTextColor="#94a3b8"
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
              />
            </View>

            {/* Event Schedule (Date, Start Time, End Time) */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1.2 }]}>
                <Text style={styles.label}>EVENT DATE</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={form.event_date}
                  onChangeText={(d) => {
                    const autoPri = calculatePriorityFromDate(d);
                    setForm({ ...form, event_date: d, priority: autoPri });
                  }}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>START TIME</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="08:00 AM"
                  placeholderTextColor="#94a3b8"
                  value={form.event_time}
                  onChangeText={(t) => setForm({ ...form, event_time: t })}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>END TIME</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="12:00 PM"
                  placeholderTextColor="#94a3b8"
                  value={form.end_time}
                  onChangeText={(t) => setForm({ ...form, end_time: t })}
                />
              </View>
            </View>

            {/* Message / Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                ANNOUNCEMENT DESCRIPTION & MESSAGE <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Ilagay ang kumpletong anunsyo, mga paalala, mga dadalhing dokumento (hal. RFID card, valid ID)..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={form.message}
                onChangeText={(m) => setForm({ ...form, message: m })}
              />
            </View>

            {/* Priority & Venue */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>PRIORITY LEVEL</Text>
                <View style={styles.prioritySelector}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((pri) => (
                    <TouchableOpacity
                      key={pri}
                      style={[styles.priorityPill, form.priority === pri && styles.priorityPillActive]}
                      onPress={() => setForm({ ...form, priority: pri })}
                    >
                      <Text style={[styles.priorityPillText, form.priority === pri && styles.priorityPillTextActive]}>
                        {pri}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>VENUE / LOCATION</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Hal. Barangay Covered Court / Bongabong Gymnasium"
                placeholderTextColor="#94a3b8"
                value={form.venue}
                onChangeText={(v) => setForm({ ...form, venue: v })}
              />
            </View>

            {/* Attendance Toggle */}
            <TouchableOpacity
              style={styles.attendanceCheckCard}
              onPress={() => setForm({ ...form, has_attendance: !form.has_attendance })}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.attendanceCheckTitle}>Kailangan ng Attendance (RFID/QR)?</Text>
                <Text style={styles.attendanceCheckSub}>
                  Papayagan ang Staff na mag-scan ng attendees sa araw ng pulong gamit ang mobile app.
                </Text>
              </View>
              <Text style={{ fontSize: 24 }}>{form.has_attendance ? '☑️' : '⬜'}</Text>
            </TouchableOpacity>

            {/* ━━━ TARGET AUDIENCE SELECTION HEADER CARD (Matching Web Image) ━━━ */}
            <TouchableOpacity
              style={styles.targetAudienceHeaderCard}
              onPress={() => setShowPreviewBeneficiaries(!showPreviewBeneficiaries)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>👥</Text>
                  <Text style={styles.targetAudienceTitle}>Target Audience Selection</Text>
                </View>
                <Text style={styles.targetAudienceSub}>
                  👁 {showPreviewBeneficiaries ? 'Itago ang listahan ng makakatanggap' : 'I-click dito upang makita ang mga benepisyaryong makakatanggap'}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 8 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.matchingSub}>Matching Beneficiaries:</Text>
                  <Text style={styles.matchingCount}>
                    {previewLoading ? 'Counting...' : `${previewCount} Beneficiaries`}
                  </Text>
                </View>
                <View style={styles.chevronBox}>
                  <Text style={styles.chevronText}>{showPreviewBeneficiaries ? '⌃' : '⌄'}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Collapsible Beneficiaries List */}
            {showPreviewBeneficiaries && (
              <View style={styles.beneficiariesPreviewContainer}>
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewTitle}>Mga Benepisyaryong Makakatanggap ({previewBeneficiaries.length})</Text>
                  <Text style={styles.previewDesc}>
                    Sila ang makakatanggap ng SMS at In-App Notification kapag na-publish ang anunsyo.
                  </Text>
                </View>

                {previewBeneficiaries.length > 2 && (
                  <TextInput
                    style={styles.previewSearchInput}
                    placeholder="🔍 Hanapin ang pangalan / sitio / ID code..."
                    placeholderTextColor="#94a3b8"
                    value={previewSearchQuery}
                    onChangeText={setPreviewSearchQuery}
                  />
                )}

                {previewLoading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Kinakalkula ang mga tugmang benepisyaryo...</Text>
                  </View>
                ) : previewBeneficiaries.length === 0 ? (
                  <View style={styles.previewEmptyBox}>
                    <Text style={styles.previewEmptyText}>
                      Walang tugmang Approved na benepisyaryo para sa napiling Category, Barangay, at Sitio.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.previewListScroll}>
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
                      .slice(0, 50)
                      .map((b, idx) => (
                        <View key={b.id || idx} style={styles.recipientRow}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={styles.recipientName}>
                                {idx + 1}. {b.full_name || `${b.first_name} ${b.last_name}`}
                              </Text>
                              <Text style={styles.recipientId}>{b.beneficiary_id_code}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <View style={styles.brgyBadge}>
                                <Text style={styles.brgyBadgeText}>Brgy. {b.barangay_name}</Text>
                              </View>
                              {b.sitio ? (
                                <View style={styles.sitioBadge}>
                                  <Text style={styles.sitioBadgeText}>📍 Sitio: {b.sitio}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View style={{ alignItems: 'flex-end' }}>
                            <View style={styles.catPill}>
                              <Text style={styles.catPillText}>{b.category}</Text>
                            </View>
                            <Text style={styles.recipientPhone}>📱 {b.contact_number || 'No mobile'}</Text>
                          </View>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            )}

            {/* ━━━ TARGET CATEGORIES & TARGET BARANGAY CARDS (Matching Web Layout) ━━━ */}
            <View style={styles.targetingCardsRow}>
              {/* Target Categories Card */}
              <View style={styles.targetSectionCard}>
                <View style={styles.targetCardHeader}>
                  <Text style={styles.targetCardTitle}>
                    TARGET CATEGORIES <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <TouchableOpacity onPress={toggleAllCategories}>
                    <Text style={styles.selectAllBtnText}>
                      {form.target_categories.length === TARGET_CATEGORIES.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 8, marginTop: 8 }}>
                  {TARGET_CATEGORIES.map((cat) => {
                    const isSelected = form.target_categories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.checkboxCard, isSelected && styles.checkboxCardActive]}
                        onPress={() => toggleCategoryTarget(cat)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 18, color: isSelected ? '#1e40af' : '#cbd5e1' }}>
                          {isSelected ? '☑' : '☐'}
                        </Text>
                        <Text style={[styles.checkboxText, isSelected && styles.checkboxTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Target Barangay Card */}
              <View style={styles.targetSectionCard}>
                <View style={styles.targetCardHeader}>
                  <Text style={styles.targetCardTitle}>
                    📍 TARGET BARANGAY <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  {isBarangayStaff && (
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockBadgeText}>🔒 Sariling Barangay Lamang</Text>
                    </View>
                  )}
                </View>

                {isBarangayStaff ? (
                  <View style={styles.assignedBrgyBox}>
                    <Text style={styles.assignedBrgyName}>
                      Barangay {assignedBarangay?.barangay_name || user?.barangay || 'Aplaya'}
                    </Text>
                    <View style={styles.assignedTag}>
                      <Text style={styles.assignedTagText}>Assigned Barangay</Text>
                    </View>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {barangays.map((b) => {
                      const isSel = form.target_barangays.includes(Number(b.id));
                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.brgyChip, isSel && styles.brgyChipActive]}
                          onPress={() => {
                            if (isSel) {
                              if (form.target_barangays.length > 1) {
                                setForm({ ...form, target_barangays: form.target_barangays.filter((id) => id !== Number(b.id)) });
                              }
                            } else {
                              setForm({ ...form, target_barangays: [...form.target_barangays, Number(b.id)] });
                            }
                          }}
                        >
                          <Text style={[styles.brgyChipText, isSel && styles.brgyChipTextActive]}>
                            {b.barangay_name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* Target Sitio Sub-Section */}
                <View style={styles.sitioSubSection}>
                  <View style={styles.targetCardHeader}>
                    <Text style={styles.sitioLabel}>
                      📍 TARGET SITIO <Text style={styles.sitioSubLabel}>(Per Sitio o Lahat)</Text>
                    </Text>
                    <View style={styles.sitioModeToggle}>
                      <TouchableOpacity
                        style={[styles.sitioToggleBtn, sitioSelectionMode === 'all' && styles.sitioToggleBtnActive]}
                        onPress={() => {
                          setSitioSelectionMode('all');
                          setForm((prev) => ({ ...prev, target_sitios: [] }));
                        }}
                      >
                        <Text style={[styles.sitioToggleBtnText, sitioSelectionMode === 'all' && styles.sitioToggleBtnTextActive]}>
                          Lahat ng Sitio
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sitioToggleBtn, sitioSelectionMode === 'specific' && styles.sitioToggleBtnActive]}
                        onPress={() => setSitioSelectionMode('specific')}
                      >
                        <Text style={[styles.sitioToggleBtnText, sitioSelectionMode === 'specific' && styles.sitioToggleBtnTextActive]}>
                          Per Sitio Lamang
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {sitioSelectionMode === 'specific' && (
                    <View style={styles.specificSitioBox}>
                      {availableSitios.length > 0 ? (
                        <>
                          <Text style={styles.availableSitioTitle}>Pumili sa mga Rehistradong Sitio:</Text>
                          <View style={styles.sitioChipsWrap}>
                            {availableSitios.map((item) => {
                              const isSel = form.target_sitios.some((s) => s.toLowerCase() === item.sitio.toLowerCase());
                              return (
                                <TouchableOpacity
                                  key={item.sitio}
                                  style={[styles.sitioSelectChip, isSel && styles.sitioSelectChipActive]}
                                  onPress={() => toggleSitioTarget(item.sitio)}
                                >
                                  <Text style={[styles.sitioSelectChipText, isSel && styles.sitioSelectChipTextActive]}>
                                    {isSel ? '✓ ' : '+ '} {item.sitio}
                                  </Text>
                                  <View style={[styles.sitioCountBadge, isSel && { backgroundColor: '#92400e' }]}>
                                    <Text style={[styles.sitioCountText, isSel && { color: '#fef3c7' }]}>{item.count}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </>
                      ) : null}

                      {/* Custom Sitio Input */}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <TextInput
                          style={styles.customSitioInput}
                          placeholder="Mag-type ng Sitio (hal. Sitio Centro)..."
                          placeholderTextColor="#94a3b8"
                          value={customSitioInput}
                          onChangeText={setCustomSitioInput}
                        />
                        <TouchableOpacity style={styles.addSitioBtn} onPress={handleAddCustomSitio}>
                          <Text style={styles.addSitioBtnText}>+ Idagdag</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Selected Sitios Display */}
                      {form.target_sitios.length > 0 && (
                        <View style={styles.selectedSitiosRow}>
                          <Text style={styles.selectedSitioLabel}>Napili:</Text>
                          {form.target_sitios.map((sitio) => (
                            <View key={sitio} style={styles.selectedSitioTag}>
                              <Text style={styles.selectedSitioTagText}>📍 {sitio}</Text>
                              <TouchableOpacity onPress={() => toggleSitioTarget(sitio)} hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                                <Text style={styles.removeSitioText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Direct Target Notice Banner (Green) */}
                <View style={styles.directTargetBox}>
                  <Text style={{ fontSize: 16 }}>✓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.directTargetTitle}>
                      Direktang Target: Barangay {assignedBarangay?.barangay_name || 'Aplaya'}{' '}
                      {form.target_sitios.length > 0
                        ? `(Sitio: ${form.target_sitios.join(', ')} lamang)`
                        : '(Lahat ng Sitio)'}
                    </Text>
                    <Text style={styles.directTargetSub}>
                      Ang mga Staff at Benepisyaryo lamang ng barangay na ito ang makakatanggap ng notification at makakakita sa anunsyo.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ━━━ YELLOW APPROVAL NOTICE BOX (Matches Web Image) ━━━ */}
            {isBarangayStaff && (
              <View style={styles.approvalYellowBox}>
                <Text style={{ fontSize: 20 }}>⏳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.approvalYellowTitle}>KINAKAILANGAN NG APPROVAL NG DSWD ADMIN</Text>
                  <Text style={styles.approvalYellowSub}>
                    Ang gagawin mong announcement para sa iyong Barangay ay ipapadala muna sa DSWD Admin para sa review at approval bago ito ma-publish at ma-text sa mga benepisyaryo.
                  </Text>
                </View>
              </View>
            )}

            {/* ━━━ ACTION STATUS & BUTTONS (Matches Web Image) ━━━ */}
            <View style={styles.actionStatusRow}>
              <Text style={styles.actionStatusLabel}>Action Status:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setForm({ ...form, status: isBarangayStaff ? 'pending_approval' : 'published' })}
                >
                  <Text style={{ fontSize: 16, color: form.status !== 'draft' ? '#2563eb' : '#94a3b8' }}>
                    {form.status !== 'draft' ? '🔘' : '⚪'}
                  </Text>
                  <Text style={styles.radioOptionText}>
                    {isBarangayStaff ? 'For DSWD Approval' : 'Publish & Notify'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setForm({ ...form, status: 'draft' })}
                >
                  <Text style={{ fontSize: 16, color: form.status === 'draft' ? '#2563eb' : '#94a3b8' }}>
                    {form.status === 'draft' ? '🔘' : '⚪'}
                  </Text>
                  <Text style={styles.radioOptionText}>Save as Draft</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Submit Buttons */}
            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitApprovalBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateAnnouncement}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>✈</Text>
                    <Text style={styles.submitApprovalBtnText}>
                      {isBarangayStaff
                        ? (form.status === 'draft' ? 'Save as Draft' : 'Submit for DSWD Approval')
                        : (form.status === 'draft' ? 'Save as Draft' : 'Publish & Notify Direct')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ━━━ OFFICIAL MEETING TEMPLATES PICKER MODAL ━━━ */}
      <Modal visible={templateModalVisible} transparent animationType="fade" onRequestClose={() => setTemplateModalVisible(false)}>
        <View style={styles.templateModalOverlay}>
          <View style={styles.templateModalCard}>
            <View style={styles.templateModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.templateModalTitle}>Opisyal na Meeting Templates</Text>
                <Text style={styles.templateModalSub}>Pumili upang awtomatikong ma-fill ang mga detalye</Text>
              </View>
              <TouchableOpacity onPress={() => setTemplateModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {['4Ps Household Beneficiaries', 'Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)'].map((sec) => {
                const groupPresets = OFFICIAL_MEETING_PRESETS.filter((p) => p.sector === sec);
                const groupLabel = sec.includes('4Ps')
                  ? '🔵 DSWD 4Ps Meetings'
                  : sec.includes('Senior')
                  ? '👵 OSCA / MSWDO Senior Citizens Meetings'
                  : '♿ PDAO / MSWDO PWD Assemblies & Meetings';

                return (
                  <View key={sec} style={{ marginBottom: 14 }}>
                    <Text style={styles.presetGroupTitle}>{groupLabel}</Text>
                    {groupPresets.map((preset) => (
                      <TouchableOpacity
                        key={preset.id}
                        style={styles.presetItemCard}
                        onPress={() => handleSelectTemplate(preset)}
                      >
                        <Text style={styles.presetItemTitle}>{preset.title}</Text>
                        <Text style={styles.presetItemSub} numberOfLines={2}>{preset.message}</Text>
                        <View style={styles.presetMetaRow}>
                          <Text style={styles.presetMetaText}>🕒 {preset.event_time} - {preset.end_time}</Text>
                          <Text style={styles.presetMetaText}>📍 {preset.venue}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  darkContainer: { backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  darkHeader: { backgroundColor: '#1e293b', borderBottomColor: '#334155' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  menuBtn: { marginRight: 12, padding: 4 },
  menuIcon: { fontSize: 24, color: '#1e293b' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: { fontSize: 18, color: '#2563eb', fontWeight: 'bold' },
  createBtn: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  darkText: { color: '#f8fafc' },
  darkSub: { color: '#94a3b8' },

  filterSection: { paddingHorizontal: 16, marginVertical: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  darkSearchBox: { backgroundColor: '#1e293b', borderColor: '#334155' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  clearSearch: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 4 },
  statusChips: { flexDirection: 'row', gap: 6, marginTop: 10, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 90 },

  loadingBox: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#64748b', fontSize: 14, marginTop: 10 },
  errorBox: { padding: 30, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  emptySub: { fontSize: 13, color: '#64748b', marginTop: 4 },

  annCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  annTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  dateSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  priorityBadgeText: { fontSize: 10, fontWeight: '800' },
  timingBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  timingBadgeText: { fontSize: 9.5, fontWeight: '800' },
  timingUpcoming: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  timingUpcomingTxt: { color: '#1d4ed8' },
  timingCurrent: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  timingCurrentTxt: { color: '#15803d' },
  timingEnded: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  timingEndedTxt: { color: '#64748b' },
  venueText: { fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 2 },
  sitioText: { fontSize: 11.5, color: '#b45309', fontWeight: '600', marginBottom: 4 },
  contentSnippet: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 8, marginTop: 4 },
  attendancePill: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  attendancePillText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  generalNoticeText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  openScannerBtn: { backgroundColor: '#1e40af', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  openScannerText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, maxHeight: '88%', overflow: 'hidden', elevation: 10 },
  darkModalContent: { backgroundColor: '#1e293b' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: 'bold' },
  modalScroll: { padding: 16, gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  infoLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  infoVal: { fontSize: 12.5, color: '#1e293b', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  contentBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 6 },
  contentBoxTitle: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 4, textTransform: 'uppercase' },
  contentBody: { fontSize: 13, color: '#334155', lineHeight: 18 },
  launchAttendanceBtn: { backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  launchAttendanceBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // ━━━ CREATE TARGETED ANNOUNCEMENT MODAL STYLES ━━━
  createModalPage: { flex: 1, backgroundColor: '#f1f5f9' },
  createModalHeader: {
    backgroundColor: '#0b3b9b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  createModalHeaderTitle: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  createModalCloseBtn: { padding: 4 },
  createModalCloseText: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  createModalBody: { padding: 14 },

  templateBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  templateBoxLabel: { fontSize: 11, fontWeight: '800', color: '#1e40af', textTransform: 'uppercase' },
  templateBoxSub: { fontSize: 10.5, color: '#64748b', fontWeight: '600' },
  templateSelectBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 4,
  },
  templateSelectBtnText: { fontSize: 12, color: '#1e293b', fontWeight: '700' },

  inputGroup: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '800', color: '#334155', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  textArea: { minHeight: 75, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },

  prioritySelector: { flexDirection: 'row', gap: 6, marginTop: 2 },
  priorityPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  priorityPillActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  priorityPillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  priorityPillTextActive: { color: '#ffffff', fontWeight: '800' },

  attendanceCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendanceCheckTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  attendanceCheckSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Target Audience Header Card (Matches Web image)
  targetAudienceHeaderCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    elevation: 1,
  },
  targetAudienceTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a' },
  targetAudienceSub: { fontSize: 11, color: '#1d4ed8', fontWeight: '700', marginTop: 2 },
  matchingSub: { fontSize: 9.5, color: '#1e40af', fontWeight: '600' },
  matchingCount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1d4ed8',
    textDecorationLine: 'underline',
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronText: { fontSize: 16, color: '#1d4ed8', fontWeight: 'bold' },

  beneficiariesPreviewContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  previewHeaderRow: { marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 6 },
  previewTitle: { fontSize: 12.5, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' },
  previewDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  previewSearchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    fontSize: 12,
    color: '#0f172a',
    marginBottom: 8,
  },
  previewEmptyBox: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, alignItems: 'center' },
  previewEmptyText: { fontSize: 11.5, color: '#64748b', textAlign: 'center' },
  previewListScroll: { maxHeight: 220 },
  recipientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    alignItems: 'center',
  },
  recipientName: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  recipientId: { fontSize: 10, color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  brgyBadge: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  brgyBadgeText: { fontSize: 9.5, color: '#065f46', fontWeight: '700' },
  sitioBadge: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  sitioBadgeText: { fontSize: 9.5, color: '#92400e', fontWeight: '700' },
  catPill: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  catPillText: { fontSize: 9.5, color: '#1e40af', fontWeight: '700' },
  recipientPhone: { fontSize: 10, color: '#64748b', marginTop: 2 },

  // Targeting Cards
  targetingCardsRow: { gap: 10, marginBottom: 12 },
  targetSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  targetCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetCardTitle: { fontSize: 11, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.4 },
  selectAllBtnText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },

  checkboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checkboxCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  checkboxText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  checkboxTextActive: { color: '#1e40af', fontWeight: '800' },

  lockBadge: { backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#6ee7b7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  lockBadgeText: { fontSize: 9.5, color: '#065f46', fontWeight: '800' },

  assignedBrgyBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  assignedBrgyName: { fontSize: 13, fontWeight: '900', color: '#064e3b' },
  assignedTag: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  assignedTagText: { fontSize: 9.5, fontWeight: '700', color: '#065f46' },

  brgyChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f1f5f9', marginRight: 6 },
  brgyChipActive: { backgroundColor: '#16a34a' },
  brgyChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  brgyChipTextActive: { color: '#ffffff', fontWeight: '800' },

  // Sitio Sub-section
  sitioSubSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sitioLabel: { fontSize: 11, fontWeight: '800', color: '#334155' },
  sitioSubLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  sitioModeToggle: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: 2, borderRadius: 8 },
  sitioToggleBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  sitioToggleBtnActive: { backgroundColor: '#d97706' },
  sitioToggleBtnText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  sitioToggleBtnTextActive: { color: '#ffffff' },

  specificSitioBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  availableSitioTitle: { fontSize: 10, fontWeight: '800', color: '#92400e', textTransform: 'uppercase', marginBottom: 4 },
  sitioChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sitioSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sitioSelectChipActive: { backgroundColor: '#d97706', borderColor: '#b45309' },
  sitioSelectChipText: { fontSize: 11, fontWeight: '700', color: '#78350f' },
  sitioSelectChipTextActive: { color: '#ffffff' },
  sitioCountBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 4, borderRadius: 4 },
  sitioCountText: { fontSize: 9, fontWeight: '800', color: '#92400e' },

  customSitioInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 34,
    fontSize: 11.5,
    color: '#0f172a',
  },
  addSitioBtn: {
    backgroundColor: '#d97706',
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSitioBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  selectedSitiosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 8 },
  selectedSitioLabel: { fontSize: 10.5, fontWeight: '800', color: '#92400e' },
  selectedSitioTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedSitioTagText: { fontSize: 10.5, fontWeight: '700', color: '#78350f' },
  removeSitioText: { fontSize: 12, fontWeight: '900', color: '#b45309' },

  // Direct Target Banner (Green)
  directTargetBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  directTargetTitle: { fontSize: 12, fontWeight: '900', color: '#14532d' },
  directTargetSub: { fontSize: 11, color: '#166534', marginTop: 2, lineHeight: 15 },

  // Yellow Approval Box (Matches Web Screenshot)
  approvalYellowBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  approvalYellowTitle: { fontSize: 11.5, fontWeight: '900', color: '#92400e', letterSpacing: 0.3 },
  approvalYellowSub: { fontSize: 11, color: '#78350f', marginTop: 2, lineHeight: 16 },

  // Action Status Row
  actionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionStatusLabel: { fontSize: 11, fontWeight: '800', color: '#334155' },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  radioOptionText: { fontSize: 12, fontWeight: '700', color: '#1e293b' },

  // Modal Footer Buttons
  modalFooterRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  submitApprovalBtn: {
    flex: 2,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 2,
  },
  submitApprovalBtnText: { fontSize: 13.5, fontWeight: '900', color: '#ffffff' },

  // Template Picker Modal
  templateModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', padding: 16 },
  templateModalCard: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, elevation: 12 },
  templateModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  templateModalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  templateModalSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  presetGroupTitle: { fontSize: 11.5, fontWeight: '800', color: '#1e40af', marginBottom: 6, textTransform: 'uppercase' },
  presetItemCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  presetItemTitle: { fontSize: 12.5, fontWeight: '800', color: '#0f172a' },
  presetItemSub: { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 15 },
  presetMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  presetMetaText: { fontSize: 10.5, color: '#475569', fontWeight: '600' },
});

export default StaffAnnouncementsScreen;

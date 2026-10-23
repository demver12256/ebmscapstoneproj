import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Image,
  Linking,
} from 'react-native';
import { assistanceRequestApi, beneficiaryApi } from '../services/api';
import { API_URL } from '../config/api';

const FILES_BASE_URL = API_URL.replace(/\/api$/, '');

const ASSISTANCE_TYPES = [
  { value: 'Medical Assistance', label: 'Medical Assistance', icon: '🩺', color: '#2563eb' },
  { value: 'Medicines Assistance', label: 'Medicines Assistance', icon: '💊', color: '#0891b2' },
  { value: 'Hospital Assistance', label: 'Hospital Assistance', icon: '🏥', color: '#e11d48' },
  { value: 'Laboratory Assistance', label: 'Laboratory Assistance', icon: '🧪', color: '#0d9488' },
  { value: 'Educational Assistance', label: 'Educational Assistance', icon: '🎓', color: '#d97706' },
  { value: 'Financial Assistance', label: 'Financial Assistance', icon: '💰', color: '#059669' },
  { value: 'Burial Assistance', label: 'Burial Assistance', icon: '🖤', color: '#7c3aed' },
  { value: 'Other', label: 'Other', icon: '📋', color: '#475569' },
];

const STATUS_CONFIG = {
  Pending: { color: '#b45309', bg: '#fef3c7', border: '#fde68a', label: 'Pending', icon: '⏳' },
  'Under Review': { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe', label: 'Under Review', icon: '👁️' },
  Approved: { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0', label: 'Approved', icon: '✓' },
  Rejected: { color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', label: 'Rejected', icon: '✕' },
  Completed: { color: '#7e22ce', bg: '#f3e8ff', border: '#e9d5ff', label: 'Completed', icon: '✓' },
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const parseAttachments = (attData) => {
  if (!attData) return [];
  if (Array.isArray(attData)) return attData;
  if (typeof attData === 'string') {
    try {
      const parsed = JSON.parse(attData);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch (e) {
      return [{ name: 'Kalakip na Dokumento', url: attData }];
    }
  }
  return [];
};

const resolveDocUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${FILES_BASE_URL}/${url.replace(/^\/+/, '')}`;
};

const StaffAssistanceRequestsScreen = ({ onBack, onOpenDrawer, onNavigate, user, darkMode = false }) => {
  const isMswdo = ['mswdo_admin', 'mswdo_staff'].includes(user?.role);
  const defaultAgency = isMswdo ? 'MSWDO' : 'DSWD';

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, review: 0, approved: 0, rejected: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState(defaultAgency); // 'DSWD' | 'MSWDO' | 'all'
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Detail Modal
  const [selectedReq, setSelectedReq] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [processing, setProcessing] = useState(false);

  // RFID Claim Modal
  const [rfidModalOpen, setRfidModalOpen] = useState(false);
  const [rfidTargetReq, setRfidTargetReq] = useState(null);
  const [rfidInput, setRfidInput] = useState('');
  const [validIdChecked, setValidIdChecked] = useState(false);
  const [rfidProcessing, setRfidProcessing] = useState(false);
  const [rfidError, setRfidError] = useState('');

  // Create Request Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [bSearch, setBSearch] = useState('');
  const [bLoading, setBLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    beneficiary_id: '',
    selectedBeneficiary: null,
    agency: defaultAgency,
    assistance_type: 'Medical Assistance',
    priority: 'Normal',
    subject: '',
    description: '',
    amount_requested: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Load Data
  const loadRequests = useCallback(async () => {
    try {
      setError('');
      const params = {};
      if (agencyFilter !== 'all') {
        params.agency = agencyFilter;
      }
      const [res, statsRes] = await Promise.all([
        assistanceRequestApi.list(params),
        assistanceRequestApi.stats(params).catch(() => ({ data: { data: {} } })),
      ]);
      const list = res.data?.data || [];
      setRequests(list);

      // Compute stats
      const apiStats = statsRes.data?.data || {};
      const total = list.length;
      const pending = list.filter((r) => (r.status || '').toLowerCase() === 'pending').length;
      const review = list.filter((r) => ['under review', 'review'].includes((r.status || '').toLowerCase())).length;
      const approved = list.filter((r) => (r.status || '').toLowerCase() === 'approved').length;
      const rejected = list.filter((r) => (r.status || '').toLowerCase() === 'rejected').length;
      const completed = list.filter((r) => (r.status || '').toLowerCase() === 'completed').length;

      setStats({
        total: apiStats.total ?? total,
        pending: apiStats.pending ?? pending,
        review: apiStats.under_review ?? review,
        approved: apiStats.approved ?? approved,
        rejected: apiStats.rejected ?? rejected,
        completed: apiStats.completed ?? completed,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load assistance requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [agencyFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  // Open Request Detail
  const handleOpenReq = (item) => {
    setSelectedReq(item);
    setActionNotes(item.admin_notes || item.remarks || '');
    setApprovedAmount(
      item.approved_amount
        ? String(item.approved_amount)
        : item.amount_requested
        ? String(item.amount_requested)
        : ''
    );
  };

  // Status Action (Approve / Review / Reject / Complete)
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedReq) return;
    setProcessing(true);
    try {
      const payload = {
        status: newStatus,
        notes: actionNotes.trim() || undefined,
        reviewed_by: user?.first_name || 'Staff',
      };
      if (['Approved', 'Completed'].includes(newStatus) && approvedAmount) {
        payload.approved_amount = parseFloat(approvedAmount) || undefined;
      }
      await assistanceRequestApi.updateStatus(selectedReq.id, payload);
      Alert.alert('Status Updated', `Request marked as ${newStatus}.`);
      setSelectedReq(null);
      setActionNotes('');
      setApprovedAmount('');
      loadRequests();
    } catch (err) {
      Alert.alert('Update Failed', err?.response?.data?.message || err.message || 'Failed to update request.');
    } finally {
      setProcessing(false);
    }
  };

  // Open RFID Claim Modal
  const openRfidModal = (item) => {
    setRfidTargetReq(item);
    setRfidInput(item.Beneficiary?.rfid_card_id || '');
    setValidIdChecked(false);
    setRfidError('');
    setRfidModalOpen(true);
  };

  // Submit RFID Claim
  const handleClaimRfidSubmit = async () => {
    if (!validIdChecked) {
      setRfidError('Kailangan lagyan ng check ang kumpirmasyon na na-verify ang Valid ID ng benepisyaryo.');
      return;
    }
    if (!rfidInput.trim()) {
      setRfidError('Pakiusap ilagay o i-tap ang RFID card ng benepisyaryo.');
      return;
    }
    setRfidProcessing(true);
    setRfidError('');
    try {
      const res = await assistanceRequestApi.claimWithRfid({
        rfid_number: rfidInput.trim(),
        request_id: rfidTargetReq?.id,
        valid_id_verified: true,
      });
      if (res.data?.success) {
        Alert.alert('Claim Successful! 🎉', 'Matagumpay na nai-claim ang assistance request gamit ang RFID card.');
        setRfidModalOpen(false);
        setRfidTargetReq(null);
        setRfidInput('');
        loadRequests();
      }
    } catch (err) {
      setRfidError(err.response?.data?.message || err.message || 'Nabigong i-claim ang assistance request.');
    } finally {
      setRfidProcessing(false);
    }
  };

  // Open Create Request Modal
  const handleOpenCreateModal = async () => {
    setCreateModalOpen(true);
    setCreateForm({
      beneficiary_id: '',
      selectedBeneficiary: null,
      agency: defaultAgency,
      assistance_type: 'Medical Assistance',
      priority: 'Normal',
      subject: '',
      description: '',
      amount_requested: '',
    });
    setBSearch('');
    try {
      setBLoading(true);
      const res = await beneficiaryApi.list();
      setBeneficiaries(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load beneficiaries:', err);
    } finally {
      setBLoading(false);
    }
  };

  // Submit Create Request
  const handleCreateSubmit = async () => {
    if (!createForm.beneficiary_id) {
      Alert.alert('Required Field', 'Pakiusap pumili ng benepisyaryo mula sa listahan.');
      return;
    }
    if (!createForm.subject.trim()) {
      Alert.alert('Required Field', 'Pakiusap ilagay ang Subject ng tulong.');
      return;
    }
    setCreateSubmitting(true);
    try {
      const payload = {
        beneficiary_id: createForm.beneficiary_id,
        agency: createForm.agency,
        type: createForm.assistance_type,
        priority: createForm.priority,
        subject: createForm.subject.trim(),
        description: createForm.description.trim() || undefined,
        amount_requested: createForm.amount_requested ? parseFloat(createForm.amount_requested) : undefined,
      };
      await assistanceRequestApi.create(payload);
      Alert.alert('Tagumpay!', 'Nalikha na ang bagong assistance request para sa benepisyaryo.');
      setCreateModalOpen(false);
      loadRequests();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Hindi nailikha ang request.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Filtered Beneficiaries for Create Modal
  const filteredBeneficiaries = useMemo(() => {
    if (!bSearch.trim()) return beneficiaries.slice(0, 15);
    const q = bSearch.toLowerCase();
    return beneficiaries
      .filter((b) => {
        const full = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
        const code = (b.id_code || b.rfid_card_id || '').toLowerCase();
        const cat = (b.category || '').toLowerCase();
        return full.includes(q) || code.includes(q) || cat.includes(q);
      })
      .slice(0, 20);
  }, [beneficiaries, bSearch]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const b = r.Beneficiary || {};
      const applicant = `${b.first_name || ''} ${b.last_name || ''} ${r.applicant_name || ''}`.toLowerCase();
      const matchSearch =
        !q ||
        applicant.includes(q) ||
        (r.subject && r.subject.toLowerCase().includes(q)) ||
        (r.reference_number && r.reference_number.toLowerCase().includes(q)) ||
        (r.assistance_type && r.assistance_type.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q));

      const rStatus = (r.status || 'Pending').toLowerCase();
      const matchStatus =
        statusFilter === 'all' ||
        rStatus === statusFilter.toLowerCase() ||
        (statusFilter === 'review' && ['under review', 'review'].includes(rStatus));

      const rType = (r.type || r.assistance_type || '').toLowerCase();
      const matchType = typeFilter === 'all' || rType === typeFilter.toLowerCase();

      return matchSearch && matchStatus && matchType;
    });
  }, [requests, searchQuery, statusFilter, typeFilter]);

  const getTypeMeta = (type) => {
    const match = ASSISTANCE_TYPES.find((t) => t.value.toLowerCase() === (type || '').toLowerCase());
    return match || { icon: '🤝', label: type || 'General Aid', color: '#2563eb' };
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Assistance Requests</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              Review and manage beneficiary assistance requests directed to DSWD and Municipal offices.
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadRequests} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Bar (6 Metrics: TOTAL, PENDING, REVIEW, APPROVED, REJECTED, COMPLETED) */}
      <View style={styles.statsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <Text style={styles.statLabel}>TOTAL</Text>
            <Text style={[styles.statValue, darkMode && styles.darkText]}>{stats.total}</Text>
          </View>
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <Text style={[styles.statLabel, { color: '#d97706' }]}>PENDING</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
          </View>
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <Text style={[styles.statLabel, { color: '#2563eb' }]}>REVIEW</Text>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>{stats.review}</Text>
          </View>
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <Text style={[styles.statLabel, { color: '#16a34a' }]}>APPROVED</Text>
            <Text style={[styles.statValue, { color: '#16a34a' }]}>{stats.approved}</Text>
          </View>
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <Text style={[styles.statLabel, { color: '#dc2626' }]}>REJECTED</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.rejected}</Text>
          </View>
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <Text style={[styles.statLabel, { color: '#7c3aed' }]}>COMPLETED</Text>
            <Text style={[styles.statValue, { color: '#9333ea' }]}>{stats.completed}</Text>
          </View>
        </ScrollView>
      </View>

      {/* Search, Office, Status & Action Controls */}
      <View style={styles.controlSection}>
        {/* Search Input */}
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search beneficiary, subject..."
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

        {/* Office Toggle & New Request Button */}
        <View style={styles.actionRow}>
          {/* Office Toggle Button */}
          <TouchableOpacity
            style={styles.officeToggleBtn}
            onPress={() => {
              const next = agencyFilter === 'DSWD' ? 'MSWDO' : agencyFilter === 'MSWDO' ? 'all' : 'DSWD';
              setAgencyFilter(next);
            }}
          >
            <Text style={styles.officeToggleIcon}>🏢</Text>
            <Text style={styles.officeToggleText}>
              Office: {agencyFilter === 'DSWD' ? 'DSWD National Aid' : agencyFilter === 'MSWDO' ? 'MSWDO Municipal' : 'All Offices'}
            </Text>
            <Text style={styles.officeToggleArrow}>▼</Text>
          </TouchableOpacity>

          {/* New Assistance Request Button */}
          <TouchableOpacity style={styles.newRequestBtn} onPress={handleOpenCreateModal}>
            <Text style={styles.newRequestBtnIcon}>＋</Text>
            <Text style={styles.newRequestBtnText}>New Request</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips (Status & Type) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll}>
          {/* Status Filters */}
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'pending', label: 'Pending' },
            { id: 'under review', label: 'Under Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'completed', label: 'Completed' },
          ].map((st) => {
            const isSel = statusFilter === st.id;
            return (
              <TouchableOpacity
                key={st.id}
                onPress={() => setStatusFilter(st.id)}
                style={[styles.chip, isSel && styles.chipActive]}
              >
                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{st.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll2}>
          {/* Type Filters */}
          <TouchableOpacity
            onPress={() => setTypeFilter('all')}
            style={[styles.typeChip, typeFilter === 'all' && styles.typeChipActive]}
          >
            <Text style={[styles.typeChipText, typeFilter === 'all' && styles.typeChipTextActive]}>All Types</Text>
          </TouchableOpacity>
          {ASSISTANCE_TYPES.map((t) => {
            const isSel = typeFilter.toLowerCase() === t.value.toLowerCase();
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => setTypeFilter(isSel ? 'all' : t.value)}
                style={[styles.typeChip, isSel && styles.typeChipActive]}
              >
                <Text style={styles.typeChipIcon}>{t.icon}</Text>
                <Text style={[styles.typeChipText, isSel && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Requests List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadRequests} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🤲</Text>
              <Text style={styles.emptyTitle}>No Assistance Requests</Text>
              <Text style={styles.emptySub}>No requests match the selected criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const b = item.Beneficiary || {};
            const applicantName = `${b.first_name || ''} ${b.last_name || ''}`.trim() || item.applicant_name || 'Citizen Applicant';
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;
            const typeMeta = getTypeMeta(item.type || item.assistance_type);
            const isMswdoReq = (item.agency || '').toUpperCase() === 'MSWDO';
            const isClaimed = !!item.claimed_at;
            const canClaim = !isClaimed && ['Approved', 'Completed'].includes(item.status);

            return (
              <View style={[styles.reqCard, darkMode && styles.darkCard]}>
                {/* Top Row: ID & Date + Target Office Pill */}
                <View style={styles.cardTopRow}>
                  <View style={styles.idDateBox}>
                    <Text style={styles.reqIdText}>REQ-#{item.id}</Text>
                    <Text style={styles.dateSubText}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View
                    style={[
                      styles.agencyPill,
                      isMswdoReq ? styles.agencyPillMswdo : styles.agencyPillDswd,
                    ]}
                  >
                    <Text
                      style={[
                        styles.agencyPillText,
                        isMswdoReq ? styles.agencyPillTextMswdo : styles.agencyPillTextDswd,
                      ]}
                    >
                      {isMswdoReq ? '🏢 MSWDO' : '🏛️ DSWD'}
                    </Text>
                  </View>
                </View>

                {/* Beneficiary Info */}
                <View style={styles.beneficiarySection}>
                  <Text style={[styles.beneficiaryName, darkMode && styles.darkText]} numberOfLines={1}>
                    {applicantName}
                  </Text>
                  <View style={styles.beneficiaryTagsRow}>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>{b.category || 'Resident Beneficiary'}</Text>
                    </View>
                    <Text style={styles.barangayText}>
                      📍 {b.Barangay?.barangay_name || b.barangay_name || b.barangay || 'Bongabong'}
                    </Text>
                  </View>
                </View>

                {/* Assistance Type Pill */}
                <View style={styles.typePillRow}>
                  <Text style={styles.typeIcon}>{typeMeta.icon}</Text>
                  <Text style={styles.typeLabel}>{typeMeta.label}</Text>
                </View>

                {/* Subject & Details */}
                <View style={styles.subjectDetailsBox}>
                  <Text style={[styles.subjectText, darkMode && styles.darkText]} numberOfLines={1}>
                    {item.subject || item.assistance_type || 'Assistance Request'}
                  </Text>
                  {item.description ? (
                    <Text style={[styles.descText, darkMode && styles.darkSub]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                {/* Priority & Status Row */}
                <View style={styles.metaBadgeRow}>
                  <View
                    style={[
                      styles.priorityBadge,
                      item.priority === 'Urgent'
                        ? styles.priorityUrgent
                        : item.priority === 'High'
                        ? styles.priorityHigh
                        : styles.priorityNormal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        item.priority === 'Urgent'
                          ? styles.priorityTextUrgent
                          : item.priority === 'High'
                          ? styles.priorityTextHigh
                          : styles.priorityTextNormal,
                      ]}
                    >
                      {item.priority || 'Normal'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: statusConfig.color }]}>
                      {statusConfig.icon} {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => handleOpenReq(item)}
                  >
                    <Text style={styles.viewBtnText}>View Details</Text>
                  </TouchableOpacity>

                  {isClaimed ? (
                    <View style={styles.claimedBadge}>
                      <Text style={styles.claimedBadgeText}>✓ Claimed</Text>
                    </View>
                  ) : canClaim ? (
                    <TouchableOpacity
                      style={styles.claimRfidBtn}
                      onPress={() => openRfidModal(item)}
                    >
                      <Text style={styles.claimRfidBtnText}>📱 Claim RFID</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* NEW ASSISTANCE REQUEST MODAL */}
      {/* ========================================================================= */}
      <Modal visible={createModalOpen} transparent animationType="slide" onRequestClose={() => setCreateModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.createModalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>+ New Assistance Request</Text>
                <Text style={styles.modalSub}>Mag-sumite ng tulong sa DSWD o MSWDO para sa residente.</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.createModalScroll}>
              {/* Step 1: Select Beneficiary */}
              <Text style={[styles.fieldLabel, darkMode && styles.darkText]}>Pumili ng Benepisyaryo *</Text>
              <View style={[styles.searchBox, darkMode && styles.darkSearchBox, { marginBottom: 8 }]}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={[styles.searchInput, darkMode && styles.darkText]}
                  placeholder="I-search ang pangalan o ID code..."
                  placeholderTextColor="#94a3b8"
                  value={bSearch}
                  onChangeText={setBSearch}
                />
              </View>

              {createForm.selectedBeneficiary && (
                <View style={styles.selectedBeneficiaryCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedBName}>
                      👤 {createForm.selectedBeneficiary.first_name} {createForm.selectedBeneficiary.last_name}
                    </Text>
                    <Text style={styles.selectedBSub}>
                      {createForm.selectedBeneficiary.category || 'Resident'} • {createForm.selectedBeneficiary.id_code || createForm.selectedBeneficiary.rfid_card_id || 'ID Verified'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setCreateForm((prev) => ({ ...prev, beneficiary_id: '', selectedBeneficiary: null }))}
                  >
                    <Text style={styles.clearSelectedB}>✕ Baguhin</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!createForm.selectedBeneficiary && (
                <View style={styles.beneficiaryPickerList}>
                  {bLoading ? (
                    <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 12 }} />
                  ) : filteredBeneficiaries.length === 0 ? (
                    <Text style={styles.noBText}>Walang natagpuang benepisyaryo.</Text>
                  ) : (
                    filteredBeneficiaries.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={styles.beneficiaryPickerItem}
                        onPress={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            beneficiary_id: b.id,
                            selectedBeneficiary: b,
                          }))
                        }
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pickerItemName}>
                            {b.first_name} {b.last_name}
                          </Text>
                          <Text style={styles.pickerItemSub}>
                            {b.category || 'General'} • {b.id_code || b.rfid_card_id || 'ID N/A'}
                          </Text>
                        </View>
                        <Text style={styles.pickerItemSelect}>Piliin ›</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* Step 2: Target Office */}
              <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>Target Office / Ahensya *</Text>
              <View style={styles.agencySelectorRow}>
                <TouchableOpacity
                  style={[styles.agencySelectBtn, createForm.agency === 'DSWD' && styles.agencySelectBtnActive]}
                  onPress={() => setCreateForm((prev) => ({ ...prev, agency: 'DSWD' }))}
                >
                  <Text style={[styles.agencySelectBtnText, createForm.agency === 'DSWD' && styles.agencySelectBtnTextActive]}>
                    🏛️ DSWD National Aid
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.agencySelectBtn, createForm.agency === 'MSWDO' && styles.agencySelectBtnActiveMswdo]}
                  onPress={() => setCreateForm((prev) => ({ ...prev, agency: 'MSWDO' }))}
                >
                  <Text style={[styles.agencySelectBtnText, createForm.agency === 'MSWDO' && styles.agencySelectBtnTextActive]}>
                    🏢 MSWDO Municipal Aid
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Step 3: Assistance Type */}
              <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>Assistance Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeSelectorScroll}>
                {ASSISTANCE_TYPES.map((t) => {
                  const isSel = createForm.assistance_type === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.typeSelectChip, isSel && styles.typeSelectChipActive]}
                      onPress={() => setCreateForm((prev) => ({ ...prev, assistance_type: t.value }))}
                    >
                      <Text style={styles.typeSelectChipIcon}>{t.icon}</Text>
                      <Text style={[styles.typeSelectChipText, isSel && styles.typeSelectChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Step 4: Priority */}
              <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>Priority Level *</Text>
              <View style={styles.prioritySelectorRow}>
                {['Normal', 'High', 'Urgent'].map((p) => {
                  const isSel = createForm.priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.prioritySelectBtn, isSel && styles.prioritySelectBtnActive]}
                      onPress={() => setCreateForm((prev) => ({ ...prev, priority: p }))}
                    >
                      <Text style={[styles.prioritySelectBtnText, isSel && styles.prioritySelectBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Step 5: Subject & Description */}
              <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>Paksa / Subject *</Text>
              <TextInput
                style={[styles.inputBox, darkMode && styles.darkInput]}
                placeholder="Halimbawa: EDUCATIONAL ASSISTANCE PARA SA MATRICULA"
                placeholderTextColor="#94a3b8"
                value={createForm.subject}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, subject: text }))}
              />

              <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>Detalye / Pangangailangan</Text>
              <TextInput
                style={[styles.inputBox, styles.textArea, darkMode && styles.darkInput]}
                placeholder="Ilarawan ang kalagayan o tiyak na tulong na kailangan ng benepisyaryo..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={createForm.description}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, description: text }))}
              />

              {/* Step 6: Requested Amount */}
              <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>
                Halagang Hinihingi / Requested Amount (₱) (Optional)
              </Text>
              <TextInput
                style={[styles.inputBox, darkMode && styles.darkInput]}
                placeholder="Halimbawa: 5000"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={createForm.amount_requested}
                onChangeText={(text) => setCreateForm((prev) => ({ ...prev, amount_requested: text }))}
              />

              <TouchableOpacity
                style={styles.submitCreateBtn}
                onPress={handleCreateSubmit}
                disabled={createSubmitting}
              >
                {createSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitCreateBtnText}>✓ Isumite ang Assistance Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* RFID CLAIM MODAL */}
      {/* ========================================================================= */}
      <Modal visible={rfidModalOpen} transparent animationType="slide" onRequestClose={() => setRfidModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.rfidModalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>📱 Claim via RFID Card</Text>
                <Text style={styles.modalSub}>I-tap o i-type ang RFID card ng benepisyaryo upang ma-claim ang tulong.</Text>
              </View>
              <TouchableOpacity onPress={() => setRfidModalOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {rfidTargetReq && (
              <View style={styles.rfidTargetInfoCard}>
                <Text style={styles.rfidTargetReqId}>REQ-#{rfidTargetReq.id} • {rfidTargetReq.type || rfidTargetReq.assistance_type}</Text>
                <Text style={styles.rfidTargetName}>
                  👤 {rfidTargetReq.Beneficiary?.first_name} {rfidTargetReq.Beneficiary?.last_name}
                </Text>
                <Text style={styles.rfidTargetAmount}>
                  Halagang Ipamamahagi: {formatMoney(rfidTargetReq.approved_amount || rfidTargetReq.amount_requested)}
                </Text>
              </View>
            )}

            {rfidError ? (
              <View style={styles.rfidErrorCard}>
                <Text style={styles.rfidErrorText}>⚠️ {rfidError}</Text>
              </View>
            ) : null}

            {/* Verification Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setValidIdChecked(!validIdChecked)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxBox, validIdChecked && styles.checkboxBoxChecked]}>
                {validIdChecked && <Text style={styles.checkIcon}>✓</Text>}
              </View>
              <Text style={[styles.checkboxLabel, darkMode && styles.darkText]}>
                Na-check at na-beripika ko ang Valid ID / ID Pass ng benepisyaryo.
              </Text>
            </TouchableOpacity>

            {/* RFID Input */}
            <Text style={[styles.fieldLabel, darkMode && styles.darkText, { marginTop: 14 }]}>
              RFID Card UID / Card Number:
            </Text>
            <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
              <Text style={styles.searchIcon}>📶</Text>
              <TextInput
                style={[styles.searchInput, darkMode && styles.darkText]}
                placeholder="I-tap ang RFID card o i-type dito..."
                placeholderTextColor="#94a3b8"
                value={rfidInput}
                onChangeText={setRfidInput}
              />
            </View>

            <TouchableOpacity
              style={[styles.claimSubmitBtn, (!validIdChecked || !rfidInput) && styles.claimSubmitBtnDisabled]}
              onPress={handleClaimRfidSubmit}
              disabled={rfidProcessing || !validIdChecked || !rfidInput}
            >
              {rfidProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.claimSubmitBtnText}>Kumpirmahin ang Claim gamit ang RFID</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* REVIEW & DETAIL MODAL */}
      {/* ========================================================================= */}
      <Modal visible={!!selectedReq} transparent animationType="slide" onRequestClose={() => setSelectedReq(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>
                  {selectedReq?.subject || selectedReq?.assistance_type}
                </Text>
                <Text style={styles.refText}>REF: {selectedReq?.reference_number || `REQ-${selectedReq?.id}`}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedReq(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Applicant</Text>
                <Text style={styles.infoVal}>
                  {selectedReq?.Beneficiary?.first_name} {selectedReq?.Beneficiary?.last_name}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoVal}>{selectedReq?.Beneficiary?.category || 'General'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Assistance Type</Text>
                <Text style={styles.infoVal}>{selectedReq?.type || selectedReq?.assistance_type || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Target Office</Text>
                <Text style={styles.infoVal}>{selectedReq?.agency || 'DSWD'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Amount Requested</Text>
                <Text style={[styles.infoVal, { color: '#16a34a', fontWeight: '800' }]}>
                  {formatMoney(selectedReq?.amount_requested || selectedReq?.total_amount_requested)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Status</Text>
                <Text style={styles.infoVal}>{(selectedReq?.status || 'Pending').toUpperCase()}</Text>
              </View>

              {selectedReq?.description ? (
                <View style={styles.descBox}>
                  <Text style={styles.descTitle}>Applicant Statement / Pangangailangan</Text>
                  <Text style={[styles.descText, darkMode && styles.darkSub]}>{selectedReq.description}</Text>
                </View>
              ) : null}

              {/* Attachments Preview */}
              {parseAttachments(selectedReq?.attachment_url).length > 0 && (
                <View style={styles.attachmentsSection}>
                  <Text style={[styles.attachmentsTitle, darkMode && styles.darkText]}>
                    📎 Kalakip na Dokumento ({parseAttachments(selectedReq?.attachment_url).length})
                  </Text>
                  {parseAttachments(selectedReq?.attachment_url).map((att, idx) => (
                    <View key={idx} style={[styles.attachmentCard, darkMode && styles.darkCard]}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.attName, darkMode && styles.darkText]} numberOfLines={1}>
                          {att.label || att.requirementName || att.name || `Document #${idx + 1}`}
                        </Text>
                        <Text style={styles.attFileSub} numberOfLines={1}>
                          {att.name || att.url}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.attViewBtn}
                        onPress={() => setPreviewAttachment({ ...att, url: resolveDocUrl(att.url) })}
                      >
                        <Text style={styles.attViewBtnText}>👁️ Tingnan</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Status Action Buttons */}
              <View style={styles.actionSection}>
                <Text style={[styles.actionSectionTitle, darkMode && styles.darkText]}>Update Request Status</Text>

                <Text style={[styles.inputSubLabel, darkMode && styles.darkSub]}>
                  Halaga ng Ayuda / Cash Amount Granted (₱):
                </Text>
                <TextInput
                  style={[styles.notesInput, darkMode && styles.darkInput]}
                  placeholder="Halimbawa: 5000 (Halaga na ibibigay)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={approvedAmount}
                  onChangeText={setApprovedAmount}
                />

                <Text style={[styles.inputSubLabel, darkMode && styles.darkSub]}>
                  Review Notes / Puna ng Staff (Optional):
                </Text>
                <TextInput
                  style={[styles.notesInput, darkMode && styles.darkInput]}
                  placeholder="Review notes / remarks..."
                  placeholderTextColor="#94a3b8"
                  value={actionNotes}
                  onChangeText={setActionNotes}
                />

                <View style={styles.btnGrid}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#16a34a' }]}
                    onPress={() => handleUpdateStatus('Approved')}
                    disabled={processing}
                  >
                    <Text style={styles.actionBtnText}>✓ Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
                    onPress={() => handleUpdateStatus('Under Review')}
                    disabled={processing}
                  >
                    <Text style={styles.actionBtnText}>👁 Review</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleUpdateStatus('Rejected')}
                    disabled={processing}
                  >
                    <Text style={styles.actionBtnText}>✕ Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}
                    onPress={() => handleUpdateStatus('Completed')}
                    disabled={processing}
                  >
                    <Text style={styles.actionBtnText}>🎉 Complete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Attachment Preview Modal */}
      <Modal visible={!!previewAttachment} transparent animationType="fade" onRequestClose={() => setPreviewAttachment(null)}>
        <View style={styles.previewOverlay}>
          <View style={[styles.previewContent, darkMode && styles.darkModalContent]}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.previewTitle, darkMode && styles.darkText]} numberOfLines={1}>
                  {previewAttachment?.label || previewAttachment?.name || 'Dokumento'}
                </Text>
                <Text style={styles.previewSub} numberOfLines={1}>{previewAttachment?.name || previewAttachment?.url}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewAttachment(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewBody}>
              {previewAttachment?.url && previewAttachment.url.toLowerCase().endsWith('.pdf') ? (
                <View style={styles.pdfBox}>
                  <Text style={{ fontSize: 36, marginBottom: 12 }}>📄</Text>
                  <Text style={[styles.pdfTitle, darkMode && styles.darkText]}>PDF Document</Text>
                  <Text style={styles.pdfSub}>Maaari mong buksan o i-download ang PDF file sa iyong device.</Text>
                  <TouchableOpacity
                    style={styles.openPdfBtn}
                    onPress={() => Linking.openURL(previewAttachment.url).catch(() => {})}
                  >
                    <Text style={styles.openPdfBtnText}>Buksan ang PDF ↗</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Image
                  source={{ uri: previewAttachment?.url }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </View>
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
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  darkHeader: { backgroundColor: '#1e293b', borderBottomColor: '#334155' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
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
  darkText: { color: '#f8fafc' },
  darkSub: { color: '#94a3b8' },

  // Stats
  statsContainer: { backgroundColor: '#f8fafc', paddingVertical: 10 },
  statsScroll: { paddingHorizontal: 16, gap: 10 },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 90,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  darkStatCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  statLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },

  // Controls
  controlSection: { paddingHorizontal: 16, marginBottom: 8 },
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
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b', padding: 0 },
  clearSearch: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 4 },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  officeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  officeToggleIcon: { fontSize: 14, marginRight: 6 },
  officeToggleText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8', flex: 1 },
  officeToggleArrow: { fontSize: 10, color: '#1d4ed8' },

  newRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  newRequestBtnIcon: { fontSize: 15, fontWeight: '900', color: '#ffffff', marginRight: 4 },
  newRequestBtnText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },

  filterChipsScroll: { flexDirection: 'row', gap: 6, marginTop: 10 },
  filterChipsScroll2: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 11.5, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },

  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipActive: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  typeChipIcon: { fontSize: 12, marginRight: 4 },
  typeChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#1d4ed8', fontWeight: '700' },

  // List & Cards
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  reqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idDateBox: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  reqIdText: { fontSize: 14, fontWeight: '900', fontFamily: 'monospace', color: '#0f172a' },
  dateSubText: { fontSize: 11, color: '#94a3b8' },

  agencyPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  agencyPillDswd: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  agencyPillMswdo: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  agencyPillText: { fontSize: 10, fontWeight: '800' },
  agencyPillTextDswd: { color: '#1d4ed8' },
  agencyPillTextMswdo: { color: '#047857' },

  beneficiarySection: { marginTop: 10 },
  beneficiaryName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  beneficiaryTagsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  categoryPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillText: { fontSize: 10.5, fontWeight: '700', color: '#475569' },
  barangayText: { fontSize: 11, color: '#64748b' },

  typePillRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  typeIcon: { fontSize: 13 },
  typeLabel: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },

  subjectDetailsBox: { marginTop: 6 },
  subjectText: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  descText: { fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 16 },

  metaBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  priorityNormal: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  priorityHigh: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  priorityUrgent: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  priorityText: { fontSize: 10, fontWeight: '800' },
  priorityTextNormal: { color: '#475569' },
  priorityTextHigh: { color: '#b45309' },
  priorityTextUrgent: { color: '#b91c1c' },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },

  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  viewBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },

  claimedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  claimedBadgeText: { fontSize: 11, fontWeight: '800', color: '#15803d' },

  claimRfidBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimRfidBtnText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  createModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
  },
  rfidModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  darkModalContent: { backgroundColor: '#1e293b' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  modalSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  refText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: '700' },
  modalScroll: { paddingBottom: 24 },
  createModalScroll: { paddingBottom: 30 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  inputBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  darkInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },

  // Beneficiary Picker
  selectedBeneficiaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 8,
  },
  selectedBName: { fontSize: 13, fontWeight: '800', color: '#1d4ed8' },
  selectedBSub: { fontSize: 10.5, color: '#475569', marginTop: 2 },
  clearSelectedB: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  beneficiaryPickerList: {
    maxHeight: 160,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  beneficiaryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerItemName: { fontSize: 12.5, fontWeight: '700', color: '#1e293b' },
  pickerItemSub: { fontSize: 10.5, color: '#64748b' },
  pickerItemSelect: { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  noBText: { textAlign: 'center', padding: 12, fontSize: 11.5, color: '#94a3b8' },

  // Agency Select
  agencySelectorRow: { flexDirection: 'row', gap: 8 },
  agencySelectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  agencySelectBtnActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  agencySelectBtnActiveMswdo: { backgroundColor: '#d1fae5', borderColor: '#059669' },
  agencySelectBtnText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  agencySelectBtnTextActive: { color: '#0f172a', fontWeight: '800' },

  // Type Select
  typeSelectorScroll: { flexDirection: 'row', gap: 6 },
  typeSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeSelectChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeSelectChipIcon: { fontSize: 12, marginRight: 4 },
  typeSelectChipText: { fontSize: 11.5, fontWeight: '600', color: '#475569' },
  typeSelectChipTextActive: { color: '#ffffff', fontWeight: '700' },

  // Priority Select
  prioritySelectorRow: { flexDirection: 'row', gap: 8 },
  prioritySelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  prioritySelectBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  prioritySelectBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  prioritySelectBtnTextActive: { color: '#ffffff' },

  submitCreateBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitCreateBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  // RFID Claim Modal Details
  rfidTargetInfoCard: {
    backgroundColor: '#f5f3ff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    marginBottom: 12,
  },
  rfidTargetReqId: { fontSize: 11, fontWeight: '800', color: '#7c3aed' },
  rfidTargetName: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  rfidTargetAmount: { fontSize: 12, fontWeight: '700', color: '#059669', marginTop: 4 },

  rfidErrorCard: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    marginBottom: 12,
  },
  rfidErrorText: { fontSize: 12, color: '#b91c1c', fontWeight: '700' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxBoxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkIcon: { color: '#ffffff', fontWeight: '900', fontSize: 14 },
  checkboxLabel: { flex: 1, fontSize: 12, color: '#334155', fontWeight: '600' },

  claimSubmitBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  claimSubmitBtnDisabled: { opacity: 0.5 },
  claimSubmitBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13.5 },

  // Details
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: { fontSize: 12.5, color: '#64748b', fontWeight: '600' },
  infoVal: { fontSize: 13, color: '#1e293b', fontWeight: '600' },
  descBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 12 },
  descTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  actionSection: { marginTop: 18 },
  actionSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 12,
  },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flex: 1, minWidth: '45%', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  inputSubLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 5 },

  // Attachments
  attachmentsSection: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  attachmentsTitle: { fontSize: 12.5, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  attName: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  attFileSub: { fontSize: 10, color: '#64748b', marginTop: 1 },
  attViewBtn: { backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  attViewBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },

  // Preview Modal
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16 },
  previewContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  previewTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  previewSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  previewBody: { padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  previewImage: { width: '100%', height: 380, borderRadius: 10 },
  pdfBox: { alignItems: 'center', padding: 24 },
  pdfTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  pdfSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  openPdfBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  openPdfBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  errorBox: { padding: 30, alignItems: 'center' },
  errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  emptySub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
});

export default StaffAssistanceRequestsScreen;

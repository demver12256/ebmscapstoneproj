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
} from 'react-native';
import { beneficiaryApi, barangayApi } from '../services/api';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getCategoryColor = (category) => {
  if (!category) return '#64748b';
  const c = category.toLowerCase();
  if (c.includes('4ps') || c.includes('pantawid')) return '#7c3aed';
  if (c.includes('senior')) return '#0891b2';
  if (c.includes('pwd') || c.includes('disability')) return '#ea580c';
  return '#64748b';
};

const getCategoryShort = (category) => {
  if (!category) return 'N/A';
  const c = category.toLowerCase();
  if (c.includes('4ps') || c.includes('pantawid')) return '4Ps';
  if (c.includes('senior')) return 'Senior';
  if (c.includes('pwd') || c.includes('disability')) return 'PWD';
  return category.length > 12 ? category.substring(0, 12) + '…' : category;
};

const getIPColor = (ip) => {
  if (ip === 'IP') return '#16a34a';
  return '#94a3b8';
};

const BeneficiaryListScreen = ({ onBack, user }) => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangayId, setSelectedBarangayId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [detailTab, setDetailTab] = useState('profile');
  const [attendanceData, setAttendanceData] = useState(null);
  const [distributionsData, setDistributionsData] = useState(null);
  const [enrollmentsData, setEnrollmentsData] = useState(null);
  const [tabLoading, setTabLoading] = useState(false);

  const CATEGORIES = [
    '4Ps Household Beneficiary',
    'Senior Citizens (Social Pension)',
    'Persons with Disabilities (PWD)',
  ];

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [benefRes, brgyRes] = await Promise.all([
        beneficiaryApi.list(),
        barangayApi.list(),
      ]);
      setBeneficiaries(benefRes.data?.data || []);
      setBarangays(brgyRes.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load beneficiaries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    if (selectedBarangayId && String(b.barangay_id) !== selectedBarangayId) return false;
    if (selectedCategory && b.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.toLowerCase();
      const brgy = b.Barangay?.name?.toLowerCase() || '';
      const idCode = (b.beneficiary_id_code || '').toLowerCase();
      const household = (b.household_id_number || '').toLowerCase();
      return fullName.includes(q) || brgy.includes(q) || idCode.includes(q) || household.includes(q);
    }
    return true;
  });

  const loadTabData = async (beneficiary, tab) => {
    setTabLoading(true);
    try {
      if (tab === 'attendance' && !attendanceData) {
        const res = await beneficiaryApi.getAttendance(beneficiary.id);
        setAttendanceData(res.data?.data || []);
      } else if (tab === 'distributions' && !distributionsData) {
        const res = await beneficiaryApi.getDistributions(beneficiary.id);
        setDistributionsData(res.data?.data || []);
      } else if (tab === 'programs' && !enrollmentsData) {
        const res = await beneficiaryApi.getEnrollments(beneficiary.id);
        setEnrollmentsData(res.data?.data || []);
      }
    } catch (err) {
      console.warn('Tab data load error:', err?.message);
    } finally {
      setTabLoading(false);
    }
  };

  const openDetail = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setDetailTab('profile');
    setAttendanceData(null);
    setDistributionsData(null);
    setEnrollmentsData(null);
  };

  const switchTab = (tab) => {
    setDetailTab(tab);
    if (selectedBeneficiary) {
      loadTabData(selectedBeneficiary, tab);
    }
  };

  const renderBeneficiaryCard = ({ item }) => {
    const fullName = `${item.last_name || ''}, ${item.first_name || ''} ${item.middle_name || ''}`.trim();
    const barangayName = item.Barangay?.name || '—';
    const catColor = getCategoryColor(item.category);
    const catShort = getCategoryShort(item.category);

    return (
      <TouchableOpacity style={s.card} onPress={() => openDetail(item)} activeOpacity={0.7}>
        <View style={s.cardHeader}>
          <View style={[s.avatar, { backgroundColor: catColor + '20' }]}>
            <Text style={[s.avatarText, { color: catColor }]}>
              {(item.first_name?.[0] || '').toUpperCase()}{(item.last_name?.[0] || '').toUpperCase()}
            </Text>
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardName} numberOfLines={1}>{fullName}</Text>
            <Text style={s.cardMeta}>📍 {barangayName}</Text>
          </View>
          <View style={[s.categoryBadge, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
            <Text style={[s.categoryText, { color: catColor }]}>{catShort}</Text>
          </View>
        </View>
        <View style={s.cardFooter}>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>ID Code</Text>
            <Text style={s.footerValue}>{item.beneficiary_id_code || '—'}</Text>
          </View>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>IP Class</Text>
            <Text style={[s.footerValue, { color: getIPColor(item.ip_classification) }]}>
              {item.ip_classification || 'Non-IP'}
            </Text>
          </View>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>Sex</Text>
            <Text style={s.footerValue}>{item.sex || '—'}</Text>
          </View>
          <Text style={s.viewArrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProfileTab = () => {
    const b = selectedBeneficiary;
    if (!b) return null;
    const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.trim();

    return (
      <ScrollView style={s.tabContent}>
        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Personal Information</Text>
          {[
            ['Full Name', fullName],
            ['Sex', b.sex],
            ['Birthdate', formatDate(b.birthdate)],
            ['Civil Status', b.civil_status],
            ['Contact', b.contact_number],
            ['Address', b.address],
            ['Barangay', b.Barangay?.name || '—'],
            ['Sitio', b.sitio || '—'],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>

        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Beneficiary Details</Text>
          {[
            ['Category', b.category],
            ['IP Classification', b.ip_classification],
            ['Beneficiary ID', b.beneficiary_id_code],
            ['Household ID', b.household_id_number],
            ['National ID', b.national_id_number],
            ['PSA Birth Cert', b.psa_birth_cert_number],
            ['RFID Number', b.RFID_number],
            ['Status', b.status],
            ['Approval Date', formatDate(b.approval_date)],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>

        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Payout Information</Text>
          {[
            ['Preference', b.payout_preference === 'digital' ? '💳 Digital' : '💵 Cash OTC'],
            ['Provider', b.payout_provider],
            ['Account No.', b.payout_account_number ? '••••' + b.payout_account_number.slice(-4) : '—'],
            ['Account Name', b.payout_account_name],
            ['Verification', b.account_verification_status],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderAttendanceTab = () => {
    if (tabLoading) return <ActivityIndicator size="large" color="#2563eb" style={s.loader} />;
    const data = Array.isArray(attendanceData) ? attendanceData : [];
    if (data.length === 0) return <Text style={s.emptyTab}>No attendance records found.</Text>;

    return (
      <ScrollView style={s.tabContent}>
        {data.map((record, i) => (
          <View key={record.id || i} style={s.recordCard}>
            <Text style={s.recordTitle}>{record.event_name || record.DistributionEvent?.event_name || 'Event'}</Text>
            <Text style={s.recordMeta}>📅 {formatDate(record.scanned_at || record.created_at)}</Text>
            {record.scan_type && <Text style={s.recordMeta}>🔖 {record.scan_type}</Text>}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderDistributionsTab = () => {
    if (tabLoading) return <ActivityIndicator size="large" color="#2563eb" style={s.loader} />;
    const data = Array.isArray(distributionsData) ? distributionsData : [];
    if (data.length === 0) return <Text style={s.emptyTab}>No distribution records found.</Text>;

    return (
      <ScrollView style={s.tabContent}>
        {data.map((txn, i) => (
          <View key={txn.id || i} style={s.recordCard}>
            <View style={s.recordRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.recordTitle}>{txn.event_name || txn.DistributionEvent?.event_name || 'Distribution'}</Text>
                <Text style={s.recordMeta}>📅 {formatDate(txn.released_at || txn.created_at)}</Text>
              </View>
              <Text style={s.amountBadge}>{formatMoney(Number(txn.amount || 0) + Number(txn.retro_amount || 0))}</Text>
            </View>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: txn.status === 'released' ? '#16a34a' : txn.status === 'pending' ? '#eab308' : '#94a3b8' }]} />
              <Text style={s.recordMeta}>{(txn.status || 'pending').toUpperCase()}</Text>
              {txn.disbursement_type && <Text style={s.recordMeta}> • {txn.disbursement_type}</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderProgramsTab = () => {
    if (tabLoading) return <ActivityIndicator size="large" color="#2563eb" style={s.loader} />;
    const data = Array.isArray(enrollmentsData) ? enrollmentsData : [];
    if (data.length === 0) return <Text style={s.emptyTab}>No program enrollments found.</Text>;

    return (
      <ScrollView style={s.tabContent}>
        {data.map((enrollment, i) => (
          <View key={enrollment.id || i} style={s.recordCard}>
            <Text style={s.recordTitle}>{enrollment.BenefitProgram?.name || enrollment.program_name || 'Program'}</Text>
            <Text style={s.recordMeta}>📅 Enrolled: {formatDate(enrollment.enrolled_at || enrollment.created_at)}</Text>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: enrollment.status === 'active' ? '#16a34a' : '#eab308' }]} />
              <Text style={s.recordMeta}>{(enrollment.status || 'active').toUpperCase()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  // ─── Main Render ───
  return (
    <SafeAreaView style={s.page}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Beneficiaries</Text>
          <Text style={s.headerCount}>{filteredBeneficiaries.length} records</Text>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={s.filterBtn}>
          <Text style={s.filterIcon}>{showFilters ? '✕' : '⚙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, barangay, or ID..."
          placeholderTextColor="#64748b"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={s.clearSearch}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={s.filterPanel}>
          <Text style={s.filterTitle}>Filter by Barangay</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
            <TouchableOpacity
              style={[s.filterChip, !selectedBarangayId && s.filterChipActive]}
              onPress={() => setSelectedBarangayId('')}
            >
              <Text style={[s.filterChipText, !selectedBarangayId && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {barangays.map((brgy) => (
              <TouchableOpacity
                key={brgy.id}
                style={[s.filterChip, selectedBarangayId === String(brgy.id) && s.filterChipActive]}
                onPress={() => setSelectedBarangayId(selectedBarangayId === String(brgy.id) ? '' : String(brgy.id))}
              >
                <Text style={[s.filterChipText, selectedBarangayId === String(brgy.id) && s.filterChipTextActive]}>
                  {brgy.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.filterTitle, { marginTop: 10 }]}>Filter by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
            <TouchableOpacity
              style={[s.filterChip, !selectedCategory && s.filterChipActive]}
              onPress={() => setSelectedCategory('')}
            >
              <Text style={[s.filterChipText, !selectedCategory && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.filterChip, selectedCategory === cat && s.filterChipActive, { borderColor: getCategoryColor(cat) + '60' }]}
                onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
              >
                <Text style={[s.filterChipText, selectedCategory === cat && s.filterChipTextActive, selectedCategory === cat && { color: '#fff' }, selectedCategory === cat && { backgroundColor: getCategoryColor(cat) }]}>
                  {getCategoryShort(cat)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /><Text style={s.loadingText}>Loading beneficiaries...</Text></View>
      ) : error ? (
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredBeneficiaries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBeneficiaryCard}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<View style={s.centered}><Text style={s.emptyText}>No beneficiaries found matching your filters.</Text></View>}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedBeneficiary} animationType="slide" onRequestClose={() => setSelectedBeneficiary(null)}>
        <SafeAreaView style={s.modalPage}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedBeneficiary(null)} style={s.modalBackBtn}>
              <Text style={s.modalBackText}>← Close</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle} numberOfLines={1}>
              {selectedBeneficiary ? `${selectedBeneficiary.first_name} ${selectedBeneficiary.last_name}` : ''}
            </Text>
          </View>

          {selectedBeneficiary && (
            <View style={s.modalSummary}>
              <View style={[s.modalAvatar, { backgroundColor: getCategoryColor(selectedBeneficiary.category) + '20' }]}>
                <Text style={[s.modalAvatarText, { color: getCategoryColor(selectedBeneficiary.category) }]}>
                  {(selectedBeneficiary.first_name?.[0] || '').toUpperCase()}{(selectedBeneficiary.last_name?.[0] || '').toUpperCase()}
                </Text>
              </View>
              <View style={s.modalSummaryInfo}>
                <Text style={s.modalName}>{selectedBeneficiary.first_name} {selectedBeneficiary.last_name}</Text>
                <Text style={s.modalMeta}>📍 {selectedBeneficiary.Barangay?.name || '—'} • {selectedBeneficiary.category || 'N/A'}</Text>
                <View style={[s.approvedBadge]}>
                  <Text style={s.approvedText}>✓ APPROVED</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tabs */}
          <View style={s.tabBar}>
            {[
              ['profile', '👤 Profile'],
              ['attendance', '📋 Attendance'],
              ['distributions', '💰 Distributions'],
              ['programs', '📦 Programs'],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[s.tab, detailTab === key && s.tabActive]}
                onPress={() => switchTab(key)}
              >
                <Text style={[s.tabText, detailTab === key && s.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {detailTab === 'profile' && renderProfileTab()}
          {detailTab === 'attendance' && renderAttendanceTab()}
          {detailTab === 'distributions' && renderDistributionsTab()}
          {detailTab === 'programs' && renderProgramsTab()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { paddingRight: 12 },
  backText: { color: '#93c5fd', fontSize: 15, fontWeight: '600' },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  headerCount: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  filterBtn: { paddingLeft: 12, paddingVertical: 4 },
  filterIcon: { color: '#f8fafc', fontSize: 20 },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, height: 48, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  clearSearch: { color: '#94a3b8', fontSize: 18, paddingLeft: 8 },

  // Filters
  filterPanel: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, borderRadius: 12, padding: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  filterTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  filterScroll: { flexDirection: 'row', marginBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
  filterChipActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  filterChipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // List
  listContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  footerItem: { flex: 1 },
  footerLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  footerValue: { fontSize: 13, color: '#334155', fontWeight: '600', marginTop: 2 },
  viewArrow: { fontSize: 24, color: '#cbd5e1', fontWeight: '300' },

  // Centered states
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  loadingText: { color: '#64748b', marginTop: 12, fontSize: 14 },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },

  // Modal
  modalPage: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 14 },
  modalBackBtn: { paddingRight: 12 },
  modalBackText: { color: '#93c5fd', fontSize: 15, fontWeight: '600' },
  modalTitle: { flex: 1, color: '#f8fafc', fontSize: 17, fontWeight: '700' },

  // Modal Summary
  modalSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  modalAvatarText: { fontSize: 20, fontWeight: '700' },
  modalSummaryInfo: { flex: 1 },
  modalName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalMeta: { fontSize: 13, color: '#64748b', marginTop: 3 },
  approvedBadge: { backgroundColor: '#dcfce7', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  approvedText: { color: '#16a34a', fontSize: 11, fontWeight: '800' },

  // Tab Bar
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#2563eb' },

  // Tab Content
  tabContent: { flex: 1, padding: 16 },
  loader: { marginTop: 40 },
  emptyTab: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 40 },

  // Profile
  profileSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  profileSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  profileLabel: { width: 120, fontSize: 13, color: '#64748b', fontWeight: '600' },
  profileValue: { flex: 1, fontSize: 13, color: '#1e293b', fontWeight: '500' },

  // Records
  recordCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  recordTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  recordMeta: { fontSize: 12, color: '#64748b' },
  amountBadge: { fontSize: 15, fontWeight: '800', color: '#16a34a' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});

export default BeneficiaryListScreen;

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
} from 'react-native';
import { programApi } from '../services/api';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffProgramsScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [enrolledList, setEnrolledList] = useState([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const loadPrograms = useCallback(async () => {
    try {
      setError('');
      const res = await programApi.list();
      setPrograms(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load programs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPrograms();
  };

  const loadEnrolled = async (programId) => {
    try {
      setEnrolledLoading(true);
      const res = await programApi.getEnrolledBeneficiaries(programId);
      setEnrolledList(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load enrolled beneficiaries:', err);
      setEnrolledList([]);
    } finally {
      setEnrolledLoading(false);
    }
  };

  const handleOpenProgram = (prog) => {
    setSelectedProgram(prog);
    loadEnrolled(prog.id);
  };

  const handleAutoEnroll = async (programId) => {
    try {
      setEnrolling(true);
      const res = await programApi.autoEnrollBeneficiaries(programId);
      Alert.alert(
        'Auto-Enrollment Complete',
        res.data?.message || 'Eligible beneficiaries have been enrolled to this program.'
      );
      loadPrograms();
      loadEnrolled(programId);
    } catch (err) {
      Alert.alert('Auto-Enrollment Failed', err?.response?.data?.message || err.message || 'An error occurred.');
    } finally {
      setEnrolling(false);
    }
  };

  const filteredPrograms = programs.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q));

    const pStatus = (p.status || 'active').toLowerCase();
    const matchStatus = statusFilter === 'all' || pStatus === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const activeCount = programs.filter((p) => (p.status || 'active').toLowerCase() === 'active').length;
  const totalEnrolled = programs.reduce((sum, p) => sum + (p.enrolled_count || p.enrollment_count || 0), 0);

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
    if (s === 'completed') return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
    return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Benefit Programs</Text>
            <Text style={styles.headerSub}>Manage social welfare & assistance initiatives</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadPrograms} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#2563eb' }]}>
          <Text style={styles.statLabel}>Total Programs</Text>
          <Text style={[styles.statValue, { color: '#2563eb' }]}>{programs.length}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#16a34a' }]}>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{activeCount}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#7c3aed' }]}>
          <Text style={styles.statLabel}>Total Enrolled</Text>
          <Text style={[styles.statValue, { color: '#7c3aed' }]}>{totalEnrolled}</Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search programs or category..."
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
          {['all', 'active', 'completed', 'inactive'].map((st) => {
            const isSel = statusFilter === st;
            return (
              <TouchableOpacity
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[styles.chip, isSel && styles.chipActive]}
              >
                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Program List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading programs...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadPrograms} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPrograms}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Programs Found</Text>
              <Text style={styles.emptySub}>No programs matching your search criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusStyle = getStatusColor(item.status);
            const enrolled = item.enrolled_count || item.enrollment_count || 0;
            return (
              <TouchableOpacity
                style={[styles.progCard, darkMode && styles.darkCard]}
                onPress={() => handleOpenProgram(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.progName, darkMode && styles.darkText]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.code ? <Text style={styles.progCode}>{item.code}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                      {(item.status || 'Active').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.category ? (
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>🏷 {item.category}</Text>
                  </View>
                ) : null}

                {item.description ? (
                  <Text style={[styles.progDesc, darkMode && styles.darkSub]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Grant / Person</Text>
                    <Text style={styles.footerVal}>{formatMoney(item.payout_amount || item.budget_per_beneficiary || item.default_amount)}</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Enrolled</Text>
                    <Text style={[styles.footerVal, { color: '#2563eb' }]}>{enrolled} Pax</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Target</Text>
                    <Text style={styles.footerVal}>{item.target_beneficiaries || item.max_beneficiaries || 'Open'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Program Details Modal */}
      <Modal visible={!!selectedProgram} transparent animationType="slide" onRequestClose={() => setSelectedProgram(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>{selectedProgram?.name}</Text>
                <Text style={styles.progCode}>{selectedProgram?.code || 'PROGRAM DETAILS'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedProgram(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoVal}>{selectedProgram?.category || 'General Social Welfare'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoVal}>{(selectedProgram?.status || 'Active').toUpperCase()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Benefit Amount</Text>
                <Text style={[styles.infoVal, { color: '#16a34a', fontWeight: '800' }]}>
                  {formatMoney(selectedProgram?.payout_amount || selectedProgram?.budget_per_beneficiary || selectedProgram?.default_amount)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Budget</Text>
                <Text style={styles.infoVal}>{formatMoney(selectedProgram?.total_budget || 0)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoVal}>{formatDate(selectedProgram?.created_at)}</Text>
              </View>

              {selectedProgram?.description ? (
                <View style={styles.descBox}>
                  <Text style={styles.descTitle}>Description</Text>
                  <Text style={[styles.descText, darkMode && styles.darkSub]}>{selectedProgram.description}</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.autoEnrollBtn, enrolling && styles.btnDisabled]}
                  onPress={() => selectedProgram && handleAutoEnroll(selectedProgram.id)}
                  disabled={enrolling}
                >
                  {enrolling ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.autoEnrollBtnText}>⚡ Auto-Enroll Matching Beneficiaries</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Enrolled Beneficiaries List */}
              <View style={styles.enrolledHeader}>
                <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>
                  Enrolled Beneficiaries ({enrolledList.length})
                </Text>
              </View>

              {enrolledLoading ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 14 }} />
              ) : enrolledList.length === 0 ? (
                <Text style={styles.emptyEnrolledText}>No beneficiaries enrolled yet.</Text>
              ) : (
                enrolledList.slice(0, 30).map((b, idx) => (
                  <View key={b.id || idx} style={styles.enrolledItem}>
                    <View style={styles.enrolledAvatar}>
                      <Text style={styles.avatarTxt}>{(b.first_name?.[0] || 'B').toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.enrolledName, darkMode && styles.darkText]}>
                        {b.first_name} {b.last_name}
                      </Text>
                      <Text style={styles.enrolledMeta}>
                        {b.beneficiary_id_code || b.RFID_number || 'ID Pending'} • {b.barangay_name || b.barangay || 'Barangay'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
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
  darkText: { color: '#f8fafc' },
  darkSub: { color: '#94a3b8' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  filterSection: { paddingHorizontal: 16, marginBottom: 8 },
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
  progCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  progName: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 20 },
  progCode: { fontSize: 10.5, fontWeight: '700', color: '#2563eb', marginTop: 2, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '800' },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  progDesc: { fontSize: 12.5, color: '#64748b', marginTop: 8, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerItem: { flex: 1, alignItems: 'center' },
  footerDivider: { width: 1, height: 24, backgroundColor: '#f1f5f9' },
  footerLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  footerVal: { fontSize: 12.5, fontWeight: '700', color: '#1e293b', marginTop: 2 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  darkModalContent: { backgroundColor: '#1e293b' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: '700' },
  modalScroll: { paddingBottom: 24 },
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
  descText: { fontSize: 12.5, color: '#334155', lineHeight: 18 },
  actionRow: { marginTop: 16 },
  autoEnrollBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  autoEnrollBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  enrolledHeader: { marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  emptyEnrolledText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginVertical: 8 },
  enrolledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  enrolledAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarTxt: { color: '#1d4ed8', fontWeight: '800', fontSize: 12 },
  enrolledName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  enrolledMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
});

export default StaffProgramsScreen;

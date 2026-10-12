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
  Linking,
} from 'react-native';
import { interventionApi } from '../services/api';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffInterventionsScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadInterventions = useCallback(async () => {
    try {
      setError('');
      const res = await interventionApi.getAll();
      setInterventions(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load interventions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInterventions();
  }, [loadInterventions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInterventions();
  };

  const handleVerify = async (item) => {
    setProcessing(true);
    try {
      await interventionApi.verify(item.id, { verified_by: user?.first_name || 'Staff' });
      Alert.alert('Verified', 'Ang interbensyon ay matagumpay na na-verify.');
      setSelectedItem(null);
      loadInterventions();
    } catch (err) {
      Alert.alert('Verification Failed', err?.response?.data?.message || err.message || 'Error verifying intervention.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (item) => {
    if (!rejectReason.trim()) {
      Alert.alert('Dahilan Kinakailangan', 'Pakilagay ang dahilan ng pag-reject.');
      return;
    }
    setProcessing(true);
    try {
      await interventionApi.reject(item.id, { reason: rejectReason.trim() });
      Alert.alert('Rejected', 'Ang interbensyon ay na-reject.');
      setSelectedItem(null);
      setRejectReason('');
      loadInterventions();
    } catch (err) {
      Alert.alert('Reject Failed', err?.response?.data?.message || err.message || 'Error rejecting intervention.');
    } finally {
      setProcessing(false);
    }
  };

  const filteredItems = interventions.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const bName = `${item.Beneficiary?.first_name || ''} ${item.Beneficiary?.last_name || ''}`.toLowerCase();
    const matchSearch =
      !q ||
      bName.includes(q) ||
      (item.agency_name && item.agency_name.toLowerCase().includes(q)) ||
      (item.assistance_type && item.assistance_type.toLowerCase().includes(q));

    const iStatus = (item.status || 'Pending').toLowerCase();
    const matchStatus = statusFilter === 'all' || iStatus === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'verified' || s === 'approved') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
    if (s === 'rejected') return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }; // Pending
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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Interventions</Text>
            <Text style={styles.headerSub}>Cross-agency citizen assistance reports</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadInterventions} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search citizen or agency (PCSO, LGU...)"
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
          {['all', 'pending', 'verified', 'rejected'].map((st) => {
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

      {/* List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading interventions...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadInterventions} style={styles.retryBtn}>
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
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No Interventions Found</Text>
              <Text style={styles.emptySub}>No intervention records match your search criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusStyle = getStatusStyle(item.status);
            const b = item.Beneficiary || {};
            const isPending = (item.status || 'pending').toLowerCase() === 'pending';
            return (
              <TouchableOpacity
                style={[styles.itemCard, darkMode && styles.darkCard]}
                onPress={() => setSelectedItem(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.agencyName, darkMode && styles.darkText]}>
                      🏢 {item.agency_name || 'Partner Agency'}
                    </Text>
                    <Text style={styles.applicantName}>
                      👤 {b.first_name} {b.last_name} ({b.beneficiary_id_code || 'ID'})
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                      {(item.status || 'Pending').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.tagRow}>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>🏷 {item.assistance_type || 'Aid'}</Text>
                  </View>
                  <Text style={styles.dateText}>📅 {formatDate(item.date_received || item.created_at)}</Text>
                </View>

                {item.description ? (
                  <Text style={[styles.descSnippet, darkMode && styles.darkSub]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Amount Received</Text>
                    <Text style={[styles.footerVal, { color: '#16a34a' }]}>{formatMoney(item.amount)}</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Barangay</Text>
                    <Text style={styles.footerVal}>{b.Barangay?.barangay_name || b.barangay || 'Municipal'}</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  {isPending ? (
                    <TouchableOpacity
                      style={styles.verifyFastBtn}
                      onPress={() => handleVerify(item)}
                    >
                      <Text style={styles.verifyFastText}>✓ Verify</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.verifiedTag}>
                      <Text style={styles.verifiedTagText}>✓ Naitala</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedItem} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>
                  {selectedItem?.agency_name} Interbensyon
                </Text>
                <Text style={styles.applicantName}>
                  Benepisyaryo: {selectedItem?.Beneficiary?.first_name} {selectedItem?.Beneficiary?.last_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Uri ng Ayuda</Text>
                <Text style={styles.infoVal}>{selectedItem?.assistance_type || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Halaga ng Tulong</Text>
                <Text style={[styles.infoVal, { color: '#16a34a', fontWeight: '800' }]}>
                  {formatMoney(selectedItem?.amount)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Petsa Natanggap</Text>
                <Text style={styles.infoVal}>{formatDate(selectedItem?.date_received)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Katayuan</Text>
                <Text style={styles.infoVal}>{(selectedItem?.status || 'Pending').toUpperCase()}</Text>
              </View>

              {selectedItem?.description ? (
                <View style={styles.descBox}>
                  <Text style={styles.descTitle}>Pahayag / Detalye</Text>
                  <Text style={[styles.descText, darkMode && styles.darkSub]}>{selectedItem.description}</Text>
                </View>
              ) : null}

              {selectedItem?.proof_document_url ? (
                <View style={styles.docBox}>
                  <Text style={[styles.docTitle, darkMode && styles.darkSub]}>Nakalakip na Katibayan / Proof</Text>
                  <TouchableOpacity
                    style={styles.docBtn}
                    onPress={() => {
                      const url = selectedItem.proof_document_url.startsWith('http')
                        ? selectedItem.proof_document_url
                        : `http://localhost:5000${selectedItem.proof_document_url.startsWith('/') ? '' : '/'}${selectedItem.proof_document_url}`;
                      Linking.openURL(url).catch(() => Alert.alert('Hindi Mabuksan', 'Hindi mabuksan ang document link.'));
                    }}
                  >
                    <Text style={styles.docBtnText}>📎 Buksan / Tingnan ang Proof Document</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {(selectedItem?.status || '').toLowerCase() === 'pending' && (
                <View style={styles.actionSection}>
                  <Text style={[styles.actionSectionTitle, darkMode && styles.darkText]}>Aksyon ng Staff</Text>

                  <TouchableOpacity
                    style={[styles.verifyBigBtn, processing && styles.btnDisabled]}
                    onPress={() => selectedItem && handleVerify(selectedItem)}
                    disabled={processing}
                  >
                    <Text style={styles.verifyBigBtnText}>✓ Aprubahan / I-verify ang Ulat</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.notesInput, darkMode && styles.darkInput]}
                    placeholder="Dahilan kung bakit ire-reject..."
                    placeholderTextColor="#94a3b8"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                  />

                  <TouchableOpacity
                    style={[styles.rejectBigBtn, processing && styles.btnDisabled]}
                    onPress={() => selectedItem && handleReject(selectedItem)}
                    disabled={processing}
                  >
                    <Text style={styles.rejectBigBtnText}>✕ I-reject ang Interbensyon</Text>
                  </TouchableOpacity>
                </View>
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
  itemCard: {
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
  agencyName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  applicantName: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '800' },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  typePill: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typePillText: { fontSize: 11, color: '#2563eb', fontWeight: '700' },
  dateText: { fontSize: 11, color: '#94a3b8' },
  descSnippet: { fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 17 },
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
  footerVal: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  verifyFastBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  verifyFastText: { color: '#15803d', fontWeight: '800', fontSize: 12 },
  verifiedTag: { paddingHorizontal: 10, paddingVertical: 4 },
  verifiedTagText: { color: '#64748b', fontSize: 11, fontWeight: '600' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
  docBox: { backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  docTitle: { fontSize: 11, fontWeight: '700', color: '#1e40af', marginBottom: 8, textTransform: 'uppercase' },
  docBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  docBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  actionSection: { marginTop: 18 },
  actionSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  verifyBigBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyBigBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
  },
  darkInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  rejectBigBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectBigBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
});

export default StaffInterventionsScreen;


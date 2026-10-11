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
import { distributionApi } from '../services/api';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffDistributionsScreen = ({ onBack, onOpenDrawer, onNavigate, user, darkMode = false }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setError('');
      const res = await distributionApi.listEvents();
      setEvents(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load distribution events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleOpenEvent = async (event) => {
    setSelectedEvent(event);
    try {
      setTxnLoading(true);
      const res = await distributionApi.getTransactions(event.id);
      setTransactions(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load event transactions:', err);
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.Program?.name && e.Program.name.toLowerCase().includes(q));

    const eStatus = (e.status || 'scheduled').toLowerCase();
    const matchStatus = statusFilter === 'all' || eStatus === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const ongoingCount = events.filter((e) => (e.status || '').toLowerCase() === 'ongoing').length;
  const completedCount = events.filter((e) => (e.status || '').toLowerCase() === 'completed').length;

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'ongoing') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
    if (s === 'scheduled') return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
    if (s === 'completed') return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Distributions</Text>
            <Text style={styles.headerSub}>Aid payout sessions & distribution events</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadEvents} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Metric Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#2563eb' }]}>
          <Text style={styles.statLabel}>Total Events</Text>
          <Text style={[styles.statValue, { color: '#2563eb' }]}>{events.length}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#16a34a' }]}>
          <Text style={styles.statLabel}>Ongoing Now</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{ongoingCount}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#64748b' }]}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={[styles.statValue, { color: '#64748b' }]}>{completedCount}</Text>
        </View>
      </View>

      {/* Search & Status Filters */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search event title, venue, or program..."
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
          {['all', 'ongoing', 'scheduled', 'completed'].map((st) => {
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

      {/* Events List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading distribution events...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadEvents} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No Distribution Events</Text>
              <Text style={styles.emptySub}>No distribution events found for the selected filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusStyle = getStatusColor(item.status);
            return (
              <TouchableOpacity
                style={[styles.eventCard, darkMode && styles.darkCard]}
                onPress={() => handleOpenEvent(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.eventTitle, darkMode && styles.darkText]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.Program?.name ? (
                      <Text style={styles.programSub}>Program: {item.Program.name}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                      {(item.status || 'Scheduled').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>📅 {formatDate(item.distribution_date || item.start_date || item.created_at)}</Text>
                  {item.location ? <Text style={styles.metaText}>📍 {item.location}</Text> : null}
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Amount / Pax</Text>
                    <Text style={[styles.footerVal, { color: '#16a34a' }]}>{formatMoney(item.amount_per_beneficiary || item.payout_amount)}</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Target Barangay</Text>
                    <Text style={styles.footerVal}>{item.Barangay?.barangay_name || item.target_barangay || 'All'}</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <TouchableOpacity
                    style={styles.scanShortcutBtn}
                    onPress={() => onNavigate && onNavigate('distributionScanner')}
                  >
                    <Text style={styles.scanShortcutText}>📱 Scan</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Event Transactions & Detail Modal */}
      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>{selectedEvent?.title}</Text>
                <Text style={styles.programSub}>
                  {selectedEvent?.Program?.name || 'Distribution Event'} • {(selectedEvent?.status || '').toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEvent(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Scheduled Date</Text>
                <Text style={styles.infoVal}>{formatDate(selectedEvent?.distribution_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Venue / Location</Text>
                <Text style={styles.infoVal}>{selectedEvent?.location || 'Municipal Gym'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Amount per Beneficiary</Text>
                <Text style={[styles.infoVal, { color: '#16a34a', fontWeight: '800' }]}>
                  {formatMoney(selectedEvent?.amount_per_beneficiary)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Budget</Text>
                <Text style={styles.infoVal}>{formatMoney(selectedEvent?.total_budget || 0)}</Text>
              </View>

              {/* Quick Scanner Launcher */}
              <TouchableOpacity
                style={styles.launchScannerBtn}
                onPress={() => {
                  setSelectedEvent(null);
                  if (onNavigate) onNavigate('distributionScanner');
                }}
              >
                <Text style={styles.launchScannerText}>📱 Launch Distribution Scanner for this Event</Text>
              </TouchableOpacity>

              {/* Beneficiary Payout Transactions Roster */}
              <View style={styles.rosterHeader}>
                <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>
                  Recipient Roster ({transactions.length})
                </Text>
              </View>

              {txnLoading ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 14 }} />
              ) : transactions.length === 0 ? (
                <Text style={styles.emptyTxnText}>No recipient records found for this event.</Text>
              ) : (
                transactions.map((txn, idx) => {
                  const b = txn.Beneficiary || {};
                  const isReleased = txn.status === 'released' || txn.status === 'completed';
                  return (
                    <View key={txn.id || idx} style={styles.txnItem}>
                      <View style={[styles.txnAvatar, isReleased ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.avatarTxt, isReleased ? { color: '#15803d' } : { color: '#b45309' }]}>
                          {isReleased ? '✓' : '⏱'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.txnName, darkMode && styles.darkText]}>
                          {b.first_name} {b.last_name}
                        </Text>
                        <Text style={styles.txnMeta}>
                          {b.beneficiary_id_code || b.RFID_number || 'N/A'} • {formatMoney(txn.amount)}
                        </Text>
                      </View>
                      <View style={[styles.txnStatusBadge, isReleased ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.txnStatusText, isReleased ? { color: '#15803d' } : { color: '#b45309' }]}>
                          {(txn.status || 'Pending').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })
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
  eventCard: {
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
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', lineHeight: 20 },
  programSub: { fontSize: 11, fontWeight: '600', color: '#2563eb', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: '#64748b' },
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
  scanShortcutBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scanShortcutText: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
  launchScannerBtn: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 16,
  },
  launchScannerText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  rosterHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  emptyTxnText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginVertical: 8 },
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  txnAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarTxt: { fontWeight: '800', fontSize: 12 },
  txnName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  txnMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  txnStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  txnStatusText: { fontSize: 9.5, fontWeight: '800' },
});

export default StaffDistributionsScreen;

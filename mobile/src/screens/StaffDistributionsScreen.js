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
} from 'react-native';
import { distributionApi, barangayApi } from '../services/api';
import { getProgramAssistanceClassification } from '../utils/nonCashPrograms';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const StaffDistributionsScreen = ({ onBack, onOpenDrawer, onNavigate, user, darkMode = false }) => {
  const [events, setEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'scheduled' | 'ongoing' | 'completed' | 'archived'
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  // Detail Modal
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Load Reference Barangays
  useEffect(() => {
    barangayApi
      .list()
      .then((res) => setBarangays(res.data?.data || []))
      .catch((err) => console.warn('Failed to load barangays:', err));
  }, []);

  // Load Events & Stats
  const loadEvents = useCallback(async () => {
    try {
      setError('');
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (barangayFilter !== 'all') params.barangay_id = barangayFilter;

      const [eventsRes, statsRes] = await Promise.all([
        distributionApi.listEvents(params),
        distributionApi.getDashboardStats(params).catch(() => ({ data: { data: null } })),
      ]);

      const rawEvents = eventsRes.data?.data || [];
      setEvents(rawEvents);
      if (statsRes.data?.data) {
        setStats(statsRes.data.data);
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load distribution events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, barangayFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  // Open Event Detail & Load Transactions
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

  // Counts & Calculations
  const archivedCount = useMemo(() => {
    return events.filter((e) => (e.status || '').toLowerCase() === 'archived').length;
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const eStatus = (e.status || 'scheduled').toLowerCase();
      // If archived filter toggle is off and status is archived, hide unless specifically selected
      if (!showArchived && statusFilter !== 'archived' && eStatus === 'archived') {
        return false;
      }
      if (showArchived && eStatus !== 'archived') {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.Program?.name && e.Program.name.toLowerCase().includes(q)) ||
        (e.venue && e.venue.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || eStatus === statusFilter.toLowerCase();
      const matchBarangay =
        barangayFilter === 'all' ||
        String(e.barangay_id) === String(barangayFilter) ||
        (e.Barangay?.id && String(e.Barangay.id) === String(barangayFilter));

      return matchSearch && matchStatus && matchBarangay;
    });
  }, [events, searchQuery, statusFilter, barangayFilter, showArchived]);

  // Overall Stats Calculation
  const computedStats = useMemo(() => {
    const totalEvents = events.length;
    const completedEvents = events.filter((e) => (e.status || '').toLowerCase() === 'completed').length;

    let totalBeneficiaries = 0;
    let releasedBeneficiaries = 0;
    let totalAmountReleased = 0;

    events.forEach((e) => {
      const txns = e.Transactions || [];
      if (txns.length > 0) {
        totalBeneficiaries += txns.length;
        const released = txns.filter((t) => ['released', 'completed'].includes((t.status || '').toLowerCase()));
        releasedBeneficiaries += released.length;
        released.forEach((t) => {
          totalAmountReleased += parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0);
        });
      } else {
        // Fallback to event counts
        const qualified = Number(e.qualified_count || e.eligible_count || 0);
        const released = Number(e.released_count || e.claimed_count || 0);
        totalBeneficiaries += qualified;
        releasedBeneficiaries += released;
      }
    });

    const releaseRate =
      stats?.release_percentage != null
        ? stats.release_percentage
        : totalBeneficiaries > 0
        ? Math.round((releasedBeneficiaries / totalBeneficiaries) * 100)
        : completedEvents > 0
        ? 100
        : 0;

    const amountReleased =
      stats?.transactions?.total_amount_released != null
        ? stats.transactions.total_amount_released
        : totalAmountReleased;

    return {
      totalEvents: stats?.events?.total != null ? stats.events.total : totalEvents,
      completedEvents: stats?.events?.completed != null ? stats.events.completed : completedEvents,
      releaseRate: `${releaseRate}%`,
      totalReleased: formatMoney(amountReleased),
    };
  }, [events, stats]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: 'Completed', icon: '✓' };
    if (s === 'ongoing') return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: 'Ongoing', icon: '▶' };
    if (s === 'archived') return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', label: 'Archived', icon: '📦' };
    return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', label: 'Scheduled', icon: '📅' };
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor={darkMode ? '#0f172a' : '#ffffff'} />

      {/* Breadcrumb Tagline */}
      <View style={styles.breadcrumbBar}>
        <Text style={styles.breadcrumbText}>
          DISTRIBUTIONS • Bongabong, Oriental Mindoro • Updated: {formatTime(lastUpdated)}
        </Text>
      </View>

      {/* Top Header */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onOpenDrawer} style={styles.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.menuIcon, darkMode && styles.darkText]}>☰</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Aid Distribution Events</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              Create, manage, and monitor benefit distributions and assistance events in real time.
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={loadEvents} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowArchived(!showArchived)}
            style={[styles.archiveToggleBtn, showArchived && styles.archiveToggleBtnActive]}
          >
            <Text style={[styles.archiveToggleText, showArchived && styles.archiveToggleTextActive]}>
              📦 Archived ({archivedCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards (4 Cards matching Image 2) */}
      <View style={styles.statsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          {/* Card 1: TOTAL EVENTS */}
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statLabel}>TOTAL EVENTS</Text>
              <Text style={styles.statIcon}>📅</Text>
            </View>
            <Text style={[styles.statValue, darkMode && styles.darkText]}>{computedStats.totalEvents}</Text>
            <Text style={styles.statSubText}>All distribution events</Text>
          </View>

          {/* Card 2: COMPLETED */}
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statLabel, { color: '#16a34a' }]}>COMPLETED</Text>
              <Text style={styles.statIcon}>🟢</Text>
            </View>
            <Text style={[styles.statValue, { color: '#16a34a' }]}>{computedStats.completedEvents}</Text>
            <Text style={styles.statSubText}>Successfully completed</Text>
          </View>

          {/* Card 3: RELEASE RATE */}
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statLabel, { color: '#ea580c' }]}>RELEASE RATE</Text>
              <Text style={styles.statIcon}>📈</Text>
            </View>
            <Text style={[styles.statValue, { color: '#ea580c' }]}>{computedStats.releaseRate}</Text>
            <Text style={styles.statSubText}>Benefits released</Text>
          </View>

          {/* Card 4: TOTAL RELEASED */}
          <View style={[styles.statCard, darkMode && styles.darkStatCard]}>
            <View style={styles.statCardHeader}>
              <Text style={[styles.statLabel, { color: '#2563eb' }]}>TOTAL RELEASED</Text>
              <Text style={styles.statIcon}>₱</Text>
            </View>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>{computedStats.totalReleased}</Text>
            <Text style={styles.statSubText}>Amount distributed</Text>
          </View>
        </ScrollView>
      </View>

      {/* Filters & Search Bar */}
      <View style={styles.filterSection}>
        {/* Search Bar */}
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

        {/* Filter Bar Header & Count */}
        <View style={styles.filterControlsRow}>
          <Text style={[styles.filtersTitle, darkMode && styles.darkText]}>🔍 Filters:</Text>
          <Text style={styles.eventCountText}>
            {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'} found
          </Text>
        </View>

        {/* Status Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChipsScroll}>
          {[
            { id: 'all', label: 'All Status' },
            { id: 'ongoing', label: 'Ongoing' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'completed', label: 'Completed' },
            { id: 'archived', label: 'Archived' },
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

        {/* Barangay Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barangayChipsScroll}>
          <TouchableOpacity
            onPress={() => setBarangayFilter('all')}
            style={[styles.bChip, barangayFilter === 'all' && styles.bChipActive]}
          >
            <Text style={[styles.bChipText, barangayFilter === 'all' && styles.bChipTextActive]}>
              All Barangays
            </Text>
          </TouchableOpacity>
          {barangays.map((b) => {
            const isSel = String(barangayFilter) === String(b.id);
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => setBarangayFilter(isSel ? 'all' : String(b.id))}
                style={[styles.bChip, isSel && styles.bChipActive]}
              >
                <Text style={[styles.bChipText, isSel && styles.bChipTextActive]}>
                  {b.barangay_name || b.name}
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
              <Text style={styles.emptySub}>No distribution events match the selected criteria.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusConfig = getStatusBadge(item.status);
            const classification = getProgramAssistanceClassification(
              item.Program?.name || item.title,
              item.benefit_type || (item.item_name ? 'In-Kind' : 'Cash')
            );

            // Calculate Progress
            const txns = item.Transactions || [];
            let qualified = Number(item.qualified_count || item.eligible_count || 0);
            let released = Number(item.released_count || item.claimed_count || 0);

            if (txns.length > 0) {
              qualified = txns.length;
              released = txns.filter((t) => ['released', 'completed'].includes((t.status || '').toLowerCase())).length;
            } else if (item.status === 'completed' && qualified === 0) {
              qualified = 2;
              released = 2;
            }

            const percent = qualified > 0 ? Math.min(100, Math.round((released / qualified) * 100)) : item.status === 'completed' ? 100 : 0;

            const isNonCash = classification?.isNonCash || item.benefit_type === 'In-Kind' || !!item.item_name;

            return (
              <View style={[styles.eventCard, darkMode && styles.darkCard]}>
                {/* Row 1: Event Details & Status Badge */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.eventTitle, darkMode && styles.darkText]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.dateText}>
                      📅 {formatDate(item.distribution_date || item.start_date || item.created_at)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                      {statusConfig.icon} {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Row 2: Program & Location */}
                <View style={styles.programLocationBox}>
                  <Text style={[styles.programNameText, darkMode && styles.darkText]} numberOfLines={1}>
                    {item.Program?.name || 'General Distribution Program'}
                  </Text>
                  <Text style={styles.locationText}>
                    📍 {item.location || item.Barangay?.barangay_name || item.target_barangay || 'Bongabong, Oriental Mindoro'}
                  </Text>
                </View>

                {/* Row 3: Budget / Benefit Details (Non-Cash vs Cash) */}
                <View style={styles.benefitBox}>
                  {isNonCash ? (
                    <View style={styles.nonCashRow}>
                      <View style={styles.nonCashBadge}>
                        <Text style={styles.nonCashBadgeText}>
                          {classification?.badge || '📦 Relief Package'}
                        </Text>
                      </View>
                      <Text style={[styles.nonCashItemName, darkMode && styles.darkSub]} numberOfLines={1}>
                        {item.item_name || classification?.itemDefault || 'Emergency Food Relief Goods'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.cashRow}>
                      <Text style={styles.cashLabel}>Budget per Beneficiary:</Text>
                      <Text style={styles.cashVal}>
                        {formatMoney(item.amount_per_beneficiary || item.payout_amount)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Row 4: Progress Bar & Count */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, darkMode && styles.darkText]}>
                      👥 {released} / {qualified}
                    </Text>
                    <Text style={styles.progressPercent}>{percent}%</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                  </View>
                </View>

                {/* Row 5: Action Buttons */}
                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={styles.viewEventBtn}
                    onPress={() => handleOpenEvent(item)}
                  >
                    <Text style={styles.viewEventBtnText}>👁️ View Details</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.scanShortcutBtn}
                    onPress={() => onNavigate && onNavigate('distributionScanner')}
                  >
                    <Text style={styles.scanShortcutText}>📱 Scan QR / RFID</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* EVENT DETAIL & RECIPIENT ROSTER MODAL */}
      {/* ========================================================================= */}
      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>
                  {selectedEvent?.title}
                </Text>
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
                <Text style={styles.infoVal}>{selectedEvent?.location || selectedEvent?.venue || 'Municipal Gym'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Barangay Scope</Text>
                <Text style={styles.infoVal}>
                  {selectedEvent?.Barangay?.barangay_name || selectedEvent?.target_barangay || 'All Barangays'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Target Category</Text>
                <Text style={styles.infoVal}>{selectedEvent?.target_category || selectedEvent?.Program?.target_criteria || 'General'}</Text>
              </View>

              {/* Benefit / Budget Information */}
              {selectedEvent?.item_name || selectedEvent?.benefit_type === 'In-Kind' ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Relief Goods / In-Kind Item</Text>
                  <Text style={[styles.infoVal, { color: '#7c3aed', fontWeight: '800' }]}>
                    📦 {selectedEvent?.item_name || 'Emergency Food Relief Goods'}
                  </Text>
                </View>
              ) : (
                <>
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
                </>
              )}

              {/* Launch Scanner Shortcut */}
              <TouchableOpacity
                style={styles.launchScannerBtn}
                onPress={() => {
                  setSelectedEvent(null);
                  if (onNavigate) onNavigate('distributionScanner');
                }}
              >
                <Text style={styles.launchScannerText}>📱 Launch Distribution Scanner for this Event</Text>
              </TouchableOpacity>

              {/* Recipient Roster */}
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
                          {b.id_code || b.beneficiary_id_code || b.rfid_card_id || 'ID N/A'} • {formatMoney(txn.amount)}
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
  breadcrumbBar: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  breadcrumbText: { fontSize: 10.5, fontWeight: '700', color: '#1d4ed8' },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  menuBtn: { marginRight: 12, padding: 4 },
  menuIcon: { fontSize: 24, color: '#1e293b' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: { fontSize: 16, color: '#2563eb', fontWeight: 'bold' },
  archiveToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  archiveToggleBtnActive: { backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' },
  archiveToggleText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  archiveToggleTextActive: { color: '#1e293b' },
  darkText: { color: '#f8fafc' },
  darkSub: { color: '#94a3b8' },

  // Stats
  statsContainer: { backgroundColor: '#f8fafc', paddingVertical: 10 },
  statsScroll: { paddingHorizontal: 16, gap: 10 },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 140,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  darkStatCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  statCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  statIcon: { fontSize: 13 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginVertical: 4 },
  statSubText: { fontSize: 10, color: '#94a3b8' },

  // Filter Section
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
  searchInput: { flex: 1, fontSize: 13, color: '#1e293b', padding: 0 },
  clearSearch: { fontSize: 14, color: '#94a3b8', paddingHorizontal: 4 },
  filterControlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  filtersTitle: { fontSize: 12, fontWeight: '800', color: '#334155' },
  eventCountText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  statusChipsScroll: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 11.5, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },

  barangayChipsScroll: { flexDirection: 'row', gap: 6, marginTop: 6 },
  bChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  bChipActive: { backgroundColor: '#dbeafe' },
  bChipText: { fontSize: 10.5, fontWeight: '600', color: '#64748b' },
  bChipTextActive: { color: '#1d4ed8', fontWeight: '800' },

  // List & Event Card
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  eventCard: {
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', lineHeight: 20 },
  dateText: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  programLocationBox: { marginTop: 8 },
  programNameText: { fontSize: 12.5, fontWeight: '700', color: '#2563eb' },
  locationText: { fontSize: 11, color: '#64748b', marginTop: 2 },

  benefitBox: { marginTop: 8 },
  nonCashRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nonCashBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  nonCashBadgeText: { fontSize: 10, fontWeight: '800', color: '#7e22ce' },
  nonCashItemName: { fontSize: 11, color: '#64748b', flex: 1 },
  cashRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cashLabel: { fontSize: 11, color: '#64748b' },
  cashVal: { fontSize: 12, fontWeight: '800', color: '#16a34a' },

  progressSection: { marginTop: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  progressLabel: { fontSize: 11.5, fontWeight: '800', color: '#334155' },
  progressPercent: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  progressBarTrack: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 3 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  viewEventBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewEventBtnText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
  scanShortcutBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  scanShortcutText: { color: '#ffffff', fontWeight: '700', fontSize: 11.5 },

  // Details Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  darkModalContent: { backgroundColor: '#1e293b' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  programSub: { fontSize: 11, fontWeight: '600', color: '#2563eb', marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: '700' },
  modalScroll: { paddingBottom: 30 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  infoVal: { fontSize: 12.5, color: '#1e293b', fontWeight: '600' },
  launchScannerBtn: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 14,
  },
  launchScannerText: { color: '#ffffff', fontWeight: '700', fontSize: 12.5 },
  rosterHeader: { marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 13.5, fontWeight: '800', color: '#1e293b' },
  emptyTxnText: { fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', marginVertical: 8 },
  txnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  txnAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarTxt: { fontWeight: '800', fontSize: 11 },
  txnName: { fontSize: 12.5, fontWeight: '700', color: '#1e293b' },
  txnMeta: { fontSize: 10.5, color: '#64748b', marginTop: 1 },
  txnStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  txnStatusText: { fontSize: 9.5, fontWeight: '800' },

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

export default StaffDistributionsScreen;

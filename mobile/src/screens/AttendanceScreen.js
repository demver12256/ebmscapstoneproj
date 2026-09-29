import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { announcementApi } from '../services/api';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function AttendanceScreen({ onBack, onOpenDrawer, user, profile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // all, Present, Absent, Pending
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAttendance = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await announcementApi.myAttendance();
      if (res.data?.success) {
        setData(res.data.data);
      } else {
        setError(res.data?.message || 'Unable to load attendance records.');
      }
    } catch (err) {
      console.warn('Failed to load attendance:', err?.message);
      setError(err.response?.data?.message || err.message || 'Error fetching attendance records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const beneficiary = data?.beneficiary || profile || {};
  const stats = data?.stats || {};
  const attendanceList = data?.records || data?.attendance || [];

  const totalMeetings = stats.total_meetings ?? attendanceList.length;
  const presentCount = stats.present_count ?? stats.present ?? 0;
  const absentCount = stats.absent_count ?? stats.absent ?? 0;
  const pendingCount = stats.pending_count ?? stats.pending ?? 0;
  const complianceRate = stats.compliance_rate ?? stats.rate ?? 0;

  const displayName = `${beneficiary.first_name || user?.first_name || 'Beneficiary'} ${beneficiary.last_name || user?.last_name || ''}`.trim();
  const rfidTag = beneficiary.RFID_number || beneficiary.rfid_tag || profile?.RFID_number || user?.RFID_number || 'Not Registered';
  const categoryName = beneficiary.category || profile?.category || 'Senior Citizens (Social Pension)';
  const rawBarangay = beneficiary.barangay || beneficiary.barangay_name || profile?.Barangay?.barangay_name || 'Bongabong';
  const barangayName = rawBarangay.startsWith('Brgy') ? rawBarangay : `Brgy. ${rawBarangay}`;

  // Filter events by status & search
  const filteredRecords = attendanceList.filter((r) => {
    const ann = r.Announcement || r;
    const status = r.attendance_status || ann.attendance_status || 'Pending';
    const matchesFilter =
      statusFilter === 'all' ||
      status.toLowerCase() === statusFilter.toLowerCase();

    const title = r.title || ann.title || '';
    const venue = r.venue || r.location || ann.venue || ann.location || '';
    const desc = r.message || r.description || ann.message || ann.description || '';
    const q = searchQuery.toLowerCase().trim();

    let targetPrograms = [];
    if (Array.isArray(r.target_programs)) targetPrograms = r.target_programs;
    else if (Array.isArray(ann.target_programs)) targetPrograms = ann.target_programs;

    const matchesSearch =
      !q ||
      title.toLowerCase().includes(q) ||
      venue.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q) ||
      targetPrograms.some((p) => String(p).toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Meeting Attendance & RFID</Text>
        <TouchableOpacity onPress={() => fetchAttendance(true)} style={styles.refreshIconBtn} activeOpacity={0.7}>
          <Text style={styles.refreshIconText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAttendance(true)} colors={['#1d4ed8']} />
        }
      >
        {/* Main Blue Banner (Image 1 Header) */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Text style={{ fontSize: 24 }}>📅</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.heroTitle}>Meeting Attendance & RFID Records</Text>
              <Text style={styles.heroSubtitle}>
                Opisyal na talaan ng iyong pagdalo sa mga pulong, assemblies, at orientations.
              </Text>
            </View>
          </View>

          {/* User Badges Strip */}
          <View style={styles.badgesWrap}>
            <View style={styles.badgeItem}>
              <Text style={styles.badgeText}>👤 {displayName}</Text>
            </View>
            <View style={styles.badgeItem}>
              <Text style={styles.badgeText}>💳 RFID: {rfidTag}</Text>
            </View>
            <View style={styles.badgeItem}>
              <Text style={styles.badgeText}>🛡️ {categoryName}</Text>
            </View>
            <View style={styles.badgeItem}>
              <Text style={styles.badgeText}>🏢 {barangayName.startsWith('Brgy') ? barangayName : `Brgy. ${barangayName}`}</Text>
            </View>
          </View>

          {/* Banner Action Buttons */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity onPress={() => fetchAttendance(true)} style={styles.yellowRefreshBtn} activeOpacity={0.8}>
              <Text style={styles.yellowRefreshBtnText}>↻ Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 Stats Cards Grid (Image 1) */}
        <View style={styles.statsGrid}>
          {/* Card 1: Attendance Rate */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>ATTENDANCE RATE</Text>
              <View style={[styles.statIconBadge, { backgroundColor: '#fee2e2' }]}>
                <Text style={{ fontSize: 13, color: '#dc2626' }}>🛡️</Text>
              </View>
            </View>
            <Text style={styles.statValueLarge}>{complianceRate}%</Text>
            <Text style={styles.statSubHighlight}>
              {complianceRate >= 80 ? 'Napakahusay' : complianceRate >= 50 ? 'Katamtaman' : 'Kailangan Paunlarin'}
            </Text>
          </View>

          {/* Card 2: Dinaluhan (Present) */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>DINALUHAN (PRESENT)</Text>
              <View style={[styles.statIconBadge, { backgroundColor: '#dcfce7' }]}>
                <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: 'bold' }}>✓</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.statValueLarge, { color: '#16a34a' }]}>{presentCount}</Text>
              <Text style={styles.statUnit}> pulong dinaluhan</Text>
            </View>
            <Text style={[styles.statSubText, { color: '#15803d' }]}>
              Opisyal na na-scan gamit ang RFID card
            </Text>
          </View>

          {/* Card 3: Hindi Nadalo (Absent) */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>HINDI NADALO (ABSENT)</Text>
              <View style={[styles.statIconBadge, { backgroundColor: '#fee2e2' }]}>
                <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: 'bold' }}>✕</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.statValueLarge, { color: '#dc2626' }]}>{absentCount}</Text>
              <Text style={styles.statUnit}> pulong hindi dinaluhan</Text>
            </View>
            <Text style={[styles.statSubText, { color: '#b91c1c' }]}>
              Walang naitalang RFID scan sa itinakdang oras
            </Text>
          </View>

          {/* Card 4: Nakatakda (Pending) */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Text style={styles.statCardTitle}>NAKATAKDA (PENDING)</Text>
              <View style={[styles.statIconBadge, { backgroundColor: '#fef3c7' }]}>
                <Text style={{ fontSize: 13, color: '#d97706' }}>🕒</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.statValueLarge, { color: '#d97706' }]}>{pendingCount}</Text>
              <Text style={styles.statUnit}> paparating na pulong</Text>
            </View>
            <Text style={[styles.statSubText, { color: '#b45309' }]}>
              Dalhin ang RFID card pagpunta sa venue
            </Text>
          </View>
        </View>

        {/* Filter Pills Row (Image 1) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.filterPillText, statusFilter === 'all' && styles.filterPillTextActive]}>
                Lahat ({totalMeetings})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, statusFilter === 'present' && styles.filterPillActive]}
              onPress={() => setStatusFilter('present')}
            >
              <Text style={[styles.filterPillText, statusFilter === 'present' && styles.filterPillTextActive]}>
                ✓ Present ({presentCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, statusFilter === 'absent' && styles.filterPillActive]}
              onPress={() => setStatusFilter('absent')}
            >
              <Text style={[styles.filterPillText, statusFilter === 'absent' && styles.filterPillTextActive]}>
                ✕ Absent ({absentCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, statusFilter === 'pending' && styles.filterPillActive]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text style={[styles.filterPillText, statusFilter === 'pending' && styles.filterPillTextActive]}>
                🕒 Pending ({pendingCount})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Search Input Box */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Maghanap ng pulong o venue..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Attendance Records List */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Ikinakarga ang mga talaan ng attendance...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity onPress={() => fetchAttendance()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Subukan Muli</Text>
            </TouchableOpacity>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
            <Text style={styles.emptyTitle}>Walang Nahanap na Talaan</Text>
            <Text style={styles.emptySub}>
              {statusFilter !== 'all'
                ? `Walang records sa status na "${statusFilter}".`
                : 'Lalabas dito ang inyong attendance kapag na-scan ang inyong RFID card ng opisyal sa pulong.'}
            </Text>
          </View>
        ) : (
          filteredRecords.map((r, idx) => {
            const ann = r.Announcement || r;
            const status = r.attendance_status || ann.attendance_status || 'Pending';
            const statusLower = status.toLowerCase();
            const isPresent = statusLower === 'present';
            const isAbsent = statusLower === 'absent';
            const isPending = statusLower === 'pending';

            const title = r.title || ann.title || 'Official Assembly Meeting';
            const description =
              r.message ||
              r.description ||
              ann.message ||
              ann.description ||
              ann.content ||
              'Buwanang pagtitipon at orientation para sa mga benepisyaryo.';
            const eventDate = r.event_date || ann.event_date;
            const eventTime = r.event_time || ann.event_time || 'N/A';
            const endTime = r.end_time || ann.end_time;
            const venue = r.venue || r.location || ann.venue || ann.location || 'Barangay Covered Court';
            const createdAt = r.created_at || r.createdAt || ann.created_at;

            let targetPrograms = [];
            if (Array.isArray(r.target_programs)) targetPrograms = r.target_programs;
            else if (Array.isArray(ann.target_programs)) targetPrograms = ann.target_programs;
            else if (typeof (r.target_programs || ann.target_programs) === 'string') {
              try {
                targetPrograms = JSON.parse(r.target_programs || ann.target_programs);
              } catch (e) {}
            }
            const programLabel =
              targetPrograms.length > 0 ? targetPrograms.join(', ') : ann.target_group || categoryName;

            return (
              <View
                key={r.id || idx}
                style={[
                  styles.recordCard,
                  isAbsent && { borderTopColor: '#ef4444' },
                  isPresent && { borderTopColor: '#10b981' },
                  isPending && { borderTopColor: '#f59e0b' },
                ]}
              >
                {/* Status and Category Badges */}
                <View style={styles.recordTopRow}>
                  <View
                    style={[
                      styles.recordStatusPill,
                      isPresent && styles.pillPresent,
                      isAbsent && styles.pillAbsent,
                      isPending && styles.pillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.recordStatusPillText,
                        isPresent && styles.textPresent,
                        isAbsent && styles.textAbsent,
                        isPending && styles.textPending,
                      ]}
                    >
                      {isPresent
                        ? '✓ ATTENDANCE CONFIRMED (PRESENT)'
                        : isAbsent
                        ? '✕ MARKED ABSENT'
                        : '🕒 ATTENDANCE PENDING (UPCOMING)'}
                    </Text>
                  </View>

                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText}>{programLabel}</Text>
                  </View>

                  <Text style={styles.createdDateText}>
                    Nilikha: {formatDate(createdAt)}
                  </Text>
                </View>

                {/* Event Title */}
                <Text style={styles.recordTitle}>{title}</Text>

                {/* Event Description */}
                <Text style={styles.recordDescription}>{description}</Text>

                {/* Event Details Grid */}
                <View style={styles.recordMetaRow}>
                  <Text style={styles.recordMetaItem}>
                    📅 Petsa: <Text style={styles.recordMetaVal}>{formatDate(eventDate)}</Text>
                  </Text>
                  <Text style={styles.recordMetaItem}>
                    ⏰ Oras: <Text style={styles.recordMetaVal}>{eventTime}{endTime ? ` - ${endTime}` : ''}</Text>
                  </Text>
                  <Text style={styles.recordMetaItem}>
                    📍 Lugar: <Text style={styles.recordMetaVal}>{venue}</Text>
                  </Text>
                  {r.scanned_at ? (
                    <Text style={styles.recordMetaItem}>
                      ⚡ Na-scan: <Text style={styles.recordMetaVal}>{new Date(r.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  navBar: {
    height: 52,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  backBtnText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 13,
  },
  navTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  // Main Blue Header Banner (Image 1)
  heroBanner: {
    backgroundColor: '#1e3a8a',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 22,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 4,
    lineHeight: 16,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  badgeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  heroActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  yellowRefreshBtn: {
    backgroundColor: '#eab308',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  yellowRefreshBtnText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
  // 4 Stats Cards Grid
  statsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  statIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValueLarge: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  statUnit: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statSubHighlight: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '700',
    marginTop: 4,
  },
  statSubText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 4,
  },
  // Filters
  filterScrollView: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterPillActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 16,
    color: '#64748b',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  // Record Cards (Image 1)
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 4,
    borderTopColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  recordStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  pillPresent: {
    backgroundColor: '#dcfce7',
  },
  pillAbsent: {
    backgroundColor: '#fee2e2',
  },
  pillPending: {
    backgroundColor: '#fef3c7',
  },
  recordStatusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
  },
  textPresent: {
    color: '#15803d',
  },
  textAbsent: {
    color: '#b91c1c',
  },
  textPending: {
    color: '#b45309',
  },
  categoryPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  categoryPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  createdDateText: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
  },
  recordDescription: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  recordMetaRow: {
    flexDirection: 'column',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  recordMetaItem: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
  },
  recordMetaVal: {
    fontWeight: '700',
    color: '#1e293b',
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});

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
import { announcementApi } from '../services/api';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffAnnouncementsScreen = ({ onBack, onOpenDrawer, onNavigate, user, darkMode = false }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedAnn, setSelectedAnn] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setError('');
      const res = await announcementApi.list();
      setAnnouncements(res.data?.data || []);
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

  const filteredItems = announcements.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.content && a.content.toLowerCase().includes(q)) ||
      (a.venue && a.venue.toLowerCase().includes(q));

    if (filterType === 'attendance') return matchSearch && a.has_attendance;
    if (filterType === 'published') return matchSearch && a.status === 'published';
    if (filterType === 'draft') return matchSearch && a.status === 'draft';
    return matchSearch;
  });

  const getPriorityStyle = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent' || p === 'high') return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    if (p === 'low') return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }; // Normal
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
        <TouchableOpacity onPress={loadAnnouncements} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
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

      {/* List */}
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
            return (
              <TouchableOpacity
                style={[styles.annCard, darkMode && styles.darkCard]}
                onPress={() => setSelectedAnn(item)}
                activeOpacity={0.8}
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
                  <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg, borderColor: priorityStyle.border }]}>
                    <Text style={[styles.priorityBadgeText, { color: priorityStyle.text }]}>
                      {(item.priority || 'Normal').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.venue ? (
                  <Text style={styles.venueText}>📍 Venue: {item.venue}</Text>
                ) : null}

                {item.content ? (
                  <Text style={[styles.contentSnippet, darkMode && styles.darkSub]} numberOfLines={2}>
                    {item.content}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  {item.has_attendance ? (
                    <View style={styles.attendancePill}>
                      <Text style={styles.attendancePillText}>📲 Attendance Required</Text>
                    </View>
                  ) : (
                    <Text style={styles.generalNoticeText}>📢 General Notice</Text>
                  )}
                  {item.has_attendance && (
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
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Attendance Status</Text>
                <Text style={styles.infoVal}>{selectedAnn?.has_attendance ? 'Required (RFID/QR)' : 'Not Required'}</Text>
              </View>

              <View style={styles.contentBox}>
                <Text style={styles.contentBoxTitle}>Announcement Details</Text>
                <Text style={[styles.contentBody, darkMode && styles.darkSub]}>{selectedAnn?.content}</Text>
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
  annCard: {
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
  annTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  dateSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  priorityBadgeText: { fontSize: 9.5, fontWeight: '800' },
  venueText: { fontSize: 12, color: '#475569', marginTop: 6, fontWeight: '500' },
  contentSnippet: { fontSize: 12.5, color: '#64748b', marginTop: 8, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendancePill: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  attendancePillText: { color: '#15803d', fontSize: 11, fontWeight: '700' },
  generalNoticeText: { color: '#64748b', fontSize: 11.5 },
  openScannerBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  openScannerText: { color: '#ffffff', fontWeight: '700', fontSize: 11.5 },
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
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
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
  contentBox: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, marginTop: 14 },
  contentBoxTitle: { fontSize: 11, fontWeight: '800', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
  contentBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
  launchAttendanceBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  launchAttendanceBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
});

export default StaffAnnouncementsScreen;


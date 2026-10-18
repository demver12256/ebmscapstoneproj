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
import { announcementApi } from '../services/api';
import {
  isAnnouncementActiveForAttendance,
  getAnnouncementTiming,
} from '../utils/announcementSchedule';

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
  const [createModal, setCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    venue: '',
    event_date: '',
    event_time: '',
    has_attendance: true,
    target_sitios: '',
    target_categories: ['4Ps', 'Senior Citizens', 'PWD'],
    priority: 'Normal',
  });

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

  const handleCreateAnnouncement = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      Alert.alert('Required Fields', 'Pakilagay ang Pamagat (Title) at Detalye (Message).');
      return;
    }
    setCreating(true);
    try {
      const isBarangayStaff = user?.role === 'staff' || user?.role === 'barangay';
      const sitiosList = form.target_sitios
        ? form.target_sitios.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        venue: form.venue.trim() || undefined,
        event_date: form.event_date.trim() || undefined,
        event_time: form.event_time.trim() || undefined,
        priority: form.priority,
        status: isBarangayStaff ? 'pending_approval' : 'published',
        has_attendance: form.has_attendance,
        target_categories: form.target_categories,
        target_programs: form.target_categories,
        target_sitios: sitiosList,
        target_barangays: user?.barangay_id ? [user.barangay_id] : [],
      };
      await announcementApi.create(payload);
      Alert.alert(
        'Anunsyo Naisumite',
        isBarangayStaff
          ? 'Naisumite na ang anunsyo para sa DSWD Admin Approval bago mai-publish sa mga benepisyaryo.'
          : 'Matagumpay na nai-publish ang bagong anunsyo.'
      );
      setCreateModal(false);
      setForm({
        title: '',
        message: '',
        venue: '',
        event_date: '',
        event_time: '',
        has_attendance: true,
        target_sitios: '',
        target_categories: ['4Ps', 'Senior Citizens', 'PWD'],
        priority: 'Normal',
      });
      loadAnnouncements();
    } catch (err) {
      Alert.alert('Submission Failed', err?.response?.data?.message || err.message || 'Hindi naisumite ang anunsyo.');
    } finally {
      setCreating(false);
    }
  };

  const toggleCategory = (cat) => {
    setForm((prev) => {
      const exists = prev.target_categories.includes(cat);
      if (exists) {
        if (prev.target_categories.length === 1) return prev; // keep at least one
        return { ...prev, target_categories: prev.target_categories.filter((c) => c !== cat) };
      }
      return { ...prev, target_categories: [...prev.target_categories, cat] };
    });
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
    if (filterType === 'pending_approval') return matchSearch && a.status === 'pending_approval';
    if (filterType === 'draft') return matchSearch && a.status === 'draft';
    return matchSearch;
  });

  const getPriorityStyle = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p === 'urgent' || p === 'high') return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    if (p === 'low') return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }; // Normal
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
          <TouchableOpacity onPress={() => setCreateModal(true)} style={styles.createBtn}>
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

                {item.content ? (
                  <Text style={[styles.contentSnippet, darkMode && styles.darkSub]} numberOfLines={2}>
                    {item.content}
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

      {/* Create Announcement Modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Mag-anunsyo / Create Announcement</Text>
              <TouchableOpacity onPress={() => setCreateModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {(user?.role === 'staff' || user?.role === 'barangay') && (
                <View style={styles.approvalNoticeBox}>
                  <Text style={styles.approvalNoticeTitle}>⏳ Kinakailangan ng Approval ng DSWD Admin</Text>
                  <Text style={styles.approvalNoticeText}>
                    Ang gagawin mong announcement para sa iyong Barangay ay ipapadala muna sa DSWD Admin para sa review at approval bago ito ma-publish at ma-text sa mga benepisyaryo.
                  </Text>
                </View>
              )}

              <Text style={[styles.formLabel, darkMode && styles.darkText]}>Pamagat ng Anunsyo *</Text>
              <TextInput
                style={[styles.formInput, darkMode && styles.darkInput]}
                placeholder="Halimbawa: Pamamahagi ng Ayuda sa Barangay Hall"
                placeholderTextColor="#94a3b8"
                value={form.title}
                onChangeText={(t) => setForm({ ...form, title: t })}
              />

              <Text style={[styles.formLabel, darkMode && styles.darkText]}>Mga Detalye / Mensahe *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea, darkMode && styles.darkInput]}
                placeholder="Ilagay ang kumpletong impormasyon, paalala, at dadalhing dokumento..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={form.message}
                onChangeText={(t) => setForm({ ...form, message: t })}
              />

              <Text style={[styles.formLabel, darkMode && styles.darkText]}>Lugar / Venue</Text>
              <TextInput
                style={[styles.formInput, darkMode && styles.darkInput]}
                placeholder="Barangay Covered Court / Municipal Hall"
                placeholderTextColor="#94a3b8"
                value={form.venue}
                onChangeText={(t) => setForm({ ...form, venue: t })}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, darkMode && styles.darkText]}>Petsa (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.formInput, darkMode && styles.darkInput]}
                    placeholder="2026-10-25"
                    placeholderTextColor="#94a3b8"
                    value={form.event_date}
                    onChangeText={(t) => setForm({ ...form, event_date: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, darkMode && styles.darkText]}>Oras (e.g. 09:00 AM)</Text>
                  <TextInput
                    style={[styles.formInput, darkMode && styles.darkInput]}
                    placeholder="09:00 AM"
                    placeholderTextColor="#94a3b8"
                    value={form.event_time}
                    onChangeText={(t) => setForm({ ...form, event_time: t })}
                  />
                </View>
              </View>

              <Text style={[styles.formLabel, darkMode && styles.darkText]}>Target Sitio (Opsyonal)</Text>
              <TextInput
                style={[styles.formInput, darkMode && styles.darkInput]}
                placeholder="Hal. Sitio Riverside, Purok 3 (Iwanang bakante kung buong barangay)"
                placeholderTextColor="#94a3b8"
                value={form.target_sitios}
                onChangeText={(t) => setForm({ ...form, target_sitios: t })}
              />

              <Text style={[styles.formLabel, darkMode && styles.darkText]}>Target Beneficiary Categories:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['4Ps', 'Senior Citizens', 'PWD'].map((cat) => {
                  const active = form.target_categories.includes(cat);
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryPill, active && styles.categoryPillActive]}
                      onPress={() => toggleCategory(cat)}
                    >
                      <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                        {active ? '✓ ' : '+ '}{cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.toggleAttendanceRow, darkMode && styles.darkCard]}
                onPress={() => setForm({ ...form, has_attendance: !form.has_attendance })}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.toggleAttendanceTitle, darkMode && styles.darkText]}>Kailangan ng Attendance (RFID/QR)?</Text>
                  <Text style={styles.toggleAttendanceSub}>Papayagan ang Staff na mag-scan ng attendees sa araw ng pulong.</Text>
                </View>
                <Text style={{ fontSize: 20 }}>{form.has_attendance ? '☑️' : '⬜'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitCreateBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreateAnnouncement}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitCreateBtnText}>
                    {user?.role === 'staff' || user?.role === 'barangay'
                      ? 'Isumite para sa DSWD Admin Approval ↗'
                      : 'I-publish ang Anunsyo 📢'}
                  </Text>
                )}
              </TouchableOpacity>
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
  timingBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  timingEnded: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  timingEndedTxt: { color: '#64748b', fontSize: 9, fontWeight: '800' },
  timingCurrent: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  timingCurrentTxt: { color: '#dc2626', fontSize: 9, fontWeight: '800' },
  timingUpcoming: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  timingUpcomingTxt: { color: '#2563eb', fontSize: 9, fontWeight: '800' },
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

  sitioText: { fontSize: 12, color: '#0284c7', marginTop: 4, fontWeight: '600' },
  createBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  createBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },

  // Create Modal Styles
  approvalNoticeBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  approvalNoticeTitle: { fontSize: 12.5, fontWeight: '800', color: '#92400e', marginBottom: 3 },
  approvalNoticeText: { fontSize: 11.5, color: '#78350f', lineHeight: 16 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 5, marginTop: 10 },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1e293b',
  },
  formTextArea: { minHeight: 80, textAlignVertical: 'top' },
  darkInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  categoryPillActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  categoryPillText: { fontSize: 11.5, fontWeight: '600', color: '#64748b' },
  categoryPillTextActive: { color: '#1d4ed8', fontWeight: '800' },
  toggleAttendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  toggleAttendanceTitle: { fontSize: 12.5, fontWeight: '700', color: '#1e293b' },
  toggleAttendanceSub: { fontSize: 10.5, color: '#64748b', marginTop: 2 },
  submitCreateBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitCreateBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13.5 },
});

export default StaffAnnouncementsScreen;


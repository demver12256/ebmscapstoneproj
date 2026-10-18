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
  Image,
  Linking,
} from 'react-native';
import { assistanceRequestApi } from '../services/api';
import { API_URL } from '../config/api';

const FILES_BASE_URL = API_URL.replace(/\/api$/, '');

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

const StaffAssistanceRequestsScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReq, setSelectedReq] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [processing, setProcessing] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setError('');
      const res = await assistanceRequestApi.list();
      setRequests(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load assistance requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleOpenReq = (item) => {
    setSelectedReq(item);
    setActionNotes(item.admin_notes || item.remarks || '');
    setApprovedAmount(item.approved_amount ? String(item.approved_amount) : item.amount_requested ? String(item.amount_requested) : '');
  };

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

  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const applicant = `${r.Beneficiary?.first_name || ''} ${r.Beneficiary?.last_name || ''} ${r.applicant_name || ''}`.toLowerCase();
    const matchSearch =
      !q ||
      applicant.includes(q) ||
      (r.subject && r.subject.toLowerCase().includes(q)) ||
      (r.reference_number && r.reference_number.toLowerCase().includes(q)) ||
      (r.assistance_type && r.assistance_type.toLowerCase().includes(q));

    const rStatus = (r.status || 'Pending').toLowerCase();
    const matchStatus = statusFilter === 'all' || rStatus === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved') return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
    if (s === 'completed') return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
    if (s === 'rejected') return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    if (s === 'under review') return { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' };
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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Assistance Requests</Text>
            <Text style={styles.headerSub}>Citizen welfare & medical assistance applications</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadRequests} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBox, darkMode && styles.darkSearchBox]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search citizen name, ref #, or type..."
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
          {['all', 'pending', 'under review', 'approved', 'rejected', 'completed'].map((st) => {
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
            const statusStyle = getStatusBadge(item.status);
            const b = item.Beneficiary || {};
            const applicantName = `${b.first_name || ''} ${b.last_name || ''}`.trim() || item.applicant_name || 'Citizen Applicant';
            return (
              <TouchableOpacity
                style={[styles.reqCard, darkMode && styles.darkCard]}
                onPress={() => handleOpenReq(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.reqSubject, darkMode && styles.darkText]} numberOfLines={1}>
                      {item.subject || item.assistance_type || 'Assistance Request'}
                    </Text>
                    <Text style={styles.applicantName}>👤 {applicantName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
                      {(item.status || 'Pending').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.tagRow}>
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>🏷 {item.assistance_type || 'General Aid'}</Text>
                  </View>
                  <Text style={styles.dateText}>📅 {formatDate(item.created_at)}</Text>
                </View>

                {item.description ? (
                  <Text style={[styles.descSnippet, darkMode && styles.darkSub]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Requested Amount</Text>
                    <Text style={[styles.footerVal, { color: '#16a34a' }]}>
                      {formatMoney(item.amount_requested || item.total_amount_requested)}
                    </Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>Barangay</Text>
                    <Text style={styles.footerVal}>{b.Barangay?.barangay_name || b.barangay_name || b.barangay || 'Municipal'}</Text>
                  </View>
                  <View style={styles.footerDivider} />
                  <TouchableOpacity
                    style={styles.reviewShortcutBtn}
                    onPress={() => handleOpenReq(item)}
                  >
                    <Text style={styles.reviewShortcutText}>Review ›</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Review & Action Modal */}
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
                <Text style={styles.infoVal}>{selectedReq?.assistance_type || 'N/A'}</Text>
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
                  <Text style={styles.descTitle}>Applicant Statement</Text>
                  <Text style={[styles.descText, darkMode && styles.darkSub]}>{selectedReq.description}</Text>
                </View>
              ) : null}

              {/* Supporting Documents / Attachments Preview */}
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
      <Modal
        visible={!!previewAttachment}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewAttachment(null)}
      >
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
  reqCard: {
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
  reqSubject: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
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
  reviewShortcutBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  reviewShortcutText: { color: '#2563eb', fontWeight: '700', fontSize: 12 },
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
  refText: { fontSize: 11, color: '#64748b', marginTop: 2 },
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
  darkInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flex: 1, minWidth: '45%', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  inputSubLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 5 },
  darkSub: { color: '#94a3b8' },

  // Attachments Section
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

  // Attachment Preview Modal
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
});

export default StaffAssistanceRequestsScreen;


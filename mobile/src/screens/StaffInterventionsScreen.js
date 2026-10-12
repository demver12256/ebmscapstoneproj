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
  Image,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { API_URL } from '../config/api';
import { interventionApi, beneficiaryApi } from '../services/api';

const FILES_BASE_URL = API_URL.replace(/\/api\/?$/, '');

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const resolveFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${FILES_BASE_URL}/${path.replace(/^\/+/, '')}`;
};

const isImageFile = (path) => {
  if (!path) return false;
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(path);
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

  // Record Intervention State
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [beneficiariesList, setBeneficiariesList] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [benSearch, setBenSearch] = useState('');
  const [selectedBeneficiaryForRecord, setSelectedBeneficiaryForRecord] = useState(null);
  const [recordForm, setRecordForm] = useState({
    agency_name: '',
    assistance_type: '',
    amount: '',
    date_received: new Date().toISOString().slice(0, 10),
    description: '',
    proof_document: null,
  });
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState(null);

  const openRecordModal = async () => {
    setShowRecordModal(true);
    if (beneficiariesList.length === 0) {
      setLoadingBeneficiaries(true);
      try {
        const res = await beneficiaryApi.list();
        setBeneficiariesList(res.data?.data || []);
      } catch (e) {
        console.warn('Failed to load beneficiaries:', e);
      } finally {
        setLoadingBeneficiaries(false);
      }
    }
  };

  const pickRecordFile = async () => {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });
      setRecordForm((prev) => ({ ...prev, proof_document: file }));
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Hindi Ma-attach', 'Pumili ng PDF o larawan (JPG, PNG).');
      }
    }
  };

  const handleCreateIntervention = async () => {
    if (!selectedBeneficiaryForRecord?.id) {
      Alert.alert('Pumili ng Benepisyaryo', 'Pumili ng benepisyaryo na tumanggap ng tulong.');
      return;
    }
    if (!recordForm.agency_name.trim()) {
      Alert.alert('Pangalan ng Ahensya', 'Ilagay ang ahensya (e.g. PCSO, DOH, LGU Bongabong).');
      return;
    }
    if (!recordForm.assistance_type.trim()) {
      Alert.alert('Uri ng Ayuda', 'Ilagay ang uri ng tulong (e.g. Medical, Burial, Food).');
      return;
    }
    setSubmittingRecord(true);
    try {
      const formData = new FormData();
      formData.append('beneficiary_id', selectedBeneficiaryForRecord.id);
      formData.append('agency_name', recordForm.agency_name.trim());
      formData.append('assistance_type', recordForm.assistance_type.trim());
      if (recordForm.amount) formData.append('amount', recordForm.amount);
      if (recordForm.date_received) formData.append('date_received', recordForm.date_received);
      if (recordForm.description) formData.append('description', recordForm.description);
      if (recordForm.proof_document) {
        formData.append('document', {
          uri: recordForm.proof_document.fileCopyUri || recordForm.proof_document.uri,
          type: recordForm.proof_document.type || 'application/octet-stream',
          name: recordForm.proof_document.name || 'proof-document',
        });
      }

      await interventionApi.create(formData);
      Alert.alert('Tagumpay', 'Matagumpay na naitala ang interbensyon.');
      setShowRecordModal(false);
      setSelectedBeneficiaryForRecord(null);
      setRecordForm({
        agency_name: '',
        assistance_type: '',
        amount: '',
        date_received: new Date().toISOString().slice(0, 10),
        description: '',
        proof_document: null,
      });
      loadInterventions();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi maitala ang intervention.');
    } finally {
      setSubmittingRecord(false);
    }
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={openRecordModal} style={styles.addRecordHeaderBtn} activeOpacity={0.8}>
            <Text style={styles.addRecordHeaderBtnText}>+ Mag-record</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={loadInterventions} style={styles.refreshBtn}>
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
                    onPress={() => setPreviewDocUrl(selectedItem.proof_document_url)}
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

      {/* Record New Intervention Modal for Staff */}
      <Modal visible={showRecordModal} transparent animationType="slide" onRequestClose={() => setShowRecordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Mag-record ng Intervention</Text>
                <Text style={styles.applicantName}>Cross-Agency Financial/In-Kind Assistance</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRecordModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.recordFormScroll} keyboardShouldPersistTaps="handled">
              {/* Beneficiary Selector */}
              <Text style={styles.formSectionLabel}>1. Piliin ang Benepisyaryo *</Text>
              {selectedBeneficiaryForRecord ? (
                <View style={styles.selectedBenBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedBenName}>
                      {selectedBeneficiaryForRecord.first_name} {selectedBeneficiaryForRecord.last_name}
                    </Text>
                    <Text style={styles.selectedBenSub}>
                      ID: {selectedBeneficiaryForRecord.beneficiary_id_code || selectedBeneficiaryForRecord.household_id_number || 'N/A'} • Brgy. {selectedBeneficiaryForRecord.Barangay?.barangay_name || selectedBeneficiaryForRecord.barangay || '—'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedBeneficiaryForRecord(null)} style={styles.changeBenBtn}>
                    <Text style={styles.changeBenBtnText}>Palitan</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.benSelectWrap}>
                  <TextInput
                    style={[styles.searchInputSmall, darkMode && styles.darkInput]}
                    placeholder="Maghanap ng pangalan o ID ng benepisyaryo..."
                    placeholderTextColor="#94a3b8"
                    value={benSearch}
                    onChangeText={setBenSearch}
                  />
                  {loadingBeneficiaries ? (
                    <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 8 }} />
                  ) : (
                    <ScrollView style={styles.benListSmall} nestedScrollEnabled>
                      {beneficiariesList
                        .filter((b) => {
                          const q = benSearch.toLowerCase().trim();
                          if (!q) return true;
                          const name = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
                          const id = `${b.beneficiary_id_code || ''} ${b.household_id_number || ''}`.toLowerCase();
                          return name.includes(q) || id.includes(q);
                        })
                        .slice(0, 8)
                        .map((b) => (
                          <TouchableOpacity
                            key={b.id}
                            style={styles.benListItem}
                            onPress={() => {
                              setSelectedBeneficiaryForRecord(b);
                              setBenSearch('');
                            }}
                          >
                            <Text style={styles.benListName}>{b.first_name} {b.last_name}</Text>
                            <Text style={styles.benListSub}>{b.category} • Brgy. {b.Barangay?.barangay_name || b.barangay || '—'}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Assistance Details */}
              <Text style={styles.formSectionLabel}>2. Detalye ng Tulong</Text>
              
              <Text style={styles.formInputLabel}>Pangalan ng Ahensya / Nagbigay *</Text>
              <TextInput
                style={[styles.formInput, darkMode && styles.darkInput]}
                placeholder="Hal. PCSO, DOH, LGU Bongabong, Office of the Mayor"
                placeholderTextColor="#94a3b8"
                value={recordForm.agency_name}
                onChangeText={(val) => setRecordForm((prev) => ({ ...prev, agency_name: val }))}
              />

              <Text style={styles.formInputLabel}>Uri ng Tulong (Assistance Type) *</Text>
              <TextInput
                style={[styles.formInput, darkMode && styles.darkInput]}
                placeholder="Hal. Medical, Burial, Educational, Food Subsidy"
                placeholderTextColor="#94a3b8"
                value={recordForm.assistance_type}
                onChangeText={(val) => setRecordForm((prev) => ({ ...prev, assistance_type: val }))}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Halaga (Amount in ₱)</Text>
                  <TextInput
                    style={[styles.formInput, darkMode && styles.darkInput]}
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={recordForm.amount}
                    onChangeText={(val) => setRecordForm((prev) => ({ ...prev, amount: val }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formInputLabel}>Petsa Natanggap</Text>
                  <TextInput
                    style={[styles.formInput, darkMode && styles.darkInput]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={recordForm.date_received}
                    onChangeText={(val) => setRecordForm((prev) => ({ ...prev, date_received: val }))}
                  />
                </View>
              </View>

              <Text style={styles.formInputLabel}>Pahayag / Tala (Description)</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMultiline, darkMode && styles.darkInput]}
                placeholder="Karagdagang tala ukol sa interbensyon..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={recordForm.description}
                onChangeText={(val) => setRecordForm((prev) => ({ ...prev, description: val }))}
              />

              {/* Document Attachment */}
              <Text style={styles.formSectionLabel}>3. Katibayan / Proof Document</Text>
              <TouchableOpacity style={styles.attachFileBtn} onPress={pickRecordFile}>
                <Text style={styles.attachFileBtnText}>
                  {recordForm.proof_document ? '✓ Palitan ang Nakalakip na File' : '📎 Mag-attach ng Katibayan (PDF / Larawan)'}
                </Text>
              </TouchableOpacity>
              {recordForm.proof_document ? (
                <View style={styles.attachedFileBadge}>
                  <Text style={styles.attachedFileName} numberOfLines={1}>
                    📄 {recordForm.proof_document.name || 'document'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.attachHint}>Opsyonal ngunit inirerekomenda para sa opisyal na talaan</Text>
              )}

              {/* Submit Buttons */}
              <View style={styles.recordFormActions}>
                <TouchableOpacity
                  style={[styles.submitRecordBtn, submittingRecord && styles.btnDisabled]}
                  onPress={handleCreateIntervention}
                  disabled={submittingRecord}
                >
                  {submittingRecord ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitRecordBtnText}>✓ I-save at Itala ang Intervention</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelRecordBtn}
                  onPress={() => setShowRecordModal(false)}
                  disabled={submittingRecord}
                >
                  <Text style={styles.cancelRecordBtnText}>Kanselahin</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Proof Document Preview Modal */}
      <Modal visible={!!previewDocUrl} transparent animationType="slide" onRequestClose={() => setPreviewDocUrl(null)}>
        <SafeAreaView style={styles.docPreviewOverlay}>
          <View style={styles.docPreviewCard}>
            <View style={styles.docPreviewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.docPreviewTitle}>Nakalakip na Katibayan / Proof</Text>
                <Text style={styles.docPreviewSub}>Dokumento ng Tulong / Intervention</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewDocUrl(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.docPreviewBody} maximumZoomScale={3} minimumZoomScale={1}>
              {previewDocUrl && isImageFile(previewDocUrl) ? (
                <Image
                  source={{ uri: resolveFileUrl(previewDocUrl) }}
                  style={styles.fullPreviewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.pdfCenterBox}>
                  <Text style={{ fontSize: 50 }}>📄</Text>
                  <Text style={styles.pdfHeading}>Dokumento (PDF / File)</Text>
                  <Text style={styles.pdfText}>Pindutin ang pindutan sa ibaba upang buksan sa browser o PDF viewer.</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.docPreviewFooter}>
              {previewDocUrl ? (
                <TouchableOpacity
                  style={styles.openExternalDocBtn}
                  onPress={() => {
                    const url = resolveFileUrl(previewDocUrl);
                    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Hindi mabuksan ang file link.'));
                  }}
                >
                  <Text style={styles.openExternalDocBtnText}>⬇ Buksan / I-download ang Buong File</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setPreviewDocUrl(null)}>
                <Text style={styles.closePreviewBtnText}>Isara</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
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
  addRecordHeaderBtn: { backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addRecordHeaderBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  recordFormScroll: { paddingBottom: 30, gap: 8 },
  formSectionLabel: { fontSize: 13, fontWeight: '800', color: '#1e40af', marginTop: 12, marginBottom: 4 },
  formInputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 6, marginBottom: 2 },
  formInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0f172a' },
  formInputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  selectedBenBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 10, padding: 12, gap: 10 },
  selectedBenName: { fontSize: 14, fontWeight: '800', color: '#1e40af' },
  selectedBenSub: { fontSize: 11, color: '#475569', marginTop: 2 },
  changeBenBtn: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  changeBenBtnText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  benSelectWrap: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 8 },
  searchInputSmall: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: '#0f172a' },
  benListSmall: { maxHeight: 150, marginTop: 6 },
  benListItem: { paddingVertical: 8, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  benListName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  benListSub: { fontSize: 10.5, color: '#64748b' },
  attachFileBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  attachFileBtnText: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' },
  attachedFileBadge: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 6, padding: 8, marginTop: 4 },
  attachedFileName: { fontSize: 12, color: '#065f46', fontWeight: '600' },
  attachHint: { fontSize: 10.5, color: '#94a3b8', marginTop: 3 },
  recordFormActions: { marginTop: 18, gap: 8 },
  submitRecordBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  submitRecordBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  cancelRecordBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  cancelRecordBtnText: { color: '#475569', fontSize: 12, fontWeight: '700' },

  // Document preview modal styles
  docPreviewOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.85)', justifyContent: 'center', padding: 14 },
  docPreviewCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxHeight: '92%', elevation: 14 },
  docPreviewHeader: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  docPreviewTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  docPreviewSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  docPreviewBody: { padding: 16, alignItems: 'center', minHeight: 280, justifyContent: 'center' },
  fullPreviewImage: { width: '100%', height: 360, borderRadius: 12, backgroundColor: '#f8fafc' },
  pdfCenterBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  pdfHeading: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  pdfText: { color: '#64748b', fontSize: 12, textAlign: 'center', maxWidth: 280 },
  docPreviewFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafafa', gap: 8 },
  openExternalDocBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  openExternalDocBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  closePreviewBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  closePreviewBtnText: { color: '#475569', fontSize: 12, fontWeight: '700' },
});

export default StaffInterventionsScreen;


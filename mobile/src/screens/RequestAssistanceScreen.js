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
  Alert,
  Modal,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { assistanceRequestApi } from '../services/api';
import { getRequirementsForType } from '../utils/assistanceRequirements';

const ASSISTANCE_CATEGORIES = [
  {
    id: 'Medical Assistance',
    title: 'Medical & Medicines',
    sub: 'Gamot at Maintenance',
    icon: '💊',
  },
  {
    id: 'Hospital Assistance',
    title: 'Hospital Confinement',
    sub: 'Ospital at Confinement',
    icon: '🏥',
  },
  {
    id: 'Laboratory Assistance',
    title: 'Diagnostics & Lab',
    sub: 'Laboratory at Pagsusuri',
    icon: '🔬',
  },
  {
    id: 'Educational Assistance',
    title: 'Educational Aid',
    sub: 'Tulong Pang-edukasyon',
    icon: '🎓',
  },
  {
    id: 'Financial Assistance',
    title: 'Financial Aid (AICS)',
    sub: 'Pangkagipitang Ayuda',
    icon: '💼',
  },
  {
    id: 'Burial Assistance',
    title: 'Burial Assistance',
    sub: 'Tulong sa Pagpapalibing',
    icon: '🕊️',
  },
  {
    id: 'Food & Relief Assistance',
    title: 'Food & Relief Goods',
    sub: 'Ayuda sa Pagkain',
    icon: '📦',
  },
];

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getSupportedMimeType = (file) => {
  const extension = String(file.name || '').split('.').pop()?.toLowerCase();
  const mimeByExtension = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const extensionMimeType = mimeByExtension[extension];
  const declaredMimeType = file.type && file.type !== 'application/octet-stream' ? file.type : null;
  if (extensionMimeType && declaredMimeType && extensionMimeType !== declaredMimeType) return null;
  const mimeType = declaredMimeType || extensionMimeType;
  return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    ? mimeType
    : null;
};

export default function RequestAssistanceScreen({ onBack, user, profile, onRefreshPopups }) {
  const [selectedAgency, setSelectedAgency] = useState('DSWD');
  const [selectedType, setSelectedType] = useState('Medical Assistance');
  const [amount, setAmount] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeView, setActiveView] = useState('form'); // 'form' | 'history'

  // Document attachments state
  const [requirementFiles, setRequirementFiles] = useState({});
  const [activeAttachReq, setActiveAttachReq] = useState(null);

  const activeBen = profile || {};
  const displayName = `${activeBen.first_name || user?.first_name || 'Beneficiary'} ${activeBen.last_name || user?.last_name || ''}`.trim();
  const categoryName = activeBen.category || 'Category not set';
  const barangayName = activeBen.barangay_name || activeBen.Barangay?.barangay_name || activeBen.barangay || 'Not available';

  const currentRequirements = getRequirementsForType(selectedType);
  const reqList = currentRequirements?.requirements || [];
  const attachedCount = Object.keys(requirementFiles).length;
  const totalReqCount = reqList.length;

  const loadRequests = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await assistanceRequestApi.list();
      setMyRequests(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load assistance history:', err?.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAttachFile = async (requirement) => {
    try {
      const selectedFile = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
        copyTo: 'cachesDirectory',
      });
      const mimeType = getSupportedMimeType(selectedFile);
      const fileUri = selectedFile.fileCopyUri || selectedFile.uri;

      if (!mimeType || !fileUri) {
        Alert.alert('Hindi suportadong file', 'PDF, JPG, PNG, o WEBP lamang ang maaaring i-attach.');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        Alert.alert('Masyadong malaking file', 'Hanggang 10 MB lamang ang bawat dokumento.');
        return;
      }

      setRequirementFiles((prev) => ({
        ...prev,
        [requirement.id]: {
          uri: fileUri,
          name: selectedFile.name || `document-${requirement.id}`,
          size: selectedFile.size,
          sizeStr: formatFileSize(selectedFile.size),
          type: mimeType,
        },
      }));
      setActiveAttachReq(null);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Hindi mabuksan ang file', error?.message || 'Subukan ulit pumili ng dokumento.');
      }
    }
  };

  const handleRemoveFile = (reqId) => {
    setRequirementFiles((prev) => {
      const updated = { ...prev };
      delete updated[reqId];
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert('Kulang ang Datos', 'Mangyaring ilagay ang layunin o paksa ng inyong kahilingan.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Kulang ang Datos', 'Mangyaring ipaliwanag nang detalyado ang inyong sitwasyon.');
      return;
    }

    try {
      setSubmitting(true);

      const attachedEntries = Object.entries(requirementFiles);
      const payload = new FormData();
      payload.append('agency', selectedAgency);
      payload.append('type', selectedType);
      payload.append('subject', subject.trim());
      payload.append('description', description.trim());

      const attachmentMetadata = attachedEntries.map(([reqId, file]) => {
        const reqMeta = reqList.find((r) => r.id === reqId);
        const fieldName = `attachment_${reqId}`;
        payload.append(fieldName, {
          uri: file.uri,
          name: file.name,
          type: file.type,
        });
        return {
          fieldName,
          reqId,
          reqName: reqMeta?.filipinoName || reqMeta?.name || reqId,
          originalName: file.name,
        };
      });
      if (attachmentMetadata.length > 0) {
        payload.append('attachment_metadata', JSON.stringify(attachmentMetadata));
      }

      const res = await assistanceRequestApi.create(payload);
      if (res.data?.success || res.status === 200 || res.status === 201) {
        setSubject('');
        setDescription('');
        setAmount('');
        setRequirementFiles({});
        loadRequests();
        setActiveView('history');
        if (typeof onRefreshPopups === 'function') {
          setTimeout(() => {
            onRefreshPopups();
          }, 350);
        }
      } else {
        Alert.alert('Puna', res.data?.message || 'Hindi ma-proseso ang kahilingan.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      Alert.alert('Error sa Pagsusumite', err.response?.data?.message || err.message || 'May problema sa koneksyon.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Request Assistance</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section (Image 2) */}
        <View style={styles.headerSection}>
          <Text style={styles.headerKicker}>SOCIAL WELFARE PORTAL</Text>
          <Text style={styles.headerTitle}>Request Assistance</Text>
          <Text style={styles.headerSubtitle}>
            Magsumite ng kahilingan sa ayuda para sa pagsusuri ng DSWD.
          </Text>

          <View style={styles.tabButtonsRow}>
            <TouchableOpacity
              style={[styles.switcherTab, activeView === 'form' && styles.switcherTabActive]}
              onPress={() => setActiveView('form')}
            >
              <Text style={[styles.switcherTabText, activeView === 'form' && styles.switcherTabTextActive]}>
                Mag-apply (New Request)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.switcherTab, activeView === 'history' && styles.switcherTabActive]}
              onPress={() => setActiveView('history')}
            >
              <Text style={[styles.switcherTabText, activeView === 'history' && styles.switcherTabTextActive]}>
                Aking mga Request ({myRequests.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Beneficiary Meta Strip (Image 2) */}
        <View style={styles.metaStrip}>
          <Text style={styles.metaStripText}>
            <Text style={{ fontWeight: '800', color: '#0f172a' }}>{displayName}</Text> • {categoryName} • {barangayName}
          </Text>
          <View style={styles.accountVerifiedBadge}>
            <Text style={styles.accountVerifiedText}>Account: <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>● Approved</Text></Text>
          </View>
        </View>

        {activeView === 'form' ? (
          <>
            {/* SECTION 1: KANINONG TANGGAPAN IPAPADALA (Image 2) */}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>1. KANINONG TANGGAPAN IPAPADALA ANG REQUEST?</Text>
              <Text style={styles.sectionHeadingSub}>Ang kahilingan ay ipapadala sa DSWD.</Text>
            </View>

            {/* Policy Banner (Image 2) */}
            <View style={styles.policyCard}>
              <View style={styles.policyTopRow}>
                <Text style={{ fontSize: 16 }}>⚖️</Text>
                <Text style={styles.policyTitle}>Patakaran sa Paghiling (DSWD):</Text>
              </View>
              <Text style={styles.policyText}>
                Maaaring mag-request ng tulong sa DSWD ang mga benepisyaryo, kabilang ang 4Ps, Senior Citizens, at PWD. Susuriin ng DSWD ang kahilingan at mga kinakailangang dokumento bago ito aprubahan.
              </Text>
            </View>

            {/* Agency Selection Cards (Image 2) */}
            <View style={styles.agenciesRow}>
              {/* DSWD Card */}
              <TouchableOpacity
                style={[styles.agencyCard, selectedAgency === 'DSWD' && styles.agencyCardSelected]}
                onPress={() => setSelectedAgency('DSWD')}
                activeOpacity={0.8}
              >
                <View style={styles.agencyTop}>
                  <View style={styles.agencyIconBox}>
                    <Text style={{ fontSize: 18 }}>🏛️</Text>
                  </View>
                  <Text style={styles.agencyName}>DSWD Office</Text>
                  <View style={[styles.checkCircle, selectedAgency === 'DSWD' && styles.checkCircleSelected]}>
                    {selectedAgency === 'DSWD' && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </View>

                <View style={styles.nationalTag}>
                  <Text style={styles.nationalTagText}>National Agency (Pambansa)</Text>
                </View>

                <Text style={styles.agencyDesc}>
                  Para sa 4Ps, National AICS emergency financial grant, at tulong-medikal sa malalaking ospital.
                </Text>

                <Text style={styles.agencyFooter}>Direktang susuriin ng DSWD Admin</Text>
              </TouchableOpacity>

              {/* MSWDO option removed from the beneficiary request form. */}
              {false && (
              <TouchableOpacity
                style={[styles.agencyCard, selectedAgency === 'MSWDO' && styles.agencyCardSelected]}
                onPress={() => setSelectedAgency('MSWDO')}
                activeOpacity={0.8}
              >
                <View style={styles.agencyTop}>
                  <View style={[styles.agencyIconBox, { backgroundColor: '#dcfce7' }]}>
                    <Text style={{ fontSize: 18 }}>🏢</Text>
                  </View>
                  <Text style={styles.agencyName}>MSWDO Office</Text>
                  <View style={[styles.checkCircle, selectedAgency === 'MSWDO' && styles.checkCircleSelected]}>
                    {selectedAgency === 'MSWDO' && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </View>

                <View style={styles.lguTag}>
                  <Text style={styles.lguTagText}>Municipal / LGU (Lokal na Pamahalaan)</Text>
                </View>

                <Text style={styles.agencyDesc}>
                  Para sa mga residente kabilang ang Senior Citizens (OSCA), PWD, 4Ps, at mga pamilyang nangangailangan ng lokal na ayuda ng bayan.
                </Text>

                <Text style={styles.agencyFooter}>Direktang susuriin ng MSWDO Admin</Text>
              </TouchableOpacity>
              )}
            </View>

            {/* SECTION 2: URI NG TULONG (ASSISTANCE TYPE) (Image 2) */}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>2. URI NG TULONG (ASSISTANCE TYPE)</Text>
              <Text style={styles.sectionHeadingSub}>Piliin ang kaukulang tulong</Text>
            </View>

            <View style={styles.categoriesGrid}>
              {ASSISTANCE_CATEGORIES.map((cat) => {
                const isSelected = selectedType === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catCard, isSelected && styles.catCardSelected]}
                    onPress={() => {
                      setSelectedType(cat.id);
                      setRequirementFiles({});
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.catCardTop}>
                      <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                      {isSelected && (
                        <View style={styles.catSelectedBadge}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.catTitle, isSelected && styles.catTitleSelected]}>{cat.title}</Text>
                    <Text style={styles.catSub}>{cat.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SECTION 3: MGA DETALYE NG KAHILINGAN */}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>3. MGA DETALYE NG KAHILINGAN</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>PAKSA O LAYUNIN *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="hal. Kahilingan para sa gamot sa hypertension / chemotherapy"
                placeholderTextColor="#94a3b8"
                value={subject}
                onChangeText={setSubject}
              />

              <Text style={styles.inputLabel}>INAASAHANG HALAGA (₱ - Opsyonal)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="hal. 5000"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.inputLabel}>PALIWANAG AT SITWASYON *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Ilarawan nang maayos ang inyong sitwasyon, ospital, pasyente o mga detalye na makatutulong sa pagsusuri ng social worker..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* SECTION 4: MGA KINAKAILANGANG DOKUMENTO (ATTACH FILES BAWAT REQUIREMENT) */}
            <View style={styles.section4Container}>
              <View style={styles.section4HeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeading}>
                    📄 4. MGA KINAKAILANGANG DOKUMENTO (ATTACH FILES BAWAT REQUIREMENT)
                  </Text>
                  <Text style={styles.sectionHeadingSub}>
                    I-attach ang kaukulang file sa dulo ng bawat requirement (Magkakahiwalay):
                  </Text>
                </View>
                <View style={styles.attachCounterBadge}>
                  <Text style={styles.attachCounterText}>
                    {attachedCount} sa {totalReqCount} naka-attach
                  </Text>
                </View>
              </View>

              {/* Requirements List (matching exact image) */}
              <View style={styles.reqList}>
                {reqList.map((req, idx) => {
                  const isAttached = Boolean(requirementFiles[req.id]);
                  const file = requirementFiles[req.id];
                  const isMandatory = req.mandatory !== false;

                  return (
                    <View
                      key={req.id || idx}
                      style={[
                        styles.reqCard,
                        isAttached && styles.reqCardAttached,
                      ]}
                    >
                      <View style={styles.reqCardContent}>
                        {/* Number / Check circle */}
                        <View
                          style={[
                            styles.reqNumberCircle,
                            isAttached && styles.reqNumberCircleAttached,
                          ]}
                        >
                          <Text
                            style={[
                              styles.reqNumberText,
                              isAttached && styles.reqNumberTextAttached,
                            ]}
                          >
                            {isAttached ? '✓' : idx + 1}
                          </Text>
                        </View>

                        {/* Title, Tag, and Description */}
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <View style={styles.reqTitleRow}>
                            <Text style={styles.reqTitle}>
                              {req.filipinoName || req.name}
                            </Text>
                            <View
                              style={[
                                styles.reqTagBadge,
                                isMandatory ? styles.reqTagMandatory : styles.reqTagSupporting,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.reqTagText,
                                  isMandatory ? styles.reqTagTextMandatory : styles.reqTagTextSupporting,
                                ]}
                              >
                                {req.tag || (isMandatory ? 'Kailangan (Required)' : 'Suporta (Supporting)')}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.reqDescription}>{req.description}</Text>

                          {/* If attached: show filename and remove button */}
                          {isAttached && (
                            <View style={styles.attachedFileInfoRow}>
                              <Text style={styles.attachedFileName}>
                                📎 {file.name} ({file.sizeStr || '245 KB'})
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleRemoveFile(req.id)}
                                style={styles.removeFileBtn}
                              >
                                <Text style={styles.removeFileBtnText}>✕ Alisin</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Right Action: Attach File Button (when not attached) */}
                        {!isAttached && (
                          <TouchableOpacity
                            style={styles.attachBtn}
                            onPress={() => setActiveAttachReq(req)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.attachBtnText}>📎 Attach File</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Paalala Box (exact text from picture) */}
              <View style={styles.paalalaBox}>
                  <Text style={styles.paalalaText}>
                  <Text style={{ fontWeight: 'bold' }}>💡 Paalala:</Text> Hindi kailangang makumpleto agad ang lahat ng online attachments upang maipasa ang request. Maaaring i-submit ang application at dalhin ang pisikal na kopya ng mga dokumento sa tanggapan ng {selectedAgency} (Department of Social Welfare and Development) kapag ipinatawag para sa verification at releasing.
                </Text>
              </View>
            </View>

            {/* Submission Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Isumite ang Kahilingan sa {selectedAgency}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* History View */
          <View style={styles.historyContainer}>
            {loadingHistory ? (
              <ActivityIndicator size="large" color="#1d4ed8" style={{ marginTop: 24 }} />
            ) : myRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
                <Text style={styles.emptyTitle}>Walang Nakaraang Kahilingan</Text>
                <Text style={styles.emptySub}>Wala ka pang naisusumiteng request sa DSWD.</Text>
              </View>
            ) : (
              myRequests.map((req, index) => (
                <View key={req.id || index} style={styles.historyCard}>
                  <View style={styles.historyTopRow}>
                    <Text style={styles.historyAgency}>{req.agency || 'DSWD'}</Text>
                    <View style={styles.historyStatusPill}>
                      <Text style={styles.historyStatusText}>{req.status || 'Pending'}</Text>
                    </View>
                    <Text style={styles.historyDate}>{formatDate(req.created_at)}</Text>
                  </View>
                  <Text style={styles.historyTitle}>{req.subject || req.type}</Text>
                  <Text style={styles.historyDesc}>{req.description}</Text>
                  {req.amount_requested ? (
                    <Text style={styles.historyAmount}>
                      Hinihiling na halaga: ₱{Number(req.amount_requested).toLocaleString('en-PH')}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Attach File Modal */}
      <Modal
        visible={Boolean(activeAttachReq)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveAttachReq(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach Document</Text>
              <TouchableOpacity onPress={() => setActiveAttachReq(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Kinakailangan: <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{activeAttachReq?.filipinoName || activeAttachReq?.name}</Text>
            </Text>

            <Text style={styles.modalSectionLabel}>PUMILI NG TOTOONG FILE SA IYONG PHONE:</Text>
            <TouchableOpacity
              style={styles.customFileBtn}
              onPress={() => handleAttachFile(activeAttachReq)}
              activeOpacity={0.8}
            >
              <Text style={styles.customFileBtnText}>Pumili ng PDF o larawan</Text>
            </TouchableOpacity>
            <Text style={styles.presetSize}>PDF, JPG, PNG, o WEBP hanggang 10 MB bawat file.</Text>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setActiveAttachReq(null)}
            >
              <Text style={styles.modalCancelBtnText}>Kanselahin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  // Header Section
  headerSection: {
    marginBottom: 14,
  },
  headerKicker: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  tabButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  switcherTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  switcherTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  switcherTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  switcherTabTextActive: {
    color: '#ffffff',
  },
  // Meta Strip
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 6,
  },
  metaStripText: {
    fontSize: 11.5,
    color: '#64748b',
  },
  accountVerifiedBadge: {},
  accountVerifiedText: {
    fontSize: 11.5,
    color: '#334155',
  },
  // Section Headings
  sectionHeadingRow: {
    marginBottom: 8,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  sectionHeadingSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  // Policy Card
  policyCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 12,
  },
  policyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  policyTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#92400e',
  },
  policyText: {
    fontSize: 11.5,
    color: '#78350f',
    lineHeight: 16,
  },
  // Agencies Selection
  agenciesRow: {
    gap: 10,
    marginBottom: 16,
  },
  agencyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  agencyCardSelected: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
  },
  agencyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  agencyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  agencyName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  nationalTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  nationalTagText: {
    color: '#1d4ed8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  lguTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  lguTagText: {
    color: '#059669',
    fontSize: 10.5,
    fontWeight: '700',
  },
  agencyDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
  },
  agencyFooter: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
  },
  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  catCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  catCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  catCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catSelectedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1e293b',
  },
  catTitleSelected: {
    color: '#1d4ed8',
  },
  catSub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  // Form Card
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  // SECTION 4: MGA KINAKAILANGANG DOKUMENTO
  section4Container: {
    marginBottom: 16,
  },
  section4HeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  attachCounterBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  attachCounterText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  reqList: {
    gap: 10,
  },
  reqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  reqCardAttached: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  reqCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reqNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reqNumberCircleAttached: {
    backgroundColor: '#16a34a',
  },
  reqNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  reqNumberTextAttached: {
    color: '#ffffff',
  },
  reqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  reqTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  reqTagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reqTagMandatory: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  reqTagSupporting: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reqTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  reqTagTextMandatory: {
    color: '#b45309',
  },
  reqTagTextSupporting: {
    color: '#64748b',
  },
  reqDescription: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  attachedFileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  attachedFileName: {
    flex: 1,
    marginRight: 8,
    fontSize: 11,
    color: '#15803d',
    fontWeight: '700',
  },
  removeFileBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  removeFileBtnText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  attachBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    alignSelf: 'center',
  },
  attachBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  // Paalala Box
  paalalaBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  paalalaText: {
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 17,
  },
  // Submit Button
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: 'bold',
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetSize: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  customFileBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customFileBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  modalCancelBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  // History View
  historyContainer: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  historyAgency: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyStatusPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#b45309',
  },
  historyDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  historyDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
  },
  historyAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
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
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});

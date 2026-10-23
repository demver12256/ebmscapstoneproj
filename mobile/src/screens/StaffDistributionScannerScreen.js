import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { distributionApi } from '../services/api';
import QrCameraScanner from '../components/QrCameraScanner';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const StaffDistributionScannerScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [rfidInput, setRfidInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [scannedHistory, setScannedHistory] = useState([]);
  const [verifiedBeneficiary, setVerifiedBeneficiary] = useState(null);
  const [eventSelectModal, setEventSelectModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null); // { type: 'success'|'error', text: '' }
  const [cameraActive, setCameraActive] = useState(false);
  const inputRef = useRef(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await distributionApi.listEvents();
      const all = res.data?.data || [];
      const activeOrScheduled = all.filter(
        (e) => e.status === 'ongoing' || e.status === 'scheduled'
      );
      setEvents(all);
      // Strictly prioritize active/ongoing or scheduled events! Never auto-select completed!
      if (activeOrScheduled.length > 0) {
        if (!selectedEventId || !all.some((e) => e.id === Number(selectedEventId) && e.status !== 'completed')) {
          setSelectedEventId(activeOrScheduled[0].id);
        }
      } else {
        setSelectedEventId(null);
      }
    } catch (err) {
      console.warn('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadEventTransactions = useCallback(async (eventId) => {
    if (!eventId) return;
    try {
      const res = await distributionApi.getTransactions(eventId);
      setTransactions(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load transactions:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadEventTransactions(selectedEventId);
      setVerifiedBeneficiary(null);
      setAlertMsg(null);
    }
  }, [selectedEventId, loadEventTransactions]);

  const currentEvent = events.find((e) => e.id === Number(selectedEventId));
  const pendingTxns = transactions.filter((t) => t.status === 'pending');
  const releasedTxns = transactions.filter((t) => t.status === 'released' || t.status === 'completed');

  const handleScanSubmit = async (customCode = null) => {
    const code = (customCode || rfidInput).trim();
    if (!code) {
      setAlertMsg({ type: 'error', text: 'Pakilagay o i-scan ang RFID card o QR code.' });
      return;
    }
    if (!selectedEventId) {
      setAlertMsg({ type: 'error', text: 'Pumili muna ng aktibong Distribution Event sa itaas.' });
      return;
    }

    if (currentEvent && currentEvent.status?.toLowerCase() === 'completed') {
      Alert.alert(
        'Tapos na ang Event',
        'Ang distribution event na ito ay COMPLETED na. Bawal na itong buksan upang mag-scan muli.'
      );
      setAlertMsg({
        type: 'error',
        text: '🔒 Ang distribution event na ito ay COMPLETED na. Bawal na itong buksan upang mag-scan muli.',
      });
      return;
    }

    if (currentEvent && currentEvent.status !== 'ongoing') {
      setAlertMsg({
        type: 'error',
        text: `❌ Ang distribution session na ito ay hindi aktibo (Status: ${currentEvent.status}). Pakisabihan ang admin na simulan ang pamamahagi.`,
      });
      return;
    }

    setProcessing(true);
    setAlertMsg(null);
    setRfidInput('');

    try {
      const cleanInput = code.trim();
      const qrToken = cleanInput.replace(/^EBMS-QR:/i, '').trim();

      // Refresh transactions to avoid stale matching (Matching Web RfidScannerPage)
      let currentTxns = transactions;
      try {
        const txnRes = await distributionApi.getTransactions(selectedEventId);
        if (txnRes.data?.data) {
          currentTxns = txnRes.data.data;
          setTransactions(currentTxns);
        }
      } catch (e) {
        // Fallback to local transactions if offline or network hiccup
      }

      const matchesInput = (b) => {
        if (!b) return false;
        const rfidVal = String(b.RFID_number || '').trim().toLowerCase();
        const qrVal = String(b.qr_token || b.qr_code_token || '').trim().toLowerCase();
        const qrFullVal = String(b.qr_code || '').trim().toLowerCase();
        const codeVal = String(b.beneficiary_id_code || '').trim().toLowerCase();
        const rawLower = cleanInput.toLowerCase();
        const tokenLower = qrToken.toLowerCase();

        const matchesRfid = rfidVal && (rfidVal === rawLower || rfidVal === tokenLower);
        const matchesQr =
          (qrVal && (qrVal === tokenLower || qrVal === rawLower)) ||
          (qrFullVal && (qrFullVal === rawLower || qrFullVal === `ebms-qr:${tokenLower}`));
        const matchesCode = codeVal && (codeVal === tokenLower || codeVal === rawLower);
        return Boolean(matchesRfid || matchesQr || matchesCode);
      };

      // Prioritize pending transactions
      const matchedTxn =
        currentTxns.find((t) => t.status === 'pending' && matchesInput(t.Beneficiary)) ||
        currentTxns.find((t) => matchesInput(t.Beneficiary));

      if (!matchedTxn) {
        setAlertMsg({
          type: 'error',
          text: `Walang kwalipikadong benepisyaryo sa event na ito para sa RFID / QR Pass: "${code}".`,
        });
        return;
      }

      if (matchedTxn.status === 'released' || matchedTxn.status === 'completed') {
        setAlertMsg({
          type: 'error',
          text: `⚠️ Na-release na ang ayuda para kay ${matchedTxn.Beneficiary?.first_name} ${matchedTxn.Beneficiary?.last_name}.`,
        });
        return;
      }

      // Found matching pending transaction!
      setVerifiedBeneficiary({
        transaction: matchedTxn,
        beneficiary: matchedTxn.Beneficiary,
      });
      setAlertMsg({
        type: 'success',
        text: `✓ Na-verify si ${matchedTxn.Beneficiary?.first_name} ${matchedTxn.Beneficiary?.last_name}! Handa nang i-release ang ayuda.`,
      });
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err?.response?.data?.message || err.message || 'Error sa pag-verify ng card o QR code.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmRelease = async () => {
    if (!verifiedBeneficiary) return;
    const { transaction, beneficiary } = verifiedBeneficiary;
    setProcessing(true);

    try {
      await distributionApi.releaseBenefit(selectedEventId, transaction.id, {
        disbursement_type: beneficiary.payout_preference || 'cash',
        released_amount: transaction.amount,
        verified_by: user?.first_name || 'Staff',
      });

      const newRecord = {
        id: Date.now(),
        name: `${beneficiary.first_name} ${beneficiary.last_name}`,
        code: beneficiary.beneficiary_id_code || beneficiary.RFID_number,
        amount: transaction.amount,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setScannedHistory((prev) => [newRecord, ...prev]);
      setAlertMsg({
        type: 'success',
        text: `🎉 Matagumpay na na-release ang ${formatMoney(transaction.amount)} kay ${beneficiary.first_name} ${beneficiary.last_name}!`,
      });
      setVerifiedBeneficiary(null);
      loadEventTransactions(selectedEventId);
    } catch (err) {
      Alert.alert(
        'Release Error',
        err?.response?.data?.message || err.message || 'Failed to release benefit.'
      );
    } finally {
      setProcessing(false);
    }
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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Distribution Scanner</Text>
            <Text style={styles.headerSub}>RFID Card & QR Code Aid Payout</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => loadEvents()} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Event Selector Card */}
        <TouchableOpacity
          style={[styles.eventSelectCard, darkMode && styles.darkCard]}
          onPress={() => setEventSelectModal(true)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.eventSelectLabel}>SELECTED DISTRIBUTION EVENT</Text>
            <Text style={[styles.eventSelectTitle, darkMode && styles.darkText]} numberOfLines={1}>
              {currentEvent ? currentEvent.title : 'Select an Event'}
            </Text>
            <Text style={styles.eventSelectSub}>
              {currentEvent?.Program?.name || 'Program'} • Status: {(currentEvent?.status || 'Scheduled').toUpperCase()}
            </Text>
          </View>
          <View style={styles.eventSelectCaret}>
            <Text style={styles.caretText}>▼</Text>
          </View>
        </TouchableOpacity>

        {/* Event KPI Strip */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: '#2563eb' }]}>
            <Text style={styles.kpiLabel}>Total Recipient</Text>
            <Text style={[styles.kpiVal, { color: '#2563eb' }]}>{transactions.length}</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#16a34a' }]}>
            <Text style={styles.kpiLabel}>Released</Text>
            <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{releasedTxns.length}</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: '#d97706' }]}>
            <Text style={styles.kpiLabel}>Pending Claim</Text>
            <Text style={[styles.kpiVal, { color: '#d97706' }]}>{pendingTxns.length}</Text>
          </View>
        </View>

        {/* RFID Tap / Scanner Box OR Completed Lockout Card */}
        {currentEvent && currentEvent.status?.toLowerCase() === 'completed' ? (
          <View style={[styles.completedLockBox, darkMode && styles.darkCard]}>
            <View style={styles.completedLockIconCircle}>
              <Text style={{ fontSize: 36 }}>🔒</Text>
            </View>
            <Text style={[styles.completedLockTitle, darkMode && styles.darkText]}>
              DISTRIBUTION EVENT COMPLETED
            </Text>
            <Text style={styles.completedLockSub}>
              Ang distribution event na ito ay tapos na (Status: COMPLETED). Sarado na ang sesyon at bawal nang mag-scan o mag-release uli ng ayuda.
            </Text>
            <View style={styles.completedStatusPill}>
              <Text style={styles.completedStatusPillText}>✓ STATUS: COMPLETED (LOCKED)</Text>
            </View>
          </View>
        ) : !selectedEventId ? (
          <View style={[styles.completedLockBox, darkMode && styles.darkCard]}>
            <View style={styles.completedLockIconCircle}>
              <Text style={{ fontSize: 36 }}>📋</Text>
            </View>
            <Text style={[styles.completedLockTitle, darkMode && styles.darkText]}>
              WALANG AKTIBONG DISTRIBUTION EVENT
            </Text>
            <Text style={styles.completedLockSub}>
              Walang kasalukuyang ongoing o scheduled na pamamahagi. Ang mga natapos nang event (COMPLETED) ay sarado na at bawal nang buksan para mag-scan uli.
            </Text>
          </View>
        ) : (
          <View style={[styles.scanBox, darkMode && styles.darkCard]}>
            <View style={styles.rfidIconCircle}>
              <Text style={{ fontSize: 32 }}>💳</Text>
            </View>
            <Text style={[styles.scanBoxTitle, darkMode && styles.darkText]}>Tap or Enter Beneficiary Card</Text>
            <Text style={styles.scanBoxSub}>
              I-scan ang RFID card, QR code pass, o i-type ang Card / ID Number
            </Text>

            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                style={[styles.rfidInput, darkMode && styles.darkInput]}
                placeholder="e.g. 10452399 o BEN-2024-..."
                placeholderTextColor="#94a3b8"
                value={rfidInput}
                onChangeText={setRfidInput}
                onSubmitEditing={() => handleScanSubmit()}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.scanBtn, processing && styles.btnDisabled]}
                onPress={() => handleScanSubmit()}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.scanBtnText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Camera QR Scanner Button */}
            {selectedEventId && currentEvent?.status === 'ongoing' && (
              <TouchableOpacity
                style={styles.openCameraBtn}
                onPress={() => setCameraActive(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.openCameraIcon}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.openCameraTitle}>Buksan ang Camera QR Scanner</Text>
                  <Text style={styles.openCameraSub}>
                    Itapat ang QR code pass ng benepisyaryo sa camera
                  </Text>
                </View>
                <Text style={styles.openCameraArrow}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Status Alert Banner */}
        {alertMsg && (
          <View style={[styles.alertBanner, alertMsg.type === 'success' ? styles.alertSuccess : styles.alertError]}>
            <Text style={alertMsg.type === 'success' ? styles.alertSuccessTxt : styles.alertErrorTxt}>
              {alertMsg.text}
            </Text>
          </View>
        )}

        {/* Verified Beneficiary Card (Ready to Release) */}
        {verifiedBeneficiary && (
          <View style={styles.verifiedCard}>
            <View style={styles.verifiedHeader}>
              <View style={styles.verifiedAvatar}>
                <Text style={styles.verifiedAvatarTxt}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.verifiedTitle}>Kwalipikadong Benepisyaryo</Text>
                <Text style={styles.verifiedName}>
                  {verifiedBeneficiary.beneficiary.first_name} {verifiedBeneficiary.beneficiary.last_name}
                </Text>
                <Text style={styles.verifiedMeta}>
                  ID: {verifiedBeneficiary.beneficiary.beneficiary_id_code || verifiedBeneficiary.beneficiary.RFID_number}
                </Text>
              </View>
            </View>

            <View style={styles.payoutDetailRow}>
              <Text style={styles.payoutDetailLabel}>Pondong I-rerelease:</Text>
              <Text style={styles.payoutDetailAmount}>
                {formatMoney(verifiedBeneficiary.transaction.amount)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.releaseBtn, processing && styles.btnDisabled]}
              onPress={handleConfirmRelease}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.releaseBtnText}>✓ KUMPIRMAHIN AT I-RELEASE ANG AYUDA</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Scanned History of this session */}
        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, darkMode && styles.darkText]}>
            Scanned & Released This Session ({scannedHistory.length})
          </Text>

          {scannedHistory.length === 0 ? (
            <Text style={styles.emptyHistory}>Wala pang na-scan na benepisyaryo sa kasalukuyang session.</Text>
          ) : (
            scannedHistory.map((rec) => (
              <View key={rec.id} style={[styles.historyItem, darkMode && styles.darkCard]}>
                <View style={styles.historyCheck}>
                  <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, darkMode && styles.darkText]}>{rec.name}</Text>
                  <Text style={styles.historySub}>{rec.code} • {rec.time}</Text>
                </View>
                <Text style={styles.historyAmt}>{formatMoney(rec.amount)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Select Event Modal */}
      <Modal visible={eventSelectModal} transparent animationType="slide" onRequestClose={() => setEventSelectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Pumili ng Distribution Event</Text>
              <TouchableOpacity onPress={() => setEventSelectModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={events}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = item.id === Number(selectedEventId);
                const isCompleted = item.status?.toLowerCase() === 'completed';
                return (
                  <TouchableOpacity
                    style={[
                      styles.eventOption,
                      isSelected && styles.eventOptionSelected,
                      isCompleted && styles.eventOptionDisabled,
                    ]}
                    onPress={() => {
                      if (isCompleted) {
                        Alert.alert(
                          'Hindi Maaaring Buksan',
                          'Ang distribution event na ito ay COMPLETED na. Bawal na itong buksan upang mag-scan muli.'
                        );
                        return;
                      }
                      setSelectedEventId(item.id);
                      setEventSelectModal(false);
                    }}
                    activeOpacity={isCompleted ? 0.9 : 0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={[
                            styles.eventOptionTitle,
                            isSelected && { color: '#2563eb', fontWeight: 'bold' },
                            isCompleted && { color: '#64748b' },
                          ]}
                        >
                          {item.title}
                        </Text>
                        {isCompleted && (
                          <View style={styles.completedTag}>
                            <Text style={styles.completedTagText}>🔒 COMPLETED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.eventOptionSub}>
                        {item.Program?.name || 'Program'} • Status: {(item.status || 'scheduled').toUpperCase()}
                      </Text>
                    </View>
                    {isSelected && !isCompleted && (
                      <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Live Camera QR Scanner Modal */}
      <QrCameraScanner
        visible={cameraActive}
        onClose={() => setCameraActive(false)}
        onScan={(code) => {
          handleScanSubmit(code);
        }}
        title="Distribution Aid QR Scanner"
        subtitle={`Ayuda Event: ${currentEvent?.title || 'Selected Event'}`}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  openCameraBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    elevation: 2,
  },
  openCameraIcon: { fontSize: 20, marginRight: 10 },
  openCameraTitle: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  openCameraSub: { fontSize: 10.5, color: '#d1fae5', marginTop: 1 },
  openCameraArrow: { fontSize: 20, color: '#ffffff', fontWeight: 'bold' },
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
  scrollContent: { padding: 16, paddingBottom: 90 },
  eventSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  eventSelectLabel: { fontSize: 9.5, fontWeight: '800', color: '#2563eb', letterSpacing: 0.8 },
  eventSelectTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  eventSelectSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  eventSelectCaret: { paddingLeft: 10 },
  caretText: { fontSize: 12, color: '#2563eb' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    elevation: 1,
  },
  kpiLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  kpiVal: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  scanBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  rfidIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  scanBoxTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  scanBoxSub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  inputWrap: { flexDirection: 'row', width: '100%', gap: 8 },
  rfidInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    color: '#1e293b',
  },
  darkInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  scanBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  demoSection: { marginTop: 14, width: '100%' },
  demoLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  demoChips: { flexDirection: 'row', gap: 6 },
  demoChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  demoChipText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  alertBanner: { padding: 12, borderRadius: 12, marginBottom: 14 },
  alertSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  alertSuccessTxt: { color: '#15803d', fontWeight: '700', fontSize: 12.5 },
  alertError: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  alertErrorTxt: { color: '#b91c1c', fontWeight: '700', fontSize: 12.5 },
  verifiedCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  verifiedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  verifiedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  verifiedAvatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  verifiedTitle: { fontSize: 11, fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' },
  verifiedName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  verifiedMeta: { fontSize: 11.5, color: '#64748b' },
  payoutDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
    marginBottom: 12,
  },
  payoutDetailLabel: { fontSize: 13, color: '#334155', fontWeight: '600' },
  payoutDetailAmount: { fontSize: 20, color: '#16a34a', fontWeight: '900' },
  releaseBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  releaseBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  historySection: { marginTop: 6 },
  historyTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  emptyHistory: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  historyCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  historyName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  historySub: { fontSize: 11, color: '#64748b' },
  historyAmt: { fontSize: 13, fontWeight: '800', color: '#16a34a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
  },
  darkModalContent: { backgroundColor: '#1e293b' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: '700' },
  eventOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  eventOptionSelected: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  eventOptionDisabled: { backgroundColor: '#f8fafc', opacity: 0.75 },
  eventOptionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  eventOptionSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  completedTag: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completedTagText: {
    color: '#be123c',
    fontSize: 9.5,
    fontWeight: '800',
  },
  completedLockBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  completedLockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  completedLockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  completedLockSub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  completedStatusPill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completedStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
});

export default StaffDistributionScannerScreen;


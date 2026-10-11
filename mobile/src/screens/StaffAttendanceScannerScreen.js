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
import { announcementApi, beneficiaryApi } from '../services/api';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const StaffAttendanceScannerScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rfidInput, setRfidInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [demoBeneficiaries, setDemoBeneficiaries] = useState([]);
  const inputRef = useRef(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const [annRes, benefRes] = await Promise.all([
        announcementApi.list({ has_attendance: true }),
        beneficiaryApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      const list = annRes.data?.data || [];
      setAnnouncements(list);
      setDemoBeneficiaries(benefRes.data?.data || []);
      if (list.length > 0 && !selectedAnnouncementId) {
        setSelectedAnnouncementId(list[0].id);
      }
    } catch (err) {
      console.warn('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAnnouncementId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const currentAnnouncement = announcements.find((a) => a.id === Number(selectedAnnouncementId));

  const handleScanSubmit = async (customCode = null) => {
    const code = (customCode || rfidInput).trim();
    if (!code) {
      setAlertMsg({ type: 'error', text: 'Pakilagay o i-scan ang RFID card o QR Pass code.' });
      return;
    }
    if (!selectedAnnouncementId) {
      setAlertMsg({ type: 'error', text: 'Pumili muna ng Aktibidad/Announcement sa itaas.' });
      return;
    }

    setProcessing(true);
    setAlertMsg(null);

    try {
      const response = await announcementApi.scanRfid(selectedAnnouncementId, {
        rfid_number: code,
        RFID_number: code,
      });

      const b = response.data?.beneficiary || {};
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const newRecord = {
        id: Date.now(),
        name: `${b.first_name || 'Beneficiary'} ${b.last_name || ''}`.trim(),
        code: b.beneficiary_id_code || b.RFID_number || code,
        category: b.category || 'General',
        time: timeStr,
      };

      setAttendanceRecords((prev) => [newRecord, ...prev]);
      setAlertMsg({
        type: 'success',
        text: `✓ Naitala ang Attendance ni ${newRecord.name} (${newRecord.code})!`,
      });
      setRfidInput('');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to record attendance.';
      if (err?.response?.status === 409) {
        setAlertMsg({
          type: 'success',
          text: `✓ ${msg} (Naitala na ang attendance dati).`,
        });
      } else {
        setAlertMsg({
          type: 'error',
          text: `❌ ${msg}`,
        });
      }
      setRfidInput('');
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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Attendance Scanner</Text>
            <Text style={styles.headerSub}>RFID & QR Event Attendance Check-in</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => loadAnnouncements()} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Activity Selector Card */}
        <TouchableOpacity
          style={[styles.activitySelectCard, darkMode && styles.darkCard]}
          onPress={() => setAnnouncementModal(true)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.activitySelectLabel}>AKTIBIDAD / PULONG</Text>
            <Text style={[styles.activitySelectTitle, darkMode && styles.darkText]} numberOfLines={1}>
              {currentAnnouncement ? currentAnnouncement.title : 'Pumili ng Announcement / Aktibidad'}
            </Text>
            <Text style={styles.activitySelectSub}>
              📅 {formatDate(currentAnnouncement?.event_date || currentAnnouncement?.publish_date)} • 📍 {currentAnnouncement?.venue || currentAnnouncement?.location || 'Barangay Hall'}
            </Text>
          </View>
          <View style={styles.activitySelectCaret}>
            <Text style={styles.caretText}>▼</Text>
          </View>
        </TouchableOpacity>

        {/* RFID Tap Box */}
        <View style={[styles.scanBox, darkMode && styles.darkCard]}>
          <View style={styles.rfidIconCircle}>
            <Text style={{ fontSize: 32 }}>📲</Text>
          </View>
          <Text style={[styles.scanBoxTitle, darkMode && styles.darkText]}>I-tap ang RFID Card o QR Pass</Text>
          <Text style={styles.scanBoxSub}>
            I-scan ang RFID card o ilagay ang ID number para awtomatikong maitala ang attendance
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
                <Text style={styles.scanBtnText}>Itala</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Demo Fast-Tap Chips */}
          {demoBeneficiaries.length > 0 && (
            <View style={styles.demoSection}>
              <Text style={styles.demoLabel}>Demo Fast-Tap (Beneficiaries in DB):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.demoChips}>
                {demoBeneficiaries.slice(0, 8).map((b, idx) => {
                  const code = b.RFID_number || b.beneficiary_id_code;
                  return (
                    <TouchableOpacity
                      key={b.id || idx}
                      style={styles.demoChip}
                      onPress={() => handleScanSubmit(code)}
                    >
                      <Text style={styles.demoChipText}>
                        👤 {b.first_name} ({code || 'No ID'})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Status Alert Banner */}
        {alertMsg && (
          <View style={[styles.alertBanner, alertMsg.type === 'success' ? styles.alertSuccess : styles.alertError]}>
            <Text style={alertMsg.type === 'success' ? styles.alertSuccessTxt : styles.alertErrorTxt}>
              {alertMsg.text}
            </Text>
          </View>
        )}

        {/* Live Attendance Roster */}
        <View style={styles.historySection}>
          <Text style={[styles.historyTitle, darkMode && styles.darkText]}>
            Mga Naitalang Dumalo sa Pulong ({attendanceRecords.length})
          </Text>

          {attendanceRecords.length === 0 ? (
            <Text style={styles.emptyHistory}>Wala pang naitalang dumalo para sa sesyong ito.</Text>
          ) : (
            attendanceRecords.map((rec) => (
              <View key={rec.id} style={[styles.historyItem, darkMode && styles.darkCard]}>
                <View style={styles.historyCheck}>
                  <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyName, darkMode && styles.darkText]}>{rec.name}</Text>
                  <Text style={styles.historySub}>{rec.code} • {rec.category}</Text>
                </View>
                <Text style={styles.historyTime}>{rec.time}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Select Activity Modal */}
      <Modal visible={announcementModal} transparent animationType="slide" onRequestClose={() => setAnnouncementModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.darkText]}>Pumili ng Aktibidad / Pulong</Text>
              <TouchableOpacity onPress={() => setAnnouncementModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={announcements}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = item.id === Number(selectedAnnouncementId);
                return (
                  <TouchableOpacity
                    style={[styles.activityOption, isSelected && styles.activityOptionSelected]}
                    onPress={() => {
                      setSelectedAnnouncementId(item.id);
                      setAnnouncementModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityOptionTitle, isSelected && { color: '#2563eb', fontWeight: 'bold' }]}>
                        {item.title}
                      </Text>
                      <Text style={styles.activityOptionSub}>
                        📅 {formatDate(item.event_date || item.publish_date)} • 📍 {item.venue || 'Barangay'}
                      </Text>
                    </View>
                    {isSelected && <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
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
  scrollContent: { padding: 16, paddingBottom: 90 },
  activitySelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    marginBottom: 14,
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  activitySelectLabel: { fontSize: 9.5, fontWeight: '800', color: '#2563eb', letterSpacing: 0.8 },
  activitySelectTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  activitySelectSub: { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  activitySelectCaret: { paddingLeft: 10 },
  caretText: { fontSize: 12, color: '#2563eb' },
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
    backgroundColor: '#f0fdf4',
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
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingHorizontal: 20,
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
  historyTime: { fontSize: 11.5, fontWeight: '700', color: '#16a34a' },
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
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activityOptionSelected: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  activityOptionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  activityOptionSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
});

export default StaffAttendanceScannerScreen;

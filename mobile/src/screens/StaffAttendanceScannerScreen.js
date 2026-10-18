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
import { announcementApi } from '../services/api';
import {
  isAnnouncementActiveForAttendance,
  getAnnouncementEndDateTime,
  getAnnouncementTiming,
} from '../utils/announcementSchedule';
import QrCameraScanner from '../components/QrCameraScanner';

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const [cameraActive, setCameraActive] = useState(false);
  const inputRef = useRef(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await announcementApi.list({ has_attendance: true });
      const list = res.data?.data || [];
      setAnnouncements(list);

      // Auto-select the first active (current or upcoming) announcement
      const activeList = list.filter(isAnnouncementActiveForAttendance);
      if (activeList.length > 0) {
        setSelectedAnnouncementId((prev) => {
          if (!prev) return activeList[0].id;
          const found = list.find((a) => a.id === Number(prev));
          return found && isAnnouncementActiveForAttendance(found) ? prev : activeList[0].id;
        });
      } else if (list.length > 0) {
        // If all are ended, select first but it will be locked
        setSelectedAnnouncementId((prev) => prev || list[0].id);
      }
    } catch (err) {
      console.warn('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExistingAttendance = useCallback(async (annId) => {
    if (!annId) return;
    try {
      const res = await announcementApi.getAttendance(annId);
      const list = res.data?.data || res.data || [];
      if (Array.isArray(list)) {
        setAttendanceRecords(
          list.map((record) => {
            const b = record.Beneficiary || {};
            const scanTime = record.scanned_at || record.created_at || record.createdAt;
            const timeStr = scanTime
              ? new Date(scanTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'Earlier';
            return {
              id: record.id || `${record.beneficiary_id}-${scanTime}`,
              beneficiary_id: record.beneficiary_id,
              name: `${b.first_name || 'Beneficiary'} ${b.last_name || ''}`.trim(),
              code: b.beneficiary_id_code || b.RFID_number || 'N/A',
              rfid: b.RFID_number || 'N/A (QR Pass)',
              qr_code: b.qr_code_token || b.qr_token || null,
              category: b.category || 'General',
              time: timeStr,
            };
          })
        );
      }
    } catch (err) {
      console.warn('Failed to load existing attendance:', err?.message);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    if (selectedAnnouncementId) {
      loadExistingAttendance(selectedAnnouncementId);
      setAlertMsg(null);
    }
  }, [selectedAnnouncementId, loadExistingAttendance]);

  const currentAnnouncement = announcements.find((a) => a.id === Number(selectedAnnouncementId));
  const isCurrentEnded = currentAnnouncement ? !isAnnouncementActiveForAttendance(currentAnnouncement) : false;

  const activeAnnouncements = announcements.filter(isAnnouncementActiveForAttendance);
  const endedAnnouncements = announcements.filter((a) => !isAnnouncementActiveForAttendance(a));

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
    if (isCurrentEnded) {
      setAlertMsg({
        type: 'error',
        text: 'BAWAL NA ANG ATTENDANCE: Ang aktibidad na ito ay tapos na o expired na. Hindi na maaaring magtala ng attendance ang staff.',
      });
      return;
    }

    // Check if this card/QR is already recorded locally for this activity
    const codeLower = code.toLowerCase();
    const cleanCode = code.replace(/^EBMS-QR:/i, '').trim().toLowerCase();
    const existingLocalRecord = attendanceRecords.find(
      (r) =>
        (r.rfid && r.rfid !== 'N/A (QR Pass)' && String(r.rfid).trim().toLowerCase() === codeLower) ||
        (r.qr_code && String(r.qr_code).trim().toLowerCase() === cleanCode) ||
        (r.code && String(r.code).trim().toLowerCase() === cleanCode) ||
        (r.code && String(r.code).trim().toLowerCase() === codeLower)
    );

    if (existingLocalRecord) {
      setAlertMsg({
        type: 'warning',
        text: `⚠️ Naka-record na si ${existingLocalRecord.name} (${existingLocalRecord.code}) sa attendance ng aktibidad na ito (Oras: ${existingLocalRecord.time}). Hindi na kailangang i-tap o i-scan ulit ang RFID o QR Code.`,
      });
      setRfidInput('');
      return;
    }

    setProcessing(true);
    setAlertMsg(null);
    setRfidInput('');

    try {
      const response = await announcementApi.scanRfid(selectedAnnouncementId, {
        rfid_number: code,
        RFID_number: code,
      });

      const b = response.data?.beneficiary || {};
      const isAlreadyPresent = Boolean(response.data?.already_present || response.data?.duplicate);

      if (isAlreadyPresent) {
        setAlertMsg({
          type: 'warning',
          text: `⚠️ Naka-record na si ${b.first_name || ''} ${b.last_name || ''} (${b.beneficiary_id_code || b.RFID_number || code}) sa attendance ng aktibidad na ito. Hindi na kailangang i-tap o i-scan ulit ang RFID o QR Code.`,
        });
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const newRecord = {
        id: Date.now(),
        beneficiary_id: b.id,
        name: `${b.first_name || 'Beneficiary'} ${b.last_name || ''}`.trim(),
        code: b.beneficiary_id_code || b.RFID_number || code,
        rfid: b.RFID_number || 'N/A (QR Pass)',
        qr_code: b.qr_code_token || b.qr_token || null,
        category: b.category || 'General',
        time: timeStr,
      };

      setAttendanceRecords((prev) => [newRecord, ...prev]);
      setAlertMsg({
        type: 'success',
        text: `✓ Naitala ang Attendance ni ${newRecord.name} (${newRecord.code})!`,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to record attendance.';
      if (err?.response?.status === 409) {
        setAlertMsg({
          type: 'warning',
          text: `⚠️ ${msg} (Naka-record na siya dati sa attendance).`,
        });
      } else {
        setAlertMsg({
          type: 'error',
          text: `❌ ${msg}`,
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectAnnouncement = (item) => {
    const isActive = isAnnouncementActiveForAttendance(item);
    if (!isActive) {
      Alert.alert(
        'Bawal Buksan ang Tapos na Aktibidad',
        `Ang "${item.title}" ay tapos na o expired na. Ang maaari lamang buksan ay ang mga kasalukuyan at paparating na anunsyo.`,
        [{ text: 'Naiintindihan' }]
      );
      return;
    }
    setSelectedAnnouncementId(item.id);
    setAnnouncementModal(false);
    setAlertMsg(null);
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={darkMode ? '#0f172a' : '#ffffff'}
      />

      {/* Top Header */}
      <View style={[styles.header, darkMode && styles.darkHeader]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={onOpenDrawer}
            style={styles.menuBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
          style={[
            styles.activitySelectCard,
            isCurrentEnded && styles.activitySelectCardEnded,
            darkMode && styles.darkCard,
          ]}
          onPress={() => setAnnouncementModal(true)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <Text
                style={[
                  styles.activitySelectLabel,
                  isCurrentEnded && styles.activitySelectLabelEnded,
                ]}
              >
                {isCurrentEnded ? '⛔ SARADO NA ANG AKTIBIDAD' : '🟢 BUKÁS PARA SA ATTENDANCE'}
              </Text>
              {currentAnnouncement && (
                <View
                  style={[
                    styles.timingChip,
                    isCurrentEnded ? styles.timingChipEnded : styles.timingChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timingChipText,
                      isCurrentEnded ? styles.timingChipTextEnded : styles.timingChipTextActive,
                    ]}
                  >
                    {isCurrentEnded
                      ? 'Tapos Na'
                      : getAnnouncementTiming(currentAnnouncement) === 'current'
                      ? 'Kasalukuyan (Current)'
                      : 'Paparating (Incoming)'}
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.activitySelectTitle,
                isCurrentEnded && styles.activitySelectTitleEnded,
                darkMode && styles.darkText,
              ]}
              numberOfLines={2}
            >
              {currentAnnouncement
                ? isCurrentEnded
                  ? `[TAPOS NA] ${currentAnnouncement.title}`
                  : currentAnnouncement.title
                : 'Pumili ng Aktibong Anunsyo / Event'}
            </Text>

            <Text style={styles.activitySelectSub}>
              📅 {formatDate(currentAnnouncement?.event_date || currentAnnouncement?.publish_date)}
              {currentAnnouncement?.event_time ? ` • ${currentAnnouncement.event_time}` : ''} • 📍{' '}
              {currentAnnouncement?.venue || currentAnnouncement?.location || 'Barangay Hall'}
            </Text>
          </View>
          <View style={styles.activitySelectCaret}>
            <Text style={[styles.caretText, isCurrentEnded && { color: '#ef4444' }]}>▼</Text>
          </View>
        </TouchableOpacity>

        {/* Warning banner if selected event has ended */}
        {isCurrentEnded && (
          <View style={styles.endedWarningBanner}>
            <Text style={styles.endedWarningIcon}>⛔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.endedWarningTitle}>ISINARA NA ANG ATTENDANCE</Text>
              <Text style={styles.endedWarningBody}>
                Ang aktibidad na ito ay tapos na o expired na. Hindi na pinapayagan ang mga kawani
                (Staff) na mag-record ng attendance para rito. Pumili ng kasalukuyan o paparating na aktibidad.
              </Text>
            </View>
          </View>
        )}

        {/* RFID & QR Tap Card */}
        <View
          style={[
            styles.scanBox,
            isCurrentEnded && styles.scanBoxEnded,
            darkMode && styles.darkCard,
          ]}
        >
          <View
            style={[
              styles.rfidIconCircle,
              isCurrentEnded && { backgroundColor: '#fee2e2' },
            ]}
          >
            <Text style={{ fontSize: 32 }}>{isCurrentEnded ? '🚫' : '📲'}</Text>
          </View>
          <Text style={[styles.scanBoxTitle, darkMode && styles.darkText]}>
            {isCurrentEnded ? 'Sarado na ang Attendance' : 'I-tap ang RFID Card o QR Pass'}
          </Text>
          <Text style={styles.scanBoxSub}>
            {isCurrentEnded
              ? 'Hindi na maaaring mag-record ng attendance dahil lumipas na ang schedule ng event na ito.'
              : 'I-tap ang RFID card o gamitin ang Camera QR Scanner para awtomatikong maitala ang attendance'}
          </Text>

          {/* Action Buttons: Camera Scanner & Manual Input */}
          {!isCurrentEnded && selectedAnnouncementId && (
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

          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={[
                styles.rfidInput,
                isCurrentEnded && styles.rfidInputEnded,
                darkMode && styles.darkInput,
              ]}
              placeholder={
                isCurrentEnded
                  ? 'Sarado na ang attendance para sa event na ito...'
                  : 'I-tap ang RFID card o i-type ang code dito...'
              }
              placeholderTextColor="#94a3b8"
              value={rfidInput}
              onChangeText={setRfidInput}
              onSubmitEditing={() => !isCurrentEnded && handleScanSubmit()}
              returnKeyType="done"
              editable={!isCurrentEnded && !processing}
            />
            <TouchableOpacity
              style={[
                styles.scanBtn,
                (processing || isCurrentEnded) && styles.btnDisabled,
              ]}
              onPress={() => handleScanSubmit()}
              disabled={processing || isCurrentEnded}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.scanBtnText}>
                  {isCurrentEnded ? 'Sarado' : 'Itala (Enter)'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Alert Banner */}
        {alertMsg && (
          <View
            style={[
              styles.alertBanner,
              alertMsg.type === 'success'
                ? styles.alertSuccess
                : alertMsg.type === 'warning'
                ? styles.alertWarning
                : styles.alertError,
            ]}
          >
            <Text
              style={
                alertMsg.type === 'success'
                  ? styles.alertSuccessTxt
                  : alertMsg.type === 'warning'
                  ? styles.alertWarningTxt
                  : styles.alertErrorTxt
              }
            >
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
                  <Text style={styles.historySub}>
                    {rec.code} • {rec.category}
                  </Text>
                </View>
                <Text style={styles.historyTime}>{rec.time}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Select Activity Modal */}
      <Modal
        visible={announcementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAnnouncementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkModalContent]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, darkMode && styles.darkText]}>
                  Pumili ng Aktibidad / Pulong
                </Text>
                <Text style={styles.modalSubtitle}>
                  Tanging ang mga kasalukuyan at paparating na anunsyo ang maaaring buksan.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAnnouncementModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Group 1: Aktibong mga Anunsyo */}
              <View style={styles.modalGroupHeader}>
                <Text style={styles.modalGroupTitleActive}>
                  🟢 Aktibong mga Anunsyo (Bukás para sa Attendance)
                </Text>
                <Text style={styles.modalGroupCount}>{activeAnnouncements.length}</Text>
              </View>

              {activeAnnouncements.length === 0 ? (
                <View style={styles.emptyGroupBox}>
                  <Text style={styles.emptyGroupText}>
                    Walang aktibong anunsyo sa ngayon na bukas para sa attendance.
                  </Text>
                </View>
              ) : (
                activeAnnouncements.map((item) => {
                  const isSelected = item.id === Number(selectedAnnouncementId);
                  const timing = getAnnouncementTiming(item);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.activityOption,
                        isSelected && styles.activityOptionSelected,
                      ]}
                      onPress={() => handleSelectAnnouncement(item)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.optionHeaderRow}>
                          <Text
                            style={[
                              styles.activityOptionTitle,
                              isSelected && { color: '#2563eb', fontWeight: 'bold' },
                            ]}
                          >
                            {item.title}
                          </Text>
                          <View
                            style={[
                              styles.timingBadge,
                              timing === 'current'
                                ? styles.timingBadgeCurrent
                                : styles.timingBadgeUpcoming,
                            ]}
                          >
                            <Text
                              style={[
                                styles.timingBadgeText,
                                timing === 'current'
                                  ? styles.timingBadgeTextCurrent
                                  : styles.timingBadgeTextUpcoming,
                              ]}
                            >
                              {timing === 'current' ? 'Kasalukuyan' : 'Paparating'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.activityOptionSub}>
                          📅 {formatDate(item.event_date || item.publish_date)}
                          {item.event_time ? ` • ${item.event_time}` : ''} • 📍{' '}
                          {item.venue || 'Barangay'}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Group 2: Mga Tapos Nang Anunsyo (Sarado) */}
              {endedAnnouncements.length > 0 && (
                <>
                  <View style={[styles.modalGroupHeader, { marginTop: 18 }]}>
                    <Text style={styles.modalGroupTitleEnded}>
                      ⛔ Mga Tapos Nang Anunsyo (Sarado na ang Attendance)
                    </Text>
                    <Text style={styles.modalGroupCount}>{endedAnnouncements.length}</Text>
                  </View>

                  {endedAnnouncements.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.activityOption, styles.activityOptionEnded]}
                      onPress={() => handleSelectAnnouncement(item)}
                      activeOpacity={0.6}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.optionHeaderRow}>
                          <Text style={[styles.activityOptionTitle, styles.activityOptionTitleEnded]}>
                            {item.title}
                          </Text>
                          <View style={styles.timingBadgeEnded}>
                            <Text style={styles.timingBadgeTextEnded}>[TAPOS NA]</Text>
                          </View>
                        </View>
                        <Text style={[styles.activityOptionSub, { color: '#94a3b8' }]}>
                          📅 {formatDate(item.event_date || item.publish_date)} • 📍{' '}
                          {item.venue || 'Barangay'} — Sarado na
                        </Text>
                      </View>
                      <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>🚫</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
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
        title="Attendance QR Pass Scanner"
        subtitle={`Aktibidad: ${currentAnnouncement?.title || 'Selected Event'}`}
      />
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

  // Activity Select Card
  activitySelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  activitySelectCardEnded: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  activitySelectLabel: { fontSize: 9.5, fontWeight: '800', color: '#16a34a', letterSpacing: 0.8 },
  activitySelectLabelEnded: { color: '#dc2626' },
  timingChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  timingChipActive: { backgroundColor: '#dbeafe' },
  timingChipEnded: { backgroundColor: '#fee2e2' },
  timingChipText: { fontSize: 10, fontWeight: '700' },
  timingChipTextActive: { color: '#1e40af' },
  timingChipTextEnded: { color: '#b91c1c' },
  activitySelectTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  activitySelectTitleEnded: { color: '#991b1b' },
  activitySelectSub: { fontSize: 11.5, color: '#64748b', marginTop: 3 },
  activitySelectCaret: { paddingLeft: 10 },
  caretText: { fontSize: 12, color: '#2563eb' },

  // Ended Warning
  endedWarningBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fee2e2',
    borderWidth: 1.5,
    borderColor: '#f87171',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  endedWarningIcon: { fontSize: 20 },
  endedWarningTitle: { fontSize: 12, fontWeight: '900', color: '#991b1b', letterSpacing: 0.5 },
  endedWarningBody: { fontSize: 11, color: '#7f1d1d', marginTop: 2, lineHeight: 16 },

  // Scanner Box
  scanBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    elevation: 2,
  },
  scanBoxEnded: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafa',
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
  scanBoxSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },

  // Open Camera Button
  openCameraBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    elevation: 2,
  },
  openCameraIcon: { fontSize: 20, marginRight: 10 },
  openCameraTitle: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  openCameraSub: { fontSize: 10.5, color: '#d1fae5', marginTop: 1 },
  openCameraArrow: { fontSize: 20, color: '#ffffff', fontWeight: 'bold' },

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
  rfidInputEnded: { backgroundColor: '#f1f5f9', color: '#94a3b8' },
  darkInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  scanBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.5, backgroundColor: '#94a3b8' },

  // Alerts
  alertBanner: { padding: 12, borderRadius: 12, marginBottom: 14 },
  alertSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
  alertSuccessTxt: { color: '#15803d', fontWeight: '700', fontSize: 12.5 },
  alertWarning: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d' },
  alertWarningTxt: { color: '#92400e', fontWeight: '700', fontSize: 12.5 },
  alertError: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  alertErrorTxt: { color: '#b91c1c', fontWeight: '700', fontSize: 12.5 },

  // History Roster
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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 20,
  },
  darkModalContent: { backgroundColor: '#1e293b' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  modalSubtitle: { fontSize: 11, color: '#64748b', marginTop: 2 },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: '700' },

  modalGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalGroupTitleActive: { fontSize: 12, fontWeight: '800', color: '#15803d' },
  modalGroupTitleEnded: { fontSize: 12, fontWeight: '800', color: '#dc2626' },
  modalGroupCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyGroupBox: { padding: 12, alignItems: 'center' },
  emptyGroupText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },

  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 10,
  },
  activityOptionSelected: { backgroundColor: '#eff6ff' },
  activityOptionEnded: { opacity: 0.55, backgroundColor: '#fafafa' },
  optionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityOptionTitle: { fontSize: 13.5, fontWeight: '700', color: '#1e293b', flex: 1 },
  activityOptionTitleEnded: { color: '#64748b', textDecorationLine: 'line-through' },
  activityOptionSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  timingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  timingBadgeCurrent: { backgroundColor: '#dcfce7' },
  timingBadgeUpcoming: { backgroundColor: '#dbeafe' },
  timingBadgeEnded: { backgroundColor: '#fee2e2' },
  timingBadgeText: { fontSize: 9.5, fontWeight: '800' },
  timingBadgeTextCurrent: { color: '#15803d' },
  timingBadgeTextUpcoming: { color: '#1d4ed8' },
  timingBadgeTextEnded: { color: '#b91c1c' },
});

export default StaffAttendanceScannerScreen;

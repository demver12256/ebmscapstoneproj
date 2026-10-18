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
  Image,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { API_URL } from '../config/api';
import { beneficiaryApi, barangayApi } from '../services/api';

const FILES_BASE_URL = API_URL.replace(/\/api\/?$/, '');

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getCategoryColor = (category) => {
  if (!category) return '#64748b';
  const c = category.toLowerCase();
  if (c.includes('4ps') || c.includes('pantawid')) return '#7c3aed';
  if (c.includes('senior')) return '#0891b2';
  if (c.includes('pwd') || c.includes('disability')) return '#ea580c';
  return '#64748b';
};

const getCategoryShort = (category) => {
  if (!category) return 'N/A';
  const c = category.toLowerCase();
  if (c.includes('4ps') || c.includes('pantawid')) return '4Ps';
  if (c.includes('senior')) return 'Senior';
  if (c.includes('pwd') || c.includes('disability')) return 'PWD';
  return category.length > 12 ? category.substring(0, 12) + '…' : category;
};

const BeneficiaryListScreen = ({ onBack, user }) => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangayId, setSelectedBarangayId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [listMode, setListMode] = useState('roster'); // 'roster' | 'applications'

  // Selected Beneficiary Detail State
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [detailTab, setDetailTab] = useState('profile');
  const [attendanceData, setAttendanceData] = useState(null);
  const [distributionsData, setDistributionsData] = useState(null);
  const [enrollmentsData, setEnrollmentsData] = useState(null);
  const [tabLoading, setTabLoading] = useState(false);

  // RFID & Payout Management
  const [editingRfid, setEditingRfid] = useState(false);
  const [rfidInput, setRfidInput] = useState('');
  const [savingRfid, setSavingRfid] = useState(false);
  const [verifyingPayout, setVerifyingPayout] = useState(false);
  const [showFullAccountNo, setShowFullAccountNo] = useState(false);

  // Edit Beneficiary Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({ contact_number: '', address: '', sitio: '', civil_status: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Pending Application Review & Rejection
  const [selectedApp, setSelectedApp] = useState(null);
  const [approvingApp, setApprovingApp] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedMissingDocs, setSelectedMissingDocs] = useState([]);
  const [rejectingApp, setRejectingApp] = useState(false);

  // Document Viewer
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [docPreviewTitle, setDocPreviewTitle] = useState('');

  // QR Pass State
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPassData, setQrPassData] = useState(null);

  const resolveDocUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${FILES_BASE_URL}/${url.replace(/^\/+/, '')}`;
  };

  const handleOpenBeneficiaryQr = async (beneficiary) => {
    if (!beneficiary) return;
    setQrModalVisible(true);
    setQrLoading(true);
    setQrPassData(null);
    try {
      const res = await beneficiaryApi.getQrPass(beneficiary.id);
      if (res.data?.data) {
        setQrPassData(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load beneficiary QR Pass:', err);
      Alert.alert('Notice', err?.response?.data?.message || 'Hindi ma-load ang QR Pass ng benepisyaryo.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleRegenerateQr = async (beneficiaryId) => {
    try {
      setQrLoading(true);
      const res = await beneficiaryApi.regenerateQrPass(beneficiaryId);
      if (res.data?.data) {
        setQrPassData(res.data.data);
        Alert.alert('Tagumpay', 'Matagumpay na na-regenerate ang QR Pass token!');
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi na-regenerate ang QR Pass.');
    } finally {
      setQrLoading(false);
    }
  };

  const handleShareBeneficiaryQr = async () => {
    if (!qrPassData?.qr_image_url) {
      Alert.alert('Walang QR Code', 'Walang magagamit na QR code image.');
      return;
    }
    try {
      await Share.share({
        title: `QR Pass - ${qrPassData.full_name}`,
        message: `Digital QR Pass para kay ${qrPassData.full_name}\nID/Code: ${qrPassData.qr_code || qrPassData.beneficiary_id_code}\nEBMS - DSWD / MSWDO Bongabong`,
        url: qrPassData.qr_image_url,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const CATEGORIES = [
    '4Ps Household Beneficiary',
    'Senior Citizens (Social Pension)',
    'Persons with Disabilities (PWD)',
  ];

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [benefRes, brgyRes, appsRes] = await Promise.all([
        beneficiaryApi.list().catch(() => ({ data: { data: [] } })),
        barangayApi.list().catch(() => ({ data: { data: [] } })),
        beneficiaryApi.listApplications().catch(() => ({ data: { data: [] } })),
      ]);
      setBeneficiaries(benefRes.data?.data || []);
      setBarangays(brgyRes.data?.data || []);
      const allApps = appsRes.data?.data || [];
      const pendingList = allApps.filter(
        (a) => a.status !== 'Approved' && a.status !== 'Pending Submission'
      );
      setPendingApplications(pendingList);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load beneficiaries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    if (selectedBarangayId && String(b.barangay_id) !== selectedBarangayId) return false;
    if (selectedCategory && b.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.toLowerCase();
      const brgy = (b.Barangay?.barangay_name || b.Barangay?.name || '').toLowerCase();
      const idCode = (b.beneficiary_id_code || '').toLowerCase();
      const household = (b.household_id_number || '').toLowerCase();
      return fullName.includes(q) || brgy.includes(q) || idCode.includes(q) || household.includes(q);
    }
    return true;
  });

  const filteredApplications = pendingApplications.filter((app) => {
    if (selectedBarangayId && String(app.barangay_id) !== selectedBarangayId) return false;
    if (selectedCategory && app.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${app.first_name || ''} ${app.middle_name || ''} ${app.last_name || ''}`.toLowerCase();
      const brgy = (app.Barangay?.barangay_name || app.Barangay?.name || '').toLowerCase();
      const idCode = (app.beneficiary_id_code || app.household_id_number || '').toLowerCase();
      return fullName.includes(q) || brgy.includes(q) || idCode.includes(q);
    }
    return true;
  });

  const handleApproveApplication = (app) => {
    Alert.alert(
      'Aprubahan ang Aplikasyon',
      `Sigurado ka bang nais mong aprubahan ang aplikasyon ni ${app.first_name} ${app.last_name}? Awtomatikong magbibigay ang system ng opisyal na Beneficiary ID Code.`,
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Aprubahan',
          style: 'default',
          onPress: async () => {
            try {
              setApprovingApp(true);
              const res = await beneficiaryApi.approveApplication(app.id);
              Alert.alert('Tagumpay', res.data?.message || 'Matagumpay na naaprubahan ang aplikasyon!');
              setSelectedApp(null);
              await loadData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi naaprubahan ang aplikasyon.');
            } finally {
              setApprovingApp(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectApplication = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Kailangan ang Dahilan', 'Pakilagay ang dahilan ng pagtanggi sa aplikasyon.');
      return;
    }
    try {
      setRejectingApp(true);
      const res = await beneficiaryApi.rejectApplication(selectedApp.id, {
        rejection_reason: rejectionReason.trim(),
        missing_documents: selectedMissingDocs,
      });
      Alert.alert('Na-reject', res.data?.message || 'Naitagubilin ang pagtanggi sa aplikasyon.');
      setRejectModalVisible(false);
      setSelectedApp(null);
      setRejectionReason('');
      setSelectedMissingDocs([]);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi nai-save ang desisyon.');
    } finally {
      setRejectingApp(false);
    }
  };

  const handleSaveRfid = async () => {
    if (!rfidInput.trim()) {
      Alert.alert('Walang RFID', 'Pakilagay ang bagong RFID number bago i-save.');
      return;
    }
    try {
      setSavingRfid(true);
      await beneficiaryApi.update(selectedBeneficiary.id, { RFID_number: rfidInput.trim() });
      Alert.alert('Tagumpay', `Na-assign ang RFID: ${rfidInput.trim()} kay ${selectedBeneficiary.first_name}!`);
      setSelectedBeneficiary((prev) => ({ ...prev, RFID_number: rfidInput.trim() }));
      setEditingRfid(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi nai-save ang RFID.');
    } finally {
      setSavingRfid(false);
    }
  };

  const handleVerifyPayout = async (action) => {
    try {
      setVerifyingPayout(true);
      const payload = action === 'verified' ? { force: true } : { action: 'reject' };
      await beneficiaryApi.verifyPayoutAccount(selectedBeneficiary.id, payload);
      Alert.alert(
        'Tagumpay',
        action === 'verified' ? 'Na-verify na ang payout account ng benepisyaryo!' : 'Tinanggihan ang payout account.'
      );
      setSelectedBeneficiary((prev) => ({
        ...prev,
        account_verification_status: action === 'verified' ? 'verified' : 'rejected',
      }));
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi nai-update ang verification.');
    } finally {
      setVerifyingPayout(false);
    }
  };

  const handleOpenEditModal = (b) => {
    setEditForm({
      contact_number: b.contact_number || '',
      address: b.address || '',
      sitio: b.sitio || '',
      civil_status: b.civil_status || 'Single',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      setSavingEdit(true);
      await beneficiaryApi.update(selectedBeneficiary.id, editForm);
      Alert.alert('Tagumpay', 'Matagumpay na na-update ang impormasyon ng benepisyaryo!');
      setSelectedBeneficiary((prev) => ({ ...prev, ...editForm }));
      setEditModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi na-update ang impormasyon.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Load all 3 tabs' live database data in parallel
  const loadBeneficiaryDetails = async (ben) => {
    setTabLoading(true);
    try {
      const [attRes, distRes, enrRes] = await Promise.allSettled([
        beneficiaryApi.getAttendance(ben.id),
        beneficiaryApi.getDistributions(ben.id),
        beneficiaryApi.getEnrollments(ben.id),
      ]);
      if (attRes.status === 'fulfilled') setAttendanceData(attRes.value.data?.data || null);
      if (distRes.status === 'fulfilled') setDistributionsData(distRes.value.data?.data || null);
      if (enrRes.status === 'fulfilled') setEnrollmentsData(enrRes.value.data?.data || null);
    } catch (err) {
      console.warn('Tab data load error:', err?.message);
    } finally {
      setTabLoading(false);
    }
  };

  const openDetail = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setDetailTab('profile');
    setAttendanceData(null);
    setDistributionsData(null);
    setEnrollmentsData(null);
    loadBeneficiaryDetails(beneficiary);
  };

  const renderBeneficiaryCard = ({ item }) => {
    const fullName = `${item.last_name || ''}, ${item.first_name || ''} ${item.middle_name || ''}`.trim();
    const barangayName = item.Barangay?.barangay_name || item.Barangay?.name || '—';
    const catColor = getCategoryColor(item.category);
    const catShort = getCategoryShort(item.category);

    return (
      <TouchableOpacity style={s.card} onPress={() => openDetail(item)} activeOpacity={0.7}>
        <View style={s.cardHeader}>
          <View style={[s.avatar, { backgroundColor: catColor + '20' }]}>
            <Text style={[s.avatarText, { color: catColor }]}>
              {(item.first_name?.[0] || '').toUpperCase()}{(item.last_name?.[0] || '').toUpperCase()}
            </Text>
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardName} numberOfLines={1}>{fullName}</Text>
            <Text style={s.cardMeta}>📍 {barangayName}</Text>
          </View>
          <View style={[s.categoryBadge, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
            <Text style={[s.categoryText, { color: catColor }]}>{catShort}</Text>
          </View>
        </View>
        <View style={s.cardFooter}>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>ID Code</Text>
            <Text style={s.footerValue}>{item.beneficiary_id_code || '—'}</Text>
          </View>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>RFID Card</Text>
            <Text style={s.footerValue}>{item.RFID_number || 'Walang RFID'}</Text>
          </View>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>Sex</Text>
            <Text style={s.footerValue}>{item.sex || '—'}</Text>
          </View>
          <Text style={s.viewArrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderApplicationCard = ({ item }) => {
    const fullName = `${item.last_name || ''}, ${item.first_name || ''} ${item.middle_name || ''}`.trim();
    const barangayName = item.Barangay?.barangay_name || item.Barangay?.name || '—';
    const catShort = getCategoryShort(item.category);
    const docCount = item.Documents?.length || 0;

    return (
      <View style={[s.card, { borderLeftColor: '#f59e0b' }]}>
        <View style={s.cardHeader}>
          <View style={[s.avatar, { backgroundColor: '#fef3c7' }]}>
            <Text style={[s.avatarText, { color: '#d97706' }]}>
              {(item.first_name?.[0] || '').toUpperCase()}{(item.last_name?.[0] || '').toUpperCase()}
            </Text>
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardName} numberOfLines={1}>{fullName}</Text>
            <Text style={s.cardMeta}>📍 {barangayName} {item.sitio ? `• ${item.sitio}` : ''}</Text>
          </View>
          <View style={[s.categoryBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
            <Text style={[s.categoryText, { color: '#b45309' }]}>{item.status || 'Pending'}</Text>
          </View>
        </View>
        <View style={s.cardFooter}>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>Kategorya</Text>
            <Text style={s.footerValue}>{catShort}</Text>
          </View>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>Dokumento</Text>
            <Text style={s.footerValue}>📎 {docCount} Kalakip</Text>
          </View>
          <View style={s.footerItem}>
            <Text style={s.footerLabel}>Petsa</Text>
            <Text style={s.footerValue}>{formatDate(item.updated_at || item.created_at)}</Text>
          </View>
        </View>
        <View style={s.appCardActions}>
          <TouchableOpacity
            style={s.appReviewBtn}
            onPress={() => setSelectedApp(item)}
            activeOpacity={0.8}
          >
            <Text style={s.appReviewBtnText}>👁 Suriin ang Aplikasyon</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.appQuickApproveBtn, approvingApp && { opacity: 0.6 }]}
            onPress={() => handleApproveApplication(item)}
            disabled={approvingApp}
            activeOpacity={0.8}
          >
            <Text style={s.appQuickApproveBtnText}>✓ Aprubahan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProfileTab = () => {
    const b = selectedBeneficiary;
    if (!b) return null;
    const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.trim();

    return (
      <ScrollView style={s.tabContent}>
        <View style={s.profileSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={s.profileSectionTitle}>Personal Information</Text>
            <TouchableOpacity style={s.editInfoBtn} onPress={() => handleOpenEditModal(b)}>
              <Text style={s.editInfoBtnText}>✏ I-edit</Text>
            </TouchableOpacity>
          </View>
          {[
            ['Full Name', fullName],
            ['Sex', b.sex],
            ['Birthdate', formatDate(b.birthdate)],
            ['Civil Status', b.civil_status],
            ['Contact', b.contact_number],
            ['Address', b.address],
            ['Barangay', b.Barangay?.barangay_name || b.Barangay?.name || '—'],
            ['Sitio', b.sitio || '—'],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>

        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Beneficiary Details</Text>
          {[
            ['Category', b.category],
            ['IP Classification', b.ip_classification],
            ['Beneficiary ID', b.beneficiary_id_code],
            ['Household ID', b.household_id_number],
            ['National ID', b.national_id_number],
            ['PSA Birth Cert', b.psa_birth_cert_number],
            ['Status', b.status],
            ['Approval Date', formatDate(b.approval_date)],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}

          {/* RFID Assignment Row */}
          <View style={s.rfidSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rfidLabel}>💳 PHYSICAL RFID CARD</Text>
                <Text style={s.rfidValue}>{b.RFID_number ? b.RFID_number : 'Walang nakatakdang RFID Card'}</Text>
              </View>
              <TouchableOpacity
                style={s.rfidEditToggleBtn}
                onPress={() => {
                  setEditingRfid(!editingRfid);
                  setRfidInput(b.RFID_number || '');
                }}
              >
                <Text style={s.rfidEditToggleBtnText}>{editingRfid ? '✕ Kanselahin' : (b.RFID_number ? 'Palitan' : '+ I-assign')}</Text>
              </TouchableOpacity>
            </View>

            {editingRfid && (
              <View style={s.rfidEditBox}>
                <TextInput
                  style={s.rfidInput}
                  value={rfidInput}
                  onChangeText={setRfidInput}
                  placeholder="I-type o i-scan ang 10-digit RFID..."
                  placeholderTextColor="#94a3b8"
                  keyboardType="default"
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[s.rfidSaveBtn, savingRfid && { opacity: 0.6 }]}
                  onPress={handleSaveRfid}
                  disabled={savingRfid}
                >
                  {savingRfid ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.rfidSaveBtnText}>I-save ang RFID</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Payout Information</Text>
          {[
            ['Preference', b.payout_preference === 'digital' ? '💳 Digital' : '💵 Cash OTC'],
            ['Provider', b.payout_provider],
            ['Account No.', b.payout_account_number ? (showFullAccountNo ? b.payout_account_number : '••••' + b.payout_account_number.slice(-4)) : '—'],
            ['Account Name', b.payout_account_name],
            ['Verification', (b.account_verification_status || 'unverified').toUpperCase()],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}

          {b.payout_preference === 'digital' && b.payout_account_number && (
            <View style={s.payoutActionsRow}>
              <TouchableOpacity
                style={s.toggleAccountNoBtn}
                onPress={() => setShowFullAccountNo(!showFullAccountNo)}
              >
                <Text style={s.toggleAccountNoText}>{showFullAccountNo ? 'Itago ang Numero' : 'Ipakita ang Buong Numero'}</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {b.account_verification_status !== 'verified' && (
                  <TouchableOpacity
                    style={[s.verifyPayoutBtn, verifyingPayout && { opacity: 0.6 }]}
                    onPress={() => handleVerifyPayout('verified')}
                    disabled={verifyingPayout}
                  >
                    <Text style={s.verifyPayoutBtnText}>✓ I-verify ang Account</Text>
                  </TouchableOpacity>
                )}
                {b.account_verification_status !== 'rejected' && (
                  <TouchableOpacity
                    style={[s.rejectPayoutBtn, verifyingPayout && { opacity: 0.6 }]}
                    onPress={() => handleVerifyPayout('rejected')}
                    disabled={verifyingPayout}
                  >
                    <Text style={s.rejectPayoutBtnText}>✕ I-reject</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // ATTENDANCE TAB matching Image 3 with live database connection
  const renderAttendanceTab = () => {
    if (tabLoading && !attendanceData) {
      return (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={s.loadingText}>Kinukuha ang talaan ng attendance...</Text>
        </View>
      );
    }

    const stats = attendanceData?.stats || {
      compliance_rate: 0,
      present_count: 0,
      total_meetings: 0,
      absent_count: 0,
      pending_count: 0,
    };
    const records = attendanceData?.records || [];
    const isCompliant = (stats.compliance_rate || 0) >= 80;

    return (
      <ScrollView style={s.tabContent}>
        {/* 4 Top KPI Cards matching Image 3 */}
        <View style={s.attendanceKpiGrid}>
          {/* 1: Compliance */}
          <View style={s.attKpiCard}>
            <View style={s.attKpiHeader}>
              <Text style={s.attKpiLabel}>COMPLIANCE</Text>
              <Text style={{ fontSize: 13 }}>🎖</Text>
            </View>
            <Text style={[s.attKpiValue, { color: isCompliant ? '#15803d' : '#be123c' }]}>
              {stats.compliance_rate}%
            </Text>
            <Text style={s.attKpiSub}>
              {isCompliant ? 'Mahusay / Compliant' : 'Kailangang Subaybayan'}
            </Text>
          </View>

          {/* 2: Naka-attend */}
          <View style={[s.attKpiCard, { borderColor: '#86efac', backgroundColor: '#f0fdf4' }]}>
            <View style={s.attKpiHeader}>
              <Text style={[s.attKpiLabel, { color: '#16a34a' }]}>NAKA-ATTEND</Text>
              <Text style={{ fontSize: 13, color: '#16a34a' }}>✓</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[s.attKpiValue, { color: '#15803d' }]}>{stats.present_count}</Text>
              <Text style={[s.attKpiTotal, { color: '#16a34a' }]}> / {stats.total_meetings}</Text>
            </View>
            <Text style={[s.attKpiSub, { color: '#16a34a' }]}>Present sa pagpupulong</Text>
          </View>

          {/* 3: Liban (Absent) */}
          <View style={[s.attKpiCard, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}>
            <View style={s.attKpiHeader}>
              <Text style={[s.attKpiLabel, { color: '#e11d48' }]}>LIBAN (ABSENT)</Text>
              <Text style={{ fontSize: 13, color: '#e11d48' }}>⊗</Text>
            </View>
            <Text style={[s.attKpiValue, { color: '#be123c' }]}>{stats.absent_count}</Text>
            <Text style={[s.attKpiSub, { color: '#e11d48' }]}>Hindi nakapag-attend</Text>
          </View>

          {/* 4: Pending */}
          <View style={[s.attKpiCard, { borderColor: '#fde047', backgroundColor: '#fefce8' }]}>
            <View style={s.attKpiHeader}>
              <Text style={[s.attKpiLabel, { color: '#ca8a04' }]}>PENDING</Text>
              <Text style={{ fontSize: 13, color: '#ca8a04' }}>🕒</Text>
            </View>
            <Text style={[s.attKpiValue, { color: '#a16207' }]}>{stats.pending_count}</Text>
            <Text style={[s.attKpiSub, { color: '#ca8a04' }]}>Paparating na pulong</Text>
          </View>
        </View>

        {/* Meeting Attendance Records Section matching Image 3 */}
        <View style={s.meetingCardContainer}>
          <View style={s.meetingSectionHeader}>
            <Text style={s.meetingSectionTitle}>
              📅 Talaan ng Lahat ng Meetings ({records.length})
            </Text>
            <Text style={s.meetingSectionSub}>
              Listahan ng mga opisyal na pagpupulong para sa kategoryang{' '}
              <Text style={{ fontWeight: 'bold' }}>{selectedBeneficiary?.category || 'Beneficiary'}</Text>
            </Text>
          </View>

          {records.length === 0 ? (
            <View style={s.emptyMeetingBox}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>📅</Text>
              <Text style={s.emptyTab}>Walang nakatalang pulong para sa benepisyaryong ito.</Text>
            </View>
          ) : (
            records.map((rec) => {
              const isPresent = rec.attendance_status === 'Present';
              const isAbsent = rec.attendance_status === 'Absent';
              const isPending = rec.attendance_status === 'Pending';

              return (
                <View key={rec.id} style={s.meetingItemCard}>
                  {/* Title & Creator */}
                  <Text style={s.meetingTitle}>{rec.title}</Text>
                  <View style={s.creatorTag}>
                    <Text style={s.creatorTagText}>
                      Nilikha ni: {rec.CreatedBy ? `${rec.CreatedBy.first_name} ${rec.CreatedBy.last_name}` : 'System Administrator'}
                    </Text>
                  </View>

                  {/* Schedule & Venue */}
                  <View style={s.meetingMetaRow}>
                    <Text style={s.meetingMetaText}>
                      📅 {formatDate(rec.event_date)} {rec.event_time ? `• ${rec.event_time}` : ''}
                    </Text>
                    <Text style={s.meetingMetaText}>
                      📍 {rec.venue || 'Barangay Covered Court'}
                    </Text>
                  </View>

                  {/* Status explanation & badge */}
                  <View style={s.meetingStatusRow}>
                    <Text
                      style={[
                        s.meetingNoteText,
                        isPresent && { color: '#15803d' },
                        isAbsent && { color: '#be123c' },
                        isPending && { color: '#a16207' },
                      ]}
                    >
                      {isPresent
                        ? `✓ Na-scan ang RFID card noong ${rec.scanned_at ? formatDate(rec.scanned_at) : 'pulong'}`
                        : isAbsent
                        ? '⊗ Hindi nakadalo sa itinakdang oras ng pulong'
                        : '🕒 Naka-iskedyul — I-tap ang RFID card sa araw ng pulong'}
                    </Text>

                    {/* Badge Pill matching Image 3 */}
                    <View
                      style={[
                        s.attendanceBadgePill,
                        isPresent && s.badgePresent,
                        isAbsent && s.badgeAbsent,
                        isPending && s.badgePending,
                      ]}
                    >
                      <Text
                        style={[
                          s.attendanceBadgeText,
                          isPresent && s.badgePresentTxt,
                          isAbsent && s.badgeAbsentTxt,
                          isPending && s.badgePendingTxt,
                        ]}
                      >
                        {isPresent
                          ? '✓ Naka-attend (Present)'
                          : isAbsent
                          ? '⊗ Hindi Naka-attend (Absent)'
                          : '🕒 Naka-iskedyul (Pending)'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Footer info bar matching Image 3 */}
        <View style={s.meetingFooterBar}>
          <Text style={s.meetingFooterInfo}>
            Kabuuang Meetings: {stats.total_meetings} • Attendance Rating:{' '}
            <Text style={{ fontWeight: 'bold' }}>{stats.compliance_rate}%</Text>
          </Text>
          <TouchableOpacity
            style={s.closeWindowBtn}
            onPress={() => setSelectedBeneficiary(null)}
          >
            <Text style={s.closeWindowBtnText}>Close Window</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // DISTRIBUTIONS TAB with real data binding
  const renderDistributionsTab = () => {
    if (tabLoading && !distributionsData) {
      return (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={s.loadingText}>Kinukuha ang talaan ng mga ayuda...</Text>
        </View>
      );
    }

    const stats = distributionsData?.stats || {
      total_claims: 0,
      released_count: 0,
      pending_count: 0,
      total_amount_claimed: 0,
    };
    const txns = distributionsData?.transactions || [];

    return (
      <ScrollView style={s.tabContent}>
        {/* KPI Banner */}
        <View style={s.distKpiRow}>
          <View style={s.distKpiCard}>
            <Text style={s.distKpiLabel}>Kabuuang Na-claim</Text>
            <Text style={s.distKpiAmount}>{formatMoney(stats.total_amount_claimed)}</Text>
          </View>
          <View style={s.distKpiCard}>
            <Text style={s.distKpiLabel}>Na-claim (Released)</Text>
            <Text style={s.distKpiCount}>{stats.released_count} ayuda</Text>
          </View>
        </View>

        {txns.length === 0 ? (
          <Text style={s.emptyTab}>Walang nakatalang release ng ayuda para sa benepisyaryong ito.</Text>
        ) : (
          txns.map((txn, i) => (
            <View key={txn.id || i} style={s.recordCard}>
              <View style={s.recordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.recordTitle}>{txn.Event?.title || 'Distribution Event'}</Text>
                  <Text style={s.recordMeta}>
                    📅 {txn.released_at ? formatDate(txn.released_at) : formatDate(txn.created_at)}
                  </Text>
                </View>
                <Text style={s.amountBadge}>{formatMoney(Number(txn.amount || 0) + Number(txn.retro_amount || 0))}</Text>
              </View>
              <View style={s.statusRow}>
                <View
                  style={[
                    s.statusDot,
                    {
                      backgroundColor:
                        txn.status === 'released'
                          ? '#16a34a'
                          : txn.status === 'pending'
                          ? '#eab308'
                          : '#94a3b8',
                    },
                  ]}
                />
                <Text style={s.recordMeta}>{(txn.status || 'pending').toUpperCase()}</Text>
                {txn.verification_method && <Text style={s.recordMeta}> • {txn.verification_method}</Text>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // PROGRAMS TAB with real data binding
  const renderProgramsTab = () => {
    if (tabLoading && !enrollmentsData) {
      return (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={s.loadingText}>Kinukuha ang mga programa...</Text>
        </View>
      );
    }

    const enrs = enrollmentsData?.enrollments || [];
    const stats = enrollmentsData?.stats || { active_count: 0, total_enrolled: 0 };

    return (
      <ScrollView style={s.tabContent}>
        <View style={s.distKpiRow}>
          <View style={s.distKpiCard}>
            <Text style={s.distKpiLabel}>Aktibong Programa</Text>
            <Text style={[s.distKpiCount, { color: '#7c3aed' }]}>{stats.active_count} programa</Text>
          </View>
          <View style={s.distKpiCard}>
            <Text style={s.distKpiLabel}>Kabuuang Enrollment</Text>
            <Text style={s.distKpiCount}>{stats.total_enrolled} record</Text>
          </View>
        </View>

        {enrs.length === 0 ? (
          <Text style={s.emptyTab}>Walang naka-enroll na programa para sa benepisyaryong ito.</Text>
        ) : (
          enrs.map((enrollment, i) => (
            <View key={enrollment.id || i} style={s.recordCard}>
              <Text style={s.recordTitle}>
                {enrollment.BenefitProgram?.name || enrollment.program_name || 'Benefit Program'}
              </Text>
              <Text style={s.recordMeta}>
                📅 Petsa ng Enrollment: {formatDate(enrollment.enrollment_date || enrollment.created_at)}
              </Text>
              <View style={s.statusRow}>
                <View
                  style={[
                    s.statusDot,
                    {
                      backgroundColor:
                        enrollment.status === 'active' ? '#16a34a' : '#eab308',
                    },
                  ]}
                />
                <Text style={s.recordMeta}>{(enrollment.status || 'active').toUpperCase()}</Text>
                {enrollment.BenefitProgram?.benefit_type && (
                  <Text style={s.recordMeta}> • {enrollment.BenefitProgram.benefit_type}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // Badges for Tabs
  const attStats = attendanceData?.stats;
  const attBadge = attStats ? `${attStats.compliance_rate}% (${attStats.present_count}/${attStats.total_meetings})` : null;

  const distStats = distributionsData?.stats;
  const distBadge = distStats ? `₱${Math.round(distStats.total_amount_claimed || 0)} (${distStats.released_count})` : null;

  const enrStats = enrollmentsData?.stats;
  const enrBadge = enrStats ? `${enrStats.active_count} Aktibo` : null;

  return (
    <SafeAreaView style={s.page}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Beneficiaries</Text>
          <Text style={s.headerCount}>
            {listMode === 'roster'
              ? `${filteredBeneficiaries.length} Rehistrado`
              : `${filteredApplications.length} Nakapilang Aplikasyon`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={s.filterBtn}>
          <Text style={s.filterIcon}>{showFilters ? '✕' : '⚙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Mode Tabs: Registered Roster vs Pending Applications */}
      <View style={s.modeTabRow}>
        <TouchableOpacity
          style={[s.modeTabBtn, listMode === 'roster' && s.modeTabBtnActive]}
          onPress={() => setListMode('roster')}
          activeOpacity={0.8}
        >
          <Text style={[s.modeTabBtnText, listMode === 'roster' && s.modeTabBtnTextActive]}>
            👥 Rehistrado ({filteredBeneficiaries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.modeTabBtn, listMode === 'applications' && s.modeTabBtnActive]}
          onPress={() => setListMode('applications')}
          activeOpacity={0.8}
        >
          <Text style={[s.modeTabBtnText, listMode === 'applications' && s.modeTabBtnTextActive]}>
            ⏳ Aplikasyon
          </Text>
          {pendingApplications.length > 0 && (
            <View style={s.tabBadgeCount}>
              <Text style={s.tabBadgeCountText}>{pendingApplications.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={listMode === 'roster' ? 'Search by name, barangay, or ID...' : 'Search applications...'}
          placeholderTextColor="#64748b"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={s.clearSearch}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={s.filterPanel}>
          <Text style={s.filterTitle}>Filter by Barangay</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
            <TouchableOpacity
              style={[s.filterChip, !selectedBarangayId && s.filterChipActive]}
              onPress={() => setSelectedBarangayId('')}
            >
              <Text style={[s.filterChipText, !selectedBarangayId && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {barangays.map((brgy) => {
              const name = brgy.barangay_name || brgy.name;
              return (
                <TouchableOpacity
                  key={brgy.id}
                  style={[s.filterChip, selectedBarangayId === String(brgy.id) && s.filterChipActive]}
                  onPress={() => setSelectedBarangayId(selectedBarangayId === String(brgy.id) ? '' : String(brgy.id))}
                >
                  <Text style={[s.filterChipText, selectedBarangayId === String(brgy.id) && s.filterChipTextActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[s.filterTitle, { marginTop: 10 }]}>Filter by Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
            <TouchableOpacity
              style={[s.filterChip, !selectedCategory && s.filterChipActive]}
              onPress={() => setSelectedCategory('')}
            >
              <Text style={[s.filterChipText, !selectedCategory && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.filterChip, selectedCategory === cat && s.filterChipActive]}
                onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
              >
                <Text style={[s.filterChipText, selectedCategory === cat && s.filterChipTextActive]}>
                  {getCategoryShort(cat)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={s.loadingText}>
            {listMode === 'roster' ? 'Loading beneficiaries...' : 'Loading applications...'}
          </Text>
        </View>
      ) : error ? (
        <View style={s.centered}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={listMode === 'roster' ? filteredBeneficiaries : filteredApplications}
          keyExtractor={(item) => String(item.id)}
          renderItem={listMode === 'roster' ? renderBeneficiaryCard : renderApplicationCard}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={s.emptyText}>
                {listMode === 'roster'
                  ? 'Walang nakitang rehistradong benepisyaryo sa napiling filter.'
                  : 'Walang nakapilang aplikasyon sa kasalukuyan.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Detail Modal with Tabs matching Image 3 */}
      <Modal visible={!!selectedBeneficiary} animationType="slide" onRequestClose={() => setSelectedBeneficiary(null)}>
        <SafeAreaView style={s.modalPage}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedBeneficiary(null)} style={s.modalBackBtn}>
              <Text style={s.modalBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle} numberOfLines={1}>
              {selectedBeneficiary ? `${selectedBeneficiary.first_name} ${selectedBeneficiary.last_name}` : ''}
            </Text>
          </View>

          {selectedBeneficiary && (
            <View style={s.modalSummary}>
              <View style={[s.modalAvatar, { backgroundColor: getCategoryColor(selectedBeneficiary.category) + '20' }]}>
                <Text style={[s.modalAvatarText, { color: getCategoryColor(selectedBeneficiary.category) }]}>
                  {(selectedBeneficiary.first_name?.[0] || '').toUpperCase()}{(selectedBeneficiary.last_name?.[0] || '').toUpperCase()}
                </Text>
              </View>
              <View style={s.modalSummaryInfo}>
                <Text style={s.modalName}>{selectedBeneficiary.first_name} {selectedBeneficiary.last_name}</Text>
                <Text style={s.modalMeta}>
                  📍 {selectedBeneficiary.Barangay?.barangay_name || selectedBeneficiary.Barangay?.name || '—'} • {selectedBeneficiary.category || 'N/A'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={s.approvedBadge}>
                    <Text style={s.approvedText}>✓ APPROVED</Text>
                  </View>
                  <TouchableOpacity
                    style={s.qrBadgeBtn}
                    onPress={() => handleOpenBeneficiaryQr(selectedBeneficiary)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.qrBadgeBtnText}>☵ QR Pass</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Tabs matching Image 3 with Live Badges */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarContainer}>
            <View style={s.tabBar}>
              {/* Tab 1: Profile */}
              <TouchableOpacity
                style={[s.tab, detailTab === 'profile' && s.tabActive]}
                onPress={() => setDetailTab('profile')}
              >
                <Text style={[s.tabText, detailTab === 'profile' && s.tabTextActive]}>
                  👤 Personal & RFID Details
                </Text>
              </TouchableOpacity>

              {/* Tab 2: Attendance */}
              <TouchableOpacity
                style={[s.tab, detailTab === 'attendance' && s.tabActive]}
                onPress={() => setDetailTab('attendance')}
              >
                <Text style={[s.tabText, detailTab === 'attendance' && s.tabTextActive]}>
                  📅 DSWD Attendance
                </Text>
                {attBadge && (
                  <View style={s.tabBadgeRed}>
                    <Text style={s.tabBadgeRedText}>{attBadge}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Tab 3: Distributions */}
              <TouchableOpacity
                style={[s.tab, detailTab === 'distributions' && s.tabActive]}
                onPress={() => setDetailTab('distributions')}
              >
                <Text style={[s.tabText, detailTab === 'distributions' && s.tabTextActive]}>
                  💰 DSWD Distributions
                </Text>
                {distBadge && (
                  <View style={s.tabBadgeGreen}>
                    <Text style={s.tabBadgeGreenText}>{distBadge}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Tab 4: Programs */}
              <TouchableOpacity
                style={[s.tab, detailTab === 'programs' && s.tabActive]}
                onPress={() => setDetailTab('programs')}
              >
                <Text style={[s.tabText, detailTab === 'programs' && s.tabTextActive]}>
                  📦 DSWD Programs
                </Text>
                {enrBadge && (
                  <View style={s.tabBadgePurple}>
                    <Text style={s.tabBadgePurpleText}>{enrBadge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Content of selected tab */}
          {detailTab === 'profile' && renderProfileTab()}
          {detailTab === 'attendance' && renderAttendanceTab()}
          {detailTab === 'distributions' && renderDistributionsTab()}
          {detailTab === 'programs' && renderProgramsTab()}
        </SafeAreaView>
      </Modal>

      {/* Digital QR Pass Modal */}
      <Modal visible={qrModalVisible} transparent animationType="slide" onRequestClose={() => setQrModalVisible(false)}>
        <SafeAreaView style={s.qrModalOverlay}>
          <View style={s.qrModalCard}>
            <View style={s.qrModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.qrModalRepublic}>Republic of the Philippines</Text>
                <Text style={s.qrModalAgency}>DSWD / MSWDO Bongabong</Text>
              </View>
              <TouchableOpacity onPress={() => setQrModalVisible(false)} style={s.qrModalCloseBtn}>
                <Text style={s.qrModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.qrModalBody}>
              <View style={s.qrIdBadgePill}>
                <Text style={s.qrIdBadgePillText}>TEMPORARY DIGITAL ID • CLAIM PASS</Text>
              </View>

              <View style={s.qrBenInfoRow}>
                {qrPassData?.profile_photo || qrPassData?.profile_picture ? (
                  <Image
                    source={{
                      uri: (qrPassData.profile_photo || qrPassData.profile_picture).startsWith('http')
                        ? (qrPassData.profile_photo || qrPassData.profile_picture)
                        : `${FILES_BASE_URL}/${(qrPassData.profile_photo || qrPassData.profile_picture).replace(/^\/+/, '')}`
                    }}
                    style={s.qrAvatarImg}
                  />
                ) : (
                  <View style={s.qrAvatarFallback}>
                    <Text style={s.qrAvatarInitials}>
                      {(qrPassData?.first_name?.[0] || selectedBeneficiary?.first_name?.[0] || 'B').toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.qrFullName}>{qrPassData?.full_name || `${selectedBeneficiary?.first_name} ${selectedBeneficiary?.last_name}`}</Text>
                  <Text style={s.qrIdText}>
                    {qrPassData?.household_id_number || qrPassData?.beneficiary_id_code || selectedBeneficiary?.beneficiary_id_code || 'Approved'}
                  </Text>
                  <View style={s.qrCategoryPill}>
                    <Text style={s.qrCategoryPillText}>{qrPassData?.category || selectedBeneficiary?.category}</Text>
                  </View>
                  <Text style={s.qrBrgyText}>Brgy. {qrPassData?.barangay || selectedBeneficiary?.Barangay?.barangay_name || '—'}</Text>
                </View>
              </View>

              <View style={s.qrImageBox}>
                {qrLoading ? (
                  <View style={s.qrLoadingBox}>
                    <ActivityIndicator size="large" color="#0b3b9b" />
                    <Text style={s.qrLoadingText}>Kinukuha ang QR code...</Text>
                  </View>
                ) : qrPassData?.qr_image_url ? (
                  <Image
                    source={{ uri: qrPassData.qr_image_url }}
                    style={s.qrCodeImg}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={s.qrLoadingBox}>
                    <Text style={s.qrLoadingText}>Walang QR code</Text>
                  </View>
                )}
                <Text style={s.qrTokenText}>
                  {qrPassData?.qr_code || `EBMS-QR:${qrPassData?.qr_token || 'TOKEN'}`}
                </Text>
              </View>

              <View style={s.qrNoticeBox}>
                <Text style={s.qrNoticeTitle}>Staff Verification Reference:</Text>
                <Text style={s.qrNoticeDesc}>Maaaring i-share o i-save ang QR code na ito para sa benepisyaryo upang magamit sa payout verification at attendance scanner.</Text>
              </View>
            </ScrollView>

            <View style={s.qrModalFooter}>
              <TouchableOpacity
                style={s.qrShareBtn}
                onPress={handleShareBeneficiaryQr}
                activeOpacity={0.8}
              >
                <Text style={s.qrShareBtnText}>⬇ I-save / I-share ang QR Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.qrCloseBtn} onPress={() => setQrModalVisible(false)}>
                <Text style={s.qrCloseBtnText}>Isara</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Pending Application Review Modal ── */}
      <Modal visible={!!selectedApp} animationType="slide" onRequestClose={() => setSelectedApp(null)}>
        <SafeAreaView style={s.modalPage}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedApp(null)} style={s.modalBackBtn}>
              <Text style={s.modalBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle} numberOfLines={1}>
              {selectedApp ? `Aplikasyon: ${selectedApp.first_name} ${selectedApp.last_name}` : ''}
            </Text>
          </View>

          {selectedApp && (
            <ScrollView style={s.tabContent}>
              <View style={s.appReviewHero}>
                <View style={[s.modalAvatar, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[s.modalAvatarText, { color: '#d97706' }]}>
                    {(selectedApp.first_name?.[0] || '').toUpperCase()}{(selectedApp.last_name?.[0] || '').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalName}>
                    {selectedApp.first_name} {selectedApp.middle_name ? selectedApp.middle_name + ' ' : ''}{selectedApp.last_name}
                  </Text>
                  <Text style={s.modalMeta}>
                    📍 {selectedApp.Barangay?.barangay_name || selectedApp.Barangay?.name || '—'} {selectedApp.sitio ? `(${selectedApp.sitio})` : ''}
                  </Text>
                  <View style={[s.categoryBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a', alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[s.categoryText, { color: '#b45309' }]}>STATUS: {selectedApp.status || 'Pending Review'}</Text>
                  </View>
                </View>
              </View>

              <View style={s.profileSection}>
                <Text style={s.profileSectionTitle}>Impormasyon ng Aplikante</Text>
                {[
                  ['Kategorya', selectedApp.category],
                  ['Kasarian', selectedApp.sex],
                  ['Kaarawan', formatDate(selectedApp.birthdate)],
                  ['Civil Status', selectedApp.civil_status],
                  ['Contact Number', selectedApp.contact_number],
                  ['Tirahan', selectedApp.address],
                  ['Sitio / Purok', selectedApp.sitio || '—'],
                  ['Barangay', selectedApp.Barangay?.barangay_name || selectedApp.Barangay?.name || '—'],
                  ['IP Classification', selectedApp.ip_classification || 'None'],
                  ['Household / 4Ps No.', selectedApp.household_id_number || '—'],
                  ['Petsa ng Pagsumite', formatDate(selectedApp.created_at || selectedApp.updated_at)],
                ].map(([label, value]) => (
                  <View key={label} style={s.profileRow}>
                    <Text style={s.profileLabel}>{label}</Text>
                    <Text style={s.profileValue}>{value || '—'}</Text>
                  </View>
                ))}
              </View>

              <View style={s.profileSection}>
                <Text style={s.profileSectionTitle}>Kalakip na mga Dokumento ({selectedApp.Documents?.length || 0})</Text>
                {(!selectedApp.Documents || selectedApp.Documents.length === 0) ? (
                  <Text style={s.emptyTab}>Walang in-upload na dokumento ang aplikante.</Text>
                ) : (
                  selectedApp.Documents.map((doc, idx) => (
                    <View key={doc.id || idx} style={s.docItemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.docItemTitle}>{doc.document_type || 'Kalakip na Dokumento'}</Text>
                        <Text style={s.docItemSub} numberOfLines={1}>{doc.file_name || doc.file_path || 'Uploaded File'}</Text>
                      </View>
                      <TouchableOpacity
                        style={s.docViewBtn}
                        onPress={() => {
                          setDocPreviewUrl(resolveDocUrl(doc.file_path));
                          setDocPreviewTitle(doc.document_type || 'Kalakip na Dokumento');
                        }}
                      >
                        <Text style={s.docViewBtnText}>👁 Tingnan</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              <View style={s.appDecisionCard}>
                <Text style={s.appDecisionTitle}>Aksyon ng Tagasuri (Staff Endorsement / Approval)</Text>
                <Text style={s.appDecisionDesc}>
                  Kapag inaprubahan, awtomatikong bibigyan ng system ang residente ng opisyal na Beneficiary ID Code at magiging kwalipikado sa mga programa at ayuda.
                </Text>

                <View style={{ gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[s.approveActionBtn, approvingApp && { opacity: 0.6 }]}
                    onPress={() => handleApproveApplication(selectedApp)}
                    disabled={approvingApp}
                  >
                    {approvingApp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.approveActionBtnText}>✓ Aprubahan ang Aplikasyon</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.rejectActionBtn}
                    onPress={() => setRejectModalVisible(true)}
                  >
                    <Text style={s.rejectActionBtnText}>✕ Tanggihan / I-reject ang Aplikasyon</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Reject Application Modal ── */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={s.rejectOverlay}>
          <View style={s.rejectCard}>
            <View style={s.rejectHeader}>
              <Text style={s.rejectTitle}>Pagtanggi sa Aplikasyon</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Text style={s.rejectClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <Text style={s.rejectSubtitle}>Pumili ng mga kulang na dokumento (opsyonal):</Text>
              {[
                'Valid Government ID',
                'Barangay Certificate of Indigency',
                '1x1 ID Picture',
                'Certificate of Residency',
                'Proof of Income / 4Ps Certificate',
                'Medical Certificate (for PWD / Senior)',
              ].map((docName) => {
                const isSelected = selectedMissingDocs.includes(docName);
                return (
                  <TouchableOpacity
                    key={docName}
                    style={[s.missingDocChip, isSelected && s.missingDocChipActive]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedMissingDocs(selectedMissingDocs.filter((d) => d !== docName));
                      } else {
                        setSelectedMissingDocs([...selectedMissingDocs, docName]);
                      }
                    }}
                  >
                    <Text style={[s.missingDocText, isSelected && s.missingDocTextActive]}>
                      {isSelected ? '✓ ' : '+ '} {docName}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={[s.rejectSubtitle, { marginTop: 12 }]}>Dahilan ng Pagtanggi (Kailangan):</Text>
              <TextInput
                style={s.rejectInput}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Hal. Kulang ang isinumiteng patunay ng tirahan o hindi malinaw ang kopya ng valid ID..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={s.rejectBtnRow}>
              <TouchableOpacity
                style={s.rejectCancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={s.rejectCancelText}>Kanselahin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.rejectSubmitBtn, rejectingApp && { opacity: 0.6 }]}
                onPress={handleRejectApplication}
                disabled={rejectingApp}
              >
                {rejectingApp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.rejectSubmitText}>Isumite ang Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Beneficiary Information Modal ── */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={s.rejectOverlay}>
          <View style={s.rejectCard}>
            <View style={s.rejectHeader}>
              <Text style={s.rejectTitle}>I-edit ang Impormasyon ng Benepisyaryo</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={s.rejectClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={s.editFieldLabel}>CONTACT NUMBER</Text>
              <TextInput
                style={s.editInput}
                value={editForm.contact_number}
                onChangeText={(val) => setEditForm((prev) => ({ ...prev, contact_number: val }))}
                placeholder="09123456789"
                keyboardType="phone-pad"
              />

              <Text style={s.editFieldLabel}>TIRAHAN / ADDRESS</Text>
              <TextInput
                style={s.editInput}
                value={editForm.address}
                onChangeText={(val) => setEditForm((prev) => ({ ...prev, address: val }))}
                placeholder="House no., Street..."
              />

              <Text style={s.editFieldLabel}>SITIO / PUROK</Text>
              <TextInput
                style={s.editInput}
                value={editForm.sitio}
                onChangeText={(val) => setEditForm((prev) => ({ ...prev, sitio: val }))}
                placeholder="Sitio..."
              />

              <Text style={s.editFieldLabel}>CIVIL STATUS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {['Single', 'Married', 'Widowed', 'Separated'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[s.statusChip, editForm.civil_status === st && s.statusChipActive]}
                    onPress={() => setEditForm((prev) => ({ ...prev, civil_status: st }))}
                  >
                    <Text style={[s.statusChipText, editForm.civil_status === st && s.statusChipTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={s.rejectBtnRow}>
              <TouchableOpacity style={s.rejectCancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={s.rejectCancelText}>Kanselahin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.approveActionBtn, { flex: 1, paddingVertical: 10 }, savingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.approveActionBtnText}>I-save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Document Image Preview Modal ── */}
      <Modal visible={!!docPreviewUrl} transparent animationType="fade" onRequestClose={() => setDocPreviewUrl(null)}>
        <SafeAreaView style={s.docPreviewOverlay}>
          <View style={s.docPreviewHeader}>
            <Text style={s.docPreviewHeaderTitle} numberOfLines={1}>{docPreviewTitle || 'Dokumento'}</Text>
            <TouchableOpacity onPress={() => setDocPreviewUrl(null)} style={s.docPreviewCloseBtn}>
              <Text style={s.docPreviewCloseText}>✕ Isara</Text>
            </TouchableOpacity>
          </View>
          <View style={s.docPreviewBody}>
            {docPreviewUrl && (
              <Image
                source={{ uri: docPreviewUrl }}
                style={s.docPreviewImage}
                resizeMode="contain"
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: '#93c5fd', fontSize: 15, fontWeight: '600' },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  headerCount: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  filterBtn: { paddingLeft: 12, paddingVertical: 4 },
  filterIcon: { color: '#f8fafc', fontSize: 20 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    elevation: 2,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  clearSearch: { color: '#94a3b8', fontSize: 18, paddingLeft: 8 },

  // Filters
  filterPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  filterScroll: { flexDirection: 'row', marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  filterChipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  listContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  footerItem: { flex: 1 },
  footerLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  footerValue: { fontSize: 12.5, color: '#334155', fontWeight: '600', marginTop: 2 },
  viewArrow: { fontSize: 24, color: '#cbd5e1', fontWeight: '300' },

  // Centered states
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 40 },
  loadingText: { color: '#64748b', marginTop: 12, fontSize: 14 },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },

  // Modal
  modalPage: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalBackBtn: { paddingRight: 12 },
  modalBackText: { color: '#93c5fd', fontSize: 15, fontWeight: '600' },
  modalTitle: { flex: 1, color: '#f8fafc', fontSize: 17, fontWeight: '700' },

  modalSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modalAvatarText: { fontSize: 20, fontWeight: '700' },
  modalSummaryInfo: { flex: 1 },
  modalName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalMeta: { fontSize: 13, color: '#64748b', marginTop: 3 },
  approvedBadge: {
    backgroundColor: '#dcfce7',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  approvedText: { color: '#16a34a', fontSize: 11, fontWeight: '800' },

  // Tabs Bar
  tabBarContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 50 },
  tabBar: { flexDirection: 'row', alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#2563eb', fontWeight: '800' },
  tabBadgeRed: { backgroundColor: '#fee2e2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgeRedText: { color: '#b91c1c', fontSize: 10, fontWeight: '800' },
  tabBadgeGreen: { backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgeGreenText: { color: '#15803d', fontSize: 10, fontWeight: '800' },
  tabBadgePurple: { backgroundColor: '#f3e8ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  tabBadgePurpleText: { color: '#7e22ce', fontSize: 10, fontWeight: '800' },

  tabContent: { flex: 1, padding: 16 },

  // Profile sections
  profileSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  profileSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  profileRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  profileLabel: { width: 120, fontSize: 12.5, color: '#64748b', fontWeight: '600' },
  profileValue: { flex: 1, fontSize: 12.5, color: '#1e293b', fontWeight: '500' },

  // 4 Top KPI Cards for Attendance matching Image 3
  attendanceKpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  attKpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  attKpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  attKpiLabel: { fontSize: 8.5, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  attKpiValue: { fontSize: 18, fontWeight: '900', color: '#1e293b' },
  attKpiTotal: { fontSize: 11, fontWeight: '700' },
  attKpiSub: { fontSize: 9, color: '#64748b', marginTop: 2, lineHeight: 12 },

  // Meeting Container
  meetingCardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    elevation: 1,
  },
  meetingSectionHeader: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
  meetingSectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  meetingSectionSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  emptyMeetingBox: { padding: 24, alignItems: 'center' },
  emptyTab: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },

  // Meeting Item Card matching Image 3
  meetingItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 10,
  },
  meetingTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  creatorTag: {
    backgroundColor: '#f1f5f9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  creatorTagText: { fontSize: 10, color: '#475569', fontWeight: '600' },
  meetingMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  meetingMetaText: { fontSize: 11.5, color: '#475569', fontWeight: '500' },
  meetingStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  meetingNoteText: { fontSize: 11, fontWeight: '600', flex: 1, minWidth: 160 },
  attendanceBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  attendanceBadgeText: { fontSize: 10.5, fontWeight: '800' },
  badgePresent: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  badgePresentTxt: { color: '#15803d' },
  badgeAbsent: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  badgeAbsentTxt: { color: '#b91c1c' },
  badgePending: { backgroundColor: '#fef3c7', borderColor: '#fde047' },
  badgePendingTxt: { color: '#b45309' },

  // Meeting Footer matching Image 3
  meetingFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  meetingFooterInfo: { fontSize: 11.5, color: '#475569', flex: 1 },
  closeWindowBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeWindowBtnText: { fontSize: 11.5, fontWeight: '700', color: '#1e293b' },

  // Distribution KPIs
  distKpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  distKpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  distKpiLabel: { fontSize: 10.5, color: '#64748b', fontWeight: '700' },
  distKpiAmount: { fontSize: 16, fontWeight: '900', color: '#15803d', marginTop: 2 },
  distKpiCount: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginTop: 2 },

  // Record cards
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  recordTitle: { fontSize: 13.5, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  recordMeta: { fontSize: 11.5, color: '#64748b' },
  amountBadge: { fontSize: 14, fontWeight: '800', color: '#16a34a' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },

  // QR Pass badge & modal styles
  qrBadgeBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  qrBadgeBtnText: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },

  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', padding: 16 },
  qrModalCard: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', maxHeight: '94%', elevation: 16 },
  qrModalHeader: { minHeight: 64, paddingHorizontal: 18, backgroundColor: '#0b3b9b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrModalRepublic: { color: '#93c5fd', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  qrModalAgency: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  qrModalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  qrModalCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  qrModalBody: { padding: 18, gap: 14, alignItems: 'center' },
  qrIdBadgePill: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  qrIdBadgePillText: { color: '#1e40af', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  qrBenInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  qrAvatarImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e2e8f0' },
  qrAvatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0b3b9b', alignItems: 'center', justifyContent: 'center' },
  qrAvatarInitials: { color: '#fff', fontSize: 22, fontWeight: '900' },
  qrFullName: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  qrIdText: { color: '#1d4ed8', fontSize: 12, fontWeight: '800', marginTop: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  qrCategoryPill: { alignSelf: 'flex-start', backgroundColor: '#f3e8ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  qrCategoryPillText: { color: '#7e22ce', fontSize: 10, fontWeight: '800' },
  qrBrgyText: { color: '#64748b', fontSize: 11, marginTop: 3 },
  qrImageBox: { width: '100%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#e2e8f0', padding: 16, alignItems: 'center', gap: 10, elevation: 2 },
  qrCodeImg: { width: 220, height: 220 },
  qrLoadingBox: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrLoadingText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  qrTokenText: { color: '#64748b', fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  qrNoticeBox: { width: '100%', backgroundColor: '#eff6ff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#bfdbfe', gap: 3 },
  qrNoticeTitle: { color: '#1e40af', fontSize: 12, fontWeight: '800' },
  qrNoticeDesc: { color: '#334155', fontSize: 11, lineHeight: 16 },
  qrModalFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafafa', gap: 10 },
  qrShareBtn: { minHeight: 46, backgroundColor: '#16a34a', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qrShareBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  qrCloseBtn: { minHeight: 44, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qrCloseBtnText: { color: '#334155', fontSize: 13, fontWeight: '800' },

  // Segmented Mode Tabs
  modeTabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 6,
  },
  modeTabBtnActive: {
    backgroundColor: '#1e40af',
  },
  modeTabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  modeTabBtnTextActive: {
    color: '#ffffff',
  },
  tabBadgeCount: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },

  // Application card actions
  appCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  appReviewBtn: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appReviewBtnText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '800',
  },
  appQuickApproveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appQuickApproveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Edit info button in profile
  editInfoBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editInfoBtnText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },

  // RFID Assignment Section
  rfidSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rfidLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  rfidValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rfidEditToggleBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rfidEditToggleBtnText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },
  rfidEditBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  rfidInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rfidSaveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfidSaveBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
  },

  // Payout actions
  payoutActionsRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  toggleAccountNoBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  toggleAccountNoText: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '700',
  },
  verifyPayoutBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyPayoutBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  rejectPayoutBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectPayoutBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },

  // Review Application Modal
  appReviewHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    gap: 12,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  docItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  docItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  docViewBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  docViewBtnText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },
  appDecisionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  appDecisionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  appDecisionDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  approveActionBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  rejectActionBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectActionBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },

  // Reject Overlay Modal
  rejectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  rejectCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    elevation: 12,
  },
  rejectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  rejectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  rejectClose: {
    fontSize: 18,
    color: '#94a3b8',
    padding: 4,
  },
  rejectSubtitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
  },
  missingDocChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 6,
  },
  missingDocChipActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  missingDocText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  missingDocTextActive: {
    color: '#dc2626',
    fontWeight: '800',
  },
  rejectInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    fontSize: 12.5,
    color: '#0f172a',
    textAlignVertical: 'top',
    minHeight: 70,
  },
  rejectBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rejectCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectSubmitBtn: {
    flex: 1.5,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectSubmitText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Edit fields
  editFieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  editInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    fontSize: 13,
    color: '#0f172a',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  statusChipActive: {
    backgroundColor: '#1e40af',
    borderColor: '#1e40af',
  },
  statusChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#fff',
    fontWeight: '800',
  },

  // Document preview modal
  docPreviewOverlay: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  docPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  docPreviewHeaderTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  docPreviewCloseBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  docPreviewCloseText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  docPreviewBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  docPreviewImage: {
    width: '100%',
    height: '100%',
  },
});

export default BeneficiaryListScreen;

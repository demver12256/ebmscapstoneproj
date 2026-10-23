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

const BeneficiaryListScreen = ({ onBack, onOpenDrawer, user }) => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangayId, setSelectedBarangayId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIpClassification, setSelectedIpClassification] = useState('');
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [listMode, setListMode] = useState('roster'); // 'roster' | 'applications'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

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
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    contact_number: '',
    address: '',
    sitio: '',
    civil_status: 'Single',
    status: 'active',
    inactivation_reason: '',
  });
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

  const isSeniorRole = ['senior_citizen_admin', 'senior_citizen_staff'].includes(user?.role);
  const isPwdRole = ['pwd_admin', 'pwd_staff'].includes(user?.role);
  const isMswdoRole = ['mswdo_admin', 'mswdo_staff'].includes(user?.role);
  const isDswdStaff = ['staff', 'barangay'].includes(user?.role);
  const isDswdAdmin = ['admin', 'dswd_admin'].includes(user?.role);
  const isSectorRole = isSeniorRole || isPwdRole || isMswdoRole;

  const getSectorLabels = () => {
    if (isSeniorRole) {
      return {
        name: 'Senior Citizen',
        attendanceTitle: 'Senior Citizen Attendance',
        attendanceRecordTitle: 'Senior Citizen Attendance Compliance Record',
        meetingTag: 'Senior Citizen Announcements & Meetings',
        distributionsTitle: 'Senior Citizen Distributions',
        ayudaTitle: 'Claimed Senior Citizen Ayuda & Distributions',
        ayudaTag: 'OSCA Released Only',
      };
    }
    if (isPwdRole) {
      return {
        name: 'PWD',
        attendanceTitle: 'PWD Attendance',
        attendanceRecordTitle: 'PWD Attendance Compliance Record',
        meetingTag: 'PWD Announcements & Meetings',
        distributionsTitle: 'PWD Distributions',
        ayudaTitle: 'Claimed PWD Ayuda & Distributions',
        ayudaTag: 'PDAO Released Only',
      };
    }
    if (isMswdoRole) {
      return {
        name: 'MSWDO',
        attendanceTitle: 'MSWDO Attendance',
        attendanceRecordTitle: 'MSWDO Attendance Compliance Record',
        meetingTag: 'MSWDO Announcements & Meetings',
        distributionsTitle: 'MSWDO Distributions',
        ayudaTitle: 'Claimed MSWDO Ayuda & Distributions',
        ayudaTag: 'MSWDO Released Only',
      };
    }
    return {
      name: 'DSWD',
      attendanceTitle: 'DSWD Attendance',
      attendanceRecordTitle: 'DSWD Attendance Compliance Record',
      meetingTag: 'DSWD Meetings Only',
      distributionsTitle: 'DSWD Distributions',
      ayudaTitle: 'Claimed DSWD Ayuda & Distributions',
      ayudaTag: 'DSWD Released Only',
    };
  };

  const sectorLabels = getSectorLabels();

  const getBeneficiarySubtitle = (b) => {
    if (!b) return { is4Ps: false, prefix: 'Beneficiary ID: ', idValue: 'Pending', category: 'Beneficiary' };
    const cat = String(b.category || '').toLowerCase();
    const is4Ps = cat.includes('4ps') || cat.includes('pantawid');
    const idValue = is4Ps
      ? (b.household_id_number || b.beneficiary_id_code || 'Pending')
      : (b.beneficiary_id_code || b.household_id_number || 'Pending');
    return {
      is4Ps,
      prefix: is4Ps ? '4Ps Household No.: ' : 'Beneficiary ID: ',
      idValue,
      category: b.category || 'Beneficiary',
    };
  };

  const getRfidPermission = (ben) => {
    if (!ben || !user) return { canRegister: false, sectorName: '', message: '' };
    const cat = String(ben.category || '').toLowerCase();
    const isBen4Ps = cat.includes('4ps') || cat.includes('pantawid');
    const isBenSenior = cat.includes('senior');
    const isBenPwd = cat.includes('pwd') || cat.includes('disabilit');

    if (isBen4Ps) {
      const allowed = isDswdAdmin || user.role === 'staff' || user.role === 'barangay';
      return {
        canRegister: allowed,
        sectorName: '4Ps / DSWD',
        message: allowed
          ? ''
          : 'Bawal mag-rehistro ng RFID: Tanging ang 4Ps / DSWD Administrator o Barangay Staff lamang ang may pahintulot na mag-rehistro ng RFID card para sa 4Ps beneficiaries.'
      };
    }

    if (isBenSenior) {
      const allowed = isSeniorRole;
      return {
        canRegister: allowed,
        sectorName: 'OSCA / SENIOR CITIZEN',
        message: allowed
          ? ''
          : 'Bawal mag-rehistro ng RFID: Tanging ang OSCA / Senior Citizen Administrator lamang ang may pahintulot na mag-rehistro ng RFID card para sa Senior Citizens.'
      };
    }

    if (isBenPwd) {
      const allowed = isPwdRole;
      return {
        canRegister: allowed,
        sectorName: 'PDAO / PWD',
        message: allowed
          ? ''
          : 'Bawal mag-rehistro ng RFID: Tanging ang PDAO / PWD Administrator lamang ang may pahintulot na mag-rehistro ng RFID card para sa Persons with Disabilities (PWD).'
      };
    }

    return {
      canRegister: isDswdAdmin,
      sectorName: 'ADMINISTRATOR',
      message: 'Tanging ang Administrator lamang ang may pahintulot na mag-rehistro ng RFID card para sa benepisyaryong ito.'
    };
  };

  const CATEGORIES = isSeniorRole
    ? ['Senior Citizens (Social Pension)']
    : isPwdRole
    ? ['Persons with Disabilities (PWD)']
    : isMswdoRole
    ? ['Senior Citizens (Social Pension)', 'Persons with Disabilities (PWD)', '4Ps Household Beneficiary']
    : isDswdStaff
    ? ['4Ps Household Beneficiary']
    : [
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

  const canManageApplications = (isDswdAdmin || isSeniorRole || isPwdRole) && !isMswdoRole;

  const isArchivedBeneficiary = (b) => {
    return b.User?.status === 'inactive' || b.status === 'inactive' || b.status === 'archived' || (b.inactivation_reason && b.inactivation_reason.includes('Archived'));
  };

  const categoryMatches = (beneficiaryCategory, filterCategory) => {
    if (!filterCategory) return true;
    if (!beneficiaryCategory) return false;
    if (beneficiaryCategory === filterCategory) return true;
    const isPwdFilter = filterCategory.toLowerCase().includes('pwd') || filterCategory.toLowerCase().includes('disabilit');
    const isPwdBen = beneficiaryCategory.toLowerCase().includes('pwd') || beneficiaryCategory.toLowerCase().includes('disabilit');
    if (isPwdFilter && isPwdBen) return true;
    const is4PsFilter = filterCategory.toLowerCase().includes('4ps');
    const is4PsBen = beneficiaryCategory.toLowerCase().includes('4ps');
    if (is4PsFilter && is4PsBen) return true;
    const isSeniorFilter = filterCategory.toLowerCase().includes('senior');
    const isSeniorBen = beneficiaryCategory.toLowerCase().includes('senior');
    if (isSeniorFilter && isSeniorBen) return true;
    return false;
  };

  const archivedCount = beneficiaries.filter(isArchivedBeneficiary).length;
  const activeCount = beneficiaries.filter((b) => !isArchivedBeneficiary(b)).length;

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const isArchived = isArchivedBeneficiary(b);
    if (showArchivedOnly && !isArchived) return false;
    if (!showArchivedOnly && isArchived) return false;

    if (selectedBarangayId && String(b.barangay_id) !== selectedBarangayId) return false;
    if (selectedCategory && !categoryMatches(b.category, selectedCategory)) return false;
    if (selectedIpClassification && b.ip_classification !== selectedIpClassification) return false;

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

  const totalPages = Math.ceil(filteredBeneficiaries.length / ITEMS_PER_PAGE) || 1;
  const paginatedBeneficiaries = filteredBeneficiaries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const filteredApplications = pendingApplications.filter((app) => {
    if (selectedBarangayId && String(app.barangay_id) !== selectedBarangayId) return false;
    if (selectedCategory && !categoryMatches(app.category, selectedCategory)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${app.first_name || ''} ${app.middle_name || ''} ${app.last_name || ''}`.toLowerCase();
      const brgy = (app.Barangay?.barangay_name || app.Barangay?.name || '').toLowerCase();
      const idCode = (app.beneficiary_id_code || app.household_id_number || '').toLowerCase();
      return fullName.includes(q) || brgy.includes(q) || idCode.includes(q);
    }
    return true;
  });

  const handleToggleArchiveBeneficiary = (beneficiaryRow) => {
    const isArchived = isArchivedBeneficiary(beneficiaryRow);
    const actionLabel = isArchived ? 'i-restore / i-activate' : 'i-archive / i-deactivate';
    Alert.alert(
      isArchived ? 'I-restore ang Benepisyaryo' : 'I-archive ang Benepisyaryo',
      `Sigurado ka bang nais mong ${actionLabel} ang rekord ni ${beneficiaryRow.first_name} ${beneficiaryRow.last_name}?`,
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: isArchived ? 'I-restore' : 'I-archive',
          style: isArchived ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await beneficiaryApi.update(beneficiaryRow.id, {
                status: isArchived ? 'active' : 'inactive',
                inactivation_reason: isArchived ? null : `Archived by ${user?.first_name || 'Staff'}`
              });
              Alert.alert('Tagumpay', `Matagumpay na na-${isArchived ? 'restore' : 'archive'} ang rekord!`);
              await loadData();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi naisagawa ang aksyon.');
            }
          }
        }
      ]
    );
  };

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

  const handleSaveRfidDirect = async () => {
    if (!selectedBeneficiary) return;
    const perm = getRfidPermission(selectedBeneficiary);
    if (!perm.canRegister) {
      Alert.alert('Bawal Mag-rehistro', perm.message);
      return;
    }
    const cleanRfid = rfidInput.trim();
    if (!cleanRfid) {
      Alert.alert('Walang RFID', 'Pakilagay ang RFID card number bago i-save.');
      return;
    }
    try {
      setSavingRfid(true);
      await beneficiaryApi.update(selectedBeneficiary.id, { RFID_number: cleanRfid });
      setSelectedBeneficiary((prev) => ({ ...prev, RFID_number: cleanRfid }));
      setBeneficiaries((prev) =>
        prev.map((b) => (b.id === selectedBeneficiary.id ? { ...b, RFID_number: cleanRfid } : b))
      );
      Alert.alert('Tagumpay', `✓ Matagumpay na na-rehistro ang RFID card: ${cleanRfid}!`);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Hindi na-save ang RFID card.');
    } finally {
      setSavingRfid(false);
    }
  };

  const handleRefreshModalData = () => {
    if (selectedBeneficiary) {
      loadBeneficiaryDetails(selectedBeneficiary);
    }
  };

  const handleSaveRfid = async () => {
    return handleSaveRfidDirect();
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
    setEditingBeneficiary(b);
    setEditForm({
      contact_number: b.contact_number || '',
      address: b.address || '',
      sitio: b.sitio || '',
      civil_status: b.civil_status || 'Single',
      status: isArchivedBeneficiary(b) ? 'inactive' : (b.User?.status || b.status || 'active'),
      inactivation_reason: b.inactivation_reason || '',
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBeneficiary) return;
    if (editForm.status === 'inactive' && !editForm.inactivation_reason?.trim()) {
      Alert.alert('Kailangan ang Dahilan', 'Pakilagay ang dahilan o note kung bakit gagawing inactive / archived ang rekord.');
      return;
    }
    try {
      setSavingEdit(true);
      const payload = {
        ...editForm,
        inactivation_reason: editForm.status === 'inactive' ? editForm.inactivation_reason.trim() : null,
      };
      await beneficiaryApi.update(editingBeneficiary.id, payload);
      Alert.alert('Tagumpay', 'Matagumpay na na-update ang impormasyon sa database!');
      setEditModalVisible(false);
      if (selectedBeneficiary && selectedBeneficiary.id === editingBeneficiary.id) {
        setSelectedBeneficiary((prev) => ({ ...prev, ...payload }));
      }
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
    setRfidInput(beneficiary.RFID_number || '');
    setEditingRfid(false);
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
    const isArchived = isArchivedBeneficiary(item);
    const isIp = item.ip_classification === 'IP';

    return (
      <View style={[s.card, isArchived && s.cardArchived]}>
        <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.7}>
          <View style={s.cardHeader}>
            <View style={[s.avatar, { backgroundColor: catColor + '20' }]}>
              <Text style={[s.avatarText, { color: catColor }]}>
                {(item.first_name?.[0] || '').toUpperCase()}{(item.last_name?.[0] || '').toUpperCase()}
              </Text>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardName} numberOfLines={1}>{fullName}</Text>
              <Text style={s.cardMeta}>
                📍 {barangayName} {item.sitio ? `• ${item.sitio}` : ''}
              </Text>
            </View>
            <View style={[s.categoryBadge, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
              <Text style={[s.categoryText, { color: catColor }]}>{catShort}</Text>
            </View>
          </View>

          <View style={s.cardFooter}>
            <View style={s.footerItem}>
              <Text style={s.footerLabel}>ID / Household No.</Text>
              <Text style={s.footerValue}>{item.household_id_number || item.beneficiary_id_code || '—'}</Text>
            </View>
            <View style={s.footerItem}>
              <Text style={s.footerLabel}>RFID Card</Text>
              <Text style={[s.footerValue, item.RFID_number ? { color: '#1d4ed8' } : { color: '#ca8a04' }]}>
                {item.RFID_number ? `💳 ${item.RFID_number}` : '⚠️ Walang RFID'}
              </Text>
            </View>
            <View style={s.footerItem}>
              <Text style={s.footerLabel}>Status</Text>
              <View style={[s.statusPill, isArchived ? s.statusPillPurple : item.User?.status === 'active' ? s.statusPillGreen : s.statusPillSlate]}>
                <Text style={[s.statusPillText, isArchived ? s.statusTextPurple : item.User?.status === 'active' ? s.statusTextGreen : s.statusTextSlate]}>
                  {isArchived ? 'Archived' : (item.User?.status || item.status || 'active')}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.cardSubRow}>
            <View style={[s.ipBadge, isIp ? s.ipBadgeActive : s.ipBadgeNormal]}>
              <Text style={[s.ipBadgeText, isIp ? s.ipBadgeTextActive : s.ipBadgeTextNormal]}>
                {isIp ? '🌿 IP (Mangyan)' : 'Non-IP'}
              </Text>
            </View>
            <Text style={s.cardDateText}>
              📅 Inaprubahan: {formatDate(item.approval_date || item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Action Buttons Toolbar matching Web App (Eye, QR, Edit, Archive) */}
        <View style={s.cardActionsToolbar}>
          <TouchableOpacity
            style={s.actionToolBtnBlue}
            onPress={() => openDetail(item)}
            activeOpacity={0.7}
          >
            <Text style={s.actionToolBtnBlueText}>👁 Tingnan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionToolBtnGreen}
            onPress={() => handleOpenBeneficiaryQr(item)}
            activeOpacity={0.7}
          >
            <Text style={s.actionToolBtnGreenText}>☵ QR Pass</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionToolBtnAmber}
            onPress={() => handleOpenEditModal(item)}
            activeOpacity={0.7}
          >
            <Text style={s.actionToolBtnAmberText}>✏ I-edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={isArchived ? s.actionToolBtnRestore : s.actionToolBtnArchive}
            onPress={() => handleToggleArchiveBeneficiary(item)}
            activeOpacity={0.7}
          >
            <Text style={isArchived ? s.actionToolBtnRestoreText : s.actionToolBtnArchiveText}>
              {isArchived ? '↺ I-restore' : '📦 I-archive'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
        {/* Card 1: Attendance Compliance Record Quick KPI Banner */}
        <View style={s.complianceCard}>
          <View style={s.cardTopRow}>
            <View style={s.blueIconSquare}>
              <Text style={{ fontSize: 16 }}>📅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={s.cardTitle}>{sectorLabels.attendanceRecordTitle}</Text>
                <View style={s.sectorBadgeBlue}>
                  <Text style={s.sectorBadgeBlueText}>{sectorLabels.meetingTag}</Text>
                </View>
                {attStats && (
                  <View style={[
                    s.ratingPill,
                    attStats.compliance_rate >= 80 ? s.ratingPillGreen : attStats.compliance_rate >= 50 ? s.ratingPillAmber : s.ratingPillRose
                  ]}>
                    <Text style={[
                      s.ratingPillText,
                      attStats.compliance_rate >= 80 ? s.ratingTextGreen : attStats.compliance_rate >= 50 ? s.ratingTextAmber : s.ratingTextRose
                    ]}>
                      {attStats.compliance_rate}% Rating
                    </Text>
                  </View>
                )}
              </View>
              {tabLoading && !attendanceData ? (
                <Text style={s.statsLoadingText}>Kinukuha ang attendance record...</Text>
              ) : attStats ? (
                <Text style={s.statsSummaryText}>
                  Naka-attend: <Text style={s.statGreen}>{attStats.present_count}</Text> • Liban: <Text style={s.statRose}>{attStats.absent_count}</Text> • Pending: <Text style={s.statAmber}>{attStats.pending_count}</Text> (Kabuuang <Text style={{ fontWeight: 'bold' }}>{attStats.total_meetings}</Text> na meetings)
                </Text>
              ) : (
                <Text style={s.statsEmptyText}>Walang nakatalang attendance stats.</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={s.viewFullBlueBtn}
            onPress={() => setDetailTab('attendance')}
            activeOpacity={0.8}
          >
            <Text style={s.viewFullBlueBtnText}>Tingnan Buong Talaan →</Text>
          </TouchableOpacity>
        </View>

        {/* Card 2: Distributions Quick KPI Banner */}
        <View style={s.ayudaCard}>
          <View style={s.cardTopRow}>
            <View style={s.emeraldIconSquare}>
              <Text style={{ fontSize: 16 }}>📦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={s.cardTitle}>{sectorLabels.ayudaTitle}</Text>
                <View style={s.sectorBadgeTeal}>
                  <Text style={s.sectorBadgeTealText}>{sectorLabels.ayudaTag}</Text>
                </View>
                {distStats && (
                  <View style={s.ratingPillGreen}>
                    <Text style={s.ratingTextGreen}>
                      {formatMoney(distStats.total_amount_claimed)} Na-claim
                    </Text>
                  </View>
                )}
              </View>
              {tabLoading && !distributionsData ? (
                <Text style={s.statsLoadingText}>Kinukuha ang talaan ng ayuda...</Text>
              ) : distStats ? (
                <Text style={s.statsSummaryText}>
                  Na-claim: <Text style={s.statGreen}>{distStats.released_count}</Text> • Pending: <Text style={s.statAmber}>{distStats.pending_count}</Text> • Kabuuang Halaga: <Text style={s.statGreen}>{formatMoney(distStats.total_amount_claimed)}</Text>
                </Text>
              ) : (
                <Text style={s.statsEmptyText}>Walang nakatalang distribution claims.</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={s.viewFullEmeraldBtn}
            onPress={() => setDetailTab('distributions')}
            activeOpacity={0.8}
          >
            <Text style={s.viewFullEmeraldBtnText}>Tingnan Buong Ayuda →</Text>
          </TouchableOpacity>
        </View>

        {/* Card 3: RFID Card Number Card */}
        <View style={s.rfidCardBox}>
          <View style={s.rfidHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={s.blueIconSquareSmall}>
                <Text style={{ fontSize: 14 }}>💳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rfidCardTitle}>RFID Card Number</Text>
                <Text style={s.rfidCardSubtitle}>Official Municipal RFID for Attendance & Distribution Tracking</Text>
              </View>
            </View>
            {b.RFID_number ? (
              <View style={s.rfidNumberPill}>
                <Text style={s.rfidNumberPillText}>💳 {b.RFID_number}</Text>
              </View>
            ) : (
              <View style={s.rfidUnassignedPill}>
                <Text style={s.rfidUnassignedPillText}>⚠️ No RFID Card Assigned</Text>
              </View>
            )}
          </View>

          {/* RFID registration form strictly for matching sector admin / staff */}
          {(() => {
            const rfidPerm = getRfidPermission(b);
            if (rfidPerm.canRegister) {
              return (
                <View style={s.rfidRegisterContainer}>
                  <View style={s.rfidRegisterHeader}>
                    <Text style={s.rfidRegisterTitle}>
                      REGISTER / UPDATE RFID CARD ({rfidPerm.sectorName})
                    </Text>
                    <View style={s.authorizedBadge}>
                      <Text style={s.authorizedBadgeText}>AUTHORIZED</Text>
                    </View>
                  </View>
                  <View style={s.rfidInputRow}>
                    <TextInput
                      style={s.rfidDirectInput}
                      value={rfidInput}
                      onChangeText={setRfidInput}
                      placeholder="Scan or enter RFID card number (e.g. RFID-0001)..."
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[s.rfidDirectSaveBtn, savingRfid && { opacity: 0.6 }]}
                      onPress={handleSaveRfidDirect}
                      disabled={savingRfid}
                      activeOpacity={0.8}
                    >
                      {savingRfid ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.rfidDirectSaveBtnText}>Save RFID</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            return (
              <View style={s.rfidLockBox}>
                <Text style={s.lockIconText}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rfidLockTitle}>{rfidPerm.message}</Text>
                  <Text style={s.rfidLockDesc}>
                    Maaari pa ring gamitin ang na-rehistrong RFID card sa DSWD/MSWDO distributions, attendance, at assistance claims.
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Card 4: Digital QR Pass / Temporary ID */}
        <View style={s.qrPassCardBox}>
          <View style={s.cardTopRow}>
            <View style={s.emeraldIconSquare}>
              <Text style={{ fontSize: 16 }}>📱</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.cardTitle}>Digital QR Pass / Temporary ID</Text>
                <View style={s.activeBackupBadge}>
                  <Text style={s.activeBackupBadgeText}>ACTIVE BACKUP</Text>
                </View>
              </View>
              <Text style={s.qrCardSubtitle}>
                {b.RFID_number
                  ? 'Maaari ring gamitin bilang alternatibong pagkakakilanlan.'
                  : 'Gamitin bilang pansamantalang ID sa mga payout at attendance habang wala pang RFID card.'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.viewQrPassBtn}
            onPress={() => handleOpenBeneficiaryQr(b)}
            activeOpacity={0.8}
          >
            <Text style={s.viewQrPassBtnText}>Tingnan Digital ID / QR Pass →</Text>
          </TouchableOpacity>
        </View>

        {/* Card 5: Personal Information */}
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

        {/* Card 6: Beneficiary Details */}
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

      {/* Header matching Web App (Lines 960-985) */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack || onOpenDrawer} style={s.backBtn}>
          <Text style={s.backText}>{onBack ? '← Back' : '☰ Menu'}</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.agencyBadgeTag}>
            <Text style={s.agencyBadgeTagText}>
              {isSeniorRole ? 'OSCA REGISTRY' : isPwdRole ? 'PDAO REGISTRY' : isMswdoRole ? 'MSWDO REGISTRY' : 'BENEFICIARY MANAGEMENT'}
            </Text>
          </View>
          <Text style={s.headerTitle} numberOfLines={1}>
            {showArchivedOnly ? 'Archived Beneficiary Records' : 'Official Beneficiary Records'}
          </Text>
          <Text style={s.headerCount}>
            Bongabong, Oriental Mindoro • {listMode === 'roster' ? `${filteredBeneficiaries.length} Rekord` : `${filteredApplications.length} Nakapilang Aplikasyon`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={s.filterBtn}>
          <Text style={s.filterIcon}>{showFilters ? '✕' : '⚙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Oversight Callout Card matching Web App (Lines 1010-1030) */}
      {isSectorRole && (
        <View style={s.sectorOversightCard}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.sectorOversightTitle}>
              {isSeniorRole
                ? 'Office of Senior Citizens Affairs (OSCA) Registry'
                : isPwdRole
                ? 'Persons with Disability Affairs Office (PDAO) Registry'
                : 'Municipal Beneficiary Records Oversight (MSWDO)'}
            </Text>
            <Text style={s.sectorOversightDesc}>
              {isSeniorRole
                ? 'Municipal registry at social pension records para sa mga Senior Citizens ng Bongabong.'
                : isPwdRole
                ? 'Municipal registry at disability welfare records para sa Persons with Disabilities (PWD).'
                : 'Municipal registry para sa Senior Citizens, Persons with Disabilities (PWD), at 4Ps households.'}
            </Text>
          </View>
        </View>
      )}

      {/* Top KPI Stat Cards matching Web App (Lines 1111-1142) */}
      <View style={s.topKpiStatsContainer}>
        <View style={s.topKpiCardBlue}>
          <Text style={s.topKpiCardLabel}>Total Records</Text>
          <Text style={s.topKpiCardNumberBlue}>{filteredBeneficiaries.length}</Text>
          <Text style={s.topKpiCardSub}>Naka-filter sa listahan</Text>
        </View>

        <View style={s.topKpiCardGreen}>
          <Text style={[s.topKpiCardLabel, { color: '#15803d' }]}>Active</Text>
          <Text style={[s.topKpiCardNumber, { color: '#16a34a' }]}>
            {filteredBeneficiaries.filter((b) => !isArchivedBeneficiary(b)).length}
          </Text>
          <Text style={[s.topKpiCardSub, { color: '#16a34a' }]}>Aktibong rekord</Text>
        </View>

        <View style={s.topKpiCardRose}>
          <Text style={[s.topKpiCardLabel, { color: '#be123c' }]}>Inactive</Text>
          <Text style={[s.topKpiCardNumber, { color: '#e11d48' }]}>
            {filteredBeneficiaries.filter((b) => isArchivedBeneficiary(b)).length}
          </Text>
          <Text style={[s.topKpiCardSub, { color: '#be123c' }]}>Inaktibo / Archive</Text>
        </View>

        {canManageApplications && (
          <TouchableOpacity
            style={s.topKpiCardAmber}
            onPress={() => {
              setListMode('applications');
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[s.topKpiCardLabel, { color: '#b45309' }]}>Pending</Text>
              <Text style={{ fontSize: 11 }}>⏳</Text>
            </View>
            <Text style={[s.topKpiCardNumber, { color: '#d97706' }]}>{pendingApplications.length}</Text>
            <Text style={[s.topKpiCardSub, { color: '#b45309' }]}>Suriin →</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Roster & Archive Mode Toggle Buttons matching Web App */}
      <View style={s.rosterToggleRow}>
        <TouchableOpacity
          style={[s.rosterToggleBtn, !showArchivedOnly && listMode === 'roster' && s.rosterToggleBtnActive]}
          onPress={() => {
            setShowArchivedOnly(false);
            setListMode('roster');
            setCurrentPage(1);
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.rosterToggleBtnText, !showArchivedOnly && listMode === 'roster' && s.rosterToggleBtnTextActive]}>
            👥 Aktibo ({activeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.rosterToggleBtn, showArchivedOnly && listMode === 'roster' && s.rosterToggleBtnActivePurple]}
          onPress={() => {
            setShowArchivedOnly(true);
            setListMode('roster');
            setCurrentPage(1);
          }}
          activeOpacity={0.8}
        >
          <Text style={[s.rosterToggleBtnText, showArchivedOnly && listMode === 'roster' && s.rosterToggleBtnTextActive]}>
            📦 Naka-archive ({archivedCount})
          </Text>
        </TouchableOpacity>

        {canManageApplications && (
          <TouchableOpacity
            style={[s.rosterToggleBtn, listMode === 'applications' && s.rosterToggleBtnActiveAmber]}
            onPress={() => {
              setListMode('applications');
              setCurrentPage(1);
            }}
            activeOpacity={0.8}
          >
            <Text style={[s.rosterToggleBtnText, listMode === 'applications' && s.rosterToggleBtnTextActive]}>
              ⏳ Aplikasyon ({pendingApplications.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          placeholder={listMode === 'roster' ? 'Search by name, barangay, or ID...' : 'Search applications...'}
          placeholderTextColor="#64748b"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setCurrentPage(1); }}>
            <Text style={s.clearSearch}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Panel matching Web App (Barangay, Category, IP Classification) */}
      {showFilters && (
        <View style={s.filterPanel}>
          <Text style={s.filterTitle}>Filter by Barangay</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
            <TouchableOpacity
              style={[s.filterChip, !selectedBarangayId && s.filterChipActive]}
              onPress={() => { setSelectedBarangayId(''); setCurrentPage(1); }}
            >
              <Text style={[s.filterChipText, !selectedBarangayId && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {barangays.map((brgy) => {
              const name = brgy.barangay_name || brgy.name;
              return (
                <TouchableOpacity
                  key={brgy.id}
                  style={[s.filterChip, selectedBarangayId === String(brgy.id) && s.filterChipActive]}
                  onPress={() => { setSelectedBarangayId(selectedBarangayId === String(brgy.id) ? '' : String(brgy.id)); setCurrentPage(1); }}
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
              onPress={() => { setSelectedCategory(''); setCurrentPage(1); }}
            >
              <Text style={[s.filterChipText, !selectedCategory && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.filterChip, selectedCategory === cat && s.filterChipActive]}
                onPress={() => { setSelectedCategory(selectedCategory === cat ? '' : cat); setCurrentPage(1); }}
              >
                <Text style={[s.filterChipText, selectedCategory === cat && s.filterChipTextActive]}>
                  {getCategoryShort(cat)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.filterTitle, { marginTop: 10 }]}>Filter by IP Classification</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
            {[
              ['', 'All Classifications'],
              ['IP', 'IP (Mangyan)'],
              ['Non-IP', 'Non-IP'],
            ].map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[s.filterChip, selectedIpClassification === val && s.filterChipActive]}
                onPress={() => { setSelectedIpClassification(selectedIpClassification === val ? '' : val); setCurrentPage(1); }}
              >
                <Text style={[s.filterChipText, selectedIpClassification === val && s.filterChipTextActive]}>
                  {label}
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
          data={listMode === 'roster' ? paginatedBeneficiaries : filteredApplications}
          keyExtractor={(item) => String(item.id)}
          renderItem={listMode === 'roster' ? renderBeneficiaryCard : renderApplicationCard}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={s.emptyText}>
                {listMode === 'roster'
                  ? (showArchivedOnly
                      ? 'Walang nakitang naka-archive na rekord sa filter na ito.'
                      : 'Walang nakitang rehistradong benepisyaryo sa napiling filter.')
                  : 'Walang nakapilang aplikasyon sa kasalukuyan.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            listMode === 'roster' && filteredBeneficiaries.length > 0 ? (
              <View style={s.paginationBar}>
                <Text style={s.paginationInfoText}>
                  Pahina {currentPage} ng {totalPages} ({filteredBeneficiaries.length} kabuuang rekord)
                </Text>
                <View style={s.paginationControls}>
                  <TouchableOpacity
                    style={[s.pageNavBtn, currentPage === 1 && s.pageNavBtnDisabled]}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pageNavBtnText, currentPage === 1 && s.pageNavBtnTextDisabled]}>‹ Nakaraan</Text>
                  </TouchableOpacity>

                  <View style={s.pageNumbersRow}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5) {
                        if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                      }
                      return (
                        <TouchableOpacity
                          key={pageNum}
                          style={[s.pageNumBtn, currentPage === pageNum && s.pageNumBtnActive]}
                          onPress={() => setCurrentPage(pageNum)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.pageNumBtnText, currentPage === pageNum && s.pageNumBtnTextActive]}>
                            {pageNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[s.pageNavBtn, currentPage === totalPages && s.pageNavBtnDisabled]}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.pageNavBtnText, currentPage === totalPages && s.pageNavBtnTextDisabled]}>Susunod ›</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* Detail Modal with Tabs matching Screenshots 1:1 */}
      <Modal visible={!!selectedBeneficiary} animationType="slide" onRequestClose={() => setSelectedBeneficiary(null)}>
        <SafeAreaView style={s.modalPage}>
          {/* Navy Blue Hero Header Banner matching Screenshots */}
          <View style={s.modalHeroBanner}>
            <View style={s.modalHeroLeft}>
              {selectedBeneficiary?.profile_picture ? (
                <Image
                  source={{
                    uri: selectedBeneficiary.profile_picture.startsWith('http')
                      ? selectedBeneficiary.profile_picture
                      : `${FILES_BASE_URL}/${selectedBeneficiary.profile_picture.replace(/\\/g, '/').replace(/^\/+/, '')}`
                  }}
                  style={s.modalHeroAvatarImg}
                />
              ) : (
                <View style={s.modalHeroAvatarFallback}>
                  <Text style={s.modalHeroAvatarInitials}>
                    {(selectedBeneficiary?.first_name?.[0] || '').toUpperCase()}{(selectedBeneficiary?.last_name?.[0] || '').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={s.modalHeroFullName} numberOfLines={1}>
                    {selectedBeneficiary?.first_name} {selectedBeneficiary?.middle_name ? `${selectedBeneficiary.middle_name} ` : ''}{selectedBeneficiary?.last_name}
                  </Text>
                  <View style={s.modalHeroActivePill}>
                    <Text style={s.modalHeroActivePillText}>
                      {selectedBeneficiary?.User?.status || selectedBeneficiary?.status || 'active'}
                    </Text>
                  </View>
                </View>
                {(() => {
                  const sub = getBeneficiarySubtitle(selectedBeneficiary);
                  return (
                    <Text style={s.modalHeroSubtitle} numberOfLines={1}>
                      {sub.prefix}
                      <Text style={s.modalHeroIdText}>{sub.idValue}</Text>
                      {' • '}
                      {sub.category}
                    </Text>
                  );
                })()}
              </View>
            </View>
            <TouchableOpacity
              style={s.modalHeroCloseBtn}
              onPress={() => setSelectedBeneficiary(null)}
              activeOpacity={0.8}
            >
              <Text style={s.modalHeroCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Modal Navigation Tabs with live badges & refresh */}
          <View style={s.modalTabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modalTabsScroll}>
              <TouchableOpacity
                style={[s.modalTabBtn, detailTab === 'profile' && s.modalTabBtnActive]}
                onPress={() => setDetailTab('profile')}
                activeOpacity={0.7}
              >
                <Text style={[s.modalTabBtnText, detailTab === 'profile' && s.modalTabBtnTextActive]}>
                  👤 Personal & RFID Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalTabBtn, detailTab === 'attendance' && s.modalTabBtnActive]}
                onPress={() => setDetailTab('attendance')}
                activeOpacity={0.7}
              >
                <Text style={[s.modalTabBtnText, detailTab === 'attendance' && s.modalTabBtnTextActive]}>
                  📅 {sectorLabels.attendanceTitle}
                </Text>
                {attBadge && (
                  <View style={[
                    s.tabBadgePill,
                    (attStats?.compliance_rate || 0) >= 80 ? s.tabBadgePillGreen : (attStats?.compliance_rate || 0) >= 50 ? s.tabBadgePillAmber : s.tabBadgePillRose
                  ]}>
                    <Text style={[
                      s.tabBadgePillText,
                      (attStats?.compliance_rate || 0) >= 80 ? s.tabBadgePillTextGreen : (attStats?.compliance_rate || 0) >= 50 ? s.tabBadgePillTextAmber : s.tabBadgePillTextRose
                    ]}>
                      {attBadge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalTabBtn, detailTab === 'distributions' && s.modalTabBtnActive]}
                onPress={() => setDetailTab('distributions')}
                activeOpacity={0.7}
              >
                <Text style={[s.modalTabBtnText, detailTab === 'distributions' && s.modalTabBtnTextActive]}>
                  📦 {sectorLabels.distributionsTitle}
                </Text>
                {distBadge && (
                  <View style={[s.tabBadgePill, s.tabBadgePillGreen]}>
                    <Text style={[s.tabBadgePillText, s.tabBadgePillTextGreen]}>
                      {distBadge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {!isSectorRole && (
                <TouchableOpacity
                  style={[s.modalTabBtn, detailTab === 'programs' && s.modalTabBtnActive]}
                  onPress={() => setDetailTab('programs')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.modalTabBtnText, detailTab === 'programs' && s.modalTabBtnTextActive]}>
                    📦 DSWD Programs
                  </Text>
                  {enrBadge && (
                    <View style={[s.tabBadgePill, s.tabBadgePillPurple]}>
                      <Text style={[s.tabBadgePillText, s.tabBadgePillTextPurple]}>
                        {enrBadge}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={s.modalRefreshBtn}
                onPress={handleRefreshModalData}
                disabled={tabLoading}
                activeOpacity={0.7}
              >
                {tabLoading ? (
                  <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 4 }} />
                ) : (
                  <Text style={{ fontSize: 13, marginRight: 4 }}>🔄</Text>
                )}
                <Text style={s.modalRefreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Modal Tab Content */}
          <View style={{ flex: 1 }}>
            {detailTab === 'profile' && renderProfileTab()}
            {detailTab === 'attendance' && renderAttendanceTab()}
            {detailTab === 'distributions' && renderDistributionsTab()}
            {detailTab === 'programs' && renderProgramsTab()}
          </View>

          {/* Modal Persistent Bottom Footer matching Screenshots */}
          <View style={s.modalBottomBar}>
            <View style={s.modalBottomInfo}>
              {detailTab === 'profile' && (
                <Text style={s.modalBottomInfoText}>
                  Account Status: <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedBeneficiary?.User?.status || selectedBeneficiary?.status || 'active'}</Text> • RFID: <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{selectedBeneficiary?.RFID_number || 'Walang RFID Card'}</Text>
                </Text>
              )}
              {detailTab === 'attendance' && (
                <Text style={s.modalBottomInfoText}>
                  Kabuuang Meetings: <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{attStats?.total_meetings || 0}</Text> • Attendance Rating: <Text style={{ fontWeight: 'bold', color: '#15803d' }}>{attStats?.compliance_rate || 0}%</Text>
                </Text>
              )}
              {detailTab === 'distributions' && (
                <Text style={s.modalBottomInfoText}>
                  Kabuuang Na-claim: <Text style={{ fontWeight: 'bold', color: '#15803d' }}>{formatMoney(distStats?.total_amount_claimed)}</Text> • Na-claim: <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{distStats?.released_count || 0} ayuda</Text>
                </Text>
              )}
              {detailTab === 'programs' && (
                <Text style={s.modalBottomInfoText}>
                  Naka-enroll: <Text style={{ fontWeight: 'bold', color: '#7c3aed' }}>{enrStats?.active_count || 0} Aktibo</Text> (Kabuuang {enrStats?.total_enrolled || 0} sinalihan)
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={s.modalBottomCloseBtn}
              onPress={() => setSelectedBeneficiary(null)}
              activeOpacity={0.8}
            >
              <Text style={s.modalBottomCloseBtnText}>Close Window</Text>
            </TouchableOpacity>
          </View>
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
              <Text style={s.rejectTitle}>
                I-edit: {editingBeneficiary ? `${editingBeneficiary.first_name} ${editingBeneficiary.last_name}` : 'Benepisyaryo'}
              </Text>
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

              <Text style={[s.editFieldLabel, { marginTop: 12 }]}>RECORD STATUS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={[s.statusChip, editForm.status === 'active' && { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}
                  onPress={() => setEditForm((prev) => ({ ...prev, status: 'active', inactivation_reason: '' }))}
                >
                  <Text style={[s.statusChipText, editForm.status === 'active' && { color: '#15803d', fontWeight: '800' }]}>
                    ✓ Active (Aktibo)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.statusChip, editForm.status === 'inactive' && { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                  onPress={() => setEditForm((prev) => ({ ...prev, status: 'inactive' }))}
                >
                  <Text style={[s.statusChipText, editForm.status === 'inactive' && { color: '#be123c', fontWeight: '800' }]}>
                    ⊗ Inactive (Inaktibo)
                  </Text>
                </TouchableOpacity>
              </View>

              {editForm.status === 'inactive' && (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.editFieldLabel}>DAHILAN / NOTE SA PAGIGING INACTIVE (REQUIRED)</Text>
                  <TextInput
                    style={[s.editInput, { height: 60, textAlignVertical: 'top' }]}
                    value={editForm.inactivation_reason}
                    onChangeText={(val) => setEditForm((prev) => ({ ...prev, inactivation_reason: val }))}
                    placeholder="Ilagay ang dahilan (e.g. Lumipat ng tirahan, Archived, atbp.)..."
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                </View>
              )}
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
                {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.approveActionBtnText}>I-save sa Database</Text>}
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
  // Modal Hero Header matching Screenshots
  modalHeroBanner: {
    backgroundColor: '#172554',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeroAvatarImg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modalHeroAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeroAvatarInitials: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  modalHeroFullName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalHeroActivePill: {
    backgroundColor: '#34d399',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modalHeroActivePillText: {
    color: '#022c22',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  modalHeroSubtitle: {
    fontSize: 11.5,
    color: '#bfdbfe',
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalHeroIdText: {
    color: '#fde047',
    fontWeight: '800',
  },
  modalHeroCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeroCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Modal Navigation Tabs
  modalTabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  modalTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  modalTabBtnActive: {
    borderBottomColor: '#2563eb',
  },
  modalTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  modalTabBtnTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  tabBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabBadgePillGreen: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  tabBadgePillTextGreen: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  tabBadgePillAmber: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde047',
  },
  tabBadgePillTextAmber: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '800',
  },
  tabBadgePillRose: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  tabBadgePillTextRose: {
    color: '#be123c',
    fontSize: 10,
    fontWeight: '800',
  },
  tabBadgePillPurple: {
    backgroundColor: '#f3e8ff',
    borderColor: '#d8b4fe',
  },
  tabBadgePillTextPurple: {
    color: '#7e22ce',
    fontSize: 10,
    fontWeight: '800',
  },
  modalRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalRefreshBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },

  // Compliance, Ayuda, RFID, and QR Pass card styles
  complianceCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  ayudaCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  blueIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueIconSquareSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emeraldIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectorBadgeBlue: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectorBadgeBlueText: {
    color: '#1d4ed8',
    fontSize: 9.5,
    fontWeight: '800',
  },
  sectorBadgeTeal: {
    backgroundColor: '#ccfbf1',
    borderWidth: 1,
    borderColor: '#99f6e4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectorBadgeTealText: {
    color: '#0f766e',
    fontSize: 9.5,
    fontWeight: '800',
  },
  ratingPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingPillGreen: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingPillAmber: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde047',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingPillRose: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  ratingTextGreen: { color: '#15803d' },
  ratingTextAmber: { color: '#b45309' },
  ratingTextRose: { color: '#be123c' },
  statsLoadingText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  statsSummaryText: {
    color: '#475569',
    fontSize: 11.5,
    marginTop: 4,
    lineHeight: 16,
  },
  statsEmptyText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
  },
  statGreen: { color: '#15803d', fontWeight: '800' },
  statRose: { color: '#be123c', fontWeight: '800' },
  statAmber: { color: '#b45309', fontWeight: '800' },
  viewFullBlueBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewFullBlueBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  viewFullEmeraldBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewFullEmeraldBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  rfidCardBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  rfidHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rfidCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  rfidCardSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  rfidNumberPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  rfidNumberPillText: {
    color: '#1d4ed8',
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rfidUnassignedPill: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  rfidUnassignedPillText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
  },
  rfidRegisterContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 8,
  },
  rfidRegisterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rfidRegisterTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  authorizedBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  authorizedBadgeText: {
    color: '#059669',
    fontSize: 9.5,
    fontWeight: '900',
  },
  rfidInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rfidDirectInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 12.5,
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rfidDirectSaveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rfidDirectSaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  rfidLockBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  lockIconText: {
    fontSize: 16,
    marginTop: 1,
  },
  rfidLockTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#78350f',
    lineHeight: 16,
  },
  rfidLockDesc: {
    fontSize: 10.5,
    color: '#92400e',
    marginTop: 4,
    lineHeight: 14,
  },
  qrPassCardBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  activeBackupBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBackupBadgeText: {
    color: '#15803d',
    fontSize: 9,
    fontWeight: '900',
  },
  qrCardSubtitle: {
    fontSize: 11,
    color: '#166534',
    marginTop: 3,
    lineHeight: 15,
  },
  viewQrPassBtn: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewQrPassBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  modalBottomInfo: {
    flex: 1,
  },
  modalBottomInfoText: {
    fontSize: 11,
    color: '#475569',
  },
  modalBottomCloseBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalBottomCloseBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },

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

  // ── Missing Styles for Modal Header & Review ──
  tabBadgePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalBackBtn: {
    paddingRight: 12,
  },
  modalBackText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '700',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // ── Sector Agency & Oversight Callout ──
  agencyBadgeTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  agencyBadgeTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectorOversightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  sectorOversightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
  },
  sectorOversightDesc: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
    lineHeight: 16,
  },

  // ── Top KPI Stat Cards ──
  topKpiStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  topKpiCardBlue: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 10,
  },
  topKpiCardGreen: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 10,
  },
  topKpiCardRose: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 10,
  },
  topKpiCardAmber: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 10,
  },
  topKpiCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  topKpiCardNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  topKpiCardNumberBlue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 2,
  },
  topKpiCardSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },

  // ── Roster & Archive Toggle Row ──
  rosterToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    gap: 4,
  },
  rosterToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  rosterToggleBtnActive: {
    backgroundColor: '#1e40af',
    elevation: 2,
    shadowColor: '#1e40af',
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  rosterToggleBtnActivePurple: {
    backgroundColor: '#7c3aed',
    elevation: 2,
  },
  rosterToggleBtnActiveAmber: {
    backgroundColor: '#d97706',
    elevation: 2,
  },
  rosterToggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  rosterToggleBtnTextActive: {
    color: '#fff',
    fontWeight: '800',
  },

  // ── Card Status & Badges ──
  cardArchived: {
    borderLeftColor: '#94a3b8',
    backgroundColor: '#f8fafc',
    opacity: 0.9,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusPillGreen: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  statusPillPurple: {
    backgroundColor: '#f3e8ff',
    borderColor: '#d8b4fe',
  },
  statusPillSlate: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextGreen: {
    color: '#15803d',
  },
  statusTextPurple: {
    color: '#7e22ce',
  },
  statusTextSlate: {
    color: '#64748b',
  },
  cardSubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  ipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  ipBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  ipBadgeNormal: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  ipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ipBadgeTextActive: {
    color: '#047857',
  },
  ipBadgeTextNormal: {
    color: '#64748b',
  },
  cardDateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },

  // ── Card Actions Toolbar ──
  cardActionsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionToolBtnBlue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
  },
  actionToolBtnBlueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  actionToolBtnGreen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
  },
  actionToolBtnGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  actionToolBtnAmber: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
  },
  actionToolBtnAmberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  actionToolBtnArchive: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
  },
  actionToolBtnArchiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  actionToolBtnRestore: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 8,
  },
  actionToolBtnRestoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },

  // ── Pagination Bar & Buttons ──
  paginationBar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  paginationInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pageNavBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pageNavBtnTextDisabled: {
    color: '#94a3b8',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNumBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pageNumBtnActive: {
    backgroundColor: '#1e40af',
    borderColor: '#1e40af',
  },
  pageNumBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  pageNumBtnTextActive: {
    color: '#fff',
  },
});

export default BeneficiaryListScreen;

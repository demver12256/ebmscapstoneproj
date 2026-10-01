import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import api, {
  beneficiaryApi,
  distributionApi,
  medicalAssistanceApi,
  assistanceRequestApi,
  notificationApi,
  messageApi,
  announcementApi,
} from './services/api';
import BeneficiaryListScreen from './screens/BeneficiaryListScreen';
import AttendanceScreen from './screens/AttendanceScreen';
import AssistanceScreen from './screens/AssistanceScreen';
import RequestAssistanceScreen from './screens/RequestAssistanceScreen';
import MessagesScreen from './screens/MessagesScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import InterventionsScreen from './screens/InterventionsScreen';
import AuthScreen from './screens/AuthScreen';
import SidebarDrawer from './components/SidebarDrawer';
import BottomNavBar from './components/BottomNavBar';
import NotificationPopupModal from './components/NotificationPopupModal';
import { API_URL } from './config/api';

const FILES_BASE_URL = API_URL.replace(/\/api\/?$/, '');

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusTone = (status = '') => {
  const value = status.toLowerCase();
  if (['released', 'completed', 'approved'].includes(value)) return 'success';
  if (['rejected', 'cancelled'].includes(value)) return 'danger';
  return 'warning';
};

const parseAttachments = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [{ name: 'Attached document', url: value }];
  } catch {
    return [{ name: 'Attached document', url: value }];
  }
};

const isAnnouncementUpcoming = (ann) => {
  if (!ann) return false;
  if (ann.status !== 'published') return false;

  const now = new Date();
  if (ann.event_date) {
    const timeToCheck = ann.end_time || ann.event_time || '23:59';
    let hours = 23;
    let minutes = 59;
    if (timeToCheck) {
      const match = String(timeToCheck).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3] ? match[3].toUpperCase() : null;
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hours = h;
        minutes = m;
      }
    }
    const [y, m, d] = String(ann.event_date).split('-').map(Number);
    if (y && m && d) {
      const eventEndTime = new Date(y, m - 1, d, hours, minutes, 59);
      if (now > eventEndTime) return false;
    }
  }

  if (ann.expiration_date) {
    const [y, m, d] = String(ann.expiration_date).split('-').map(Number);
    if (y && m && d) {
      const expirationTime = new Date(y, m - 1, d, 23, 59, 59);
      if (now > expirationTime) return false;
    }
  }

  return true;
};

const App = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [extraSaving, setExtraSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [benefitsError, setBenefitsError] = useState('');
  const [assistanceApplications, setAssistanceApplications] = useState([]);
  const [portalAssistanceRequests, setPortalAssistanceRequests] = useState([]);
  const [benefitFilter, setBenefitFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [payoutForm, setPayoutForm] = useState({
    payout_preference: 'digital',
    payout_provider: 'GCash',
    payout_account_number: '',
    payout_account_name: '',
  });
  const [extraPayoutForm, setExtraPayoutForm] = useState({
    provider: 'Landbank',
    account_number: '',
    account_name: '',
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentNav, setCurrentNav] = useState('dashboard');
  const [activeModal, setActiveModal] = useState(null);
  const [payoutMethodOpen, setPayoutMethodOpen] = useState(false);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [assistanceForm, setAssistanceForm] = useState({
    type: 'Medical Assistance',
    subject: '',
    description: '',
  });
  const [submittingAssistance, setSubmittingAssistance] = useState(false);

  const loadAttendanceLogs = async () => {
    try {
      setAttendanceLoading(true);
      if (profile?.id) {
        const res = await beneficiaryApi.getAttendance(profile.id);
        setAttendanceLogs(res?.data?.data || []);
      }
    } catch (err) {
      console.warn('Attendance load error:', err?.message);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await notificationApi.list();
      setNotificationsList(res?.data?.data || []);
    } catch (err) {
      console.warn('Notifications load error:', err?.message);
    }
  };

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Popup Modal for Announcements & System Notifications (Matching Web & Screenshot)
  const [modalItems, setModalItems] = useState([]);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [shownPopupIds, setShownPopupIds] = useState(new Set());

  const loadPopups = async () => {
    if (!user) return;
    try {
      const [annRes, notifRes] = await Promise.allSettled([
        announcementApi.list().catch(() => ({ data: { data: [] } })),
        notificationApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      const annList = annRes.status === 'fulfilled' ? annRes.value.data?.data || [] : [];
      const notifList = notifRes.status === 'fulfilled' ? notifRes.value.data?.data || [] : [];

      const unreadAnn = annList
        .filter((a) => !a.is_read && isAnnouncementUpcoming(a))
        .map((a) => ({ ...a, popupType: 'announcement' }));

      const unclaimedReferenceIds = new Set(
        notifList
          .filter((n) => n.title?.toLowerCase().includes('unclaimed'))
          .map((n) => n.reference_id)
          .filter(Boolean)
      );

      const unreadNotif = notifList
        .filter((n) => {
          if (n.is_read) return false;
          const isAssistanceSubmissionConfirmation =
            n.reference_type === 'assistance_request' &&
            (n.title?.startsWith('Kahilingan sa Ayuda:') ||
              n.message?.toLowerCase().includes('matagumpay na naisumite'));
          if (isAssistanceSubmissionConfirmation) return false;
          if (
            (n.type === 'announcement' || n.reference_type === 'announcement') &&
            n.reference_type !== 'announcement_absence'
          ) {
            return false;
          }

          const isUpcoming =
            n.title?.toLowerCase().includes('upcoming') ||
            n.message?.toLowerCase().includes('you are scheduled');
          if (isUpcoming && n.reference_id && unclaimedReferenceIds.has(n.reference_id)) {
            notificationApi.markAsRead(n.id).catch(() => {});
            return false;
          }
          return true;
        })
        .map((n) => ({ ...n, popupType: 'notification' }));

      const combined = [...unreadAnn, ...unreadNotif];

      setModalItems((prevModalItems) => {
        const newItems = combined.filter((item) => {
          const key = `${item.popupType}-${item.id}`;
          return !shownPopupIds.has(key);
        });

        if (newItems.length > 0) {
          setShowPopupModal(true);
          return newItems;
        } else if (newItems.length === 0) {
          setShowPopupModal(false);
          return [];
        }
        return prevModalItems;
      });
    } catch (err) {
      console.warn('Failed to load popup notifications:', err?.message);
    }
  };

  useEffect(() => {
    if (user) {
      loadPopups();
      const popupInterval = setInterval(loadPopups, 8000);
      return () => clearInterval(popupInterval);
    }
  }, [user, shownPopupIds]);

  const handlePopupMarkAsRead = async (item) => {
    try {
      const itemObj = item || modalItems[currentPopupIndex] || modalItems[0];
      if (!itemObj) return;
      const key = `${itemObj.popupType}-${itemObj.id}`;
      setShownPopupIds((prev) => new Set([...prev, key]));

      if (itemObj.popupType === 'announcement') {
        await announcementApi.markAsRead(itemObj.id);
      } else {
        await notificationApi.markAsRead(itemObj.id);
      }

      setModalItems((prev) => {
        const filtered = prev.filter((i) => !(i.id === itemObj.id && i.popupType === itemObj.popupType));
        if (filtered.length === 0) {
          setShowPopupModal(false);
        }
        return filtered;
      });
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      setCurrentPopupIndex(0);
    } catch (err) {
      console.error('Failed to mark popup read:', err);
    }
  };

  const handlePopupCloseForNow = () => {
    setShownPopupIds((prev) => {
      const next = new Set(prev);
      modalItems.forEach((item) => next.add(`${item.popupType}-${item.id}`));
      return next;
    });
    setShowPopupModal(false);
  };

  useEffect(() => {
    if (user) {
      const fetchCounts = async () => {
        try {
          const [notifRes, msgRes] = await Promise.allSettled([
            notificationApi.unreadCount(),
            messageApi.unreadCount(),
          ]);
          if (notifRes.status === 'fulfilled') {
            setUnreadNotifCount(notifRes.value.data?.data?.count || notifRes.value.data?.count || 0);
          }
          if (msgRes.status === 'fulfilled') {
            setUnreadMessageCount(msgRes.value.data?.data?.count || msgRes.value.data?.count || 0);
          }
        } catch (e) {}
      };
      fetchCounts();
      const interval = setInterval(fetchCounts, 20000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleNavSelect = (routeKey) => {
    setCurrentNav(routeKey);
    setCurrentScreen(routeKey);
    setSidebarOpen(false);
  };

  const handleSubmitAssistance = async () => {
    if (!assistanceForm.subject.trim() || !assistanceForm.description.trim()) {
      Alert.alert('Required Fields', 'Please enter a subject and description for your request.');
      return;
    }
    try {
      setSubmittingAssistance(true);
      await api.createData({ ...assistanceForm, category: assistanceForm.type });
      Alert.alert('Success', 'Your assistance application has been submitted.');
      setActiveModal(null);
      setAssistanceForm({ type: 'Medical Assistance', subject: '', description: '' });
      loadBenefits();
    } catch (err) {
      Alert.alert('Submission Error', err?.response?.data?.message || err.message || 'Unable to submit assistance request.');
    } finally {
      setSubmittingAssistance(false);
    }
  };


  useEffect(() => {
    if (user?.role === 'beneficiary') {
      loadBeneficiaryProfile();
      loadBenefits();
    }
  }, [user?.id]);

  const loadBenefits = async () => {
    try {
      setBenefitsLoading(true);
      setBenefitsError('');
      const [medical, portal] = await Promise.all([
        medicalAssistanceApi.getMyApplications().catch(() => ({ data: { data: [] } })),
        assistanceRequestApi.list().catch(() => ({ data: { data: [] } })),
      ]);
      setAssistanceApplications(medical?.data?.data || []);
      setPortalAssistanceRequests(portal?.data?.data || []);
    } catch (err) {
      setBenefitsError(err?.response?.data?.message || err.message || 'Unable to load benefits.');
    } finally {
      setBenefitsLoading(false);
    }
  };

  const getTransactions = () => profile?.DistributionTransactions || [];

  const getAssistanceItems = () => [
    ...portalAssistanceRequests.map((request) => ({
      id: `request-${request.id}`,
      rawId: request.id,
      refNumber: `#${request.id}`,
      agency: request.agency || 'DSWD',
      type: request.type || 'General Assistance',
      subject: request.subject || request.type || 'Assistance Request',
      description: request.description || 'No description provided.',
      status: request.status || 'Pending',
      priority: request.priority || 'Normal',
      notes: request.admin_notes,
      createdAt: request.created_at || request.createdAt,
      attachmentUrl: request.attachment_url,
    })),
    ...assistanceApplications
      .filter((application) => !portalAssistanceRequests.some((request) => request.id === application.id || request.subject?.includes(application.application_number)))
      .map((application) => ({
        id: `medical-${application.id}`,
        rawId: application.id,
        refNumber: application.application_number || `#${application.id}`,
        agency: 'DSWD',
        type: application.category || 'Medical Assistance',
        subject: `${application.category || 'Medical Assistance'} - ${application.patient_name || 'Applicant'}`,
        description: application.diagnosis || 'Medical assistance application',
        status: application.status === 'Released' ? 'Completed' : application.status === 'Approved' ? 'Approved' : 'Under Review',
        priority: 'Normal',
        notes: application.staff_remarks || application.barangay_endorsement_notes,
        createdAt: application.created_at || application.createdAt,
        amount: application.approved_amount || application.total_amount_requested,
      })),
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const acknowledgePayout = async (transaction) => {
    try {
      setAcknowledgingId(transaction.id);
      await distributionApi.acknowledgePayout(transaction.id);
      setAcknowledgedIds((current) => [...current, transaction.id]);
      Alert.alert('Confirmed', 'Your digital payout receipt has been acknowledged.');
      await loadBeneficiaryProfile();
    } catch (err) {
      Alert.alert('Unable to confirm', err?.response?.data?.message || err.message || 'Please try again.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const loadBeneficiaryProfile = async () => {
    try {
      const response = await beneficiaryApi.getMe();
      const data = response?.data?.data || response?.data || null;
      if (!data) return;

      setProfile(data);
      setPayoutForm({
        payout_preference: data.payout_preference || 'digital',
        payout_provider: data.payout_provider || 'GCash',
        payout_account_number: data.payout_account_number || '',
        payout_account_name: data.payout_account_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      });
      setExtraPayoutForm((prev) => ({
        ...prev,
        account_name: data.payout_account_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      }));
    } catch (err) {
      console.warn('Profile load failed:', err?.response?.data || err.message);
    }
  };

  // ── Computed real stats from actual DB data ──────────────────────────────────
  const _transactions = profile?.DistributionTransactions || [];
  const _releasedTxns = _transactions.filter((t) => t.status === 'released' || t.status === 'completed');
  const _pendingTxns = _transactions.filter((t) => t.status === 'pending');

  // Released assistance (medical)
  const _releasedAssistance = assistanceApplications.filter((a) => a.status === 'Released');
  // Approved assistance pending release
  const _approvedAssistance = assistanceApplications.filter((a) => a.status === 'Approved');
  // Approved or completed portal requests
  const _approvedPortal = portalAssistanceRequests.filter((r) => ['Approved', 'Completed'].includes(r.status));

  // Total received = released distributions + released medical assistance
  const _totalReceived =
    _releasedTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0), 0) +
    _releasedAssistance.reduce((sum, a) => sum + parseFloat(a.approved_amount || a.total_amount_requested || 0), 0);

  // Pending / approved = pending distributions + approved medical (not yet released)
  const _totalPending =
    _pendingTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0), 0) +
    _approvedAssistance.reduce((sum, a) => sum + parseFloat(a.approved_amount || a.total_amount_requested || 0), 0);

  // Enrollments from profile
  const _enrollments = profile?.Enrollments || [];
  // Total Programs & Grants = active program enrollments + all assistance requests
  const _allAssistanceCount = portalAssistanceRequests.length + assistanceApplications.filter(
    (a) => !portalAssistanceRequests.some((r) => r.subject?.includes(a.application_number))
  ).length;
  const _totalProgramsGrants = _enrollments.length + _allAssistanceCount;

  // Disbursements = released distributions + released assistance
  const _totalDisbursements =
    _releasedTxns.length +
    _releasedAssistance.length +
    portalAssistanceRequests.filter((r) => r.status === 'Completed').length;

  // Pending distributions + approved portal requests subtext
  const _pendingDistCount = _pendingTxns.length;
  const _approvedGrantsCount = _approvedAssistance.length + _approvedPortal.filter((r) => r.status === 'Approved').length;

  const quickCards = [
    {
      label: 'Total Received',
      value: formatMoney(_totalReceived),
      meta: `${_releasedTxns.length} dist. • ${_releasedAssistance.length} grant(s) released`,
      tone: 'green',
    },
    {
      label: 'Pending / Approved',
      value: formatMoney(_totalPending),
      meta: `${_pendingDistCount} dist. • ${_approvedGrantsCount} approved grant(s)`,
      tone: 'purple',
    },
    {
      label: 'Programs & Grants',
      value: String(_totalProgramsGrants),
      meta: `${_enrollments.length} program(s) • ${_allAssistanceCount} assistance request(s)`,
      tone: 'violet',
    },
    {
      label: 'Disbursements',
      value: String(_totalDisbursements),
      meta: 'Total claims received',
      tone: 'orange',
    },
  ];

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('Please enter your username/email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = await api.login({ identifier, password });
      if (!payload?.success) {
        throw new Error(payload?.message || 'Login failed');
      }

      const loggedUser = payload.user || null;
      setUser(loggedUser);
      if (loggedUser?.role !== 'beneficiary') {
        setProfile(null);
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.clearAuthToken();
    setUser(null);
    setProfile(null);
    setIdentifier('');
    setPassword('');
    setError('');
    setCurrentScreen('dashboard');
    setCurrentNav('dashboard');
  };

  const handleSavePayoutAccount = async () => {
    if (
      payoutForm.payout_preference !== 'cash_otc' &&
      (!payoutForm.payout_provider || !payoutForm.payout_account_number)
    ) {
      Alert.alert('Missing field', 'Provider and account number are required.');
      return;
    }

    try {
      setPayoutSaving(true);
      const response = await beneficiaryApi.updateMyPayoutAccount(payoutForm);
      const result = response?.data || {};
      if (result?.success) {
        Alert.alert('Success', result.message || 'Payout account updated.');
        setPayoutMethodOpen(false);
        setActiveModal(null);
        await loadBeneficiaryProfile();
      }
    } catch (err) {
      Alert.alert('Update failed', err?.response?.data?.message || err.message || 'Unable to save payout account.');
    } finally {
      setPayoutSaving(false);
    }
  };

  const handleAddExtraPayoutAccount = async () => {
    if (!extraPayoutForm.provider || !extraPayoutForm.account_number) {
      Alert.alert('Missing field', 'Provider and extra account number are required.');
      return;
    }

    try {
      setExtraSaving(true);
      const response = await beneficiaryApi.addExtraPayoutAccount(extraPayoutForm);
      const result = response?.data || {};
      if (result?.success) {
        Alert.alert('Success', result.message || 'Extra payout account added.');
        setExtraPayoutForm({ provider: 'Landbank', account_number: '', account_name: profile?.payout_account_name || '' });
        await loadBeneficiaryProfile();
      }
    } catch (err) {
      Alert.alert('Add failed', err?.response?.data?.message || err.message || 'Unable to add extra payout account.');
    } finally {
      setExtraSaving(false);
    }
  };

  const handleRemoveExtraAccount = async (index) => {
    try {
      const response = await beneficiaryApi.removeExtraPayoutAccount(index);
      const result = response?.data || {};
      if (result?.success) {
        Alert.alert('Removed', result.message || 'Secondary payout account removed.');
        await loadBeneficiaryProfile();
      }
    } catch (err) {
      Alert.alert('Remove failed', err?.response?.data?.message || err.message || 'Unable to remove extra account.');
    }
  };

  if (user) {
    const displayName = `${profile?.first_name || user.first_name || 'Beneficiary'} ${profile?.last_name || user.last_name || ''}`.trim();
    const statusLabel = profile?.status || 'Not available';
    const isApproved = String(statusLabel).toLowerCase() === 'approved';
    const activeEnrollment = (Array.isArray(profile?.Enrollments) ? profile.Enrollments : [])
      .find((enrollment) => String(enrollment.status || '').toLowerCase() === 'active') || profile?.Enrollments?.[0];
    const enrolledProgramName = activeEnrollment?.BenefitProgram?.name ||
      activeEnrollment?.Program?.name || activeEnrollment?.program_name || 'No active program';
    const beneficiaryCategory = profile?.category || 'Category not set';
    const beneficiaryCode = profile?.beneficiary_id_code || profile?.household_id_number || 'Not assigned';
    const beneficiaryBarangay = profile?.barangay_name || profile?.Barangay?.barangay_name || profile?.barangay?.barangay_name || profile?.barangay || 'Not available';
    const accountStatus = profile?.account_verification_status || 'verified';
    const extraAccounts = Array.isArray(profile?.extra_payout_accounts) ? profile.extra_payout_accounts : [];

    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <View style={{ flex: 1 }}>
          {/* Admin/Staff Beneficiary List Screen */}
          {currentScreen === 'beneficiaryList' && ['admin', 'staff', 'mswdo_admin', 'barangay'].includes(user.role) && (
            <BeneficiaryListScreen
              onBack={() => handleNavSelect('dashboard')}
              onOpenDrawer={() => setSidebarOpen(true)}
              user={user}
            />
          )}

          {/* Attendance Screen (Image 1) */}
          {currentScreen === 'attendance' && (
            <AttendanceScreen
              onBack={() => handleNavSelect('dashboard')}
              onOpenDrawer={() => setSidebarOpen(true)}
              user={user}
              profile={profile}
            />
          )}

          {/* Assistance Screen (Image 3) */}
          {currentScreen === 'assistance' && (
            <AssistanceScreen
              onBack={() => handleNavSelect('dashboard')}
              onOpenDrawer={() => setSidebarOpen(true)}
              onRequestNew={() => handleNavSelect('requestAssistance')}
              user={user}
              profile={profile}
            />
          )}

          {/* Request Assistance Screen (Image 2) */}
          {currentScreen === 'requestAssistance' && (
            <RequestAssistanceScreen
              onBack={() => handleNavSelect('assistance')}
              onOpenDrawer={() => setSidebarOpen(true)}
              user={user}
              profile={profile}
              onRefreshPopups={loadPopups}
            />
          )}

          {/* Messages Screen */}
          {currentScreen === 'messages' && (
            <MessagesScreen
              onBack={() => handleNavSelect('dashboard')}
              onOpenDrawer={() => setSidebarOpen(true)}
              user={user}
            />
          )}

          {/* Notifications Screen */}
          {currentScreen === 'notifications' && (
            <NotificationsScreen
              onBack={() => handleNavSelect('dashboard')}
              onOpenDrawer={() => setSidebarOpen(true)}
              user={user}
            />
          )}

          {/* Intervention / Other Assistance Screen */}
          {currentScreen === 'interventions' && (
            <InterventionsScreen
              onBack={() => handleNavSelect('dashboard')}
            />
          )}

          {/* Dashboard Home (Image 4) */}
          {currentScreen === 'dashboard' && (
            <SafeAreaView style={styles.dashboardPage}>
              <StatusBar barStyle="light-content" backgroundColor="#0f172a" />



        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              console.log('[DEBUG] Hamburger tapped! Opening sidebar...');
              setSidebarOpen(true);
            }}
            style={styles.menuButton}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchText}>Search anything...</Text>
          </View>
          <View style={styles.topActions}>
            <View style={styles.iconChip}><Text>◔</Text></View>
            <View style={styles.iconChip}><Text>☼</Text></View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* Admin/Staff Navigation */}
        {['admin', 'staff', 'mswdo_admin', 'barangay'].includes(user.role) && (
          <View style={styles.adminNav}>
            <TouchableOpacity style={styles.adminNavBtn} onPress={() => setCurrentScreen('beneficiaryList')}>
              <Text style={styles.adminNavIcon}>👥</Text>
              <Text style={styles.adminNavText}>Beneficiary List</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.dashboardContent}>
          {/* Hero Header Card (Image 4) */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}><Text style={styles.heroIcon}>👤</Text></View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Beneficiary Portal</Text>
              <Text style={styles.heroSubtitle}>Welcome back, {displayName}! Here is your official application, RFID card, and assistance payout overview.</Text>
            </View>
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>📅 {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              <Text style={styles.timeText}>🕒 {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>

          {/* Show the approval message only when the API confirms approval. */}
          {isApproved ? <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <View style={styles.successTextWrap}>
              <Text style={styles.successTitle}>Congratulations! Your application has been {statusLabel.toUpperCase()}.</Text>
              <Text style={styles.successBody}>You are now an official beneficiary. You can now view your benefits and upcoming distributions.</Text>
            </View>
          </View> : null}

          {/* 4 Status Cards Row (Image 4) */}
          <View style={styles.statusRow}>
            {/* Card 1: My Status */}
            <View style={styles.statusCardBlue}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardIconBlue}>✓</Text>
                <Text style={styles.cardMiniTitleBlue}>My Status</Text>
              </View>
              <Text style={styles.cardMainBlue}>{statusLabel.toUpperCase()}</Text>
              <Text style={styles.cardSmallBlue}>{isApproved ? 'You are an official beneficiary.' : 'Beneficiary application status'}</Text>
              <Text style={styles.cardSmallBlue}>{profile?.approved_at ? `Approved on ${formatDate(profile.approved_at)}` : 'Approval date not recorded'}</Text>
            </View>

            {/* Card 2: Beneficiary ID */}
            <View style={styles.statusCardWhite}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardIcon}>📄</Text>
                <Text style={styles.cardMiniTitle}>Beneficiary ID</Text>
                {isApproved ? <View style={styles.officialMemberBadge}>
                  <Text style={styles.officialMemberText}>OFFICIAL MEMBER</Text>
                </View> : null}
              </View>
              <Text style={styles.cardSubHead}>{beneficiaryCode}</Text>
              <TouchableOpacity onPress={() => Alert.alert('Copied', 'Beneficiary ID copied to clipboard.')}>
                <Text style={styles.copyLink}>📋 Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Card 3: Enrolled Program */}
            <View style={styles.statusCardAmber}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardIcon}>⭐</Text>
                <Text style={styles.cardMiniTitleAmber}>Enrolled Program</Text>
              </View>
              <Text style={styles.cardSubHeadAmber}>{enrolledProgramName}</Text>
              <Text style={styles.cardSmallAmber}>{beneficiaryCategory}</Text>
            </View>

            {/* Card 4: Barangay */}
            <View style={styles.statusCardWhite}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardIcon}>📍</Text>
                <Text style={styles.cardMiniTitle}>Barangay</Text>
              </View>
              <Text style={styles.cardSubHead}>{beneficiaryBarangay}</Text>
              <Text style={styles.cardSmallGray}>{beneficiaryBarangay}</Text>
            </View>
          </View>

          {/* Digital Ayuda Account Card (Image 4) */}
          <View style={styles.digitalAyudaCard}>
            <View style={styles.digitalAyudaHeader}>
              <View style={styles.digitalAyudaIconBox}>
                <Text style={{ fontSize: 20 }}>💳</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.digitalAyudaTitle}>
                    {payoutForm.payout_preference === 'cash_otc' ? 'Cash OTC Account' : 'Digital Ayuda Account'}
                  </Text>
                  <View style={styles.verifiedTag}>
                    <Text style={styles.verifiedTagText}>✓ Verified</Text>
                  </View>
                </View>
                <Text style={styles.digitalAyudaSub}>
                  Tumatanggap ng ayuda sa pamamagitan ng GCash, Maya, o Bank Account nang walang pila.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.updateAccountBtn}
                onPress={() => {
                  setPayoutMethodOpen(false);
                  setActiveModal(activeModal === 'payout' ? null : 'payout');
                }}
              >
                <Text style={styles.updateAccountBtnText}>✏️ I-update ang Account</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ayudaDetailsGrid}>
              <View style={styles.ayudaDetailCol}>
                <Text style={styles.ayudaDetailLabel}>PAYOUT METHOD</Text>
                <Text style={styles.ayudaDetailVal}>
                  {payoutForm.payout_preference === 'cash_otc' ? '🏢 Cash OTC / RFID' : `⚡ ${profile?.payout_provider || payoutForm.payout_provider || 'GCash'}`}
                </Text>
              </View>
              <View style={styles.ayudaDetailCol}>
                <Text style={styles.ayudaDetailLabel}>ACCOUNT NUMBER</Text>
                <Text style={styles.ayudaDetailVal}>{payoutForm.payout_preference === 'cash_otc' ? 'Physical claiming' : profile?.payout_account_number || payoutForm.payout_account_number || '09534519448'}</Text>
              </View>
              <View style={styles.ayudaDetailCol}>
                <Text style={styles.ayudaDetailLabel}>ACCOUNT NAME</Text>
                <Text style={styles.ayudaDetailVal}>{profile?.payout_account_name || displayName}</Text>
              </View>
            </View>

            <View style={styles.verifiedInfoBanner}>
              <Text style={styles.verifiedInfoText}>
                ✓ Beripikado na ang iyong primary account! Handa ka nang makatanggap ng digital grants at ayuda direkta sa iyong e-wallet.
              </Text>
            </View>
          </View>

          {/* Intervention / Other Assistance Card */}
          {user?.role === 'beneficiary' && (
            <View style={styles.interventionCard}>
              <View style={styles.interventionIconBox}>
                <Text style={styles.interventionIcon}>♥</Text>
              </View>
              <View style={styles.interventionCopy}>
                <Text style={styles.interventionTitle}>Intervention / Ibang Tulong</Text>
                <Text style={styles.interventionText}>
                  I-report ang tulong mula sa PCSO, PhilHealth, LGU, NGO, o ibang ahensya.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.interventionButton}
                onPress={() => handleNavSelect('interventions')}
              >
                <Text style={styles.interventionButtonText}>Buksan</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.quickSummaryHeader}>
            <Text style={styles.sectionLabel}>My Benefits Overview</Text>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => {
                setCurrentScreen('requestAssistance');
                setCurrentNav('requestAssistance');
              }}
            >
              <Text style={styles.requestButtonText}>+ Request Assistance</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricGrid}>
            {quickCards.map((item, index) => (
              <View key={index} style={[styles.metricCard, item.tone === 'green' ? styles.greenCard : item.tone === 'purple' ? styles.purpleCard : item.tone === 'violet' ? styles.violetCard : styles.orangeCard]}>
                <Text style={styles.metricLabel}>{item.label}</Text>
                <Text style={styles.metricValue}>{item.value}</Text>
                <Text style={styles.metricMeta}>{item.meta}</Text>
              </View>
            ))}
          </View>

          <View style={styles.benefitsPanel}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>My Benefits & Assistance</Text>
                <Text style={styles.panelText}>Track your grants, applications, and distribution history.</Text>
              </View>
              <TouchableOpacity onPress={loadBenefits} style={styles.refreshButton}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              {[
                ['all', 'All'],
                ['in_progress', 'In Progress'],
                ['approved', 'Approved'],
                ['completed', 'Completed'],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setBenefitFilter(value)}
                  style={benefitFilter === value ? styles.filterActive : styles.filterInactive}
                >
                  <Text style={benefitFilter === value ? styles.filterActiveText : styles.filterInactiveText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {benefitsError ? <Text style={styles.errorText}>{benefitsError}</Text> : null}
            {benefitsLoading ? <ActivityIndicator size="small" color="#2563eb" /> : null}

            <Text style={styles.subsectionTitle}>Distribution History</Text>
            {getTransactions().length === 0 ? (
              <Text style={styles.emptyText}>No distribution records found.</Text>
            ) : getTransactions().map((transaction) => {
              const pendingReceipt = transaction.status === 'released' &&
                (transaction.disbursement_type === 'digital' || transaction.payout_reference_number) &&
                !transaction.beneficiary_acknowledged_at && !acknowledgedIds.includes(transaction.id);
              return (
                <View key={transaction.id} style={styles.benefitCard}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.benefitTitle}>{transaction.event_name || transaction.program_name || 'Benefit Distribution'}</Text>
                      <Text style={styles.benefitMeta}>{formatDate(transaction.released_at || transaction.created_at)} • {transaction.disbursement_type || 'Cash'}</Text>
                    </View>
                    <Text style={styles.amountText}>{formatMoney(Number(transaction.amount || 0) + Number(transaction.retro_amount || 0))}</Text>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={[styles.statusPill, styles[`status${statusTone(transaction.status)}`]]}>{transaction.status || 'Pending'}</Text>
                    {pendingReceipt ? (
                      <TouchableOpacity onPress={() => acknowledgePayout(transaction)} style={styles.ackButton} disabled={acknowledgingId === transaction.id}>
                        {acknowledgingId === transaction.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.ackButtonText}>Acknowledge receipt</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}

            <Text style={styles.subsectionTitle}>Assistance Requests</Text>
            {getAssistanceItems().filter((item) => {
              if (benefitFilter === 'in_progress') return ['Pending', 'Under Review', 'Pending Review', 'Under Verification', 'Under Barangay Verification', 'Verified by Barangay'].includes(item.status);
              if (benefitFilter === 'approved') return item.status === 'Approved';
              if (benefitFilter === 'completed') return ['Completed', 'Released'].includes(item.status);
              return true;
            }).map((item) => (
              <TouchableOpacity key={item.id} style={styles.benefitCard} onPress={() => setSelectedItem(item)}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitTitle}>{item.subject}</Text>
                    <Text style={styles.benefitMeta}>{item.refNumber} • {item.agency} • {formatDate(item.createdAt)}</Text>
                  </View>
                  <Text style={[styles.statusPill, styles[`status${statusTone(item.status)}`]]}>{item.status}</Text>
                </View>
                <Text style={styles.benefitDescription} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.viewDetails}>View details ›</Text>
              </TouchableOpacity>
            ))}
            {!benefitsLoading && getAssistanceItems().length === 0 ? <Text style={styles.emptyText}>No assistance applications found.</Text> : null}
          </View>

          {selectedItem ? (
            <View style={styles.detailCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.panelTitle}>Assistance Details</Text>
                <TouchableOpacity onPress={() => setSelectedItem(null)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
              </View>
              <Text style={styles.detailReference}>{selectedItem.refNumber} • {selectedItem.agency}</Text>
              <Text style={styles.detailTitle}>{selectedItem.subject}</Text>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={[styles.statusPill, styles[`status${statusTone(selectedItem.status)}`]]}>{selectedItem.status}</Text>
              <View style={styles.progressRow}>
                {['Submitted', 'Under Review', 'Approved', 'Completed'].map((step, index) => (
                  <View key={step} style={styles.progressStep}>
                    <View style={[styles.progressDot, index <= (selectedItem.status === 'Completed' ? 3 : selectedItem.status === 'Approved' ? 2 : selectedItem.status === 'Under Review' ? 1 : 0) ? styles.progressDone : null]} />
                    <Text style={styles.progressText}>{step}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailDescription}>{selectedItem.description}</Text>
              {selectedItem.notes ? <><Text style={styles.detailLabel}>Office notes</Text><Text style={styles.detailDescription}>{selectedItem.notes}</Text></> : null}
              {selectedItem.amount ? <><Text style={styles.detailLabel}>Approved amount</Text><Text style={styles.amountText}>{formatMoney(selectedItem.amount)}</Text></> : null}
              <Text style={styles.detailLabel}>Supporting documents</Text>
              {parseAttachments(selectedItem.attachmentUrl).length === 0 ? (
                <Text style={styles.emptyText}>No online attachments were uploaded.</Text>
              ) : parseAttachments(selectedItem.attachmentUrl).map((attachment, index) => (
                <TouchableOpacity
                  key={`${attachment.url || attachment.name}-${index}`}
                  style={styles.documentButton}
                  onPress={() => attachment.url && Linking.openURL(attachment.url.startsWith('http') ? attachment.url : `${FILES_BASE_URL}${attachment.url}`)}
                >
                  <Text style={styles.documentText}>{attachment.name || attachment.file_name || 'Attached document'} • Open file</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
            </SafeAreaView>
          )}
        </View>

        {/* Persistent Bottom Navigation Bar across ALL screens (Image 5) */}
        <BottomNavBar
          currentNav={currentNav}
          onSelectNav={handleNavSelect}
          unreadMessageCount={unreadMessageCount}
          unreadNotifCount={unreadNotifCount}
        />

        {/* Sidebar Drawer (rendered on top of everything) */}
        <SidebarDrawer
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentRoute={currentNav}
          onSelectRoute={handleNavSelect}
          user={user}
          unreadNotifCount={unreadNotifCount}
          unreadMessageCount={unreadMessageCount}
          onLogout={handleLogout}
        />

        {/* Auto Popup Announcement & Notification Modal (Matching Web & User Screenshot) */}
        <NotificationPopupModal
          visible={showPopupModal && modalItems.length > 0}
          items={modalItems}
          currentIndex={currentPopupIndex}
          onClose={handlePopupCloseForNow}
          onPrev={() => setCurrentPopupIndex((prev) => Math.max(0, prev - 1))}
          onNext={() => setCurrentPopupIndex((prev) => Math.min(modalItems.length - 1, prev + 1))}
          onMarkAsRead={handlePopupMarkAsRead}
          onUpdatePayout={() => {
            setShowPopupModal(false);
            setPayoutMethodOpen(false);
            setActiveModal('payout');
          }}
        />

        {/* Digital Payout Account modal */}
        <Modal
          visible={activeModal === 'payout'}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setPayoutMethodOpen(false);
            setActiveModal(null);
          }}
        >
          <View style={styles.payoutModalOverlay}>
            <View style={styles.payoutModalCard}>
              <View style={styles.payoutModalHeader}>
                <View style={styles.payoutModalIconBox}>
                  <Text style={styles.payoutModalIcon}>▣</Text>
                </View>
                <View style={styles.payoutModalHeaderCopy}>
                  <Text style={styles.payoutModalTitle}>Digital Payout Account</Text>
                  <Text style={styles.payoutModalSubtitle}>I-rehistro ang iyong GCash, Maya, o Landbank Account</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setPayoutMethodOpen(false);
                    setActiveModal(null);
                  }}
                  style={styles.payoutModalClose}
                >
                  <Text style={styles.payoutModalCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.payoutModalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.payoutModalLabel}>PARAAN NG PAGTANGGAP (PAYOUT PREFERENCE)</Text>
                <TouchableOpacity
                  style={styles.payoutSelect}
                  onPress={() => setPayoutMethodOpen((value) => !value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.payoutSelectText}>
                    {payoutForm.payout_preference === 'cash_otc'
                      ? '🏢 Cash OTC / Physical Claiming (RFID)'
                      : '⚡ Digital (E-Wallet / Bank Account)'}
                  </Text>
                  <Text style={styles.payoutSelectChevron}>{payoutMethodOpen ? '⌃' : '⌄'}</Text>
                </TouchableOpacity>

                {payoutMethodOpen && (
                  <View style={styles.payoutOptions}>
                    <TouchableOpacity
                      style={styles.payoutOption}
                      onPress={() => {
                        setPayoutForm((prev) => ({ ...prev, payout_preference: 'digital' }));
                        setPayoutMethodOpen(false);
                      }}
                    >
                      <Text style={styles.payoutOptionText}>⚡ Digital (E-Wallet / Bank Account)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.payoutOption}
                      onPress={() => {
                        setPayoutForm((prev) => ({ ...prev, payout_preference: 'cash_otc' }));
                        setPayoutMethodOpen(false);
                      }}
                    >
                      <Text style={styles.payoutOptionText}>🏢 Cash OTC / Physical Claiming (RFID)</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {payoutForm.payout_preference === 'cash_otc' ? (
                  <View style={styles.cashOtcNotice}>
                    <Text style={styles.cashOtcTitle}>Cash OTC / Physical Claiming</Text>
                    <Text style={styles.cashOtcText}>Gamitin ang iyong RFID card sa itinalagang payout location. Hindi kailangan ng e-wallet account.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.payoutModalLabel}>PROVIDER</Text>
                    <TextInput
                      style={styles.payoutModalInput}
                      value={payoutForm.payout_provider}
                      onChangeText={(value) => setPayoutForm((prev) => ({ ...prev, payout_provider: value }))}
                      placeholder="GCash, Maya, Landbank"
                    />
                    <Text style={styles.payoutModalLabel}>ACCOUNT NUMBER</Text>
                    <TextInput
                      style={styles.payoutModalInput}
                      value={payoutForm.payout_account_number}
                      keyboardType="phone-pad"
                      onChangeText={(value) => setPayoutForm((prev) => ({ ...prev, payout_account_number: value }))}
                      placeholder="09123456789"
                    />
                    <Text style={styles.payoutModalLabel}>ACCOUNT NAME</Text>
                    <TextInput
                      style={styles.payoutModalInput}
                      value={payoutForm.payout_account_name}
                      onChangeText={(value) => setPayoutForm((prev) => ({ ...prev, payout_account_name: value }))}
                      placeholder="Full name"
                    />
                  </>
                )}

                <Text style={styles.payoutAccountStatus}>Account status: {accountStatus}</Text>
                <TouchableOpacity style={styles.payoutSaveButton} onPress={handleSavePayoutAccount} disabled={payoutSaving}>
                  {payoutSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.payoutSaveText}>Save payout account</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <AuthScreen
      onLoginSuccess={(loggedUser, token) => {
        if (token) {
          api.setAuthToken(token);
        }
        setUser(loggedUser);
        if (loggedUser?.role !== 'beneficiary') {
          setProfile(null);
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4a4f57',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  loginCard: {
    backgroundColor: '#f1f1f1',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#dfeaf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBadge: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 20,
  },
  label: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#111827',
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '600',
  },
  passwordFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 999,
    backgroundColor: '#f9fafb',
    height: 52,
    marginBottom: 18,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
  },
  eyeButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeText: {
    fontSize: 18,
    color: '#4b5563',
  },
  primaryButton: {
    backgroundColor: '#1f2d3d',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  primaryButtonSmall: {
    backgroundColor: '#1f2d3d',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#c9ced6',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6b7280',
    fontSize: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    height: 52,
    marginBottom: 20,
  },
  googleIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginRight: 10,
  },
  googleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  signupText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#374151',
  },
  signupLink: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  demoText: {
    textAlign: 'center',
    marginTop: 18,
    color: '#4b5563',
    fontSize: 13,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 10,
  },
  dashboardPage: {
    flex: 1,
    backgroundColor: '#dfe3ea',
  },
  topBar: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  menuIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  searchBox: {
    flex: 1,
    backgroundColor: '#eff2f7',
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    marginRight: 10,
  },
  searchIcon: {
    color: '#64748b',
    fontSize: 20,
    marginRight: 8,
  },
  searchText: {
    color: '#64748b',
    fontSize: 14,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ecf0f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoutButton: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dashboardContent: {
    padding: 18,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#dbeafe',
    fontSize: 12,
    lineHeight: 18,
  },
  dateBox: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  dateText: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  timeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#d7f7e8',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  successIcon: {
    fontSize: 26,
    color: '#15803d',
    marginRight: 10,
    fontWeight: '700',
  },
  successTextWrap: {
    flex: 1,
  },
  successTitle: {
    color: '#14532d',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 3,
  },
  successBody: {
    color: '#166534',
    fontSize: 12,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  statusCardBlue: {
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    padding: 12,
    width: '48%',
    minHeight: 125,
    marginBottom: 10,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  statusCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    width: '48%',
    minHeight: 125,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statusCardAmber: {
    backgroundColor: '#fffdf5',
    borderRadius: 14,
    padding: 12,
    width: '48%',
    minHeight: 125,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fef08a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardIconBlue: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardMiniTitleBlue: {
    color: '#bfdbfe',
    fontSize: 11,
    fontWeight: '700',
  },
  cardMainBlue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  cardSmallBlue: {
    color: '#dbeafe',
    fontSize: 10.5,
    lineHeight: 15,
  },
  cardIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  officialMemberBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  officialMemberText: {
    color: '#1d4ed8',
    fontSize: 8.5,
    fontWeight: '800',
  },
  cardMiniTitleAmber: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '700',
  },
  cardSubHeadAmber: {
    color: '#78350f',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 4,
  },
  cardSmallAmber: {
    color: '#b45309',
    fontSize: 10.5,
    lineHeight: 15,
  },
  cardSmallGray: {
    color: '#64748b',
    fontSize: 10.5,
    lineHeight: 15,
  },
  cardMiniTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  cardMain: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardSmall: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
  },
  cardSubHead: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 4,
  },
  copyLink: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 6,
  },
  // Digital Ayuda Account (Image 4)
  digitalAyudaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  digitalAyudaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  digitalAyudaIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitalAyudaTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  digitalAyudaSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
  updateAccountBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
  updateAccountBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  ayudaDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  ayudaDetailCol: {
    flex: 1,
  },
  ayudaDetailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  ayudaDetailVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  verifiedInfoBanner: {
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 8,
  },
  verifiedInfoText: {
    color: '#065f46',
    fontSize: 11.5,
    fontWeight: '600',
  },
  interventionCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    flexDirection: 'row',
    alignItems: 'center',
  },
  interventionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  interventionIcon: {
    color: '#4338ca',
    fontSize: 22,
    fontWeight: '800',
  },
  interventionCopy: {
    flex: 1,
  },
  interventionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  interventionText: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  interventionButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
  },
  interventionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  quickSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  requestButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    minHeight: 110,
  },
  greenCard: { backgroundColor: '#dcfce7' },
  purpleCard: { backgroundColor: '#ede9fe' },
  violetCard: { backgroundColor: '#e9d5ff' },
  orangeCard: { backgroundColor: '#ffedd5' },
  metricLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  metricMeta: {
    color: '#475569',
    fontSize: 11,
    lineHeight: 16,
  },
  panelCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  panelTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
  },
  panelText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pillActive: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  pillInactive: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  formBlock: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  formLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  inlineStatus: {
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  extraList: {
    marginTop: 16,
  },
  extraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  extraTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  extraMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 11,
  },
  benefitsPanel: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  refreshButton: {
    backgroundColor: '#dbeafe',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  refreshButtonText: { color: '#1d4ed8', fontSize: 11, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  filterActive: {
    backgroundColor: '#1d4ed8',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginRight: 7,
    marginBottom: 7,
  },
  filterInactive: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginRight: 7,
    marginBottom: 7,
  },
  filterActiveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  filterInactiveText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  subsectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 8,
  },
  benefitCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  benefitTitle: { color: '#0f172a', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  benefitMeta: { color: '#64748b', fontSize: 10 },
  benefitDescription: { color: '#475569', fontSize: 12, lineHeight: 17, marginTop: 8 },
  amountText: { color: '#047857', fontSize: 16, fontWeight: '800', marginLeft: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  statussuccess: { color: '#047857', backgroundColor: '#d1fae5' },
  statuswarning: { color: '#b45309', backgroundColor: '#fef3c7' },
  statusdanger: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  ackButton: { backgroundColor: '#047857', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  ackButtonText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  viewDetails: { color: '#2563eb', fontSize: 11, fontWeight: '700', marginTop: 8 },
  emptyText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
  closeText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  detailReference: { color: '#64748b', fontSize: 11, marginBottom: 5 },
  detailTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  detailLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 5 },
  detailDescription: { color: '#334155', fontSize: 13, lineHeight: 19 },
  documentButton: { backgroundColor: '#eff6ff', borderRadius: 9, padding: 10, marginBottom: 7 },
  documentText: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#cbd5e1', marginBottom: 4 },
  progressDone: { backgroundColor: '#2563eb' },
  progressText: { color: '#64748b', fontSize: 9, textAlign: 'center' },

  // Admin Navigation
  adminNav: { flexDirection: 'row', backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  adminNavBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, flex: 1 },
  adminNavIcon: { fontSize: 18, marginRight: 8 },
  adminNavText: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },

  // Modal Styles
  payoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'center',
    padding: 18,
  },
  payoutModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    overflow: 'hidden',
    maxHeight: '92%',
    elevation: 12,
  },
  payoutModalHeader: {
    backgroundColor: '#5b21b6',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutModalIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payoutModalIcon: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  payoutModalHeaderCopy: { flex: 1 },
  payoutModalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  payoutModalSubtitle: { color: '#ede9fe', fontSize: 11, marginTop: 3 },
  payoutModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  payoutModalCloseText: { color: '#ffffff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  payoutModalBody: { padding: 18, paddingBottom: 24 },
  payoutModalLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
    marginTop: 8,
  },
  payoutSelect: {
    minHeight: 54,
    borderWidth: 2,
    borderColor: '#9333ea',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutSelectText: { color: '#0f172a', fontSize: 14, fontWeight: '800', flex: 1, paddingRight: 8 },
  payoutSelectChevron: { color: '#0f172a', fontSize: 22, fontWeight: '700' },
  payoutOptions: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff',
    marginTop: 2,
    elevation: 5,
  },
  payoutOption: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  payoutOptionText: { color: '#0f172a', fontSize: 14 },
  payoutModalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 15,
  },
  cashOtcNotice: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cashOtcTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  cashOtcText: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 4 },
  payoutAccountStatus: { color: '#0f766e', fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 12 },
  payoutSaveButton: { backgroundColor: '#172b3b', borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  payoutSaveText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  modalFullPage: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeaderDark: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalBackBtn: { paddingRight: 14 },
  modalBackText: { color: '#93c5fd', fontSize: 14, fontWeight: '700' },
  modalHeaderTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700', flex: 1 },
  attendanceSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryCardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  summaryCardSubtitle: { fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 17 },
  rfidTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 10,
    borderRadius: 10,
  },
  rfidLabel: { fontSize: 12, color: '#1d4ed8', fontWeight: '700', marginRight: 6 },
  rfidValue: { fontSize: 12, color: '#1e293b', fontWeight: '800' },
  attendanceItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendanceItemTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  attendanceItemMeta: { fontSize: 11, color: '#64748b', marginBottom: 6 },
  attendanceItemStatus: { color: '#16a34a', fontSize: 11, fontWeight: '800' },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18 },
  formSectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  formSectionSub: { fontSize: 13, color: '#64748b', marginBottom: 18, lineHeight: 18 },
  formFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  typeSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, gap: 8 },
  typeChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  typeChipActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#ffffff', fontWeight: '800' },
  modalInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  modalSubmitBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 30,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  notifCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notifTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  notifMeta: { fontSize: 11, color: '#64748b', marginBottom: 6 },
  notifBody: { fontSize: 12.5, color: '#334155', lineHeight: 18 },

  // ── Bottom Navigation Bar ──
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 6,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  bottomNavIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  bottomNavIcon: {
    fontSize: 22,
    opacity: 0.45,
  },
  bottomNavIconActive: {
    opacity: 1,
  },
  bottomNavLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  bottomNavLabelActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  bottomNavActiveBar: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#1d4ed8',
  },
  bottomNavBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bottomNavBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});

export default App;

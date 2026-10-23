import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { dashboardApi, announcementApi, beneficiaryApi } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatMoney = (amount) => {
  const num = Number(amount || 0);
  return `₱${num.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Recently';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch (e) {
    return 'Recently';
  }
};

export default function StaffDashboardScreen({
  user,
  onNavigate,
  onOpenDrawer,
  darkMode = false,
  setDarkMode,
  onLogout,
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);

  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const isMswdoStaff = user?.role === 'mswdo_staff';
  const isMswdo = isMswdoAdmin || isMswdoStaff;
  const isSenior = ['senior_citizen_admin', 'senior_citizen_staff'].includes(user?.role);
  const isPwd = ['pwd_admin', 'pwd_staff'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const isDswd = ['admin', 'staff', 'barangay'].includes(user?.role);
  const hasAssistanceAccess = ['admin', 'mswdo_admin', 'mswdo_staff', 'staff', 'barangay'].includes(user?.role);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const promises = [
        dashboardApi.summary().catch(() => ({ data: { data: {} } })),
        dashboardApi.monthlyDistribution().catch(() => ({ data: { data: [] } })),
        announcementApi.list().catch(() => ({ data: { data: [] } })),
        beneficiaryApi.listApplications().catch(() => ({ data: { data: [] } })),
      ];

      const results = await Promise.all(promises);
      const summaryData = results[0]?.data?.data || results[0]?.data || {};
      const monthlyData = results[1]?.data?.data || results[1]?.data || [];
      const annData = results[2]?.data?.data || results[2]?.data || [];
      const appsData = results[3]?.data?.data || results[3]?.data || [];

      setSummary(summaryData);
      setMonthly(Array.isArray(monthlyData) ? monthlyData : []);
      setAnnouncements(Array.isArray(annData) ? annData : []);
      setApplications(Array.isArray(appsData) ? appsData : []);
    } catch (err) {
      console.warn('Failed to load staff dashboard data:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const totalBeneficiaries = summary
    ? ((summary.fourPsCount || 0) + (summary.seniorCitizensCount || 0) + (summary.pwdCount || 0) || summary.totalBeneficiaries || 0)
    : 0;
  const totalDistributedFunds = summary?.totalDistributedFunds || 0;
  const approvedCount = summary?.approvedCount || totalBeneficiaries;
  const totalPrograms = summary?.totalPrograms || 1;
  const totalDistributionEvents = summary?.totalDistributionEvents || 0;
  const pendingRequests = summary?.pendingAssistanceRequests || 0;

  const pendingApps = applications.filter(
    (a) => a.status !== 'Approved' && a.status !== 'Rejected' && a.status !== 'Pending Submission'
  );
  const pendingAppsCount = pendingApps.length;

  const recentActivity = applications.slice(0, 5).map((app) => {
    const isApproved = app.status === 'Approved';
    const isRejected = app.status === 'Rejected';
    return {
      id: app.id,
      name: `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Beneficiary Applicant',
      action: isApproved ? 'Application Approved' : isRejected ? 'Application Rejected' : 'New Application Submitted',
      status: app.status || 'Pending Review',
      time: formatTimeAgo(app.updated_at || app.created_at),
      category: app.category || 'General',
    };
  });

  // Trend calculation
  const currentMonthData = monthly[monthly.length - 1] || {};
  const previousMonthData = monthly[monthly.length - 2] || {};
  const currAmt = parseFloat(currentMonthData.total || 0);
  const prevAmt = parseFloat(previousMonthData.total || 0);
  let trendPct = '+0%';
  if (prevAmt > 0) {
    const diff = ((currAmt - prevAmt) / prevAmt) * 100;
    trendPct = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  }

  // Active / published announcements
  const activeAnnouncements = announcements.filter(
    (a) => a.status === 'published' || a.status === 'active' || a.status === 'completed'
  );
  const firstAnnouncement = activeAnnouncements[0] || announcements[0];

  // Category breakdown scoped to the user's sector
  const categoryData = isSenior
    ? [{ name: 'Senior Citizens (Social Pension)', value: summary?.seniorCitizensCount || totalBeneficiaries || 0, color: '#E11D48', bg: '#ffe4e6' }]
    : isPwd
    ? [{ name: 'Persons with Disabilities (PWD)', value: summary?.pwdCount || totalBeneficiaries || 0, color: '#F59E0B', bg: '#fef3c7' }]
    : isMswdo
    ? [
        { name: 'Senior Citizens', value: summary?.seniorCitizensCount || 0, color: '#E11D48', bg: '#ffe4e6' },
        { name: 'PWD Program', value: summary?.pwdCount || 0, color: '#F59E0B', bg: '#fef3c7' },
      ]
    : [
        { name: '4Ps Program', value: summary?.fourPsCount || 0, color: '#2563EB', bg: '#eff6ff' },
        { name: 'Senior Citizens', value: summary?.seniorCitizensCount || 0, color: '#E11D48', bg: '#ffe4e6' },
        { name: 'PWD Program', value: summary?.pwdCount || 0, color: '#F59E0B', bg: '#fef3c7' },
      ];
  const totalCategorySum = categoryData.reduce((acc, c) => acc + c.value, 0) || 1;

  // Monthly chart calculations
  const maxMonthAmount = Math.max(
    ...monthly.map((m) => parseFloat(m.total || 0)),
    10000
  );

  const getScopeBadge = () => {
    switch (user?.role) {
      case 'mswdo_admin':
        return 'MSWDO ADMIN';
      case 'mswdo_staff':
        return 'MSWDO STAFF';
      case 'senior_citizen_admin':
        return 'OSCA / SENIOR CITIZEN ADMIN';
      case 'senior_citizen_staff':
        return 'OSCA / SENIOR CITIZEN STAFF';
      case 'pwd_admin':
        return 'PDAO / PWD ADMIN';
      case 'pwd_staff':
        return 'PDAO / PWD STAFF';
      case 'admin':
        return 'DSWD ADMIN CONSOLE';
      case 'staff':
        return 'DSWD / BARANGAY STAFF';
      default:
        return 'BARANGAY STAFF';
    }
  };

  return (
    <View style={[styles.screen, darkMode && styles.darkScreen]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={darkMode ? '#0f172a' : '#ffffff'}
      />

      {/* Top Header Bar */}
      <View style={[styles.topBar, darkMode && styles.darkTopBar]}>
        <TouchableOpacity
          onPress={onOpenDrawer}
          style={[styles.menuBtn, darkMode && styles.darkMenuBtn]}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.menuIcon, darkMode && styles.darkMenuIcon]}>☰</Text>
        </TouchableOpacity>

        <View style={styles.topBarTitleWrap}>
          <Text style={[styles.topBarTitle, darkMode && styles.darkTopBarTitle]}>
            BeniAid
          </Text>
          <Text style={[styles.topBarSubtitle, darkMode && styles.darkTopBarSubtitle]}>
            STAFF DASHBOARD
          </Text>
        </View>

        <View style={styles.topActions}>
          {setDarkMode && (
            <TouchableOpacity
              onPress={() => setDarkMode((prev) => !prev)}
              style={[styles.themeBtn, darkMode && styles.darkThemeBtn]}
              activeOpacity={0.7}
            >
              <Text style={styles.themeBtnText}>{darkMode ? '☀' : '☾'}</Text>
            </TouchableOpacity>
          )}
          {onLogout && (
            <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.7}>
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={['#2563EB']}
            tintColor="#2563EB"
          />
        }
      >
        {/* ━━━ Welcome Hero Header Card ━━━ */}
        <View style={[styles.welcomeCard, darkMode && styles.darkCard]}>
          <View style={styles.scopeRow}>
            <View style={styles.scopeBadge}>
              <Text style={styles.scopeBadgeText}>{getScopeBadge()}</Text>
            </View>
            <Text style={[styles.locationText, darkMode && styles.darkSubtext]}>
              • Bongabong, Oriental Mindoro
            </Text>
          </View>

          <Text style={[styles.welcomeTitle, darkMode && styles.darkTitle]}>
            Welcome back, {user?.first_name || 'Staff'}
          </Text>
          <Text style={[styles.welcomeDesc, darkMode && styles.darkSubtext]}>
            Real-time overview of municipal beneficiaries, programs, and aid distributions.
          </Text>

          {/* Action Buttons */}
          <View style={styles.welcomeActionRow}>
            <TouchableOpacity
              onPress={() => loadData(true)}
              style={[styles.actionBtnOutline, darkMode && styles.darkActionBtnOutline]}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnOutlineIcon}>{refreshing ? '⏳' : '🔄'}</Text>
              <Text style={[styles.actionBtnOutlineText, darkMode && styles.darkText]}>
                {refreshing ? 'Updating...' : 'Refresh'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('reports')}
              style={[styles.actionBtnOutline, darkMode && styles.darkActionBtnOutline]}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnOutlineIcon}>📊</Text>
              <Text style={[styles.actionBtnOutlineText, darkMode && styles.darkText]}>Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('distributionScanner')}
              style={styles.actionBtnPrimary}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBtnPrimaryIcon}>📱</Text>
              <Text style={styles.actionBtnPrimaryText}>Scan RFID</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ━━━ Pending Applications Alert Banner ━━━ */}
        {pendingAppsCount > 0 && (
          <TouchableOpacity
            style={styles.pendingQueueBanner}
            activeOpacity={0.85}
            onPress={() => onNavigate && onNavigate('beneficiaryList')}
          >
            <View style={styles.pendingQueueLeft}>
              <View style={styles.pendingQueueIconWrap}>
                <Text style={{ fontSize: 16 }}>⏳</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingQueueTitle}>Nakapilang Aplikasyon ({pendingAppsCount})</Text>
                <Text style={styles.pendingQueueSub} numberOfLines={2}>
                  May mga bagong aplikasyon ng residente na naghihintay ng rebyu at pag-apruba.
                </Text>
              </View>
            </View>
            <Text style={styles.pendingQueueLink}>I-rebyu ›</Text>
          </TouchableOpacity>
        )}

        {/* ━━━ Upcoming Announcements Alert Banner ━━━ */}
        {firstAnnouncement && (
          <TouchableOpacity
            style={[styles.announcementBanner, darkMode && styles.darkAnnouncementBanner]}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedAnnouncement(firstAnnouncement);
              setShowAnnouncementsModal(true);
            }}
          >
            <View style={styles.announcementBannerLeft}>
              <View style={styles.announcementIconWrap}>
                <Text style={styles.announcementIcon}>📣</Text>
              </View>
              <View style={styles.announcementTextWrap}>
                <Text
                  style={[styles.announcementTitleText, darkMode && styles.darkAnnouncementTitleText]}
                  numberOfLines={2}
                >
                  <Text style={styles.announcementPrefix}>Upcoming Announcements: </Text>
                  {firstAnnouncement.title}
                </Text>
              </View>
            </View>
            <View style={styles.announcementViewAll}>
              <Text style={styles.announcementViewAllText}>View All ›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ━━━ 5 Minimalist KPI Stat Cards ━━━ */}
        <Text style={[styles.sectionHeading, darkMode && styles.darkSubtext]}>
          KEY METRICS OVERVIEW
        </Text>

        <View style={styles.kpiGrid}>
          {/* 1. Total Beneficiaries */}
          <TouchableOpacity
            style={[styles.kpiCard, darkMode && styles.darkCard]}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('beneficiaryList')}
          >
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#eff6ff', borderColor: '#dbeafe' }]}>
                <Text style={styles.kpiEmoji}>👥</Text>
              </View>
              <View style={[styles.kpiBadge, { backgroundColor: '#eff6ff' }]}>
                <Text style={[styles.kpiBadgeText, { color: '#1d4ed8' }]}>
                  {approvedCount > 0 ? `${approvedCount} approved` : '+0%'} ↗
                </Text>
              </View>
            </View>
            <Text style={[styles.kpiValue, darkMode && styles.darkTitle]}>
              {totalBeneficiaries}
            </Text>
            <Text style={[styles.kpiLabel, darkMode && styles.darkSubtext]}>
              Total Beneficiaries
            </Text>
          </TouchableOpacity>

          {/* 2. Active Programs */}
          <TouchableOpacity
            style={[styles.kpiCard, darkMode && styles.darkCard]}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('programs')}
          >
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#faf5ff', borderColor: '#f3e8ff' }]}>
                <Text style={styles.kpiEmoji}>🎯</Text>
              </View>
              <View style={[styles.kpiBadge, { backgroundColor: '#faf5ff' }]}>
                <Text style={[styles.kpiBadgeText, { color: '#7e22ce' }]}>
                  {totalDistributionEvents} events ↗
                </Text>
              </View>
            </View>
            <Text style={[styles.kpiValue, darkMode && styles.darkTitle]}>
              {totalPrograms}
            </Text>
            <Text style={[styles.kpiLabel, darkMode && styles.darkSubtext]}>
              Active Programs
            </Text>
          </TouchableOpacity>

          {/* 3. Total Distributed */}
          <TouchableOpacity
            style={[styles.kpiCard, darkMode && styles.darkCard]}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('distributions')}
          >
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' }]}>
                <Text style={styles.kpiEmoji}>₱</Text>
              </View>
              <View style={[styles.kpiBadge, { backgroundColor: '#ecfdf5' }]}>
                <Text style={[styles.kpiBadgeText, { color: '#047857' }]}>
                  {trendPct} ↗
                </Text>
              </View>
            </View>
            <Text style={[styles.kpiValue, darkMode && styles.darkTitle, { fontSize: 20 }]}>
              {formatMoney(totalDistributedFunds)}
            </Text>
            <Text style={[styles.kpiLabel, darkMode && styles.darkSubtext]}>
              Total Distributed
            </Text>
          </TouchableOpacity>

          {/* 4. Approved Beneficiaries */}
          <TouchableOpacity
            style={[styles.kpiCard, darkMode && styles.darkCard]}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('beneficiaryList')}
          >
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: '#f0fdfa', borderColor: '#ccfbf1' }]}>
                <Text style={styles.kpiEmoji}>✓</Text>
              </View>
              <View style={[styles.kpiBadge, { backgroundColor: '#f0fdfa' }]}>
                <Text style={[styles.kpiBadgeText, { color: '#0f766e' }]}>
                  Verified ↗
                </Text>
              </View>
            </View>
            <Text style={[styles.kpiValue, darkMode && styles.darkTitle]}>
              {approvedCount}
            </Text>
            <Text style={[styles.kpiLabel, darkMode && styles.darkSubtext]}>
              Approved Beneficiaries
            </Text>
          </TouchableOpacity>

          {/* 5. Assistance Requests */}
          {hasAssistanceAccess && (
            <TouchableOpacity
              style={[styles.kpiCardFull, darkMode && styles.darkCard]}
              activeOpacity={0.8}
              onPress={() => onNavigate && onNavigate('assistanceRequests')}
            >
              <View style={styles.kpiTopRow}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
                  <Text style={styles.kpiEmoji}>🤲</Text>
                </View>
                <View style={[styles.kpiBadge, { backgroundColor: '#fffbeb' }]}>
                  <Text style={[styles.kpiBadgeText, { color: '#b45309' }]}>
                    {isMswdo ? 'MSWDO aid' : 'Barangay aid'}
                  </Text>
                </View>
              </View>
              <View style={styles.kpiFullBottom}>
                <View>
                  <Text style={[styles.kpiValue, darkMode && styles.darkTitle]}>
                    {pendingRequests}
                  </Text>
                  <Text style={[styles.kpiLabel, darkMode && styles.darkSubtext]}>
                    Assistance Requests
                  </Text>
                </View>
                <Text style={styles.kpiFullLink}>View requests ›</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ━━━ Monthly Distribution Trend Chart ━━━ */}
        <View style={[styles.chartCard, darkMode && styles.darkCard]}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chartTitle, darkMode && styles.darkTitle]}>
                Monthly Distribution Trend
              </Text>
              <Text style={[styles.chartSubtitle, darkMode && styles.darkSubtext]}>
                Disbursement volume and history over time
              </Text>
            </View>
            <View style={styles.amountLegendPill}>
              <View style={styles.amountLegendDot} />
              <Text style={styles.amountLegendText}>Amount</Text>
            </View>
          </View>

          {/* Native Bar Trend Visual */}
          <View style={styles.chartVisualArea}>
            {/* Horizontal guideline markers */}
            <View style={styles.guidelineRow}>
              <Text style={styles.guidelineText}>{formatMoney(maxMonthAmount)}</Text>
              <View style={[styles.guidelineLine, darkMode && styles.darkGuidelineLine]} />
            </View>
            <View style={styles.guidelineRow}>
              <Text style={styles.guidelineText}>{formatMoney(maxMonthAmount / 2)}</Text>
              <View style={[styles.guidelineLine, darkMode && styles.darkGuidelineLine]} />
            </View>
            <View style={styles.guidelineRow}>
              <Text style={styles.guidelineText}>₱0</Text>
              <View style={[styles.guidelineLine, darkMode && styles.darkGuidelineLine]} />
            </View>

            {/* Monthly Bars */}
            <View style={styles.barsContainer}>
              {monthly.length > 0 ? (
                monthly.map((item, idx) => {
                  const amt = parseFloat(item.total || 0);
                  const barHeightPct = Math.max(15, Math.min(100, Math.round((amt / maxMonthAmount) * 100)));
                  return (
                    <View key={idx} style={styles.barColumn}>
                      {/* Amount Bubble */}
                      <View style={styles.barAmtBadge}>
                        <Text style={styles.barAmtBadgeText}>{formatMoney(amt)}</Text>
                      </View>
                      {/* Bar Fill */}
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${barHeightPct}%` }]} />
                      </View>
                      {/* Month label */}
                      <Text style={[styles.barMonthText, darkMode && styles.darkSubtext]} numberOfLines={1}>
                        {item.month || 'Recent'}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyChartWrap}>
                  <Text style={[styles.emptyChartText, darkMode && styles.darkSubtext]}>
                    No distribution records yet for this period.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ━━━ Category Distribution Card ━━━ */}
        <View style={[styles.chartCard, darkMode && styles.darkCard]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, darkMode && styles.darkTitle]}>
                Category Distribution
              </Text>
              <Text style={[styles.chartSubtitle, darkMode && styles.darkSubtext]}>
                Beneficiary roster breakdown
              </Text>
            </View>
          </View>

          {/* Central Donut Summary Visual */}
          <View style={styles.donutCenterWrap}>
            <View style={[styles.donutOuterRing, darkMode && styles.darkDonutOuterRing]}>
              <View style={[styles.donutInnerHole, darkMode && styles.darkCard]}>
                <Text style={[styles.donutTotalNum, darkMode && styles.darkTitle]}>
                  {totalBeneficiaries}
                </Text>
                <Text style={styles.donutTotalLabel}>Total</Text>
              </View>
            </View>
          </View>

          {/* Category List with Progress Bars */}
          <View style={styles.categoryList}>
            {categoryData.map((cat, idx) => {
              const pct = totalCategorySum > 0 ? Math.round((cat.value / totalCategorySum) * 100) : 0;
              return (
                <View key={idx} style={styles.categoryItem}>
                  <View style={styles.categoryItemTop}>
                    <View style={styles.categoryNameRow}>
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.categoryName, darkMode && styles.darkText]}>
                        {cat.name}
                      </Text>
                    </View>
                    <View style={styles.categoryStatsRow}>
                      <Text style={[styles.categoryCount, darkMode && styles.darkTitle]}>
                        {cat.value}
                      </Text>
                      <Text style={styles.categoryPct}>{pct}%</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={[styles.categoryBarTrack, darkMode && styles.darkTrack]}>
                    <View
                      style={[
                        styles.categoryBarFill,
                        { width: `${Math.max(4, pct)}%`, backgroundColor: cat.color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ━━━ Recent Applications & Activity (Matching Web ModernDashboard) ━━━ */}
        <View style={[styles.chartCard, darkMode && styles.darkCard]}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chartTitle, darkMode && styles.darkTitle]}>
                Recent Applications & Activity
              </Text>
              <Text style={[styles.chartSubtitle, darkMode && styles.darkSubtext]}>
                Mga pinakabagong rehistrasyon at aplikasyon ng residente
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onNavigate && onNavigate('beneficiaryList')}
              style={styles.reviewPendingLink}
            >
              <Text style={styles.reviewPendingLinkText}>Roster ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            {recentActivity.length > 0 ? (
              recentActivity.map((act) => {
                const isApproved = act.status === 'Approved';
                const isRejected = act.status === 'Rejected';
                return (
                  <TouchableOpacity
                    key={act.id}
                    style={[styles.activityItem, darkMode && styles.darkItem]}
                    activeOpacity={0.7}
                    onPress={() => onNavigate && onNavigate('beneficiaryList')}
                  >
                    <View
                      style={[
                        styles.activityAvatar,
                        {
                          backgroundColor: isApproved
                            ? '#dcfce7'
                            : isRejected
                            ? '#fee2e2'
                            : '#fef3c7',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13 }}>
                        {isApproved ? '✓' : isRejected ? '✕' : '⏳'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.activityName, darkMode && styles.darkTitle]}
                        numberOfLines={1}
                      >
                        {act.name}
                      </Text>
                      <Text style={[styles.activityAction, darkMode && styles.darkSubtext]}>
                        {act.action} • {act.category}
                      </Text>
                    </View>
                    <Text style={[styles.activityTime, darkMode && styles.darkSubtext]}>
                      {act.time}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyChartWrap}>
                <Text style={[styles.emptyChartText, darkMode && styles.darkSubtext]}>
                  Walang bagong tala ng aktibidad sa kasalukuyan.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.viewRosterBtn}
            onPress={() => onNavigate && onNavigate('beneficiaryList')}
          >
            <Text style={styles.viewRosterBtnText}>
              Tingnan ang Talaan ng mga Benepisyaryo →
            </Text>
          </TouchableOpacity>
        </View>

        {/* ━━━ Comprehensive Quick Operations (All Staff Modules) ━━━ */}
        <View style={[styles.chartCard, darkMode && styles.darkCard]}>
          <Text style={[styles.chartTitle, darkMode && styles.darkTitle]}>
            Quick Operations
          </Text>
          <Text style={[styles.chartSubtitle, darkMode && styles.darkSubtext, { marginBottom: 14 }]}>
            Komprehensibong kontrol at serbisyo para sa mga kawani ng barangay at DSWD
          </Text>

          <View style={styles.operationsGrid}>
            {/* 1. Beneficiaries Roster */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('beneficiaryList')}
            >
              <Text style={styles.opIcon}>👥</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Beneficiaries</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Roster & Aplikasyon</Text>
            </TouchableOpacity>

            {/* 2. Distributions */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('distributions')}
            >
              <Text style={styles.opIcon}>📦</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Distributions</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Pamamahagi ng Ayuda</Text>
            </TouchableOpacity>

            {/* 3. Distribution Scanner */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('distributionScanner')}
            >
              <Text style={styles.opIcon}>📱</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Distribution Scanner</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>RFID/QR Claiming</Text>
            </TouchableOpacity>

            {/* 4. Attendance Scanner */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('attendanceScanner')}
            >
              <Text style={styles.opIcon}>📱</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Attendance Scanner</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>RFID Attendance</Text>
            </TouchableOpacity>

            {/* 5. Benefit Programs */}
            {isDswd && (
              <TouchableOpacity
                style={[styles.opBtn, darkMode && styles.darkOpBtn]}
                activeOpacity={0.75}
                onPress={() => onNavigate && onNavigate('programs')}
              >
                <Text style={styles.opIcon}>📋</Text>
                <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Benefit Programs</Text>
                <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>4Ps, Senior, PWD</Text>
              </TouchableOpacity>
            )}

            {/* 6. Assistance Requests */}
            {hasAssistanceAccess && (
              <TouchableOpacity
                style={[styles.opBtn, darkMode && styles.darkOpBtn]}
                activeOpacity={0.75}
                onPress={() => onNavigate && onNavigate('assistanceRequests')}
              >
                <Text style={styles.opIcon}>🤲</Text>
                <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Assistance</Text>
                <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Ayuda & Kahilingan</Text>
              </TouchableOpacity>
            )}

            {/* 7. Community Announcements */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('announcements')}
            >
              <Text style={styles.opIcon}>📢</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Announcements</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Anunsyo sa Barangay</Text>
            </TouchableOpacity>

            {/* 8. Interventions */}
            {isDswd && (
              <TouchableOpacity
                style={[styles.opBtn, darkMode && styles.darkOpBtn]}
                activeOpacity={0.75}
                onPress={() => onNavigate && onNavigate('interventions')}
              >
                <Text style={styles.opIcon}>📄</Text>
                <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Interventions</Text>
                <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Tulong & Serbisyo</Text>
              </TouchableOpacity>
            )}

            {/* 9. Reports */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('reports')}
            >
              <Text style={styles.opIcon}>📊</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Reports</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Audit & Talaan</Text>
            </TouchableOpacity>

            {/* 10. Messages */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('messages')}
            >
              <Text style={styles.opIcon}>💬</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>Messages</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Mensahe sa Residente</Text>
            </TouchableOpacity>

            {/* 11. BeniAid AI Bot */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('botAssistant')}
            >
              <Text style={styles.opIcon}>🤖</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>BeniAid Bot</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>AI Staff Assistant</Text>
            </TouchableOpacity>

            {/* 12. User Accounts */}
            <TouchableOpacity
              style={[styles.opBtn, darkMode && styles.darkOpBtn]}
              activeOpacity={0.75}
              onPress={() => onNavigate && onNavigate('users')}
            >
              <Text style={styles.opIcon}>👤⚙</Text>
              <Text style={[styles.opTitle, darkMode && styles.darkTitle]}>User Accounts</Text>
              <Text style={[styles.opDesc, darkMode && styles.darkSubtext]}>Mga Kawani & Staff</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ━━━ Announcements Modal ━━━ */}
      <Modal
        visible={showAnnouncementsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnnouncementsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkCard]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.darkTitle]}>
                Upcoming Announcements
              </Text>
              <TouchableOpacity
                onPress={() => setShowAnnouncementsModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {activeAnnouncements.map((item, idx) => (
                <View key={idx} style={[styles.announcementItem, darkMode && styles.darkItem]}>
                  <View style={styles.annItemTop}>
                    <Text style={[styles.annItemTitle, darkMode && styles.darkTitle]}>
                      {item.title}
                    </Text>
                    <View style={styles.annPriorityBadge}>
                      <Text style={styles.annPriorityText}>{item.priority || 'Normal'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.annItemMsg, darkMode && styles.darkSubtext]}>
                    {item.message}
                  </Text>
                  {item.venue && (
                    <Text style={styles.annItemMeta}>📍 Venue: {item.venue}</Text>
                  )}
                  {item.event_date && (
                    <Text style={styles.annItemMeta}>
                      📅 Date: {item.event_date} {item.event_time ? `(${item.event_time})` : ''}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  darkScreen: {
    backgroundColor: '#020617',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  darkTopBar: {
    backgroundColor: '#0f172a',
    borderBottomColor: '#1e293b',
  },
  menuBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  darkMenuBtn: {
    backgroundColor: '#1e293b',
  },
  menuIcon: {
    fontSize: 18,
    color: '#0f172a',
    fontWeight: 'bold',
  },
  darkMenuIcon: {
    color: '#f8fafc',
  },
  topBarTitleWrap: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  darkTopBarTitle: {
    color: '#ffffff',
  },
  topBarSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 1,
  },
  darkTopBarSubtitle: {
    color: '#60a5fa',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  darkThemeBtn: {
    backgroundColor: '#1e293b',
  },
  themeBtnText: {
    fontSize: 14,
    color: '#0f172a',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  darkCard: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  scopeBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scopeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  darkTitle: {
    color: '#f8fafc',
  },
  welcomeDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  darkSubtext: {
    color: '#94a3b8',
  },
  darkText: {
    color: '#cbd5e1',
  },
  welcomeActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  darkActionBtnOutline: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  actionBtnOutlineIcon: {
    fontSize: 12,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0f172a',
  },
  actionBtnPrimaryIcon: {
    fontSize: 12,
  },
  actionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  announcementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  darkAnnouncementBanner: {
    backgroundColor: '#172554',
    borderColor: '#1e40af',
  },
  announcementBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  announcementIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementIcon: {
    fontSize: 14,
  },
  announcementTextWrap: {
    flex: 1,
  },
  announcementTitleText: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '500',
    lineHeight: 16,
  },
  darkAnnouncementTitleText: {
    color: '#e2e8f0',
  },
  announcementPrefix: {
    fontWeight: '800',
    color: '#1e40af',
  },
  announcementViewAll: {
    paddingLeft: 4,
  },
  announcementViewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: -4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiCardFull: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiEmoji: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  kpiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kpiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  kpiFullBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  kpiFullLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  chartSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  amountLegendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  amountLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
  },
  amountLegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  chartVisualArea: {
    height: 190,
    position: 'relative',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  guidelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidelineText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    width: 44,
    textAlign: 'right',
  },
  guidelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  darkGuidelineLine: {
    backgroundColor: '#1e293b',
  },
  barsContainer: {
    position: 'absolute',
    left: 54,
    right: 12,
    top: 10,
    bottom: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 4,
  },
  barAmtBadge: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  barAmtBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  barTrack: {
    width: 32,
    height: 110,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 6,
  },
  barMonthText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 6,
  },
  emptyChartWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  donutCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  donutOuterRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 14,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkDonutOuterRing: {
    borderColor: '#3b82f6',
  },
  donutInnerHole: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotalNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 24,
  },
  donutTotalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  categoryList: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  categoryItem: {
    gap: 4,
  },
  categoryItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  categoryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  categoryPct: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    width: 32,
    textAlign: 'right',
  },
  categoryBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  darkTrack: {
    backgroundColor: '#1e293b',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  opBtn: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  darkOpBtn: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  opIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  opTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  opDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  announcementItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  darkItem: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  annItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  annItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    marginRight: 6,
  },
  annPriorityBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  annPriorityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#dc2626',
  },
  annItemMsg: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
  },
  annItemMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  pendingQueueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  pendingQueueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pendingQueueIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingQueueTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  pendingQueueSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
  },
  pendingQueueLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
    paddingLeft: 4,
  },
  reviewPendingLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  reviewPendingLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  activityList: {
    marginTop: 10,
    gap: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  activityAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  activityAction: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  activityTime: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  viewRosterBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  viewRosterBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
});



import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { reportsApi, programApi, barangayApi } from '../services/api';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ALL_REPORT_TYPES = [
  { label: 'All Reports (Distributions)', value: '' },
  { label: 'Beneficiary Reports', value: 'beneficiary' },
  { label: 'Distribution Reports', value: 'distribution' },
  { label: 'Program Reports', value: 'program', roles: ['admin', 'staff', 'barangay'] },
  { label: 'Enrollment Reports', value: 'enrollment', roles: ['admin', 'staff', 'barangay'] },
  { label: 'Attendance Reports', value: 'attendance' },
  { label: 'Announcement Reports', value: 'announcement' },
  { label: 'Assistance Requests', value: 'assistance', roles: ['admin', 'mswdo_admin', 'mswdo_staff', 'staff', 'barangay'] },
];

const StaffReportsScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const REPORT_TYPES = ALL_REPORT_TYPES.filter(
    (rt) => !rt.roles || rt.roles.includes(user?.role)
  );
  // Filters State
  const [reportType, setReportType] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown options
  const [programs, setPrograms] = useState([]);
  const [barangays, setBarangays] = useState([]);

  // Data State
  const [summary, setSummary] = useState({});
  const [monthlyAid, setMonthlyAid] = useState([]);
  const [distributionStatus, setDistributionStatus] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // UI State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filterModal, setFilterModal] = useState(null); // 'type' | 'program' | 'barangay' | null
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Load filter select options
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [progRes, brgyRes] = await Promise.all([
          programApi.list().catch(() => ({ data: { data: [] } })),
          barangayApi.list().catch(() => ({ data: { data: [] } })),
        ]);
        setPrograms(progRes.data?.data || []);
        setBarangays(brgyRes.data?.data || []);
      } catch (e) {
        console.warn('Failed to load filter options:', e);
      }
    };
    fetchFilters();
  }, []);

  // Fetch report data
  const loadReportData = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError('');

        const params = { page, limit: 10 };
        if (programFilter) params.program_id = programFilter;
        if (barangayFilter) params.barangay_id = barangayFilter;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        // Fetch summary KPIs & chart metrics
        const [sumRes, statusRes, monthlyRes] = await Promise.allSettled([
          reportsApi.summary(),
          reportsApi.distributionStatus(),
          reportsApi.monthlyAid(),
        ]);

        if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data?.data || sumRes.value.data || {});
        if (statusRes.status === 'fulfilled') setDistributionStatus(statusRes.value.data?.data || []);
        if (monthlyRes.status === 'fulfilled') setMonthlyAid(monthlyRes.value.data?.data || []);

        // Fetch dynamic table rows based on selected reportType
        let rows = [];
        let total = 0;
        let pages = 1;

        if (reportType === 'beneficiary') {
          const res = await reportsApi.getTableBeneficiaries(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        } else if (reportType === 'program') {
          const res = await reportsApi.getTablePrograms(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        } else if (reportType === 'enrollment') {
          const res = await reportsApi.getTableEnrollments(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        } else if (reportType === 'assistance') {
          const res = await reportsApi.getTableAssistanceRequests(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        } else if (reportType === 'attendance') {
          const res = await reportsApi.getTableAttendance(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        } else if (reportType === 'announcement') {
          const res = await reportsApi.getTableAnnouncements(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        } else {
          // Default: distribution (matches web default)
          const res = await reportsApi.recentDistributions(params);
          rows = res.data?.data || [];
          total = res.data?.pagination?.total ?? rows.length;
          pages = res.data?.pagination?.totalPages ?? 1;
        }

        setTableData(rows);
        setTableTotal(total);
        setTotalPages(pages);
        setCurrentPage(page);
      } catch (err) {
        console.warn('Report fetch error:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to load reports');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [reportType, programFilter, barangayFilter, startDate, endDate]
  );

  useEffect(() => {
    loadReportData(1);
  }, [loadReportData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReportData(currentPage);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    loadReportData(1);
  };

  const handleResetFilters = () => {
    setReportType('');
    setProgramFilter('');
    setBarangayFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Top KPIs matching Image 2
  const totalBeneficiaries =
    summary.totalBeneficiaries ||
    (Number(summary.fourPsCount || 0) +
      Number(summary.seniorCitizensCount || 0) +
      Number(summary.pwdCount || 0)) ||
    0;
  const activePrograms = summary.totalPrograms || summary.activePrograms || 0;
  const pendingEnrollments = summary.pendingApplications || summary.pendingEnrollments || 0;
  const distributionsDone = summary.completedEvents || summary.distributionsDone || 0;
  const budgetDistributed = summary.totalDistributedFunds || summary.totalDisbursed || 0;

  // Selected names for filter buttons
  const selectedReportLabel =
    REPORT_TYPES.find((r) => r.value === reportType)?.label || 'All Reports';
  const selectedProgramName =
    programs.find((p) => String(p.id) === String(programFilter))?.name || 'All Programs';
  const selectedBarangayName =
    barangays.find((b) => String(b.id) === String(barangayFilter))?.barangay_name ||
    barangays.find((b) => String(b.id) === String(barangayFilter))?.name ||
    'All Barangays';

  // Renders individual record row based on reportType
  const renderTableRow = (item, idx) => {
    if (reportType === 'beneficiary') {
      return (
        <TouchableOpacity
          key={item.id || idx}
          style={styles.tableRow}
          onPress={() => setSelectedRecord(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableRowTitle}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={styles.tableRowMeta}>
              ID: {item.id} • 📍 {item.barangay_name || 'N/A'} • {item.category || 'General'}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <View style={styles.badgeGreen}>
              <Text style={styles.badgeGreenText}>{item.status || 'Active'}</Text>
            </View>
            <Text style={styles.viewRowArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (reportType === 'program') {
      return (
        <TouchableOpacity
          key={item.id || idx}
          style={styles.tableRow}
          onPress={() => setSelectedRecord(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableRowTitle}>{item.name}</Text>
            <Text style={styles.tableRowMeta}>
              📍 {item.barangay_name || 'All Barangays'} • Enrolled: {item.enrollment_count || 0}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <Text style={styles.amountBadge}>{formatMoney(item.budget)}</Text>
            <Text style={styles.viewRowArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (reportType === 'enrollment') {
      return (
        <TouchableOpacity
          key={item.id || idx}
          style={styles.tableRow}
          onPress={() => setSelectedRecord(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableRowTitle}>{item.beneficiary_name}</Text>
            <Text style={styles.tableRowMeta}>
              📦 {item.program_name} • 📍 {item.barangay_name || 'N/A'}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <View style={styles.badgeBlue}>
              <Text style={styles.badgeBlueText}>Enrolled</Text>
            </View>
            <Text style={styles.viewRowArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (reportType === 'assistance') {
      return (
        <TouchableOpacity
          key={item.id || idx}
          style={styles.tableRow}
          onPress={() => setSelectedRecord(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableRowTitle}>{item.subject || item.type || 'Request'}</Text>
            <Text style={styles.tableRowMeta}>
              👤 {item.beneficiary_name} • 📍 {item.barangay_name || 'N/A'}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <View
              style={
                item.status === 'Completed' || item.status === 'Approved'
                  ? styles.badgeGreen
                  : styles.badgeAmber
              }
            >
              <Text
                style={
                  item.status === 'Completed' || item.status === 'Approved'
                    ? styles.badgeGreenText
                    : styles.badgeAmberText
                }
              >
                {item.status || 'Pending'}
              </Text>
            </View>
            <Text style={styles.viewRowArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (reportType === 'attendance') {
      return (
        <TouchableOpacity
          key={item.id || idx}
          style={styles.tableRow}
          onPress={() => setSelectedRecord(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableRowTitle}>{item.event_name || 'Attendance Event'}</Text>
            <Text style={styles.tableRowMeta}>
              👤 {item.beneficiary_name} • 📅 {formatDate(item.attendance_date)}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <View style={item.status === 'Present' ? styles.badgeGreen : styles.badgeAmber}>
              <Text style={item.status === 'Present' ? styles.badgeGreenText : styles.badgeAmberText}>
                {item.status || 'Pending'}
              </Text>
            </View>
            <Text style={styles.viewRowArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (reportType === 'announcement') {
      return (
        <TouchableOpacity
          key={item.id || idx}
          style={styles.tableRow}
          onPress={() => setSelectedRecord(item)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.tableRowTitle}>{item.title}</Text>
            <Text style={styles.tableRowMeta}>
              📅 {formatDate(item.event_date)} • 📍 {item.venue || 'N/A'}
            </Text>
          </View>
          <View style={styles.badgeWrap}>
            <View style={styles.badgeBlue}>
              <Text style={styles.badgeBlueText}>
                {item.attendees ?? 0}/{item.recipients_count ?? 0}
              </Text>
            </View>
            <Text style={styles.viewRowArrow}>›</Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Default: Distribution Report row
    return (
      <TouchableOpacity
        key={item.id || idx}
        style={styles.tableRow}
        onPress={() => setSelectedRecord(item)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.tableRowTitle}>{item.title}</Text>
          <Text style={styles.tableRowMeta}>
            📦 {item.program || 'Program'} • 📍 {item.barangay || 'All Barangays'} • 📅{' '}
            {formatDate(item.date)}
          </Text>
          <Text style={styles.tableRowSubMeta}>
            Beneficiaries: {item.released_count ?? 0}/{item.beneficiaries ?? 0}
          </Text>
        </View>
        <View style={styles.badgeWrap}>
          <Text style={styles.amountBadge}>{formatMoney(item.amount)}</Text>
          <View
            style={
              item.status === 'completed'
                ? styles.badgeGreen
                : item.status === 'ongoing'
                ? styles.badgeAmber
                : styles.badgeBlue
            }
          >
            <Text
              style={
                item.status === 'completed'
                  ? styles.badgeGreenText
                  : item.status === 'ongoing'
                  ? styles.badgeAmberText
                  : styles.badgeBlueText
              }
            >
              {item.status || 'Scheduled'}
            </Text>
          </View>
          <Text style={styles.viewRowArrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.darkContainer]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={darkMode ? '#0f172a' : '#ffffff'}
      />

      {/* Top Header matching Web App */}
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
            <View style={styles.headerTagRow}>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>REPORTS & EXPORTS</Text>
              </View>
              <Text style={styles.headerLocation}>• Bongabong, Oriental Mindoro</Text>
            </View>
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Reports & Analytics</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => loadReportData(currentPage)}
          style={styles.refreshBtn}
        >
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        <Text style={styles.headerDesc}>
          Generate and review municipal reports for monitoring, transparency, and decision-making.
        </Text>

        {/* Filters Card matching Image 2 */}
        <View style={[styles.filtersCard, darkMode && styles.darkCard]}>
          <View style={styles.filtersHeader}>
            <Text style={styles.filtersIcon}>⚙</Text>
            <Text style={[styles.filtersTitle, darkMode && styles.darkText]}>Filters</Text>
            <Text style={styles.filtersSubTag}>Filters apply to table below</Text>
          </View>

          {/* Filter 1: Report Type */}
          <Text style={styles.filterLabel}>Report Type</Text>
          <TouchableOpacity
            style={styles.filterSelectBtn}
            onPress={() => setFilterModal('type')}
            activeOpacity={0.8}
          >
            <Text style={styles.filterSelectText}>{selectedReportLabel}</Text>
            <Text style={styles.filterSelectArrow}>▼</Text>
          </TouchableOpacity>

          {/* Filter 2: Program */}
          <Text style={styles.filterLabel}>Program</Text>
          <TouchableOpacity
            style={styles.filterSelectBtn}
            onPress={() => setFilterModal('program')}
            activeOpacity={0.8}
          >
            <Text style={styles.filterSelectText}>{selectedProgramName}</Text>
            <Text style={styles.filterSelectArrow}>▼</Text>
          </TouchableOpacity>

          {/* Filter 3: Barangay */}
          <Text style={styles.filterLabel}>Barangay</Text>
          <TouchableOpacity
            style={styles.filterSelectBtn}
            onPress={() => setFilterModal('barangay')}
            activeOpacity={0.8}
          >
            <Text style={styles.filterSelectText}>{selectedBarangayName}</Text>
            <Text style={styles.filterSelectArrow}>▼</Text>
          </TouchableOpacity>

          {/* Filter 4: Date Range */}
          <Text style={styles.filterLabel}>Date Range (YYYY-MM-DD)</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="Start Date"
              placeholderTextColor="#94a3b8"
              value={startDate}
              onChangeText={setStartDate}
            />
            <Text style={styles.dateDivider}>–</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="End Date"
              placeholderTextColor="#94a3b8"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApplyFilters}>
              <Text style={styles.applyBtnText}>🔍 Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5 KPI Cards matching Image 2 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiScroll}
        >
          {/* Card 1: Total Beneficiaries */}
          <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 16 }}>👥</Text>
            </View>
            <Text style={styles.kpiNumber}>{totalBeneficiaries}</Text>
            <Text style={styles.kpiTitle}>Total Beneficiaries</Text>
            <Text style={styles.kpiSubtitle}>All Programs</Text>
          </View>

          {/* Card 2: Active Programs */}
          <View style={[styles.kpiCard, { borderLeftColor: '#f43f5e' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#fff1f2' }]}>
              <Text style={{ fontSize: 16 }}>📋</Text>
            </View>
            <Text style={styles.kpiNumber}>{activePrograms}</Text>
            <Text style={styles.kpiTitle}>Active Programs</Text>
            <Text style={styles.kpiSubtitle}>All Programs</Text>
          </View>

          {/* Card 3: Pending Enrollments */}
          <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 16 }}>⏳</Text>
            </View>
            <Text style={styles.kpiNumber}>{pendingEnrollments}</Text>
            <Text style={styles.kpiTitle}>Pending Enrollments</Text>
            <Text style={styles.kpiSubtitle}>Awaiting Review</Text>
          </View>

          {/* Card 4: Distributions Done */}
          <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#ecfdf5' }]}>
              <Text style={{ fontSize: 16 }}>✅</Text>
            </View>
            <Text style={styles.kpiNumber}>{distributionsDone}</Text>
            <Text style={styles.kpiTitle}>Distributions Done</Text>
            <Text style={styles.kpiSubtitle}>All Events</Text>
          </View>

          {/* Card 5: Budget Distributed */}
          <View style={[styles.kpiCard, { borderLeftColor: '#eab308' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#fefce8' }]}>
              <Text style={{ fontSize: 16 }}>💰</Text>
            </View>
            <Text style={[styles.kpiNumber, { fontSize: 18 }]}>{formatMoney(budgetDistributed)}</Text>
            <Text style={styles.kpiTitle}>Budget Distributed</Text>
            <Text style={styles.kpiSubtitle}>All Time</Text>
          </View>
        </ScrollView>

        {/* Dynamic Table Card matching Image 2 */}
        <View style={[styles.tableCard, darkMode && styles.darkCard]}>
          <View style={styles.tableHeader}>
            <View>
              <Text style={[styles.tableTitle, darkMode && styles.darkText]}>
                {selectedReportLabel}
              </Text>
              <Text style={styles.tableSub}>
                Showing {tableData.length} of {tableTotal} records
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Kinukuha ang datos mula sa database...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => loadReportData(currentPage)} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Subukang Muli</Text>
              </TouchableOpacity>
            </View>
          ) : tableData.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
              <Text style={styles.emptyText}>Walang nakitang talaan na tumutugma sa filters.</Text>
            </View>
          ) : (
            <View style={styles.tableListWrap}>
              {tableData.map((item, idx) => renderTableRow(item, idx))}
            </View>
          )}

          {/* Pagination Controls */}
          {tableTotal > 10 && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
                disabled={currentPage <= 1}
                onPress={() => loadReportData(currentPage - 1)}
              >
                <Text style={styles.pageBtnText}>‹ Previous</Text>
              </TouchableOpacity>
              <Text style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
                disabled={currentPage >= totalPages}
                onPress={() => loadReportData(currentPage + 1)}
              >
                <Text style={styles.pageBtnText}>Next ›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Analytics Breakdown: Monthly & Status */}
        <View style={[styles.panelCard, darkMode && styles.darkCard]}>
          <Text style={[styles.panelTitle, darkMode && styles.darkText]}>Monthly Aid Distribution</Text>
          <Text style={styles.panelSub}>Historical financial releases from backend records</Text>

          {monthlyAid.length === 0 ? (
            <Text style={styles.emptyText}>No monthly aid records found.</Text>
          ) : (
            monthlyAid.slice(0, 5).map((m, idx) => (
              <View key={idx} style={styles.monthlyRow}>
                <Text style={styles.monthLabel}>{m.month || `Month ${idx + 1}`}</Text>
                <Text style={styles.monthVal}>{formatMoney(m.total || m.amount || 0)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Compliance Footer */}
        <View style={styles.auditNote}>
          <Text style={styles.auditNoteTitle}>🛡 OFFICIAL MSWDO / DSWD MUNICIPAL REPORT</Text>
          <Text style={styles.auditNoteBody}>
            Connected directly to MySQL database endpoints. All disbursement numbers, beneficiary
            counts, and program enrollments are validated in real-time.
          </Text>
        </View>
      </ScrollView>

      {/* Filter Selection Modal */}
      <Modal
        visible={!!filterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, darkMode && styles.darkCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {filterModal === 'type'
                  ? 'Pumili ng Report Type'
                  : filterModal === 'program'
                  ? 'Pumili ng Program'
                  : 'Pumili ng Barangay'}
              </Text>
              <TouchableOpacity onPress={() => setFilterModal(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {filterModal === 'type' &&
                REPORT_TYPES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[
                      styles.modalOption,
                      reportType === r.value && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setReportType(r.value);
                      setFilterModal(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        reportType === r.value && styles.modalOptionTextSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                    {reportType === r.value && <Text style={{ color: '#2563eb' }}>✓</Text>}
                  </TouchableOpacity>
                ))}

              {filterModal === 'program' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalOption, !programFilter && styles.modalOptionSelected]}
                    onPress={() => {
                      setProgramFilter('');
                      setFilterModal(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        !programFilter && styles.modalOptionTextSelected,
                      ]}
                    >
                      All Programs
                    </Text>
                  </TouchableOpacity>
                  {programs.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.modalOption,
                        String(programFilter) === String(p.id) && styles.modalOptionSelected,
                      ]}
                      onPress={() => {
                        setProgramFilter(String(p.id));
                        setFilterModal(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          String(programFilter) === String(p.id) && styles.modalOptionTextSelected,
                        ]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {filterModal === 'barangay' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalOption, !barangayFilter && styles.modalOptionSelected]}
                    onPress={() => {
                      setBarangayFilter('');
                      setFilterModal(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        !barangayFilter && styles.modalOptionTextSelected,
                      ]}
                    >
                      All Barangays
                    </Text>
                  </TouchableOpacity>
                  {barangays.map((b) => {
                    const name = b.barangay_name || b.name;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.modalOption,
                          String(barangayFilter) === String(b.id) && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setBarangayFilter(String(b.id));
                          setFilterModal(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            String(barangayFilter) === String(b.id) &&
                              styles.modalOptionTextSelected,
                          ]}
                        >
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Record Detail Modal */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalCard, darkMode && styles.darkCard]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalye ng Record</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedRecord && (
              <ScrollView style={{ maxHeight: 350 }}>
                {Object.entries(selectedRecord)
                  .filter(([k]) => !['createdAt', 'updatedAt', 'Recipients', 'Transactions'].includes(k))
                  .map(([key, val]) => (
                    <View key={key} style={styles.detailRow}>
                      <Text style={styles.detailKey}>{key.replace(/_/g, ' ')}</Text>
                      <Text style={styles.detailVal}>
                        {typeof val === 'object' && val !== null
                          ? JSON.stringify(val)
                          : String(val || '—')}
                      </Text>
                    </View>
                  ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.closeDetailBtn}
              onPress={() => setSelectedRecord(null)}
            >
              <Text style={styles.closeDetailText}>Isara</Text>
            </TouchableOpacity>
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
  headerTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  headerBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  headerBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#1d4ed8' },
  headerLocation: { fontSize: 10.5, color: '#94a3b8' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
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
  headerDesc: { fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 18 },

  // Filters Card
  filtersCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  filtersHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  filtersIcon: { fontSize: 16, color: '#475569' },
  filtersTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  filtersSubTag: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  filterLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 8, marginBottom: 4 },
  filterSelectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterSelectText: { fontSize: 12.5, color: '#1e293b', fontWeight: '600' },
  filterSelectArrow: { fontSize: 11, color: '#2563eb' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#1e293b',
  },
  dateDivider: { fontSize: 14, color: '#94a3b8' },
  filterActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  applyBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12.5 },
  resetBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  resetBtnText: { color: '#475569', fontWeight: '700', fontSize: 12.5 },

  // KPI Horizontal Scroll
  kpiScroll: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: 140,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
    elevation: 2,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiNumber: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
  kpiTitle: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 2 },
  kpiSubtitle: { fontSize: 9.5, color: '#94a3b8', marginTop: 1 },

  // Dynamic Table Card
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  tableTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  tableSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  tableListWrap: { divideY: 1 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowTitle: { fontSize: 13.5, fontWeight: '700', color: '#1e293b' },
  tableRowMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  tableRowSubMeta: { fontSize: 10.5, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  badgeWrap: { alignItems: 'flex-end', gap: 4, paddingLeft: 8 },
  amountBadge: { fontSize: 13, fontWeight: '800', color: '#15803d' },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeGreenText: { color: '#15803d', fontSize: 10, fontWeight: '800' },
  badgeAmber: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeAmberText: { color: '#b45309', fontSize: 10, fontWeight: '800' },
  badgeBlue: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeBlueText: { color: '#1d4ed8', fontSize: 10, fontWeight: '800' },
  viewRowArrow: { fontSize: 16, color: '#cbd5e1' },

  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pageBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: '#2563eb', fontSize: 11.5, fontWeight: '700' },
  pageInfo: { fontSize: 11.5, color: '#64748b', fontWeight: '600' },

  // Panel Cards
  panelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  panelTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  panelSub: { fontSize: 11, color: '#64748b', marginTop: 1, marginBottom: 10 },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  monthLabel: { fontSize: 12.5, fontWeight: '600', color: '#1e293b' },
  monthVal: { fontSize: 13, fontWeight: '800', color: '#15803d' },

  // Audit Note
  auditNote: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
  },
  auditNoteTitle: { fontSize: 10.5, fontWeight: '800', color: '#1d4ed8', letterSpacing: 0.5 },
  auditNoteBody: { fontSize: 11, color: '#1e40af', marginTop: 3, lineHeight: 16 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '75%',
  },
  detailModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748b', fontWeight: 'bold' },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionSelected: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 6 },
  modalOptionText: { fontSize: 13, color: '#334155' },
  modalOptionTextSelected: { color: '#2563eb', fontWeight: 'bold' },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  detailKey: { width: 110, fontSize: 11.5, color: '#64748b', textTransform: 'capitalize' },
  detailVal: { flex: 1, fontSize: 12, color: '#1e293b', fontWeight: '600' },
  closeDetailBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  closeDetailText: { color: '#ffffff', fontWeight: '700', fontSize: 12.5 },

  loadingBox: { padding: 30, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#64748b' },
  errorBox: { padding: 20, alignItems: 'center' },
  errorText: { color: '#dc2626', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyBox: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
});

export default StaffReportsScreen;

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
} from 'react-native';
import { beneficiaryApi, barangayApi } from '../services/api';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangayId, setSelectedBarangayId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [detailTab, setDetailTab] = useState('profile');
  const [attendanceData, setAttendanceData] = useState(null);
  const [distributionsData, setDistributionsData] = useState(null);
  const [enrollmentsData, setEnrollmentsData] = useState(null);
  const [tabLoading, setTabLoading] = useState(false);

  const CATEGORIES = [
    '4Ps Household Beneficiary',
    'Senior Citizens (Social Pension)',
    'Persons with Disabilities (PWD)',
  ];

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [benefRes, brgyRes] = await Promise.all([
        beneficiaryApi.list(),
        barangayApi.list(),
      ]);
      setBeneficiaries(benefRes.data?.data || []);
      setBarangays(brgyRes.data?.data || []);
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

  const renderProfileTab = () => {
    const b = selectedBeneficiary;
    if (!b) return null;
    const fullName = `${b.first_name || ''} ${b.middle_name || ''} ${b.last_name || ''}`.trim();

    return (
      <ScrollView style={s.tabContent}>
        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Personal Information</Text>
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
            ['RFID Number', b.RFID_number],
            ['Status', b.status],
            ['Approval Date', formatDate(b.approval_date)],
          ].map(([label, value]) => (
            <View key={label} style={s.profileRow}>
              <Text style={s.profileLabel}>{label}</Text>
              <Text style={s.profileValue}>{value || '—'}</Text>
            </View>
          ))}
        </View>

        <View style={s.profileSection}>
          <Text style={s.profileSectionTitle}>Payout Information</Text>
          {[
            ['Preference', b.payout_preference === 'digital' ? '💳 Digital' : '💵 Cash OTC'],
            ['Provider', b.payout_provider],
            ['Account No.', b.payout_account_number ? '••••' + b.payout_account_number.slice(-4) : '—'],
            ['Account Name', b.payout_account_name],
            ['Verification', b.account_verification_status],
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

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Beneficiaries</Text>
          <Text style={s.headerCount}>{filteredBeneficiaries.length} records</Text>
        </View>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={s.filterBtn}>
          <Text style={s.filterIcon}>{showFilters ? '✕' : '⚙'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, barangay, or ID..."
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
          <Text style={s.loadingText}>Loading beneficiaries...</Text>
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
          data={filteredBeneficiaries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBeneficiaryCard}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={s.emptyText}>No beneficiaries found matching your filters.</Text>
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
                <View style={s.approvedBadge}>
                  <Text style={s.approvedText}>✓ APPROVED</Text>
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
});

export default BeneficiaryListScreen;

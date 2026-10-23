import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { barangayApi } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StaffBarangaysScreen({
  onBack,
  onOpenDrawer,
  onNavigate,
  user,
  darkMode = false,
}) {
  const [barangays, setBarangays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isSeniorAdmin = user?.role === 'senior_citizen_admin';
  const isSeniorStaff = user?.role === 'senior_citizen_staff';
  const isAnySenior = isSeniorAdmin || isSeniorStaff;

  const isPwdAdmin = user?.role === 'pwd_admin';
  const isPwdStaff = user?.role === 'pwd_staff';
  const isAnyPwd = isPwdAdmin || isPwdStaff;

  const isMswdoAdmin = user?.role === 'mswdo_admin';
  const isMswdoStaff = user?.role === 'mswdo_staff';
  const isAnyMswdo = isMswdoAdmin || isMswdoStaff;

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await barangayApi.list();
      const list = res?.data?.data || res?.data || [];
      setBarangays(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load barangays:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate totals
  const totals = useMemo(() => {
    return barangays.reduce(
      (acc, b) => ({
        beneficiaries: acc.beneficiaries + (b.total || 0),
        fourPs: acc.fourPs + (b.fourPs || 0),
        senior: acc.senior + (b.senior || 0),
        pwd: acc.pwd + (b.pwd || 0),
        ip: acc.ip + (b.ip || 0),
        nonIp: acc.nonIp + (b.nonIp || 0),
      }),
      { beneficiaries: 0, fourPs: 0, senior: 0, pwd: 0, ip: 0, nonIp: 0 }
    );
  }, [barangays]);

  // Filtered barangays
  const filteredBarangays = useMemo(() => {
    if (!searchQuery.trim()) return barangays;
    const q = searchQuery.toLowerCase().trim();
    return barangays.filter((b) =>
      (b.barangay_name || '').toLowerCase().includes(q)
    );
  }, [barangays, searchQuery]);

  // Header metadata
  const headerMeta = useMemo(() => {
    if (isAnySenior) {
      return {
        badge: 'OSCA JURISDICTION',
        subtitle:
          'Overview of officially registered and approved Senior Citizens (OSCA) across all 36 barangays in Bongabong.',
      };
    }
    if (isAnyPwd) {
      return {
        badge: 'PDAO / PWDO JURISDICTION',
        subtitle:
          'Overview of officially registered and approved Persons with Disabilities (PDAO / PWDO) across all 36 barangays in Bongabong.',
      };
    }
    if (isAnyMswdo) {
      return {
        badge: 'MSWDO JURISDICTION & COVERAGE',
        subtitle:
          'Overview of officially approved beneficiaries across all 36 barangays in Bongabong (4Ps, Senior Citizens, PWDs, and IP classifications).',
      };
    }
    return {
      badge: 'DSWD JURISDICTION & COVERAGE',
      subtitle:
        'Overview of officially approved beneficiaries, 4Ps households, senior citizens, PWDs, and IP classifications across barangays.',
    };
  }, [isAnySenior, isAnyPwd, isAnyMswdo]);

  // Stat cards
  const statCards = useMemo(() => {
    if (isAnySenior) {
      const totalSeniors = totals.senior || totals.beneficiaries;
      return [
        { label: 'Total Barangays', value: barangays.length, icon: '📍', color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Total Senior Citizens', value: totalSeniors, icon: '👥', color: '#2563eb', bg: '#eff6ff' },
        { label: 'IP Senior Citizens', value: totals.ip, icon: '🌐', color: '#059669', bg: '#ecfdf5' },
        { label: 'Non-IP Senior Citizens', value: totals.nonIp, icon: '👤', color: '#475569', bg: '#f8fafc' },
      ];
    }
    if (isAnyPwd) {
      const totalPwds = totals.pwd || totals.beneficiaries;
      return [
        { label: 'Total Barangays', value: barangays.length, icon: '📍', color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Total PWD Beneficiaries', value: totalPwds, icon: '♿', color: '#9333ea', bg: '#faf5ff' },
        { label: 'IP PWD Beneficiaries', value: totals.ip, icon: '🌐', color: '#059669', bg: '#ecfdf5' },
        { label: 'Non-IP PWD Beneficiaries', value: totals.nonIp, icon: '👤', color: '#475569', bg: '#f8fafc' },
      ];
    }
    if (isAnyMswdo) {
      return [
        { label: 'Total Barangays', value: barangays.length, icon: '📍', color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Approved Beneficiaries', value: totals.beneficiaries, icon: '👥', color: '#2563eb', bg: '#eff6ff' },
        { label: 'Senior Citizens', value: totals.senior, icon: '🧓', color: '#e11d48', bg: '#ffe4e6' },
        { label: 'PWD Beneficiaries', value: totals.pwd, icon: '♿', color: '#d97706', bg: '#fef3c7' },
      ];
    }
    return [
      { label: 'Total Barangays', value: barangays.length, icon: '📍', color: '#16a34a', bg: '#f0fdf4' },
      { label: 'Beneficiaries', value: totals.beneficiaries, icon: '👥', color: '#2563eb', bg: '#eff6ff' },
      { label: '4Ps Households', value: totals.fourPs, icon: '🏠', color: '#d97706', bg: '#fef3c7' },
      { label: 'Senior / PWD', value: `${totals.senior} / ${totals.pwd}`, icon: '🤝', color: '#7c3aed', bg: '#f5f3ff' },
    ];
  }, [isAnySenior, isAnyPwd, isAnyMswdo, barangays.length, totals]);

  return (
    <View style={[styles.screen, darkMode && styles.darkScreen]}>
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor={darkMode ? '#0f172a' : '#ffffff'}
      />

      {/* Top Header Bar */}
      <View style={[styles.topBar, darkMode && styles.darkTopBar]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            onPress={onOpenDrawer}
            style={[styles.menuBtn, darkMode && styles.darkMenuBtn]}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuIcon, darkMode && styles.darkMenuIcon]}>☰</Text>
          </TouchableOpacity>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={[styles.backBtn, darkMode && styles.darkBackBtn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.backIcon, darkMode && styles.darkText]}>‹ Back</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.topBarTitleWrap}>
          <Text style={[styles.topBarTitle, darkMode && styles.darkTopBarTitle]}>
            Barangays
          </Text>
          <Text style={[styles.topBarSubtitle, darkMode && styles.darkTopBarSubtitle]}>
            BONGABONG DIRECTORY
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => loadData(true)}
          style={[styles.refreshIconBtn, darkMode && styles.darkRefreshIconBtn]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16 }}>{refreshing ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
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
        {/* Banner Card */}
        <View style={[styles.bannerCard, darkMode && styles.darkCard]}>
          <View style={styles.bannerBadgeWrap}>
            <Text style={styles.bannerBadge}>{headerMeta.badge}</Text>
          </View>
          <Text style={[styles.bannerTitle, darkMode && styles.darkTitle]}>
            Barangay Directory & Stats
          </Text>
          <Text style={[styles.bannerSub, darkMode && styles.darkSubtext]}>
            {headerMeta.subtitle}
          </Text>
        </View>

        {/* Stat Cards Grid */}
        <View style={styles.statsGrid}>
          {statCards.map((c, idx) => (
            <View
              key={idx}
              style={[
                styles.statCard,
                darkMode && styles.darkCard,
                { borderLeftColor: c.color, borderLeftWidth: 3 },
              ]}
            >
              <View style={[styles.statIconWrap, { backgroundColor: c.bg }]}>
                <Text style={styles.statEmoji}>{c.icon}</Text>
              </View>
              <Text style={[styles.statValue, darkMode && styles.darkTitle, { color: c.color }]}>
                {c.value}
              </Text>
              <Text style={[styles.statLabel, darkMode && styles.darkSubtext]} numberOfLines={1}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, darkMode && styles.darkCard]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, darkMode && styles.darkText]}
            placeholder="Search barangay name..."
            placeholderTextColor={darkMode ? '#94a3b8' : '#94a3b8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Barangay List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, darkMode && styles.darkTitle]}>
            Barangays List ({filteredBarangays.length})
          </Text>
          <Text style={[styles.sectionSubtitle, darkMode && styles.darkSubtext]}>
            Bongabong, Oriental Mindoro
          </Text>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={[styles.loaderText, darkMode && styles.darkSubtext]}>
              Loading barangay directory...
            </Text>
          </View>
        ) : filteredBarangays.length === 0 ? (
          <View style={[styles.emptyCard, darkMode && styles.darkCard]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
            <Text style={[styles.emptyTitle, darkMode && styles.darkTitle]}>No Barangays Found</Text>
            <Text style={[styles.emptySub, darkMode && styles.darkSubtext]}>
              {searchQuery ? `No results matching "${searchQuery}"` : 'No barangays recorded yet.'}
            </Text>
          </View>
        ) : (
          filteredBarangays.map((b) => {
            const seniorCount = (b.senior !== undefined && b.senior !== null ? b.senior : b.total) || 0;
            const pwdCount = (b.pwd !== undefined && b.pwd !== null ? b.pwd : b.total) || 0;
            const totalCount = b.total || 0;

            return (
              <View key={b.id || b.barangay_name} style={[styles.barangayCard, darkMode && styles.darkCard]}>
                <View style={styles.barangayCardHeader}>
                  <View style={styles.barangayNameWrap}>
                    <Text style={styles.barangayPin}>📍</Text>
                    <Text style={[styles.barangayName, darkMode && styles.darkTitle]}>
                      {b.barangay_name}
                    </Text>
                  </View>
                  <View style={styles.badgeJurisdiction}>
                    <Text style={styles.badgeJurisdictionText}>Bongabong</Text>
                  </View>
                </View>

                {/* Scope-specific counts */}
                {isAnySenior ? (
                  <View style={styles.chipsRow}>
                    <View style={[styles.chip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                      <Text style={[styles.chipText, { color: '#1d4ed8' }]}>
                        🧓 Senior: <Text style={{ fontWeight: '700' }}>{seniorCount}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[styles.chipText, { color: '#047857' }]}>
                        🌐 IP: <Text style={{ fontWeight: '700' }}>{b.ip || 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                      <Text style={[styles.chipText, { color: '#475569' }]}>
                        Non-IP: <Text style={{ fontWeight: '700' }}>{b.nonIp || 0}</Text>
                      </Text>
                    </View>
                  </View>
                ) : isAnyPwd ? (
                  <View style={styles.chipsRow}>
                    <View style={[styles.chip, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                      <Text style={[styles.chipText, { color: '#7e22ce' }]}>
                        ♿ PWD: <Text style={{ fontWeight: '700' }}>{pwdCount}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[styles.chipText, { color: '#047857' }]}>
                        🌐 IP: <Text style={{ fontWeight: '700' }}>{b.ip || 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                      <Text style={[styles.chipText, { color: '#475569' }]}>
                        Non-IP: <Text style={{ fontWeight: '700' }}>{b.nonIp || 0}</Text>
                      </Text>
                    </View>
                  </View>
                ) : isAnyMswdo ? (
                  <View style={styles.chipsRow}>
                    <View style={[styles.chip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                      <Text style={[styles.chipText, { color: '#1d4ed8' }]}>
                        👥 Total: <Text style={{ fontWeight: '700' }}>{totalCount}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}>
                      <Text style={[styles.chipText, { color: '#be123c' }]}>
                        Senior: <Text style={{ fontWeight: '700' }}>{b.senior || 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                      <Text style={[styles.chipText, { color: '#b45309' }]}>
                        PWD: <Text style={{ fontWeight: '700' }}>{b.pwd || 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                      <Text style={[styles.chipText, { color: '#047857' }]}>
                        IP: <Text style={{ fontWeight: '700' }}>{b.ip || 0}</Text>
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.chipsRow}>
                    <View style={[styles.chip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                      <Text style={[styles.chipText, { color: '#1d4ed8' }]}>
                        👥 Total: <Text style={{ fontWeight: '700' }}>{totalCount}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                      <Text style={[styles.chipText, { color: '#b45309' }]}>
                        4Ps: <Text style={{ fontWeight: '700' }}>{b.fourPs || 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}>
                      <Text style={[styles.chipText, { color: '#be123c' }]}>
                        Senior: <Text style={{ fontWeight: '700' }}>{b.senior || 0}</Text>
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                      <Text style={[styles.chipText, { color: '#7e22ce' }]}>
                        PWD: <Text style={{ fontWeight: '700' }}>{b.pwd || 0}</Text>
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  darkScreen: {
    backgroundColor: '#0b1120',
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
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  darkTopBar: {
    backgroundColor: '#0f172a',
    borderBottomColor: '#1e293b',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  darkMenuBtn: {
    backgroundColor: '#1e293b',
  },
  menuIcon: {
    fontSize: 18,
    color: '#334155',
  },
  darkMenuIcon: {
    color: '#cbd5e1',
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  darkBackBtn: {
    backgroundColor: '#1e293b',
  },
  backIcon: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  topBarTitleWrap: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  darkTopBarTitle: {
    color: '#f8fafc',
  },
  topBarSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.8,
  },
  darkTopBarSubtitle: {
    color: '#60a5fa',
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  darkRefreshIconBtn: {
    backgroundColor: '#1e293b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  darkCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  darkTitle: {
    color: '#f8fafc',
  },
  darkSubtext: {
    color: '#94a3b8',
  },
  darkText: {
    color: '#f8fafc',
  },
  bannerBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  bannerBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statEmoji: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  barangayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  barangayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barangayNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  barangayPin: {
    fontSize: 14,
  },
  barangayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  badgeJurisdiction: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeJurisdictionText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
  },
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});


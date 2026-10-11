import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { reportsApi, dashboardApi } from '../services/api';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const StaffReportsScreen = ({ onBack, onOpenDrawer, user, darkMode = false }) => {
  const [summary, setSummary] = useState(null);
  const [monthlyDist, setMonthlyDist] = useState([]);
  const [progDist, setProgDist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      setError('');
      const [sumRes, monthlyRes, progRes] = await Promise.allSettled([
        reportsApi.summary(),
        reportsApi.monthlyDistribution(),
        reportsApi.beneficiariesByProgram(),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data?.data || sumRes.value.data);
      if (monthlyRes.status === 'fulfilled') setMonthlyDist(monthlyRes.value.data?.data || monthlyRes.value.data || []);
      if (progRes.status === 'fulfilled') setProgDist(progRes.value.data?.data || progRes.value.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const totalBeneficiaries = summary?.totalBeneficiaries || summary?.beneficiariesCount || 0;
  const totalDisbursed = summary?.totalDisbursed || summary?.total_amount_distributed || summary?.totalFunds || 0;
  const activePrograms = summary?.activePrograms || summary?.programsCount || 0;
  const pendingRequests = summary?.pendingAssistanceRequests || summary?.pendingRequests || 0;

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
            <Text style={[styles.headerTitle, darkMode && styles.darkText]}>Reports & Analytics</Text>
            <Text style={styles.headerSub}>Executive welfare & financial metrics</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadReports} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Generating municipal reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadReports} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        >
          {/* Executive Overview Cards */}
          <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>Executive Summary</Text>
          <View style={styles.metricGrid}>
            <View style={[styles.metricCard, { borderLeftColor: '#2563eb' }, darkMode && styles.darkCard]}>
              <Text style={styles.metricLabel}>Total Beneficiaries</Text>
              <Text style={[styles.metricVal, { color: '#2563eb' }]}>{totalBeneficiaries.toLocaleString()}</Text>
              <Text style={styles.metricMeta}>Registered in Masterlist</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#16a34a' }, darkMode && styles.darkCard]}>
              <Text style={styles.metricLabel}>Total Disbursed Aid</Text>
              <Text style={[styles.metricVal, { color: '#16a34a' }]}>{formatMoney(totalDisbursed)}</Text>
              <Text style={styles.metricMeta}>Cash & Digital Payouts</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#7c3aed' }, darkMode && styles.darkCard]}>
              <Text style={styles.metricLabel}>Active Programs</Text>
              <Text style={[styles.metricVal, { color: '#7c3aed' }]}>{activePrograms}</Text>
              <Text style={styles.metricMeta}>Operational Initiatives</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#ea580c' }, darkMode && styles.darkCard]}>
              <Text style={styles.metricLabel}>Pending Requests</Text>
              <Text style={[styles.metricVal, { color: '#ea580c' }]}>{pendingRequests}</Text>
              <Text style={styles.metricMeta}>Awaiting Action</Text>
            </View>
          </View>

          {/* Program Distribution Breakdown */}
          <View style={[styles.panelCard, darkMode && styles.darkCard]}>
            <Text style={[styles.panelTitle, darkMode && styles.darkText]}>Program Enrollment Breakdown</Text>
            <Text style={styles.panelSub}>Beneficiaries currently receiving aid per program</Text>

            {progDist.length === 0 ? (
              <Text style={styles.emptyText}>No program enrollment distribution data available.</Text>
            ) : (
              progDist.map((prog, idx) => {
                const count = Number(prog.beneficiary_count || prog.count || prog.enrolled_count || 0);
                const percent = totalBeneficiaries > 0 ? Math.min(100, Math.round((count / totalBeneficiaries) * 100)) : 0;
                return (
                  <View key={prog.program_id || prog.id || idx} style={styles.progItem}>
                    <View style={styles.progHeaderRow}>
                      <Text style={[styles.progItemName, darkMode && styles.darkText]}>
                        {prog.program_name || prog.name || 'Benefit Program'}
                      </Text>
                      <Text style={styles.progItemCount}>{count} ({percent}%)</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.max(6, percent)}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Monthly Aid Disbursement Trend */}
          <View style={[styles.panelCard, darkMode && styles.darkCard]}>
            <Text style={[styles.panelTitle, darkMode && styles.darkText]}>Monthly Disbursement Summary</Text>
            <Text style={styles.panelSub}>Financial aid released across recent operational cycles</Text>

            {monthlyDist.length === 0 ? (
              <Text style={styles.emptyText}>No historical monthly distribution data found.</Text>
            ) : (
              monthlyDist.slice(0, 6).map((m, idx) => (
                <View key={idx} style={styles.monthlyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.monthLabel, darkMode && styles.darkText]}>
                      {m.month || m.month_name || `Cycle ${idx + 1}`}
                    </Text>
                    <Text style={styles.monthSub}>{m.transaction_count || m.count || 0} claims processed</Text>
                  </View>
                  <Text style={styles.monthAmount}>
                    {formatMoney(m.total_amount || m.amount || 0)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Compliance & Audit Footer Note */}
          <View style={styles.auditNote}>
            <Text style={styles.auditNoteTitle}>🛡 OFFICIAL DSWD / MSWDO COMPLIANCE REPORT</Text>
            <Text style={styles.auditNoteBody}>
              All payout records, RFID attendance stamps, and biometric logs are synchronized in real-time with municipal audit trails.
            </Text>
          </View>
        </ScrollView>
      )}
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
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  darkCard: { backgroundColor: '#1e293b', borderColor: '#334155' },
  metricLabel: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  metricVal: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  metricMeta: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  panelCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  panelTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  panelSub: { fontSize: 11.5, color: '#64748b', marginTop: 2, marginBottom: 14 },
  emptyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 12 },
  progItem: { marginBottom: 12 },
  progHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progItemName: { fontSize: 12.5, fontWeight: '600', color: '#1e293b', flex: 1, marginRight: 8 },
  progItemCount: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  progressBarBg: { height: 7, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
  monthlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  monthLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  monthSub: { fontSize: 11, color: '#64748b' },
  monthAmount: { fontSize: 14, fontWeight: '800', color: '#16a34a' },
  auditNote: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  auditNoteTitle: { fontSize: 10.5, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
  auditNoteBody: { fontSize: 11.5, color: '#475569', marginTop: 4, lineHeight: 17 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#64748b' },
  errorBox: { padding: 30, alignItems: 'center' },
  errorText: { color: '#ef4444', textAlign: 'center', marginBottom: 12 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});

export default StaffReportsScreen;

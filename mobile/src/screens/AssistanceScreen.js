import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  beneficiaryApi,
  medicalAssistanceApi,
  assistanceRequestApi,
  distributionApi,
} from '../services/api';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function AssistanceScreen({ onBack, onRequestNew, user, profile }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [beneficiary, setBeneficiary] = useState(null);
  const [assistanceApplications, setAssistanceApplications] = useState([]);
  const [portalRequests, setPortalRequests] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // all | pending | approved | completed
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState(new Set());

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [benRes, assistRes, portalRes] = await Promise.all([
        beneficiaryApi.getMe().catch(() => ({ data: { data: null } })),
        medicalAssistanceApi.getMyApplications().catch(() => ({ data: { data: [] } })),
        assistanceRequestApi.list().catch(() => ({ data: { data: [] } })),
      ]);

      setBeneficiary(benRes.data?.data || null);
      setAssistanceApplications(assistRes.data?.data || []);
      setPortalRequests(portalRes.data?.data || []);
    } catch (err) {
      console.warn('Assistance screen load error:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledge = (transactionId) => {
    Alert.alert(
      'Kumpirmahin ang Payout',
      'Sigurado ka ba na natanggap mo na ang digital payout sa iyong account?\n\nIto ay magsisilbing opisyal na digital resibo para sa DSWD.',
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Oo, Natanggap Ko Na',
          style: 'default',
          onPress: async () => {
            setAcknowledgingId(transactionId);
            try {
              const res = await distributionApi.acknowledgePayout(transactionId);
              if (res.data?.success) {
                setAcknowledgedIds((prev) => new Set(prev).add(transactionId));
                Alert.alert('Salamat!', 'Matagumpay mong nakumpirma ang pagtanggap ng iyong payout.');
                loadData(true);
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || err.message);
            } finally {
              setAcknowledgingId(null);
            }
          },
        },
      ]
    );
  };

  const activeBen = beneficiary || profile || {};
  const transactions = activeBen?.DistributionTransactions || [];
  const releasedDistributions = transactions.filter((t) => t.status === 'released' || t.status === 'completed');
  const pendingDistributions = transactions.filter((t) => t.status === 'pending');

  const totalReceived = releasedDistributions.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0),
    0
  );
  const totalPending = pendingDistributions.reduce(
    (sum, t) => sum + parseFloat(t.amount || 0) + parseFloat(t.retro_amount || 0),
    0
  );

  // Released / Approved assistance amounts for stat cards
  const releasedAssistance = assistanceApplications.filter((a) => a.status === 'Released');
  const approvedAssistance = assistanceApplications.filter((a) => a.status === 'Approved');
  const approvedPortalRequests = portalRequests.filter((r) => r.status === 'Approved');

  // Real total received = distributions released + assistance released
  const totalReceivedReal =
    totalReceived +
    releasedAssistance.reduce((sum, a) => sum + parseFloat(a.approved_amount || a.total_amount_requested || 0), 0);

  // Real pending/approved = pending distributions + approved assistance not yet released
  const totalPendingReal =
    totalPending +
    approvedAssistance.reduce((sum, a) => sum + parseFloat(a.approved_amount || a.total_amount_requested || 0), 0);

  // Enrollments (active program enrollments)
  const enrollments = activeBen?.Enrollments || [];
  const regularProgramCount = enrollments.length;

  // Special assistance = all unique assistance requests + medical applications
  const dedupedMedical = assistanceApplications.filter(
    (a) => !portalRequests.some((r) => r.subject?.includes(a.application_number))
  );
  const specialAssistanceCount = portalRequests.length + dedupedMedical.length;
  const totalProgramsGrants = regularProgramCount + specialAssistanceCount;

  // Disbursements = released distributions + released assistance + completed portal requests
  const totalDisbursements =
    releasedDistributions.length +
    releasedAssistance.length +
    portalRequests.filter((r) => r.status === 'Completed').length;

  // Approved grant count for subtext
  const approvedGrantsCount = approvedAssistance.length + approvedPortalRequests.length;

  // Combine items
  const allItems = [
    ...transactions.map((t) => ({
      ...t,
      itemType: 'distribution',
      title: t.Event?.title || t.Event?.Program?.name || 'Municipal Distribution Payout',
      date: t.release_date || t.Event?.distribution_date || t.created_at,
      status: t.status === 'released' ? 'Completed' : t.status,
      amount: t.amount,
      agency: t.Event?.agency || 'DSWD / MSWDO',
    })),
    ...portalRequests.map((r) => ({
      ...r,
      itemType: 'request',
      title: r.subject || r.type || 'Assistance Request',
      date: r.created_at,
      status: r.status || 'Pending',
      amount: r.amount_requested,
      agency: r.agency || 'MSWDO',
    })),
    ...dedupedMedical.map((a) => ({
      ...a,
      itemType: 'medical',
      title: a.category || 'Medical Support Grant',
      date: a.created_at,
      status: a.status === 'Released' ? 'Completed' : a.status || 'Pending',
      amount: a.approved_amount || a.total_amount_requested,
      agency: 'DSWD',
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Count by statuses for filter pills
  const pendingCount = allItems.filter((i) => ['pending', 'under review', 'sinusuri'].includes((i.status || '').toLowerCase())).length;
  const approvedCount = allItems.filter((i) => ['approved', 'na-aprubahan'].includes((i.status || '').toLowerCase())).length;
  const completedCount = allItems.filter((i) => ['completed', 'released', 'naipamahagi'].includes((i.status || '').toLowerCase())).length;

  const filteredItems = allItems.filter((item) => {
    const st = (item.status || '').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pending') return ['pending', 'under review', 'sinusuri'].includes(st);
    if (activeFilter === 'approved') return ['approved', 'na-aprubahan'].includes(st);
    if (activeFilter === 'completed') return ['completed', 'released', 'naipamahagi'].includes(st);
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>My Benefits Overview</Text>
        <TouchableOpacity onPress={() => loadData(true)} style={styles.refreshIconBtn} activeOpacity={0.7}>
          <Text style={styles.refreshIconText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#1d4ed8']} />
        }
      >
        {/* Main Blue Banner (Image 3 Header) */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBox}>
              <Text style={{ fontSize: 24 }}>📦</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.heroTitle}>My Benefits Overview</Text>
              <Text style={styles.heroSubtitle}>
                View your released and approved assistance payouts, claimed benefit history, and active program enrollments.
              </Text>
            </View>
          </View>
          <View style={styles.heroActionRow}>
            <TouchableOpacity onPress={onRequestNew} style={styles.requestBannerBtn} activeOpacity={0.8}>
              <Text style={styles.requestBannerBtnText}>+ Request Assistance</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 Colored Stat Cards Grid (Image 3) */}
        <View style={styles.statCardsGrid}>
          {/* Card 1: Total Received (Green) */}
          <View style={[styles.coloredStatCard, { backgroundColor: '#10b981' }]}>
            <Text style={styles.coloredStatTitle}>💰 Total Received</Text>
            <Text style={styles.coloredStatValue}>{formatMoney(totalReceivedReal)}</Text>
            <Text style={styles.coloredStatSub}>
              {releasedDistributions.length} dist. • {releasedAssistance.length} grant(s) released
            </Text>
          </View>

          {/* Card 2: Pending / Approved (Blue) */}
          <View style={[styles.coloredStatCard, { backgroundColor: '#2563eb' }]}>
            <Text style={styles.coloredStatTitle}>🕒 Pending / Approved</Text>
            <Text style={styles.coloredStatValue}>{formatMoney(totalPendingReal)}</Text>
            <Text style={styles.coloredStatSub}>
              {pendingDistributions.length} dist. • {approvedGrantsCount} approved grant(s)
            </Text>
          </View>

          {/* Card 3: Programs & Grants (Purple) */}
          <View style={[styles.coloredStatCard, { backgroundColor: '#8b5cf6' }]}>
            <Text style={styles.coloredStatTitle}>📦 Programs & Grants</Text>
            <Text style={styles.coloredStatValue}>{totalProgramsGrants}</Text>
            <Text style={styles.coloredStatSub}>
              {regularProgramCount} program(s) • {specialAssistanceCount} request(s)
            </Text>
          </View>

          {/* Card 4: Disbursements (Orange) */}
          <View style={[styles.coloredStatCard, { backgroundColor: '#ea580c' }]}>
            <Text style={styles.coloredStatTitle}>📈 Disbursements</Text>
            <Text style={styles.coloredStatValue}>{totalDisbursements}</Text>
            <Text style={styles.coloredStatSub}>Total claims received</Text>
          </View>
        </View>

        {/* Tracking Section Header Card (Image 3) */}
        <View style={styles.trackingHeaderCard}>
          <View style={styles.trackingTopRow}>
            <View style={styles.heartIconBox}>
              <Text style={{ fontSize: 20 }}>🤝</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.trackingTitle}>Subaybayan ang Nirequest na Ayuda at Grants</Text>
              <Text style={styles.trackingSub}>
                Direktang pagsubaybay sa katayuan ng iyong mga nirequest na tulong (Educational, Medical, Financial, Burial, Ospital) mula sa DSWD at MSWDO.
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onRequestNew} style={styles.applyBtn} activeOpacity={0.8}>
            <Text style={styles.applyBtnText}>+ Mag-apply ng Ayuda</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs (Image 3) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
                Lahat ({allItems.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'pending' && styles.filterPillActive]}
              onPress={() => setActiveFilter('pending')}
            >
              <Text style={[styles.filterPillText, activeFilter === 'pending' && styles.filterPillTextActive]}>
                ⏳ Sinusuri / Pending ({pendingCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'approved' && styles.filterPillActive]}
              onPress={() => setActiveFilter('approved')}
            >
              <Text style={[styles.filterPillText, activeFilter === 'approved' && styles.filterPillTextActive]}>
                ✓ Na-aprubahan ({approvedCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, activeFilter === 'completed' && styles.filterPillActive]}
              onPress={() => setActiveFilter('completed')}
            >
              <Text style={[styles.filterPillText, activeFilter === 'completed' && styles.filterPillTextActive]}>
                🎉 Naipamahagi / Natapos ({completedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* List Content */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Ikinakarga ang impormasyon sa ayuda...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🤲</Text>
            <Text style={styles.emptyTitle}>Wala pang Naisumiteng Kahilingan sa Ayuda</Text>
            <Text style={styles.emptySub}>
              Kung may emergency o pangangailangan sa medikal, burial, o educational assistance, i-click ang "+ Mag-apply ng Ayuda" sa itaas.
            </Text>
          </View>
        ) : (
          filteredItems.map((item, idx) => {
            const st = (item.status || 'Pending').toLowerCase();
            const isCompleted = ['completed', 'released', 'naipamahagi'].includes(st);
            const isApproved = ['approved', 'na-aprubahan'].includes(st);
            const needsAck =
              item.itemType === 'distribution' &&
              (item.disbursement_type === 'digital' || item.payout_reference_number) &&
              !item.beneficiary_acknowledged_at &&
              !acknowledgedIds.has(item.id);

            return (
              <View key={item.id || idx} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemTypeBadge}>
                    <Text style={styles.itemTypeBadgeText}>{item.agency || 'DSWD'}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isCompleted && styles.statusBadgeCompleted,
                      isApproved && styles.statusBadgeApproved,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isCompleted && styles.statusTextCompleted,
                        isApproved && styles.statusTextApproved,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                  <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
                </View>

                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {item.amount ? (
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Halaga ng Ayuda:</Text>
                    <Text style={styles.amountVal}>{formatMoney(item.amount)}</Text>
                  </View>
                ) : null}

                {needsAck && (
                  <TouchableOpacity
                    onPress={() => handleAcknowledge(item.id)}
                    style={styles.ackBtn}
                    disabled={acknowledgingId === item.id}
                  >
                    {acknowledgingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.ackBtnText}>✓ Kumpirmahin ang Natanggap na Payout</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  navBar: {
    height: 52,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  backBtnText: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 13,
  },
  navTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  // Main Blue Banner (Image 3 Header)
  heroBanner: {
    backgroundColor: '#162850',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#162850',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 24,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 4,
    lineHeight: 16,
  },
  heroActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  requestBannerBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  requestBannerBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  // 4 Colored Stat Cards Grid (Image 3)
  statCardsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  coloredStatCard: {
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  coloredStatTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  coloredStatValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  coloredStatSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  // Tracking Header Card (Image 3)
  trackingHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trackingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  heartIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
  },
  trackingSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  applyBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  // Filter tabs
  filterScrollView: {
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filterPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  // Item Cards
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  itemTypeBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemTypeBadgeText: {
    color: '#1d4ed8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeApproved: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#b45309',
  },
  statusTextCompleted: {
    color: '#15803d',
  },
  statusTextApproved: {
    color: '#1d4ed8',
  },
  itemDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  amountLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  amountVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16a34a',
  },
  ackBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  ackBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
});

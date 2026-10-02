import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function PendingApprovalScreen({
  profile,
  loading,
  error,
  onRefresh,
  onLogout,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const status = profile?.status || '';
  const isRejected = status.toLowerCase() === 'rejected';

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  };

  const title = error && !profile
    ? 'Unable to Check Application'
    : isRejected ? 'Application Needs Attention' : 'Application Pending';
  const description = error && !profile
    ? 'Hindi makuha ang application status ngayon. I-refresh kapag may internet connection na.'
    : isRejected
    ? 'Hindi naaprubahan ang application mo. Tingnan ang dahilan sa ibaba at makipag-ugnayan sa inyong barangay o social worker para sa susunod na hakbang.'
    : 'Natanggap na ang application mo at sinusuri ito ng admin. Awtomatikong bubukas ang beneficiary dashboard kapag naaprubahan na.';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, isRejected && styles.rejectedIconWrap]}>
            <Text style={styles.icon}>{isRejected ? '!' : '…'}</Text>
          </View>
          <Text style={styles.eyebrow}>BENIAID BENEFICIARY PORTAL</Text>
          <Text style={styles.title}>{loading ? 'Checking application…' : title}</Text>
          <Text style={styles.name}>
            {profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1d4ed8" style={styles.loader} />
          ) : (
            <>
              <View style={[styles.statusPill, isRejected && styles.rejectedPill]}>
                <Text style={[styles.statusText, isRejected && styles.rejectedText]}>
                  {status || (error ? 'Status unavailable' : 'Awaiting status')}
                </Text>
              </View>
              <Text style={styles.description}>{description}</Text>

              {isRejected && profile.rejection_reason ? (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Dahilan</Text>
                  <Text style={styles.reasonText}>{profile.rejection_reason}</Text>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.refreshButton} onPress={refresh} disabled={refreshing}>
                {refreshing ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.refreshText}>Refresh application status</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff4fb' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#dbe5f1', elevation: 3 },
  iconWrap: { width: 68, height: 68, borderRadius: 22, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  rejectedIconWrap: { backgroundColor: '#fee2e2' },
  icon: { color: '#1d4ed8', fontSize: 38, fontWeight: '900' },
  eyebrow: { color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  name: { color: '#334155', fontSize: 14, fontWeight: '700', marginTop: 6 },
  statusPill: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 18 },
  rejectedPill: { backgroundColor: '#fee2e2' },
  statusText: { color: '#92400e', fontSize: 12, fontWeight: '800' },
  rejectedText: { color: '#b91c1c' },
  description: { color: '#475569', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 18 },
  reasonBox: { width: '100%', backgroundColor: '#fff7f7', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 13, marginTop: 16 },
  reasonLabel: { color: '#991b1b', fontSize: 11, fontWeight: '900', marginBottom: 5 },
  reasonText: { color: '#7f1d1d', fontSize: 13, lineHeight: 19 },
  errorText: { color: '#b91c1c', fontSize: 12, textAlign: 'center', marginTop: 12 },
  loader: { marginTop: 24, marginBottom: 8 },
  primaryButton: { backgroundColor: '#1d4ed8', borderRadius: 12, width: '100%', alignItems: 'center', paddingVertical: 14, marginTop: 20 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  refreshButton: { borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, width: '100%', alignItems: 'center', paddingVertical: 13, marginTop: 10 },
  refreshText: { color: '#1d4ed8', fontSize: 13, fontWeight: '800' },
  logoutButton: { paddingVertical: 14, paddingHorizontal: 20, marginTop: 8 },
  logoutText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
});

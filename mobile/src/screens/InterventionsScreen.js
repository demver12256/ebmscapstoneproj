import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { interventionApi } from '../services/api';

const peso = (value) => `\u20B1${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatDate = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const blankForm = () => ({
  agency_name: '',
  assistance_type: '',
  amount: '',
  date_received: new Date().toISOString().slice(0, 10),
  description: '',
});

export default function InterventionsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [submitting, setSubmitting] = useState(false);

  const loadInterventions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await interventionApi.listMine();
      setItems(response?.data?.data || []);
    } catch (error) {
      Alert.alert('Unable to load', error?.response?.data?.message || 'Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInterventions();
  }, [loadInterventions]);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.agency_name.trim() || !form.assistance_type.trim() || !form.date_received.trim()) {
      Alert.alert('Required fields', 'Agency, assistance type, and date received are required.');
      return;
    }
    try {
      setSubmitting(true);
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      await interventionApi.submit(payload);
      Alert.alert('Submitted', 'Your intervention report is waiting for staff verification.');
      setForm(blankForm());
      setShowForm(false);
      await loadInterventions();
    } catch (error) {
      Alert.alert('Submission failed', error?.response?.data?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (item) => {
    Alert.alert('Delete report?', 'This intervention report will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await interventionApi.remove(item.id);
            setItems((current) => current.filter((entry) => entry.id !== item.id));
          } catch (error) {
            Alert.alert('Unable to delete', error?.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Interventions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadInterventions(true)} colors={['#2563eb']} />}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}><Text style={styles.introIconText}>♥</Text></View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Intervention / Ibang Tulong</Text>
            <Text style={styles.introText}>I-report ang tulong mula sa ibang ahensya para maitala at ma-verify ng DSWD staff.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.newButton} onPress={() => setShowForm((value) => !value)}>
          <Text style={styles.newButtonText}>{showForm ? 'Close form' : '+ Report New Assistance'}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Report received assistance</Text>
            <Text style={styles.label}>Agency name *</Text>
            <TextInput style={styles.input} value={form.agency_name} onChangeText={(value) => updateField('agency_name', value)} placeholder="PCSO, PhilHealth, LGU, NGO" />
            <Text style={styles.label}>Assistance type *</Text>
            <TextInput style={styles.input} value={form.assistance_type} onChangeText={(value) => updateField('assistance_type', value)} placeholder="Medical, burial, food, etc." />
            <Text style={styles.label}>Date received (YYYY-MM-DD) *</Text>
            <TextInput style={styles.input} value={form.date_received} onChangeText={(value) => updateField('date_received', value)} placeholder="2026-10-01" />
            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} value={form.amount} onChangeText={(value) => updateField('amount', value)} placeholder="0.00" keyboardType="decimal-pad" />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(value) => updateField('description', value)} placeholder="Add details" multiline />
            <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit for Verification</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.muted}>Loading interventions...</Text></View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♥</Text>
            <Text style={styles.emptyTitle}>No Interventions Yet</Text>
            <Text style={styles.muted}>May natanggap ka bang tulong mula sa ibang ahensya? I-report ito dito.</Text>
          </View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.agency}>{item.agency_name}</Text>
              <Text style={[styles.status, item.status === 'Verified' ? styles.verified : item.status === 'Rejected' ? styles.rejected : styles.pending]}>{item.status}</Text>
            </View>
            <Text style={styles.itemType}>{item.assistance_type}</Text>
            <Text style={styles.itemDate}>Received {formatDate(item.date_received)}</Text>
            {item.amount ? <Text style={styles.amount}>{peso(item.amount)}</Text> : null}
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            {item.status !== 'Verified' && <TouchableOpacity onPress={() => remove(item)}><Text style={styles.deleteText}>Delete report</Text></TouchableOpacity>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { height: 56, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: '#93c5fd', fontWeight: '700', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSpacer: { width: 62 },
  content: { padding: 16, paddingBottom: 110 },
  introCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 16, borderWidth: 1, borderColor: '#c7d2fe', padding: 16, marginBottom: 12 },
  introIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  introIconText: { color: '#4338ca', fontSize: 24, fontWeight: '800' },
  introCopy: { flex: 1 },
  introTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  introText: { color: '#475569', fontSize: 12, lineHeight: 17, marginTop: 4 },
  newButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  newButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  formTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  label: { color: '#475569', fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 10, color: '#0f172a', fontSize: 13 },
  multiline: { minHeight: 74, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#2563eb', borderRadius: 9, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  center: { alignItems: 'center', paddingVertical: 40 },
  muted: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 28, alignItems: 'center', marginTop: 6 },
  emptyIcon: { color: '#6366f1', fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  itemCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  agency: { color: '#1d4ed8', fontSize: 13, fontWeight: '800', flex: 1 },
  status: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  pending: { color: '#b45309', backgroundColor: '#fef3c7' },
  verified: { color: '#15803d', backgroundColor: '#dcfce7' },
  rejected: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  itemType: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  itemDate: { color: '#64748b', fontSize: 11, marginTop: 4 },
  amount: { color: '#15803d', fontSize: 14, fontWeight: '800', marginTop: 8 },
  description: { color: '#475569', fontSize: 12, lineHeight: 18, marginTop: 8 },
  deleteText: { color: '#dc2626', fontSize: 12, fontWeight: '700', marginTop: 12 },
});

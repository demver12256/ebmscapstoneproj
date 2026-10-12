import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import DocumentPicker from 'react-native-document-picker';
import { API_URL } from '../config/api';
import { interventionApi } from '../services/api';

const FILES_BASE_URL = API_URL.replace(/\/api\/?$/, '');

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

const resolveFileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${FILES_BASE_URL}/${path.replace(/^\/+/, '')}`;
};

const isImageFile = (path) => {
  if (!path) return false;
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(path);
};

const blankForm = () => ({
  agency_name: '',
  assistance_type: '',
  amount: '',
  date_received: new Date().toISOString().slice(0, 10),
  description: '',
  proof_document: null,
});

export default function InterventionsScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const pickProofDocument = async () => {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });
      setForm((current) => ({ ...current, proof_document: file }));
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Unable to attach file', 'Please choose a PDF, JPG, PNG, or WEBP file up to 10MB.');
      }
    }
  };

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
      Object.entries(form).forEach(([key, value]) => {
        if (key !== 'proof_document' && value !== null && value !== undefined) {
          payload.append(key, value);
        }
      });
      if (form.proof_document) {
        payload.append('proof_document', {
          uri: form.proof_document.fileCopyUri || form.proof_document.uri,
          type: form.proof_document.type || 'application/octet-stream',
          name: form.proof_document.name || 'intervention-document',
        });
      }
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
            <Text style={styles.label}>Proof document</Text>
            <TouchableOpacity style={styles.fileButton} onPress={pickProofDocument}>
              <Text style={styles.fileButtonText}>{form.proof_document ? 'Change attached file' : 'Attach file'}</Text>
            </TouchableOpacity>
            {form.proof_document ? <Text style={styles.fileName}>{form.proof_document.name}</Text> : <Text style={styles.fileHint}>PDF, JPG, PNG, or WEBP • up to 10MB</Text>}
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
            {item.proof_document_url ? (
              <TouchableOpacity
                style={styles.viewDocButton}
                onPress={() => setPreviewDoc(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewDocButtonText}>📎 Tingnan ang Katibayan (Proof Document)</Text>
              </TouchableOpacity>
            ) : null}
            {item.status !== 'Verified' && <TouchableOpacity onPress={() => remove(item)}><Text style={styles.deleteText}>Delete report</Text></TouchableOpacity>}
          </View>
        ))}
      </ScrollView>

      {/* Proof Document Preview Modal */}
      <Modal visible={!!previewDoc} transparent animationType="slide" onRequestClose={() => setPreviewDoc(null)}>
        <SafeAreaView style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {previewDoc?.agency_name} - Katibayan ng Ayuda
                </Text>
                <Text style={styles.previewSub}>
                  {previewDoc?.assistance_type} • {formatDate(previewDoc?.date_received)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewDoc(null)} style={styles.previewCloseBtn}>
                <Text style={styles.previewCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.previewBody} maximumZoomScale={3} minimumZoomScale={1}>
              {previewDoc?.proof_document_url && isImageFile(previewDoc.proof_document_url) ? (
                <Image
                  source={{ uri: resolveFileUrl(previewDoc.proof_document_url) }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.pdfFallbackBox}>
                  <Text style={styles.pdfIcon}>📄</Text>
                  <Text style={styles.pdfTitle}>Nakalakip na Dokumento (PDF / File)</Text>
                  <Text style={styles.pdfSub}>Pindutin ang pindutan sa ibaba para buksan o i-download.</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.previewFooter}>
              {previewDoc?.proof_document_url ? (
                <TouchableOpacity
                  style={styles.openExternalBtn}
                  onPress={() => {
                    const url = resolveFileUrl(previewDoc.proof_document_url);
                    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Hindi mabuksan ang file link.'));
                  }}
                >
                  <Text style={styles.openExternalText}>⬇ Buksan / I-download ang Buong File</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.previewDismissBtn} onPress={() => setPreviewDoc(null)}>
                <Text style={styles.previewDismissText}>Isara</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
  fileButton: { borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, backgroundColor: '#eff6ff', paddingVertical: 11, alignItems: 'center', marginTop: 4 },
  fileButtonText: { color: '#1d4ed8', fontSize: 13, fontWeight: '800' },
  fileName: { color: '#334155', fontSize: 11, marginTop: 6 },
  fileHint: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
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
  viewDocButton: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 10, alignSelf: 'flex-start' },
  viewDocButtonText: { color: '#1d4ed8', fontSize: 12, fontWeight: '800' },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'center', padding: 14 },
  previewCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxHeight: '92%', elevation: 12 },
  previewHeader: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  previewSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  previewCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  previewCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  previewBody: { padding: 16, alignItems: 'center', minHeight: 280, justifyContent: 'center' },
  previewImage: { width: '100%', height: 360, borderRadius: 12, backgroundColor: '#f8fafc' },
  pdfFallbackBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  pdfIcon: { fontSize: 50 },
  pdfTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  pdfSub: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  previewFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafafa', gap: 8 },
  openExternalBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  openExternalText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  previewDismissBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  previewDismissText: { color: '#475569', fontSize: 13, fontWeight: '700' },
});

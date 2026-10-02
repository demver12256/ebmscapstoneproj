import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { beneficiaryApi } from '../services/api';
import { API_URL } from '../config/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILES_BASE_URL = API_URL.replace(/\/api\/?$/, '');
const CATEGORIES = [
  '4Ps Household Beneficiary',
  'Senior Citizen (Social Pension)',
  'Person with Disability (PWD)',
];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated'];

const requirementsFor = (category, hasSchoolChildren) => {
  const requirements = [{ name: 'Valid Government ID / National ID', required: true }];
  if (category.toLowerCase().includes('4ps')) {
    requirements.push(
      { name: 'PSA Birth Certificate', required: true },
      { name: 'Barangay Certificate of Residency or Indigency', required: true },
      { name: 'Certificate of Enrollment', required: hasSchoolChildren },
    );
  } else if (category.toLowerCase().includes('senior')) {
    requirements.push(
      { name: 'Social Pension Application Form', required: true },
      { name: 'OSCA ID (optional if available)', required: false },
      { name: 'PSA Birth Certificate (if needed)', required: false },
    );
  } else if (category.toLowerCase().includes('pwd') || category.toLowerCase().includes('disabil')) {
    requirements.push(
      { name: 'Medical Certificate', required: true },
      { name: 'PWD Application Form', required: true },
      { name: 'PSA Birth Certificate (if needed)', required: false },
    );
  }
  return requirements;
};

const messageFromError = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, required, editable = true }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput, !editable && styles.readOnlyInput]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function ApplicationSubmissionScreen({ profile, onProfileUpdated, onLogout }) {
  const [category, setCategory] = useState(profile?.category || CATEGORIES[0]);
  const [nationalId, setNationalId] = useState(profile?.national_id_number || '');
  const [psaBirthCert, setPsaBirthCert] = useState(profile?.psa_birth_cert_number || '');
  const [contactNumber, setContactNumber] = useState(profile?.contact_number || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [sitio, setSitio] = useState(profile?.sitio || '');
  const [sex, setSex] = useState(profile?.sex || 'Male');
  const [birthdate, setBirthdate] = useState(profile?.birthdate || '');
  const [civilStatus, setCivilStatus] = useState(profile?.civil_status || 'Single');
  const [hasSchoolChildren, setHasSchoolChildren] = useState(
    Boolean(
      profile?.Documents?.some((doc) => doc.document_type === 'Certificate of Enrollment') ||
      String(profile?.missing_documents || '').includes('Certificate of Enrollment')
    )
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!profile?.id) return;
    setCategory(profile.category || CATEGORIES[0]);
    setNationalId(profile.national_id_number || '');
    setPsaBirthCert(profile.psa_birth_cert_number || '');
    setContactNumber(profile.contact_number || '');
    setAddress(profile.address || '');
    setSitio(profile.sitio || '');
    setSex(profile.sex || 'Male');
    setBirthdate(profile.birthdate || '');
    setCivilStatus(profile.civil_status || 'Single');
    setHasSchoolChildren(Boolean(
      profile.Documents?.some((doc) => doc.document_type === 'Certificate of Enrollment') ||
      String(profile.missing_documents || '').includes('Certificate of Enrollment')
    ));
  }, [profile?.id]);

  const requirements = useMemo(
    () => requirementsFor(category, hasSchoolChildren),
    [category, hasSchoolChildren]
  );
  const documents = profile?.Documents || [];
  const uploadedTypes = new Set(documents.map((doc) => doc.document_type));
  const requiredCount = requirements.filter((item) => item.required).length;
  const completedCount = requirements.filter((item) => item.required && uploadedTypes.has(item.name)).length;
  const flaggedDocuments = useMemo(() => {
    try {
      return profile?.missing_documents ? JSON.parse(profile.missing_documents) : [];
    } catch {
      return [];
    }
  }, [profile?.missing_documents]);

  const refreshProfile = async () => {
    try {
      const response = await beneficiaryApi.getMe();
      const updatedProfile = response?.data?.data || response?.data || profile;
      onProfileUpdated?.(updatedProfile);
      setError('');
      return updatedProfile;
    } catch (refreshError) {
      setError(messageFromError(refreshError, 'Hindi ma-refresh ang application.'));
      return null;
    }
  };

  const saveProfile = async (showSuccessMessage = true) => {
    if (!category || !nationalId.trim()) {
      throw new Error('Piliin ang category at ilagay ang National ID / Government ID number.');
    }
    const payload = {
      category,
      sex,
      birthdate: birthdate.trim() || undefined,
      civil_status: civilStatus,
      address: address.trim(),
      sitio: sitio.trim(),
      barangay_id: profile?.barangay_id,
      contact_number: contactNumber.trim(),
      national_id_number: nationalId.trim(),
      psa_birth_cert_number: psaBirthCert.trim(),
      ip_classification: profile?.ip_classification || 'Non-IP',
    };
    const response = await beneficiaryApi.updateMe(payload);
    const updatedProfile = response?.data?.data || response?.data || null;
    if (updatedProfile) onProfileUpdated?.({ ...profile, ...updatedProfile, Documents: documents });
    if (showSuccessMessage) setSuccess('Na-save ang application profile details.');
  };

  const saveProfileDetails = async () => {
    setError('');
    setSuccess('');
    try {
      setSaving(true);
      await saveProfile();
    } catch (saveError) {
      setError(messageFromError(saveError, 'Hindi ma-save ang profile details.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (documentType) => {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.doc,
          DocumentPicker.types.docx,
          DocumentPicker.types.images,
        ],
        copyTo: 'cachesDirectory',
      });
      if (file.size && file.size > MAX_FILE_SIZE) {
        Alert.alert('File is too large', 'Hanggang 10 MB lamang ang bawat dokumento.');
        return;
      }

      const extension = (file.name || '').split('.').pop()?.toLowerCase();
      const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
      if (!allowedExtensions.includes(extension)) {
        Alert.alert('Unsupported file', 'PDF, DOC, DOCX, JPG, JPEG, at PNG lamang ang puwedeng i-upload.');
        return;
      }

      const mimeTypes = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
      };
      const formData = new FormData();
      formData.append('document', {
        uri: file.fileCopyUri || file.uri,
        type: mimeTypes[extension] || file.type,
        name: file.name || `application-document.${extension}`,
      });
      formData.append('document_type', documentType);

      setError('');
      setSuccess('');
      setUploadingType(documentType);
      await beneficiaryApi.uploadMyDocument(formData);
      await refreshProfile();
      setSuccess(`${documentType} na-upload na.`);
    } catch (uploadError) {
      if (!DocumentPicker.isCancel(uploadError)) {
        setError(messageFromError(uploadError, 'Hindi na-upload ang dokumento.'));
      }
    } finally {
      setUploadingType('');
    }
  };

  const deleteDocument = (document) => {
    Alert.alert('Alisin ang dokumento?', `Tatanggalin ang ${document.document_type}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setError('');
            await beneficiaryApi.deleteMyDocument(document.id);
            await refreshProfile();
          } catch (deleteError) {
            setError(messageFromError(deleteError, 'Hindi ma-delete ang dokumento.'));
          }
        },
      },
    ]);
  };

  const submitApplication = async () => {
    setError('');
    setSuccess('');
    if (!nationalId.trim()) {
      setError('Ilagay muna ang National ID / Government ID number.');
      return;
    }
    const missing = requirements
      .filter((item) => item.required && !uploadedTypes.has(item.name))
      .map((item) => item.name);
    if (missing.length) {
      setError(`Kulang pa ang required documents: ${missing.join(', ')}.`);
      return;
    }

    try {
      setSubmitting(true);
      await saveProfile(false);
      await beneficiaryApi.submitMyApplication({ has_school_aged_children: hasSchoolChildren });
      await refreshProfile();
      setSuccess('Naipasa na ang application. Hintayin ang review ng admin.');
    } catch (submitError) {
      setError(messageFromError(submitError, 'Hindi maipasa ang application. Pakisuri ang profile at documents.'));
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const openDocument = (document) => {
    const relativePath = String(document.file_path || '').replace(/^\//, '');
    Linking.openURL(`${FILES_BASE_URL}/${relativePath}`).catch(() => {
      Alert.alert('Unable to open document', 'Pakisubukang muli pagkatapos i-refresh ang application.');
    });
  };

  const isRejected = String(profile?.status || '').toLowerCase() === 'rejected';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.brand}>BeniAid</Text>
          <Text style={styles.headerTitle}>Beneficiary Application</Text>
        </View>
        <TouchableOpacity onPress={refresh} disabled={refreshing} style={styles.refreshButton}>
          {refreshing ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Text style={styles.refreshButtonText}>Refresh</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>APPLICATION PROGRESS TRACKER</Text>
          <View style={styles.stepTrack}>
            <View style={styles.stepItem}>
              <View style={styles.stepDone}><Text style={styles.stepDoneText}>✓</Text></View>
              <View><Text style={styles.stepLabel}>Register Account</Text><Text style={styles.stepMeta}>Completed</Text></View>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepCurrent}><Text style={styles.stepCurrentText}>2</Text></View>
              <View><Text style={styles.stepLabelActive}>Pending Submission</Text><Text style={styles.stepMeta}>Current Step</Text></View>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepUpcoming}><Text style={styles.stepUpcomingText}>3</Text></View>
              <View><Text style={styles.stepLabel}>Under Review</Text><Text style={styles.stepMeta}>Upcoming</Text></View>
            </View>
            <View style={styles.stepItem}>
              <View style={styles.stepUpcoming}><Text style={styles.stepUpcomingText}>4</Text></View>
              <View><Text style={styles.stepLabel}>Verification Status</Text><Text style={styles.stepMeta}>Upcoming</Text></View>
            </View>
          </View>
        </View>

        {isRejected ? (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionTitle}>Application Rejected</Text>
            <Text style={styles.rejectionBody}>{profile?.rejection_reason || 'Pakitingnan at itama ang profile details at mga dokumento bago muling magsumite.'}</Text>
            {flaggedDocuments.length > 0 ? (
              <Text style={styles.rejectionBody}>Missing o invalid: {flaggedDocuments.join(', ')}</Text>
            ) : null}
          </View>
        ) : null}

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Step 1: Application Profile Details</Text>
          <Text style={styles.fieldLabel}>Category Selection *</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((item) => {
              const itemKey = item.toLowerCase().includes('4ps') ? '4ps' : item.toLowerCase().includes('senior') ? 'senior' : 'pwd';
              const selected = category.toLowerCase().includes(itemKey);
              return (
                <TouchableOpacity key={item} onPress={() => setCategory(item)} style={[styles.chip, selected && styles.chipActive]}>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.fieldsGrid}>
            <Field label="National ID / Government ID Number" value={nationalId} onChangeText={setNationalId} placeholder="Enter ID number" required />
            <Field label="PSA Birth Certificate Number (if applicable)" value={psaBirthCert} onChangeText={setPsaBirthCert} placeholder="Enter registry number" />
            <Field label="Contact Number" value={contactNumber} onChangeText={setContactNumber} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />
            <Field label="Birthdate (YYYY-MM-DD)" value={birthdate} onChangeText={setBirthdate} placeholder="1993-02-09" />
            <Field label="Barangay" value={profile?.Barangay?.barangay_name || String(profile?.barangay_id || '')} placeholder="Registered barangay" editable={false} />
            <Field label="Sitio / Subdivision" value={sitio} onChangeText={setSitio} placeholder="Enter sitio or subdivision" />
          </View>

          {String(category).toLowerCase().includes('4ps') && profile?.household_id_number ? (
            <View style={styles.infoBox}><Text style={styles.infoLabel}>4Ps Household Number</Text><Text style={styles.infoValue}>{profile.household_id_number}</Text></View>
          ) : null}

          <Text style={styles.fieldLabel}>Civil Status</Text>
          <View style={styles.chipRow}>
            {CIVIL_STATUSES.map((item) => (
              <TouchableOpacity key={item} onPress={() => setCivilStatus(item)} style={[styles.smallChip, civilStatus === item && styles.chipActive]}>
                <Text style={[styles.chipText, civilStatus === item && styles.chipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, styles.spaceTop]}>Sex</Text>
          <View style={styles.chipRow}>
            {['Male', 'Female', 'Other'].map((item) => (
              <TouchableOpacity key={item} onPress={() => setSex(item)} style={[styles.smallChip, sex === item && styles.chipActive]}>
                <Text style={[styles.chipText, sex === item && styles.chipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Current Residential Address" value={address} onChangeText={setAddress} placeholder="Street, Municipality, Province" multiline />

          {category.toLowerCase().includes('4ps') ? (
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasSchoolChildren((value) => !value)}>
              <View style={[styles.checkbox, hasSchoolChildren && styles.checkboxChecked]}>
                {hasSchoolChildren ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>May school-aged children? Kailangan ng Certificate of Enrollment kapag oo.</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={[styles.secondaryButton, saving && styles.disabledButton]} onPress={saveProfileDetails} disabled={saving}>
            {saving ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.secondaryButtonText}>Save Profile Details</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Step 2: Upload Required Documents</Text>
          <Text style={styles.sectionHint}>PDF, DOC, DOCX, JPG, JPEG, o PNG lamang; hanggang 10 MB bawat file.</Text>
          <Text style={styles.progressText}>Required documents: {completedCount} / {requiredCount} uploaded</Text>

          {requirements.map((requirement) => {
            const uploaded = documents.find((document) => document.document_type === requirement.name);
            const flagged = flaggedDocuments.includes(requirement.name);
            const busy = uploadingType === requirement.name;
            return (
              <View key={requirement.name} style={[styles.documentCard, uploaded && styles.documentUploaded, flagged && styles.documentFlagged]}>
                <View style={styles.documentHeader}>
                  <Text style={styles.documentTitle}>{requirement.name}</Text>
                  <Text style={[styles.requiredTag, requirement.required ? styles.requiredTagRequired : styles.requiredTagOptional]}>
                    {requirement.required ? 'Required' : 'Optional'}
                  </Text>
                </View>
                {flagged ? <Text style={styles.flaggedText}>Marked as missing or invalid. Upload a corrected copy.</Text> : null}
                {uploaded ? (
                  <>
                    <Text style={styles.uploadedName}>✓ {uploaded.file_name || 'Document uploaded'}</Text>
                    <View style={styles.documentActions}>
                      <TouchableOpacity onPress={() => openDocument(uploaded)} style={styles.documentActionButton}>
                        <Text style={styles.documentActionText}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteDocument(uploaded)} style={styles.deleteActionButton}>
                        <Text style={styles.deleteActionText}>Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => uploadDocument(requirement.name)} style={styles.documentActionButton} disabled={busy}>
                        {busy ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Text style={styles.documentActionText}>Replace</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => uploadDocument(requirement.name)} style={styles.uploadButton} disabled={busy}>
                    {busy ? <ActivityIndicator color="#1d4ed8" /> : <Text style={styles.uploadButtonText}>＋ Choose Document</Text>}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.submitCard}>
          <View style={styles.submitCopy}>
            <Text style={styles.submitTitle}>Step 3: Submit Complete Application</Text>
            <Text style={styles.submitHint}>I-save ang profile at kumpletuhin ang lahat ng required documents bago magsumite.</Text>
          </View>
          <TouchableOpacity style={[styles.submitButton, submitting && styles.disabledButton]} onPress={submitApplication} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Application</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>Kapag naisumite na, ipapakita ng app ang review status. Awtomatikong bubukas ang beneficiary dashboard kapag naaprubahan.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { minHeight: 66, backgroundColor: '#fff', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerCopy: { flex: 1 },
  brand: { color: '#00338d', fontSize: 18, fontWeight: '900' },
  headerTitle: { color: '#64748b', fontSize: 10, fontWeight: '700', marginTop: 1 },
  refreshButton: { borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, marginRight: 8 },
  refreshButtonText: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  logoutButton: { backgroundColor: '#f1f5f9', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  logoutText: { color: '#334155', fontSize: 11, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 36 },
  heroCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#dbe5f1', padding: 16, marginBottom: 14 },
  heroEyebrow: { color: '#0f172a', fontSize: 15, fontWeight: '900', marginBottom: 14 },
  stepTrack: { gap: 12 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDone: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  stepDoneText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  stepCurrent: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1d4ed8', alignItems: 'center', justifyContent: 'center' },
  stepCurrentText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  stepUpcoming: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  stepUpcomingText: { color: '#94a3b8', fontSize: 13, fontWeight: '800' },
  stepLabel: { color: '#475569', fontSize: 12, fontWeight: '800' },
  stepLabelActive: { color: '#1d4ed8', fontSize: 12, fontWeight: '900' },
  stepMeta: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#dbe5f1', padding: 16, marginBottom: 14 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', marginBottom: 12 },
  sectionHint: { color: '#64748b', fontSize: 11, lineHeight: 16, marginTop: -6, marginBottom: 12 },
  fieldsGrid: { gap: 2 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: '#334155', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#f8fafc', color: '#0f172a', paddingHorizontal: 12, fontSize: 13 },
  readOnlyInput: { color: '#64748b', backgroundColor: '#f1f5f9' },
  multilineInput: { minHeight: 78, paddingTop: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 2 },
  smallChip: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#1d4ed8', fontWeight: '900' },
  spaceTop: { marginTop: 4 },
  infoBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 11, marginBottom: 12 },
  infoLabel: { color: '#64748b', fontSize: 10, fontWeight: '800' },
  infoValue: { color: '#1e3a8a', fontSize: 13, fontWeight: '900', marginTop: 3 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eff6ff', borderRadius: 10, padding: 11, marginBottom: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#94a3b8', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: '900' },
  checkboxLabel: { flex: 1, color: '#1e3a8a', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#eff6ff', marginTop: 2 },
  secondaryButtonText: { color: '#1d4ed8', fontSize: 13, fontWeight: '900' },
  progressText: { color: '#1d4ed8', fontSize: 11, fontWeight: '900', marginBottom: 10 },
  documentCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 9 },
  documentUploaded: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  documentFlagged: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  documentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' },
  documentTitle: { color: '#1e293b', fontSize: 12, fontWeight: '800', flex: 1, lineHeight: 17 },
  requiredTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, overflow: 'hidden', fontWeight: '900' },
  requiredTagRequired: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  requiredTagOptional: { color: '#475569', backgroundColor: '#e2e8f0' },
  flaggedText: { color: '#b91c1c', fontSize: 10, fontWeight: '700', marginTop: 7 },
  uploadedName: { color: '#166534', fontSize: 11, fontWeight: '700', marginTop: 10 },
  documentActions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  documentActionButton: { flex: 1, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  documentActionText: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  deleteActionButton: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  deleteActionText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },
  uploadButton: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#93c5fd', borderRadius: 9, backgroundColor: '#fff', minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  uploadButtonText: { color: '#1d4ed8', fontSize: 12, fontWeight: '900' },
  submitCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe5f1', borderRadius: 16, padding: 16, gap: 12 },
  submitCopy: { gap: 5 },
  submitTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900' },
  submitHint: { color: '#64748b', fontSize: 11, lineHeight: 16 },
  submitButton: { minHeight: 48, backgroundColor: '#1d4ed8', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 11, padding: 12, marginBottom: 12 },
  errorText: { color: '#b91c1c', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  successBox: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 11, padding: 12, marginBottom: 12 },
  successText: { color: '#166534', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  rejectionCard: { backgroundColor: '#fff7f7', borderWidth: 1, borderColor: '#fecaca', borderRadius: 13, padding: 14, marginBottom: 12, gap: 7 },
  rejectionTitle: { color: '#b91c1c', fontSize: 15, fontWeight: '900' },
  rejectionBody: { color: '#7f1d1d', fontSize: 12, lineHeight: 18 },
  footerText: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14, marginHorizontal: 8 },
});

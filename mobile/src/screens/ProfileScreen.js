import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { authApi, beneficiaryApi } from '../services/api';

const FILES_BASE_URL = API_URL.replace(/\/api\/?$/, '');

const formatDate = (value) => {
  if (!value) return 'Not provided';
  const dateOnly = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : 'Not provided';
};

const ProfileField = ({ label, value, icon }) => (
  <View style={styles.fieldRow}>
    <View style={styles.fieldIcon}><Text style={styles.fieldIconText}>{icon}</Text></View>
    <View style={styles.fieldCopy}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Not provided'}</Text>
    </View>
  </View>
);

export default function ProfileScreen({ user, profile, onOpenDrawer, onProfileUpdated }) {
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordVisibility, setPasswordVisibility] = useState({ current: false, next: false, confirm: false });
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fullName = `${profile?.first_name || user?.first_name || ''} ${profile?.middle_name || ''} ${profile?.last_name || user?.last_name || ''}`
    .replace(/\s+/g, ' ').trim() || 'Beneficiary';
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  const profileImageUri = useMemo(() => {
    const path = profile?.profile_picture;
    if (!path) return null;
    return path.startsWith('http') ? path : `${FILES_BASE_URL}/${path.replace(/^\/+/, '')}`;
  }, [profile?.profile_picture]);
  const barangayName = profile?.Barangay?.barangay_name || profile?.barangay_name || '';
  const address = profile?.address || [profile?.sitio, barangayName].filter(Boolean).join(', ');
  const accountUser = profile?.User || user || {};

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setPasswordForm({ current: '', next: '', confirm: '' });
    setPasswordVisibility({ current: false, next: false, confirm: false });
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      Alert.alert('Kulang ang impormasyon', 'Punan ang lahat ng password fields.');
      return;
    }
    if (passwordForm.next.length < 6) {
      Alert.alert('Hindi sapat ang haba', 'Ang bagong password ay dapat may hindi bababa sa 6 na character.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      Alert.alert('Hindi magkatugma', 'Hindi magkapareho ang bagong password at confirmation.');
      return;
    }

    try {
      setSavingPassword(true);
      const response = await authApi.changePassword({
        current_password: passwordForm.current,
        new_password: passwordForm.next,
      });
      Alert.alert('Matagumpay', response.data?.message || 'Na-update na ang iyong password.');
      closePasswordModal();
    } catch (error) {
      Alert.alert('Hindi na-update', error?.response?.data?.message || error.message || 'Subukan muli mamaya.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUploadPhoto = async () => {
    try {
      const file = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.images],
        copyTo: 'cachesDirectory',
      });
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('File size limit', 'Hanggang 10 MB lamang ang profile photo.');
        return;
      }

      const formData = new FormData();
      formData.append('profile_picture', {
        uri: file.fileCopyUri || file.uri,
        type: file.type || 'image/jpeg',
        name: file.name || `profile-${Date.now()}.jpg`,
      });

      setUploadingPhoto(true);
      const response = await beneficiaryApi.uploadProfilePicture(formData);
      const savedPath = response.data?.data?.profile_picture;
      if (savedPath) {
        onProfileUpdated?.((previous) => ({ ...previous, profile_picture: savedPath }));
      }
      Alert.alert('Na-update ang larawan', 'Matagumpay na napalitan ang iyong profile photo.');
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Hindi na-upload', error?.response?.data?.message || error.message || 'Subukan muli mamaya.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const renderPasswordField = (key, label, placeholder) => (
    <>
      <Text style={styles.passwordLabel}>{label}</Text>
      <View style={styles.passwordInputWrap}>
        <TextInput
          style={styles.passwordInput}
          value={passwordForm[key]}
          onChangeText={(value) => setPasswordForm((previous) => ({ ...previous, [key]: value }))}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={!passwordVisibility[key]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => setPasswordVisibility((previous) => ({ ...previous, [key]: !previous[key] }))}
          style={styles.passwordEyeButton}
          accessibilityLabel={passwordVisibility[key] ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.passwordEye}>{passwordVisibility[key] ? 'HIDE' : 'SHOW'}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#082f87" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onOpenDrawer} style={styles.menuButton} accessibilityLabel="Open menu">
          <Text style={styles.menuButtonText}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>Personal information and account settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>{initials || 'B'}</Text></View>
            )}
            <TouchableOpacity
              onPress={handleUploadPhoto}
              disabled={uploadingPhoto}
              style={styles.uploadButton}
              accessibilityLabel="Upload profile photo"
            >
              {uploadingPhoto ? <ActivityIndicator size="small" color="#0b3b9b" /> : <Text style={styles.uploadButtonText}>↑</Text>}
            </TouchableOpacity>
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.nameText}>{fullName}</Text>
            <Text style={styles.categoryText}>{profile?.category || 'Beneficiary'}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.approvedBadge}><Text style={styles.approvedBadgeText}>{profile?.status || 'Active'}</Text></View>
              {(profile?.beneficiary_id_code || profile?.household_id_number) ? (
                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeText}>ID: {profile.beneficiary_id_code || profile.household_id_number}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <ProfileField label="Birthdate" value={formatDate(profile?.birthdate)} icon="▦" />
          <ProfileField label="Sex" value={profile?.sex} icon="♙" />
          <ProfileField label="Civil Status" value={profile?.civil_status} icon="♧" />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <ProfileField label="Username" value={accountUser.username} icon="♙" />
          <ProfileField label="Contact Number" value={profile?.contact_number || accountUser.contact_number || accountUser.phone} icon="☎" />
          <ProfileField label="Email Address" value={accountUser.email || 'None (Optional)'} icon="✉" />
          <ProfileField label="Address" value={address} icon="⌖" />
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityCopy}>
            <Text style={styles.securityTitle}>Account Security</Text>
            <Text style={styles.securitySubtitle}>Keep your account secure by updating your password.</Text>
          </View>
          <TouchableOpacity style={styles.changePasswordButton} onPress={() => setPasswordModalVisible(true)}>
            <Text style={styles.changePasswordButtonText}>Change Password</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={closePasswordModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalKeyIcon}>⚿</Text>
                <Text style={styles.modalTitle}>Change Password</Text>
              </View>
              <TouchableOpacity onPress={closePasswordModal} style={styles.modalCloseButton} accessibilityLabel="Close">
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {renderPasswordField('current', 'Current Password', 'Enter current password')}
              {renderPasswordField('next', 'New Password', 'Enter new password (min. 6 characters)')}
              {renderPasswordField('confirm', 'Confirm New Password', 'Re-enter new password')}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={closePasswordModal} disabled={savingPassword}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={savingPassword}>
                  {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Password</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7fc' },
  header: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0b3b9b' },
  menuButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuButtonText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  headerSubtitle: { color: '#dbeafe', fontSize: 11, marginTop: 2 },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#dbe4f0', padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, elevation: 2 },
  avatarWrap: { width: 94, height: 94, position: 'relative' },
  avatarImage: { width: 94, height: 94, borderRadius: 47, backgroundColor: '#e2e8f0' },
  avatarFallback: { width: 94, height: 94, borderRadius: 47, backgroundColor: '#0b3b9b', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#eaf1ff' },
  avatarInitials: { color: '#fff', fontSize: 30, fontWeight: '900' },
  uploadButton: { position: 'absolute', right: -2, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  uploadButtonText: { color: '#0b3b9b', fontSize: 23, lineHeight: 27, fontWeight: '800' },
  nameBlock: { flex: 1, minWidth: 0 },
  nameText: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  categoryText: { color: '#475569', fontSize: 14, marginTop: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  approvedBadge: { backgroundColor: '#dcfce7', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 5 },
  approvedBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '800' },
  idBadge: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5 },
  idBadgeText: { color: '#1d4ed8', fontSize: 10, fontWeight: '800' },
  infoCard: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 17, paddingVertical: 16, borderWidth: 1, borderColor: '#dbe4f0' },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', marginBottom: 7 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  fieldIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  fieldIconText: { color: '#1d4ed8', fontSize: 17, fontWeight: '800' },
  fieldCopy: { flex: 1 },
  fieldLabel: { color: '#64748b', fontSize: 12 },
  fieldValue: { color: '#0f172a', fontSize: 14, fontWeight: '700', marginTop: 2 },
  securityCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe4f0', padding: 16, gap: 13 },
  securityCopy: { gap: 3 },
  securityTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  securitySubtitle: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  changePasswordButton: { backgroundColor: '#0b3b9b', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  changePasswordButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', maxHeight: '92%', elevation: 12 },
  modalHeader: { minHeight: 68, paddingLeft: 19, paddingRight: 10, backgroundColor: '#1553c7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  modalKeyIcon: { color: '#fff', fontSize: 23, fontWeight: '800' },
  modalTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  modalCloseButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#fff', fontSize: 31, fontWeight: '300', lineHeight: 34 },
  modalBody: { padding: 18, paddingBottom: 20 },
  passwordLabel: { color: '#17324f', fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 7 },
  passwordInputWrap: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#dbe4f0', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 9 },
  passwordInput: { flex: 1, minHeight: 48, color: '#0f172a', fontSize: 14 },
  passwordEyeButton: { paddingHorizontal: 7, paddingVertical: 8 },
  passwordEye: { color: '#64748b', fontSize: 10, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#dbe4f0', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: '#17324f', fontSize: 14, fontWeight: '800' },
  saveButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#0b3b9b', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

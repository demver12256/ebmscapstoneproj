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
  Share,
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
  const [imageError, setImageError] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPassData, setQrPassData] = useState(null);

  // Contact Information Edit Modal State
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    contact_number: '',
    email: '',
    sitio: '',
    address: '',
  });

  const fullName = `${profile?.first_name || user?.first_name || ''} ${profile?.middle_name || ''} ${profile?.last_name || user?.last_name || ''}`
    .replace(/\s+/g, ' ').trim() || 'Beneficiary';
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  const profileImageUri = useMemo(() => {
    const path = profile?.profile_picture || profile?.User?.profile_picture || user?.profile_picture;
    if (!path) return null;
    const base = path.startsWith('http') ? path : `${FILES_BASE_URL}/${path.replace(/^\/+/, '')}`;
    return `${base}${base.includes('?') ? '&' : '?'}v=${photoVersion}`;
  }, [profile?.profile_picture, profile?.User?.profile_picture, user?.profile_picture, photoVersion]);
  const barangayName = profile?.Barangay?.barangay_name || profile?.barangay_name || '';
  const address = profile?.address || [profile?.sitio, barangayName].filter(Boolean).join(', ');
  const accountUser = profile?.User || user || {};

  const handleOpenQrModal = async () => {
    setQrModalVisible(true);
    if (!profile?.qr_image_url && !qrPassData?.qr_image_url) {
      setQrLoading(true);
      try {
        const res = await beneficiaryApi.getMyQrPass().catch(() => beneficiaryApi.getMe());
        if (res.data?.data) {
          setQrPassData(res.data.data);
          if (res.data.data.profile_picture && !profile?.profile_picture) {
            onProfileUpdated?.((prev) => ({ ...prev, profile_picture: res.data.data.profile_picture }));
          }
        }
      } catch (err) {
        console.warn('Could not fetch QR Pass data:', err);
      } finally {
        setQrLoading(false);
      }
    }
  };

  const handleShareQrCode = async () => {
    const qrImage = profile?.qr_image_url || qrPassData?.qr_image_url;
    const qrCode = profile?.qr_code || qrPassData?.qr_code || (profile?.qr_token ? `EBMS-QR:${profile.qr_token}` : '');
    try {
      await Share.share({
        title: `Digital QR Pass - ${fullName}`,
        message: `Digital QR Pass ni ${fullName}\nID/Code: ${qrCode}\nEBMS - DSWD / MSWDO Bongabong`,
        url: qrImage || undefined,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

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

      const fileExtension = (file.name || '').split('.').pop()?.toLowerCase();
      const detectedMime =
        file.type ||
        (fileExtension === 'png'
          ? 'image/png'
          : fileExtension === 'webp'
          ? 'image/webp'
          : 'image/jpeg');

      const formData = new FormData();
      formData.append('profile_picture', {
        uri: file.fileCopyUri || file.uri,
        type: detectedMime,
        name: file.name || `profile-${Date.now()}.${fileExtension || 'jpg'}`,
      });

      setUploadingPhoto(true);
      setImageError(false);
      const response = await beneficiaryApi.uploadProfilePicture(formData);
      const savedPath = response.data?.data?.profile_picture;
      if (savedPath) {
        setPhotoVersion(Date.now());
        onProfileUpdated?.((previous) => ({
          ...previous,
          profile_picture: savedPath,
          profile_photo: savedPath,
        }));
      }
      // Re-fetch profile to sync all fields with backend
      beneficiaryApi.getMe().then((res) => {
        if (res.data?.data) {
          onProfileUpdated?.(res.data.data);
        }
      }).catch(() => {});
      Alert.alert('Na-update ang larawan', 'Matagumpay na napalitan ang iyong profile photo.');
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('Hindi na-upload', error?.response?.data?.message || error.message || 'Subukan muli mamaya.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleOpenContactModal = () => {
    setContactForm({
      contact_number: profile?.contact_number || accountUser.contact_number || accountUser.phone || '',
      email: accountUser.email || profile?.email || '',
      sitio: profile?.sitio || '',
      address: profile?.address || '',
    });
    setContactModalVisible(true);
  };

  const handleCloseContactModal = () => {
    setContactModalVisible(false);
  };

  const handleSaveContact = async () => {
    if (!contactForm.contact_number.trim()) {
      Alert.alert('Kulang ang impormasyon', 'Pakilagay ang iyong Contact Number (Cellphone Number).');
      return;
    }

    try {
      setSavingContact(true);
      const res = await beneficiaryApi.updateContact(contactForm);
      if (res.data?.success && res.data?.data) {
        onProfileUpdated?.(res.data.data);
      } else {
        onProfileUpdated?.((prev) => ({
          ...prev,
          contact_number: contactForm.contact_number,
          sitio: contactForm.sitio,
          address: contactForm.address,
          User: {
            ...(prev?.User || {}),
            contact_number: contactForm.contact_number,
            email: contactForm.email,
            address: contactForm.address,
          },
        }));
      }
      Alert.alert('Matagumpay', 'Na-update na ang iyong Contact Information!');
      handleCloseContactModal();
    } catch (err) {
      Alert.alert('Hindi na-update', err?.response?.data?.message || err.message || 'Subukan muli mamaya.');
    } finally {
      setSavingContact(false);
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
            {profileImageUri && !imageError ? (
              <Image
                source={{ uri: profileImageUri }}
                style={styles.avatarImage}
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>{initials || 'B'}</Text></View>
            )}
            <TouchableOpacity
              onPress={handleUploadPhoto}
              disabled={uploadingPhoto}
              style={styles.uploadButton}
              accessibilityLabel="Upload profile photo"
            >
              {uploadingPhoto ? <ActivityIndicator size="small" color="#0b3b9b" /> : <Text style={styles.uploadButtonText}>📷</Text>}
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

        {/* Digital QR Pass / Temporary ID Banner */}
        {profile?.status === 'Approved' && (
          <View style={styles.qrBannerCard}>
            <View style={styles.qrBannerTop}>
              <View style={styles.qrBannerIconWrap}>
                <Text style={styles.qrBannerIconText}>☵</Text>
              </View>
              <View style={styles.qrBannerContent}>
                <View style={styles.qrBannerBadgeRow}>
                  <Text style={styles.qrBannerTitle}>Digital ID & QR Pass</Text>
                  <View style={styles.qrActiveBadge}>
                    <Text style={styles.qrActiveBadgeText}>Active Backup</Text>
                  </View>
                </View>
                <Text style={styles.qrBannerDesc}>
                  {profile?.RFID_number 
                    ? 'Maaari ring gamitin bilang alternatibong pagkakakilanlan.' 
                    : 'Pansamantalang ID sa mga payout at attendance habang wala pang RFID card.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.viewQrPassButton}
              onPress={handleOpenQrModal}
              activeOpacity={0.8}
            >
              <Text style={styles.viewQrPassButtonText}>Tingnan ang QR ID Pass</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <ProfileField label="Birthdate" value={formatDate(profile?.birthdate)} icon="▦" />
          <ProfileField label="Sex" value={profile?.sex} icon="♙" />
          <ProfileField label="Civil Status" value={profile?.civil_status} icon="♧" />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <TouchableOpacity
              style={styles.editContactBtn}
              onPress={handleOpenContactModal}
              activeOpacity={0.8}
            >
              <Text style={styles.editContactBtnText}>✏️ I-update</Text>
            </TouchableOpacity>
          </View>
          <ProfileField label="Username" value={accountUser.username} icon="♙" />
          <ProfileField label="Contact Number" value={profile?.contact_number || accountUser.contact_number || accountUser.phone} icon="☎" />
          <ProfileField label="Email Address" value={accountUser.email || profile?.email || 'None (Optional)'} icon="✉" />
          <ProfileField label="Sitio" value={profile?.sitio || 'Not specified'} icon="⌂" />
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

      {/* EDIT CONTACT INFORMATION MODAL */}
      <Modal visible={contactModalVisible} transparent animationType="fade" onRequestClose={handleCloseContactModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalKeyIcon}>☎</Text>
                <Text style={styles.modalTitle}>Update Contact Info</Text>
              </View>
              <TouchableOpacity onPress={handleCloseContactModal} style={styles.modalCloseButton} accessibilityLabel="Close">
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.passwordLabel}>Contact Number (Mobile / Cellphone) *</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={contactForm.contact_number}
                  onChangeText={(val) => setContactForm((prev) => ({ ...prev, contact_number: val }))}
                  placeholder="Hal. 09123456789"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.passwordLabel}>Email Address (Optional)</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={contactForm.email}
                  onChangeText={(val) => setContactForm((prev) => ({ ...prev, email: val }))}
                  placeholder="Hal. demver@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.passwordLabel}>Sitio / Purok</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={contactForm.sitio}
                  onChangeText={(val) => setContactForm((prev) => ({ ...prev, sitio: val }))}
                  placeholder="Hal. Sitio Centro / Purok 1"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <Text style={styles.passwordLabel}>Tirahan / Address</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={contactForm.address}
                  onChangeText={(val) => setContactForm((prev) => ({ ...prev, address: val }))}
                  placeholder="Hal. Block 3 Lot 2, Aplaya, Bongabong"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCloseContactModal} disabled={savingContact}>
                  <Text style={styles.cancelButtonText}>Kanselahin</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveContact} disabled={savingContact}>
                  {savingContact ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>I-save ang Impormasyon</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* DIGITAL QR PASS MODAL */}
      <Modal visible={qrModalVisible} transparent animationType="slide" onRequestClose={() => setQrModalVisible(false)}>
        <SafeAreaView style={styles.qrModalOverlay}>
          <View style={styles.qrModalCard}>
            {/* Header */}
            <View style={styles.qrModalHeader}>
              <View style={styles.qrModalHeaderTitleWrap}>
                <Text style={styles.qrModalRepublic}>Republic of the Philippines</Text>
                <Text style={styles.qrModalAgency}>DSWD / MSWDO Bongabong</Text>
              </View>
              <TouchableOpacity onPress={() => setQrModalVisible(false)} style={styles.qrModalCloseBtn} accessibilityLabel="Close">
                <Text style={styles.qrModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.qrModalBody} showsVerticalScrollIndicator={false}>
              {/* Temporary ID Pass Badge */}
              <View style={styles.qrIdPassBadgeWrap}>
                <Text style={styles.qrIdPassBadgeText}>TEMPORARY DIGITAL ID • CLAIM PASS</Text>
              </View>

              {/* Beneficiary Header inside Card */}
              <View style={styles.qrBenInfoRow}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.qrModalAvatar} />
                ) : (
                  <View style={styles.qrModalAvatarFallback}>
                    <Text style={styles.qrModalAvatarInitials}>{initials || 'B'}</Text>
                  </View>
                )}
                <View style={styles.qrModalBenTextWrap}>
                  <Text style={styles.qrModalFullName}>{fullName}</Text>
                  <Text style={styles.qrModalBenId}>
                    {profile?.household_id_number || profile?.beneficiary_id_code || qrPassData?.household_id_number || qrPassData?.beneficiary_id_code || 'Approved Beneficiary'}
                  </Text>
                  <View style={styles.qrCategoryPill}>
                    <Text style={styles.qrCategoryPillText}>{profile?.category || qrPassData?.category || 'Beneficiary'}</Text>
                  </View>
                  <Text style={styles.qrBrgyText}>Brgy. {barangayName || qrPassData?.barangay}</Text>
                </View>
              </View>

              {/* QR Image Box */}
              <View style={styles.qrImageBox}>
                {(profile?.qr_image_url || qrPassData?.qr_image_url) ? (
                  <Image
                    source={{ uri: profile?.qr_image_url || qrPassData?.qr_image_url }}
                    style={styles.qrCodeImage}
                    resizeMode="contain"
                  />
                ) : qrLoading ? (
                  <View style={styles.qrLoadingBox}>
                    <ActivityIndicator size="large" color="#0b3b9b" />
                    <Text style={styles.qrLoadingText}>Kinukuha ang QR Code...</Text>
                  </View>
                ) : (
                  <View style={styles.qrLoadingBox}>
                    <ActivityIndicator size="small" color="#0b3b9b" />
                    <Text style={styles.qrLoadingText}>Walang QR Code</Text>
                  </View>
                )}
                <Text style={styles.qrTokenText}>
                  {profile?.qr_code || qrPassData?.qr_code || (profile?.qr_token ? `EBMS-QR:${profile.qr_token}` : 'DIGITAL QR PASS')}
                </Text>
              </View>

              {/* Notice */}
              <View style={styles.qrNoticeCard}>
                <Text style={styles.qrNoticeTitle}>Paalala para sa Benepisyaryo:</Text>
                <Text style={styles.qrNoticeDesc}>
                  Ipakita ang QR code na ito sa staff scanner tuwing distribution payout o meeting attendance kung wala ka pang physical RFID card.
                </Text>
              </View>

              {/* Status info */}
              <View style={styles.qrMetaRow}>
                <Text style={styles.qrMetaLabel}>RFID Card:</Text>
                <Text style={styles.qrMetaValue}>
                  {profile?.RFID_number || 'Walang RFID Card (QR Pass Active)'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.qrModalFooter}>
              <TouchableOpacity
                style={styles.qrShareButton}
                onPress={handleShareQrCode}
                activeOpacity={0.8}
              >
                <Text style={styles.qrShareButtonText}>⬇ I-save / I-share ang QR Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.qrCloseButton} onPress={() => setQrModalVisible(false)}>
                <Text style={styles.qrCloseButtonText}>Isara</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
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
  uploadButtonText: { fontSize: 16 },
  nameBlock: { flex: 1, minWidth: 0 },
  nameText: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  categoryText: { color: '#475569', fontSize: 14, marginTop: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  approvedBadge: { backgroundColor: '#dcfce7', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 5 },
  approvedBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '800' },
  idBadge: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5 },
  idBadgeText: { color: '#1d4ed8', fontSize: 10, fontWeight: '800' },
  infoCard: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 17, paddingVertical: 16, borderWidth: 1, borderColor: '#dbe4f0' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  editContactBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 },
  editContactBtnText: { color: '#1d4ed8', fontSize: 12, fontWeight: '800' },
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

  // QR Banner Card Styles
  qrBannerCard: { backgroundColor: '#f0fdf4', borderRadius: 18, borderWidth: 1.5, borderColor: '#86efac', padding: 16, gap: 12 },
  qrBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrBannerIconWrap: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#15803d', alignItems: 'center', justifyContent: 'center' },
  qrBannerIconText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  qrBannerContent: { flex: 1 },
  qrBannerBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  qrBannerTitle: { color: '#14532d', fontSize: 16, fontWeight: '900' },
  qrActiveBadge: { backgroundColor: '#bbf7d0', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  qrActiveBadgeText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  qrBannerDesc: { color: '#15803d', fontSize: 12, marginTop: 3, lineHeight: 17 },
  viewQrPassButton: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  viewQrPassButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  // QR Modal Styles
  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', padding: 16 },
  qrModalCard: { backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', maxHeight: '94%', elevation: 16 },
  qrModalHeader: { minHeight: 64, paddingHorizontal: 18, backgroundColor: '#0b3b9b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qrModalHeaderTitleWrap: { flex: 1 },
  qrModalRepublic: { color: '#93c5fd', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  qrModalAgency: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  qrModalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  qrModalCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  qrModalBody: { padding: 18, gap: 14, alignItems: 'center' },
  qrIdPassBadgeWrap: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  qrIdPassBadgeText: { color: '#1e40af', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  qrBenInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  qrModalAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e2e8f0' },
  qrModalAvatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0b3b9b', alignItems: 'center', justifyContent: 'center' },
  qrModalAvatarInitials: { color: '#fff', fontSize: 22, fontWeight: '900' },
  qrModalBenTextWrap: { flex: 1, minWidth: 0 },
  qrModalFullName: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  qrModalBenId: { color: '#1d4ed8', fontSize: 12, fontWeight: '800', marginTop: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  qrCategoryPill: { alignSelf: 'flex-start', backgroundColor: '#f3e8ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  qrCategoryPillText: { color: '#7e22ce', fontSize: 10, fontWeight: '800' },
  qrBrgyText: { color: '#64748b', fontSize: 11, marginTop: 3 },
  qrImageBox: { width: '100%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#e2e8f0', padding: 16, alignItems: 'center', gap: 10, elevation: 2 },
  qrCodeImage: { width: 220, height: 220 },
  qrLoadingBox: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', gap: 8 },
  qrLoadingText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  qrTokenText: { color: '#64748b', fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  qrNoticeCard: { width: '100%', backgroundColor: '#f0fdf4', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#bbf7d0', gap: 3 },
  qrNoticeTitle: { color: '#166534', fontSize: 12, fontWeight: '800' },
  qrNoticeDesc: { color: '#15803d', fontSize: 11, lineHeight: 16 },
  qrMetaRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  qrMetaLabel: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  qrMetaValue: { color: '#0f172a', fontSize: 12, fontWeight: '800' },
  qrModalFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fafafa', gap: 10 },
  qrShareButton: { minHeight: 46, backgroundColor: '#16a34a', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qrShareButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  qrCloseButton: { minHeight: 44, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qrCloseButtonText: { color: '#334155', fontSize: 13, fontWeight: '800' },
});

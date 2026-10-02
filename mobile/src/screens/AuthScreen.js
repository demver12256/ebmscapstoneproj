import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  Modal,
} from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import api, { authApi, barangayApi } from '../services/api';
import { GOOGLE_WEB_CLIENT_ID } from '../config/api';

const BONGABONG_BARANGAYS_FALLBACK = [
  { id: 1, barangay_name: 'Anahao' },
  { id: 2, barangay_name: 'Aplaya' },
  { id: 3, barangay_name: 'Bagong Bayan II' },
  { id: 4, barangay_name: 'Batangan' },
  { id: 5, barangay_name: 'Camantigue' },
  { id: 6, barangay_name: 'Carmundo' },
  { id: 7, barangay_name: 'Cawayan' },
  { id: 8, barangay_name: 'Dayhagan' },
  { id: 9, barangay_name: 'Formon' },
  { id: 10, barangay_name: 'Hagan' },
  { id: 11, barangay_name: 'Hagupit' },
  { id: 12, barangay_name: 'Ipil' },
  { id: 13, barangay_name: 'Kaligtasan' },
  { id: 14, barangay_name: 'Labasan' },
  { id: 15, barangay_name: 'Labonan' },
  { id: 16, barangay_name: 'Libertad' },
  { id: 17, barangay_name: 'Lisap' },
  { id: 18, barangay_name: 'Luna' },
  { id: 19, barangay_name: 'Malitbog' },
  { id: 20, barangay_name: 'Mapang' },
  { id: 21, barangay_name: 'Masagana' },
  { id: 22, barangay_name: 'Morente' },
  { id: 23, barangay_name: 'Orconuma' },
  { id: 24, barangay_name: 'Poblacion' },
  { id: 25, barangay_name: 'Pulosahi' },
  { id: 26, barangay_name: 'Sagana' },
  { id: 27, barangay_name: 'San Isidro' },
  { id: 28, barangay_name: 'San Jose' },
  { id: 29, barangay_name: 'San Juan' },
  { id: 30, barangay_name: 'San Pedro' },
  { id: 31, barangay_name: 'Santa Cruz' },
  { id: 32, barangay_name: 'Sigange' },
  { id: 33, barangay_name: 'Sinisian' },
  { id: 34, barangay_name: 'South Poblacion' },
  { id: 35, barangay_name: 'Tawas' },
  { id: 36, barangay_name: 'Villa Maria' },
];

const SECTORS = [
  '4Ps Household Beneficiaries',
  'Senior Citizens (Social Pension)',
  'Persons with Disabilities (PWD)',
];

export default function AuthScreen({ onLoginSuccess }) {
  // Mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState('login');

  // ── Login State ──
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ── Barangay List ──
  const [barangays, setBarangays] = useState(BONGABONG_BARANGAYS_FALLBACK);
  const [showBarangayModal, setShowBarangayModal] = useState(false);

  // ── Registration State ──
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBarangayId, setRegBarangayId] = useState('');
  const [regSitio, setRegSitio] = useState('');
  const [regSex, setRegSex] = useState('Male');
  const [regBirthdate, setRegBirthdate] = useState('');
  const [regContactNumber, setRegContactNumber] = useState('');
  const [regCategory, setRegCategory] = useState('4Ps Household Beneficiaries');
  const [regHouseholdNumber, setRegHouseholdNumber] = useState('');
  const [regIpClassification, setRegIpClassification] = useState('Non-IP');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // ── OTP Modal for Registration ──
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [pendingRegData, setPendingRegData] = useState(null);

  // ── Forgot Password State ──
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotMaskedEmail, setForgotMaskedEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotDevOtp, setForgotDevOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
    loadBarangays();
  }, []);

  const loadBarangays = async () => {
    try {
      const res = await barangayApi.publicList();
      const list = res?.data?.data || res?.data || [];
      if (Array.isArray(list) && list.length > 0) {
        setBarangays(list);
      }
    } catch (e) {
      // Fallback is already initialized in state
    }
  };

  // ── Handle Login ──
  const handleLogin = async () => {
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError('Please enter your username/email and password.');
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError('');
      const payload = await api.login({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });

      if (!payload?.success) {
        throw new Error(payload?.message || 'Login failed');
      }

      if (onLoginSuccess) {
        onLoginSuccess(payload.user, payload.token);
      }
    } catch (err) {
      setLoginError(err?.response?.data?.message || err?.message || 'Hindi nahanap ang account (User not found) o mali ang password.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Native Google sign-in ──
  const handleGoogleSignInClick = async () => {
    if (googleLoading || loginLoading) return;

    try {
      setGoogleLoading(true);
      setLoginError('');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const googleAccount = await GoogleSignin.signIn();
      if (!googleAccount?.idToken) {
        throw new Error('Hindi nakakuha ng Google ID token. Pakisubukang muli.');
      }

      const payload = await authApi.googleLogin(googleAccount.idToken);
      if (!payload?.success || !payload?.token || !payload?.user) {
        throw new Error(payload?.message || 'Hindi nakumpleto ang Google sign-in.');
      }

      onLoginSuccess?.(payload.user, payload.token);
    } catch (err) {
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) return;

      const message = err?.response?.data?.message || err?.message;
      const isAndroidOAuthConfigurationError =
        err?.code === '10' || /DEVELOPER_ERROR|Developer console is not set up correctly/i.test(String(message || ''));

      if (isAndroidOAuthConfigurationError) {
        console.warn('[Google Sign-In] Android OAuth mismatch. Verify the Android OAuth client package and signing SHA-1 in Google Cloud.');
        setLoginError('Hindi pa available ang Google sign-in. Gamitin muna ang username at password o makipag-ugnayan sa administrator.');
        return;
      }

      setLoginError(
        err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
          ? 'Kailangan i-update o i-install ang Google Play Services para makapag-sign in.'
          : message || 'Hindi gumana ang Google sign-in. Pakisubukang muli.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Handle Register Step 1 ──
  const handleRegisterSubmit = async () => {
    setRegError('');
    setRegSuccess('');

    if (
      !regFirstName.trim() ||
      !regLastName.trim() ||
      !regUsername.trim() ||
      !regBarangayId ||
      !regPassword ||
      !regConfirmPassword
    ) {
      setRegError('Pakiusap punan ang First name, Last name, Username, Barangay, at Password.');
      return;
    }

    if (regUsername.trim().length < 3) {
      setRegError('Ang Username ay dapat hindi bababa sa 3 characters.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Hindi magkatugma ang Password at Confirm Password.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Ang Password ay dapat hindi bababa sa 6 characters.');
      return;
    }

    if (regCategory === '4Ps Household Beneficiaries' && !regHouseholdNumber.trim()) {
      setRegError('Mangyaring ilagay ang inyong 4Ps Household Number.');
      return;
    }

    const selectedBrgy = barangays.find((b) => Number(b.id) === Number(regBarangayId));
    const selectedBrgyName = selectedBrgy ? selectedBrgy.barangay_name : '';
    const fullCombinedAddress = [
      regSitio ? regSitio.trim() : null,
      selectedBrgyName ? `Barangay ${selectedBrgyName}` : null,
      'Bongabong, Oriental Mindoro',
    ]
      .filter(Boolean)
      .join(', ');

    const regData = {
      first_name: regFirstName.trim(),
      last_name: regLastName.trim(),
      username: regUsername.trim(),
      email: regEmail && regEmail.trim() !== '' ? regEmail.trim() : undefined,
      password: regPassword,
      barangay_id: Number(regBarangayId),
      contact_number: regContactNumber ? regContactNumber.trim() : '',
      sex: regSex,
      birthdate: regBirthdate || undefined,
      category: regCategory,
      household_id_number: regCategory === '4Ps Household Beneficiaries' ? regHouseholdNumber.trim() : undefined,
      ip_classification: regIpClassification,
      sitio: regSitio ? regSitio.trim() : '',
      address: fullCombinedAddress,
    };

    // If EMAIL is provided -> Send OTP and open modal
    if (regEmail && regEmail.trim() !== '') {
      setRegLoading(true);
      try {
        const response = await authApi.sendOtp({ email: regEmail.trim() });
        if (response.data?.dev_otp) {
          setDevOtp(response.data.dev_otp);
        }
        setPendingRegData(regData);
        setOtpCode('');
        setOtpError('');
        setShowOtpModal(true);
      } catch (err) {
        setRegError(err?.response?.data?.message || 'Bigo sa pagpapadala ng verification code.');
      } finally {
        setRegLoading(false);
      }
    } else {
      // NO email provided -> Register directly without OTP (for IPs / elderly)
      setRegLoading(true);
      try {
        await authApi.registerBeneficiary(regData);
        setRegSuccess('✓ Matagumpay na nagawa ang account! Lilipat sa login...');
        resetRegForm();
        setTimeout(() => {
          setRegSuccess('');
          setLoginIdentifier('');
          setLoginPassword('');
          setLoginError('');
          setMode('login');
        }, 1800);
      } catch (err) {
        setRegError(err?.response?.data?.message || 'Bigo sa paggawa ng account.');
      } finally {
        setRegLoading(false);
      }
    }
  };

  // ── Handle OTP Verified for Registration ──
  const handleVerifyOtpAndRegister = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setOtpError('Ilagay ang 6-digit verification code.');
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError('');

      // Verify OTP first
      const verifyRes = await authApi.verifyOtp({
        email: pendingRegData.email,
        otp: otpCode.trim(),
      });

      const otpToken = verifyRes?.data?.otp_token;

      // Submit registration with otp_token
      await authApi.registerBeneficiary({
        ...pendingRegData,
        otp_token: otpToken,
      });

      setShowOtpModal(false);
      setDevOtp('');
      resetRegForm();
      setRegSuccess('✓ Matagumpay na nagawa ang account! Lilipat sa login...');
      setTimeout(() => {
        setRegSuccess('');
        setLoginIdentifier('');
        setLoginPassword('');
        setLoginError('');
        setMode('login');
      }, 1800);
    } catch (err) {
      setOtpError(err?.response?.data?.message || 'Maling verification code o nag-expire na.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendRegOtp = async () => {
    if (!pendingRegData?.email) return;
    try {
      setOtpLoading(true);
      setOtpError('');
      const response = await authApi.sendOtp({ email: pendingRegData.email });
      if (response.data?.dev_otp) {
        setDevOtp(response.data.dev_otp);
      }
      setOtpError('Bago at sariwang OTP code ang naipadala!');
    } catch (err) {
      setOtpError(err?.response?.data?.message || 'Hindi maipadala ang verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const resetRegForm = () => {
    setRegFirstName('');
    setRegLastName('');
    setRegUsername('');
    setRegEmail('');
    setRegBarangayId('');
    setRegSitio('');
    setRegSex('Male');
    setRegBirthdate('');
    setRegContactNumber('');
    setRegCategory('4Ps Household Beneficiaries');
    setRegHouseholdNumber('');
    setRegIpClassification('Non-IP');
    setRegPassword('');
    setRegConfirmPassword('');
    setPendingRegData(null);
  };

  // ── Handle Forgot Password Step 1: Send OTP ──
  const handleForgotSendOtp = async () => {
    if (!forgotIdentifier.trim()) {
      setForgotError('Pakiusap ilagay ang iyong Username o Email address.');
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError('');
      setForgotSuccess('');
      setForgotOtp('');
      setForgotDevOtp('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');

      const res = await authApi.sendForgotPasswordOtp({ identifier: forgotIdentifier.trim() });
      const data = res?.data || {};

      if (!data.success || !data.email) {
        throw new Error(data.message || 'Hindi maipadala ang verification code.');
      }

      setForgotMaskedEmail(data.masked_email || data.email || 'iyong email');
      setForgotEmail(data.email || '');
      if (data.dev_otp) {
        setForgotDevOtp(data.dev_otp);
      }

      setForgotStep(2);
    } catch (err) {
      setForgotError(
        err?.response?.data?.message || err?.message || 'Walang nahanap na account para sa ibinigay na username/email.'
      );
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Handle Forgot Password Step 2: Reset ──
  const handleForgotReset = async () => {
    if (!forgotOtp.trim()) {
      setForgotError('Pakiusap ilagay ang 6-digit verification code.');
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError('Ang bagong password ay dapat hindi bababa sa 6 characters.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Hindi magkatugma ang bagong password at confirmation.');
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError('');

      await authApi.resetPassword({
        email: forgotEmail,
        otp: forgotOtp.trim(),
        new_password: forgotNewPassword,
      });

      setForgotSuccess('✓ Matagumpay na napalitan ang iyong password! Bumabalik sa login...');
      setTimeout(() => {
        setForgotStep(1);
        setForgotIdentifier('');
        setForgotEmail('');
        setForgotMaskedEmail('');
        setForgotOtp('');
        setForgotDevOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotSuccess('');
        setForgotError('');
        setLoginIdentifier('');
        setLoginPassword('');
        setMode('login');
      }, 2000);
    } catch (err) {
      setForgotError(err?.response?.data?.message || 'Maling verification code o nag-expire na.');
    } finally {
      setForgotLoading(false);
    }
  };

  const selectedBarangayObj = barangays.find((b) => Number(b.id) === Number(regBarangayId));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: LOGIN (Faithful to original mobile & web designs)        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'login' && (
            <View style={styles.loginCard}>
              {/* Header Icon Wrap */}
              <View style={styles.iconWrap}>
                <Image
                  source={require('../assets/dswd-logo.jpg')}
                  style={styles.authLogo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.title}>Sign in to BeniAid</Text>
              <Text style={styles.subtitle}>Access your municipal benefits, RFID records &amp; assistance</Text>

              {loginError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{loginError}</Text>
                </View>
              ) : null}

              {/* Identifier */}
              <Text style={styles.label}>USERNAME OR EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={loginIdentifier}
                onChangeText={(text) => {
                  setLoginIdentifier(text);
                  if (loginError) setLoginError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Ilagay ang iyong username o email"
                placeholderTextColor="#5c6678"
              />

              {/* Password */}
              <View style={styles.passwordRow}>
                <Text style={styles.label}>PASSWORD</Text>
                <TouchableOpacity
                  onPress={() => {
                    setForgotIdentifier(loginIdentifier);
                    setForgotStep(1);
                    setForgotError('');
                    setForgotSuccess('');
                    setMode('forgot');
                  }}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.passwordFieldWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={loginPassword}
                  onChangeText={(text) => {
                    setLoginPassword(text);
                    if (loginError) setLoginError('');
                  }}
                  secureTextEntry={!showLoginPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#5c6678"
                />
                <TouchableOpacity
                  onPress={() => setShowLoginPassword(!showLoginPassword)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeText}>{showLoginPassword ? '◉' : '◌'}</Text>
                </TouchableOpacity>
              </View>

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.primaryButton, loginLoading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.primaryButtonText}>Signing In...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <TouchableOpacity
                style={[styles.googleButton, googleLoading && styles.btnDisabled]}
                onPress={handleGoogleSignInClick}
                disabled={googleLoading || loginLoading}
              >
                <Text style={styles.googleIcon}>G</Text>
                {googleLoading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#4285F4" size="small" />
                    <Text style={styles.googleText}>Connecting to Google...</Text>
                  </View>
                ) : (
                  <Text style={styles.googleText}>Sign in with Google</Text>
                )}
              </TouchableOpacity>

              {/* Create Account Link */}
              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Don’t have an account yet? </Text>
                <TouchableOpacity
                  onPress={() => {
                    setRegError('');
                    setRegSuccess('');
                    setMode('register');
                  }}
                >
                  <Text style={styles.signupLink}>Create Account</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.subHelpText}>
                Para sa tulong sa account, makipag-ugnayan sa inyong social worker o barangay officer.
              </Text>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: REGISTER                                                */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'register' && (
            <View style={styles.loginCard}>
              <View style={styles.iconWrap}>
                <Text style={styles.iconBadge}>📝</Text>
              </View>

              <Text style={styles.title}>Create Beneficiary Account</Text>
              <Text style={styles.subtitle}>Join the Bongabong Social Welfare digital registry</Text>

              {regError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{regError}</Text>
                </View>
              ) : null}

              {regSuccess ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{regSuccess}</Text>
                </View>
              ) : null}

              {/* Names */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>FIRST NAME *</Text>
                  <TextInput
                    style={styles.input}
                    value={regFirstName}
                    onChangeText={setRegFirstName}
                    placeholder="hal. Maria"
                    placeholderTextColor="#5c6678"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>LAST NAME *</Text>
                  <TextInput
                    style={styles.input}
                    value={regLastName}
                    onChangeText={setRegLastName}
                    placeholder="hal. Santos"
                    placeholderTextColor="#5c6678"
                  />
                </View>
              </View>

              {/* Username */}
              <View style={styles.passwordRow}>
                <Text style={styles.label}>USERNAME *</Text>
                <Text style={styles.hintBadge}>pang-login</Text>
              </View>
              <TextInput
                style={styles.input}
                value={regUsername}
                onChangeText={(text) => setRegUsername(text.replace(/\s+/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="hal. mariasantos"
                placeholderTextColor="#5c6678"
              />
              <Text style={styles.inputHint}>
                Gagamitin sa pag-login kahit walang Gmail account.
              </Text>

              {/* Email (Optional) */}
              <View style={styles.passwordRow}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <Text style={styles.optionalBadge}>opsyonal</Text>
              </View>
              <TextInput
                style={styles.input}
                value={regEmail}
                onChangeText={setRegEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="hal. maria@gmail.com (Opsyonal)"
                placeholderTextColor="#5c6678"
              />
              <Text style={styles.inputHint}>
                May OTP verification kung lalagyan. Kung walang email, maaari itong iwang bakante.
              </Text>

              {/* Barangay Picker */}
              <Text style={styles.label}>BARANGAY *</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowBarangayModal(true)}
              >
                <Text
                  style={[
                    styles.pickerBtnText,
                    !selectedBarangayObj && styles.pickerPlaceholder,
                  ]}
                >
                  {selectedBarangayObj ? `Barangay ${selectedBarangayObj.barangay_name}` : 'Select Barangay'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Sitio */}
              <Text style={styles.label}>SITIO / STREET (OPSYONAL)</Text>
              <TextInput
                style={styles.input}
                value={regSitio}
                onChangeText={setRegSitio}
                placeholder="hal. Sitio Centro"
                placeholderTextColor="#5c6678"
              />

              {/* Sex & Birthdate */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>SEX</Text>
                  <View style={styles.sexSelector}>
                    {['Male', 'Female', 'Other'].map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.sexChip, regSex === item && styles.sexChipActive]}
                        onPress={() => setRegSex(item)}
                      >
                        <Text
                          style={[
                            styles.sexChipText,
                            regSex === item && styles.sexChipTextActive,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>BIRTHDATE</Text>
                  <TextInput
                    style={styles.input}
                    value={regBirthdate}
                    onChangeText={setRegBirthdate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#5c6678"
                  />
                </View>
              </View>

              {/* Contact Number */}
              <Text style={styles.label}>CONTACT NUMBER</Text>
              <TextInput
                style={styles.input}
                value={regContactNumber}
                onChangeText={setRegContactNumber}
                keyboardType="phone-pad"
                placeholder="0917xxxxxxx"
                placeholderTextColor="#5c6678"
              />

              {/* Category */}
              <Text style={styles.label}>PRIMARY SECTOR CATEGORY</Text>
              <View style={styles.sectorList}>
                {SECTORS.map((sec) => (
                  <TouchableOpacity
                    key={sec}
                    style={[
                      styles.sectorChip,
                      regCategory === sec && styles.sectorChipActive,
                    ]}
                    onPress={() => setRegCategory(sec)}
                  >
                    <Text
                      style={[
                        styles.sectorChipText,
                        regCategory === sec && styles.sectorChipTextActive,
                      ]}
                    >
                      {regCategory === sec ? '● ' : '○ '}
                      {sec}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 4Ps Household Number Field (Conditional) */}
              {regCategory === '4Ps Household Beneficiaries' && (
                <View style={styles.hhBox}>
                  <View style={styles.passwordRow}>
                    <Text style={styles.hhLabel}>4PS HOUSEHOLD NUMBER *</Text>
                    <Text style={styles.hhBadge}>Magiging Beneficiary Number</Text>
                  </View>
                  <TextInput
                    style={styles.hhInput}
                    value={regHouseholdNumber}
                    onChangeText={setRegHouseholdNumber}
                    placeholder="hal. 175201001-0001"
                    placeholderTextColor="#5c6678"
                  />
                  <Text style={styles.hhHint}>
                    Ipasok ang opisyal na 4Ps Household ID Number mula sa inyong Pantawid Pamilya ID card o certificate.
                  </Text>
                </View>
              )}

              {/* IP Classification */}
              <Text style={styles.label}>IP CLASSIFICATION</Text>
              <View style={styles.row}>
                {['Non-IP', 'IP'].map((ip) => (
                  <TouchableOpacity
                    key={ip}
                    style={[
                      styles.ipChip,
                      regIpClassification === ip && styles.ipChipActive,
                    ]}
                    onPress={() => setRegIpClassification(ip)}
                  >
                    <Text
                      style={[
                        styles.ipChipText,
                        regIpClassification === ip && styles.ipChipTextActive,
                      ]}
                    >
                      {ip === 'IP' ? '🏕️ IP (Indigenous)' : '🏘️ Non-IP (General)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Password & Confirm */}
              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>PASSWORD *</Text>
                  <View style={styles.passwordFieldWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      value={regPassword}
                      onChangeText={setRegPassword}
                      secureTextEntry={!showRegPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#5c6678"
                    />
                    <TouchableOpacity
                      onPress={() => setShowRegPassword(!showRegPassword)}
                      style={styles.eyeButton}
                    >
                      <Text style={styles.eyeText}>{showRegPassword ? '◉' : '◌'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.label}>CONFIRM *</Text>
                  <View style={styles.passwordFieldWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      value={regConfirmPassword}
                      onChangeText={setRegConfirmPassword}
                      secureTextEntry={!showRegConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#5c6678"
                    />
                    <TouchableOpacity
                      onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      style={styles.eyeButton}
                    >
                      <Text style={styles.eyeText}>{showRegConfirmPassword ? '◉' : '◌'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Submit Registration Button */}
              <TouchableOpacity
                style={[styles.primaryButton, regLoading && styles.btnDisabled]}
                onPress={handleRegisterSubmit}
                disabled={regLoading}
              >
                {regLoading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.primaryButtonText}>
                      {regEmail && regEmail.trim() !== ''
                        ? 'Ipinapadala ang OTP...'
                        : 'Ginagawa ang Account...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {regEmail && regEmail.trim() !== ''
                      ? 'Ipadala ang OTP at I-verify'
                      : 'Lumikha ng Beneficiary Account'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Switch back to Login */}
              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Already registered? </Text>
                <TouchableOpacity
                  onPress={() => {
                    setRegError('');
                    setRegSuccess('');
                    setMode('login');
                  }}
                >
                  <Text style={styles.signupLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* MODE: FORGOT PASSWORD                                         */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'forgot' && (
            <View style={styles.loginCard}>
              <View style={styles.iconWrap}>
                <Text style={styles.iconBadge}>🔒</Text>
              </View>

              <Text style={styles.title}>
                {forgotStep === 1 ? 'Forgot Password' : 'Reset Your Password'}
              </Text>
              <Text style={styles.subtitle}>
                {forgotStep === 1
                  ? 'Ilagay ang iyong Username o Email upang makatanggap ng 6-digit verification code.'
                  : `I-type ang code na ipinadala sa ${forgotMaskedEmail} at ilagay ang bagong password.`}
              </Text>

              {forgotError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{forgotError}</Text>
                </View>
              ) : null}

              {forgotSuccess ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{forgotSuccess}</Text>
                </View>
              ) : null}

              {/* STEP 1: Enter Username or Email */}
              {forgotStep === 1 && (
                <>
                  <Text style={styles.label}>USERNAME O EMAIL ADDRESS</Text>
                  <TextInput
                    style={styles.input}
                    value={forgotIdentifier}
                    onChangeText={setForgotIdentifier}
                    autoCapitalize="none"
                    placeholder="Ilagay ang iyong username o email"
                    placeholderTextColor="#5c6678"
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, forgotLoading && styles.btnDisabled]}
                    onPress={handleForgotSendOtp}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <View style={styles.btnRow}>
                        <ActivityIndicator color="#ffffff" size="small" />
                        <Text style={styles.primaryButtonText}>Hinahanap ang Account...</Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>Ipadala ang Verification Code</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* STEP 2: Enter OTP & New Password */}
              {forgotStep === 2 && (
                <>
                  {forgotDevOtp ? (
                    <TouchableOpacity
                      style={styles.devOtpBanner}
                      onPress={() => setForgotOtp(forgotDevOtp)}
                    >
                      <Text style={styles.devOtpText}>
                        🔧 Dev OTP: <Text style={styles.devOtpBold}>{forgotDevOtp}</Text> (Tap to fill)
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <Text style={styles.label}>6-DIGIT VERIFICATION CODE</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={forgotOtp}
                    onChangeText={setForgotOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                    placeholder="123456"
                    placeholderTextColor="#5c6678"
                  />

                  <View style={styles.forgotOptionsRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setForgotStep(1);
                        setForgotOtp('');
                        setForgotDevOtp('');
                        setForgotNewPassword('');
                        setForgotConfirmPassword('');
                        setForgotError('');
                      }}
                    >
                      <Text style={styles.forgotText}>Palitan ang account</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleForgotSendOtp} disabled={forgotLoading}>
                      <Text style={styles.forgotText}>Ipadala ulit ang code</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>BAGONG PASSWORD *</Text>
                  <View style={styles.passwordFieldWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      value={forgotNewPassword}
                      onChangeText={setForgotNewPassword}
                      secureTextEntry={!showForgotNewPassword}
                      placeholder="Hindi bababa sa 6 characters"
                      placeholderTextColor="#5c6678"
                    />
                    <TouchableOpacity
                      onPress={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      style={styles.eyeButton}
                    >
                      <Text style={styles.eyeText}>{showForgotNewPassword ? '◉' : '◌'}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>KUMPIRMAHIN ANG BAGONG PASSWORD *</Text>
                  <View style={styles.passwordFieldWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      value={forgotConfirmPassword}
                      onChangeText={setForgotConfirmPassword}
                      secureTextEntry
                      placeholder="Ulitin ang bagong password"
                      placeholderTextColor="#5c6678"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, forgotLoading && styles.btnDisabled]}
                    onPress={handleForgotReset}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <View style={styles.btnRow}>
                        <ActivityIndicator color="#ffffff" size="small" />
                        <Text style={styles.primaryButtonText}>Pinapalitan ang Password...</Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>I-save ang Bagong Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Back to Sign In */}
              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Naalala mo na ang iyong password? </Text>
                <TouchableOpacity
                  onPress={() => {
                    setForgotError('');
                    setForgotSuccess('');
                    setMode('login');
                  }}
                >
                  <Text style={styles.signupLink}>Bumalik sa Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.footerNote}>
            © 2026 Municipality of Bongabong • BeniAid Social Welfare &amp; Development
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* BARANGAY SELECTION MODAL                                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showBarangayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBarangayModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Barangay</Text>
              <TouchableOpacity
                onPress={() => setShowBarangayModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {barangays.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.barangayItem,
                    Number(regBarangayId) === Number(b.id) && styles.barangayItemActive,
                  ]}
                  onPress={() => {
                    setRegBarangayId(String(b.id));
                    setShowBarangayModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.barangayItemText,
                      Number(regBarangayId) === Number(b.id) && styles.barangayItemTextActive,
                    ]}
                  >
                    Barangay {b.barangay_name}
                  </Text>
                  {Number(regBarangayId) === Number(b.id) ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* OTP VERIFICATION MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <View style={styles.otpModalOverlay}>
          <View style={styles.otpModalCard}>
            <View style={styles.otpModalHeader}>
              <View style={styles.otpIconBadge}>
                <Text style={{ fontSize: 24 }}>✉️</Text>
              </View>
              <Text style={styles.otpModalTitle}>I-verify ang Email</Text>
              <Text style={styles.otpModalSub}>
                Nagpadala kami ng 6-digit verification code sa:{'\n'}
                <Text style={{ fontWeight: '800', color: '#111827' }}>{pendingRegData?.email}</Text>
              </Text>
            </View>

            {otpError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            ) : null}

            {devOtp ? (
              <TouchableOpacity
                style={styles.devOtpBanner}
                onPress={() => setOtpCode(devOtp)}
              >
                <Text style={styles.devOtpText}>
                  🔧 Dev OTP: <Text style={styles.devOtpBold}>{devOtp}</Text> (Tap to fill)
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.label}>6-DIGIT VERIFICATION CODE</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="••••••"
              placeholderTextColor="#5c6678"
            />

            <TouchableOpacity
              style={[styles.primaryButton, otpLoading && styles.btnDisabled]}
              onPress={handleVerifyOtpAndRegister}
              disabled={otpLoading}
            >
              {otpLoading ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.primaryButtonText}>Pina-verify at lumilikha...</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>I-verify at Kumpletuhin</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpActionRow}>
              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendRegOtp}
                disabled={otpLoading}
              >
                <Text style={styles.resendBtnText}>Ipadala muli ang code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowOtpModal(false)}
              >
                <Text style={styles.cancelBtnText}>Bumalik / Baguhin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#4a4f57',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#f1f1f1',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#dfeaf8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBadge: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  authLogo: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 13.5,
    color: '#4b5563',
    marginBottom: 20,
    lineHeight: 18,
  },
  label: {
    color: '#1f2937',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
    color: '#111827',
  },
  inputHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: -8,
    marginBottom: 12,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '600',
  },
  passwordFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    height: 52,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
  },
  eyeButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeText: {
    fontSize: 18,
    color: '#4b5563',
  },
  primaryButton: {
    backgroundColor: '#1f2d3d',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#c9ced6',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#6b7280',
    fontSize: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    height: 52,
    marginBottom: 18,
  },
  googleIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 10,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  signupText: {
    fontSize: 14.5,
    color: '#374151',
  },
  signupLink: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 14.5,
  },
  subHelpText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  successBox: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  successText: {
    color: '#047857',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  forgotOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  hintBadge: {
    fontSize: 10,
    color: '#1d4ed8',
    backgroundColor: '#dfeaf8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  optionalBadge: {
    fontSize: 10,
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 14,
  },
  pickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  pickerPlaceholder: {
    color: '#64748b',
    fontWeight: 'normal',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6b7280',
  },
  sexSelector: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
  },
  sexChip: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sexChipActive: {
    backgroundColor: '#1f2d3d',
    borderColor: '#1f2d3d',
  },
  sexChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  sexChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  sectorList: {
    gap: 6,
    marginBottom: 14,
  },
  sectorChip: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectorChipActive: {
    backgroundColor: '#dfeaf8',
    borderColor: '#1d4ed8',
  },
  sectorChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  sectorChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  hhBox: {
    backgroundColor: '#dfeaf8',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hhLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  hhBadge: {
    fontSize: 9.5,
    color: '#1e40af',
    backgroundColor: '#bfdbfe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700',
  },
  hhInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#60a5fa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
    marginBottom: 6,
  },
  hhHint: {
    fontSize: 10.5,
    color: '#2563eb',
    lineHeight: 15,
  },
  ipChip: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d7dfe9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  ipChipActive: {
    backgroundColor: '#dfeaf8',
    borderColor: '#1d4ed8',
  },
  ipChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  ipChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  devOtpBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  devOtpText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  devOtpBold: {
    fontWeight: '900',
    color: '#b45309',
  },
  footerNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  barangayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  barangayItemActive: {
    backgroundColor: '#dfeaf8',
    borderRadius: 10,
  },
  barangayItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  barangayItemTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  checkmark: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '800',
  },
  otpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  otpModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otpIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#dfeaf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  otpModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  otpModalSub: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  otpActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  resendBtn: {
    paddingVertical: 8,
  },
  resendBtnText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});

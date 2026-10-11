import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Linking,
  Vibration,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';

/**
 * Live camera QR / barcode scanner (same behaviour as the web "Buksan ang Camera QR Scanner").
 * Calls onScan(code) once per detected code, then closes itself.
 */
const QrCameraScanner = ({ visible, onClose, onScan, title = 'Live Camera QR Scanner', subtitle }) => {
  const [permission, setPermission] = useState('checking'); // checking | granted | denied | blocked
  const handledRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    handledRef.current = false;
    let cancelled = false;

    const requestPermission = async () => {
      if (Platform.OS !== 'android') {
        setPermission('granted');
        return;
      }
      try {
        const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (already) {
          if (!cancelled) setPermission('granted');
          return;
        }
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Camera Permission',
          message: 'Kailangan ng BeniAid ang camera para ma-scan ang QR Pass ng benepisyaryo.',
          buttonPositive: 'Payagan',
          buttonNegative: 'Huwag',
        });
        if (cancelled) return;
        if (result === PermissionsAndroid.RESULTS.GRANTED) setPermission('granted');
        else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) setPermission('blocked');
        else setPermission('denied');
      } catch (e) {
        if (!cancelled) setPermission('denied');
      }
    };

    setPermission('checking');
    requestPermission();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleReadCode = (event) => {
    const code = String(event?.nativeEvent?.codeStringValue || '').trim();
    if (!code || handledRef.current) return;
    handledRef.current = true;
    Vibration.vibrate(80);
    onScan && onScan(code);
    onClose && onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={s.page}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>📷 {title}</Text>
            <Text style={s.headerSub}>
              {subtitle || 'Itapat ang QR Pass ng benepisyaryo sa camera para awtomatikong maitala.'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕ Isara</Text>
          </TouchableOpacity>
        </View>

        <View style={s.cameraWrap}>
          {permission === 'checking' && (
            <View style={s.center}>
              <ActivityIndicator size="large" color="#60a5fa" />
              <Text style={s.infoText}>Binubuksan ang camera...</Text>
            </View>
          )}

          {(permission === 'denied' || permission === 'blocked') && (
            <View style={s.center}>
              <Text style={s.errorTitle}>Hindi pinayagan ang camera</Text>
              <Text style={s.infoText}>
                I-enable ang camera permission para sa BeniAid upang magamit ang QR scanner.
              </Text>
              <TouchableOpacity
                style={s.settingsBtn}
                onPress={() => (permission === 'blocked' ? Linking.openSettings() : setPermission('checking'))}
              >
                <Text style={s.settingsText}>
                  {permission === 'blocked' ? 'Buksan ang Settings' : 'Subukang Muli'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {permission === 'granted' && visible && (
            <Camera
              style={StyleSheet.absoluteFill}
              cameraType={CameraType.Back}
              flashMode="auto"
              scanBarcode
              onReadCode={handleReadCode}
              showFrame
              laserColor="#22c55e"
              frameColor="#ffffff"
            />
          )}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Sinusuportahan: BeniAid Digital QR Pass (EBMS-QR), Beneficiary ID QR, at barcode.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: { color: '#93c5fd', fontSize: 15, fontWeight: '800' },
  headerSub: { color: '#cbd5e1', fontSize: 11.5, marginTop: 3 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginLeft: 10 },
  closeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cameraWrap: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  infoText: { color: '#cbd5e1', fontSize: 13, textAlign: 'center', marginTop: 10 },
  errorTitle: { color: '#fca5a5', fontSize: 16, fontWeight: '800' },
  settingsBtn: { marginTop: 16, backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  settingsText: { color: '#fff', fontWeight: '700' },
  footer: { padding: 14, borderTopWidth: 1, borderTopColor: '#1e293b' },
  footerText: { color: '#94a3b8', fontSize: 11, textAlign: 'center' },
});

export default QrCameraScanner;


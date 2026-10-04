import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const CHANNEL_ID = 'beniaid-beneficiary-notifications';
const CHANNEL_NAME = 'BeniAid notifications';
const nativeNotifications = NativeModules.BeniAidNotifications;

export const prepareDeviceNotifications = async () => {
  if (Platform.OS !== 'android' || !nativeNotifications) return false;

  await nativeNotifications.createChannel(CHANNEL_ID, CHANNEL_NAME);

  if (Number(Platform.Version) >= 33) {
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS || 'android.permission.POST_NOTIFICATIONS',
      {
        title: 'Pahintulot sa notification',
        message: 'Payagan ang BeniAid na magpakita ng mahahalagang abiso sa iyong cellphone.',
        buttonPositive: 'Payagan',
        buttonNegative: 'Hindi ngayon',
      }
    );
    return permission === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
};

export const showDeviceNotification = async (notificationId, title, body) => {
  if (Platform.OS !== 'android' || !nativeNotifications) return false;
  return nativeNotifications.showNotification(
    String(notificationId),
    String(title || 'BeniAid'),
    String(body || 'May bago kang abiso sa BeniAid.')
  );
};

export const startBackgroundNotificationChecks = async (userId, token, apiUrl) => {
  if (Platform.OS !== 'android' || !nativeNotifications || !token || !userId) return false;
  return nativeNotifications.startBackgroundMonitoring(String(userId), token, apiUrl);
};

export const stopBackgroundNotificationChecks = async () => {
  if (Platform.OS !== 'android' || !nativeNotifications) return false;
  return nativeNotifications.stopBackgroundMonitoring();
};

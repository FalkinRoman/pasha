import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken } from '../api/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('session', {
      name: 'Сеанс',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let tokenData;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync();
  } catch {
    const Constants = (await import('expo-constants')).default;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return null;
    tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  }
  const token = tokenData.data;
  await registerPushToken(token, Platform.OS);
  return token;
}

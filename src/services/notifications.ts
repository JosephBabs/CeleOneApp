import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Init FCM AFTER login
 */
export async function initFCM() {
  try {
    // Android 13+
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }

    const permission = await messaging().requestPermission();

    const enabled =
      permission === messaging.AuthorizationStatus.AUTHORIZED ||
      permission === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('🔕 Notification permission denied');
      return;
    }

    const token = await messaging().getToken();
    const uid = auth().currentUser?.uid;

    console.log('🔥 FCM TOKEN:', token);

    if (uid && token) {
      await firestore()
        .collection('users')
        .doc(uid)
        .set({ fcmToken: token }, { merge: true });
    }
  } catch (e) {
    console.log('❌ initFCM error:', e);
  }
}

/**
 * Foreground notifications
 */
export function listenForegroundNotifications() {
  return messaging().onMessage(async remoteMessage => {
    console.log('📩 Foreground:', remoteMessage);
    await saveNotification(remoteMessage);
  });
}

/**
 * Save notification to Firestore
 */
async function saveNotification(remoteMessage: any) {
  const uid = auth().currentUser?.uid;
  if (!uid) return;

  const { title, body } = remoteMessage.notification || {};

  await firestore()
    .collection('users')
    .doc(uid)
    .collection('notifications')
    .add({
      title: title || 'Notification',
      description: body || '',
      data: remoteMessage.data || {},
      read: false,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
}

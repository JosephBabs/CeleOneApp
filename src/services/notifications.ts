import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Init FCM AFTER login
 */
export async function initFCM(uid: string) {
  if (!uid) return console.log('❌ initFCM: no UID provided');

  console.log('🟡 initFCM() called for UID:', uid);

  try {
    // Android 13+ permission
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('🔕 Android notification permission denied');
        await saveFallbackToken(uid);
        return;
      }
    }

    const permission = await messaging().requestPermission();
    const enabled =
      permission === messaging.AuthorizationStatus.AUTHORIZED ||
      permission === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('🔕 Notification permission denied');
      await saveFallbackToken(uid);
      return;
    }

    // Get FCM token
    const token = await messaging().getToken();
    if (!token) {
      console.log('⚠️ FCM token unavailable');
      await saveFallbackToken(uid);
      return;
    }

    console.log('🔥 FCM TOKEN:', token);

    // Save token
    await firestore()
      .collection('userTokens')
      .doc(uid)
      .set(
        {
          token,
          platform: Platform.OS,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    console.log('✅ Token saved');

  } catch (e) {
    console.log('❌ initFCM error:', e);
    await saveFallbackToken(uid);
  }
}


/**
 * Save a fallback token if FCM is unavailable
 */
async function saveFallbackToken(uid: string) {
  await firestore()
    .collection('userTokens')
    .doc(uid)
    .set(
      {
        offline: true,
        platform: Platform.OS,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  console.log('⚠️ Fallback token saved for UID:', uid);
}

/**
 * Foreground notifications
 */
export function listenForegroundNotifications() {
  return messaging().onMessage(async remoteMessage => {
    console.log('📩 Foreground notification:', remoteMessage);
    await saveNotification(remoteMessage);
  });
}

/**
 * Background / Quit notifications
 */
export function handleBackgroundNotifications() {
  // Background handler
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('📩 Background notification:', remoteMessage);
    await saveNotification(remoteMessage);
  });

  // Opened from background
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('🔔 Opened from background:', remoteMessage);
  });

  // Opened from quit
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('🔔 Opened from quit:', remoteMessage);
      }
    });
}

/**
 * Save notification to in-app inbox
 */
async function saveNotification(remoteMessage: any) {
  const uid = auth().currentUser?.uid;
  if (!uid) return;

  const { title, body } = remoteMessage.notification || {};

  try {
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
    console.log('✅ Notification saved to inbox');
  } catch (e) {
    console.log('❌ Failed to save notification:', e);
  }
}

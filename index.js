/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import messaging from '@react-native-firebase/messaging';

// 🔥 Register app FIRST
AppRegistry.registerComponent(appName, () => App);

// 🔕 Background messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📩 Background message:', remoteMessage);
});

// 🔔 Notification opened from background
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log('🔔 Opened from background:', remoteMessage);
});

// 🔔 Notification opened from quit
messaging()
  .getInitialNotification()
  .then(remoteMessage => {
    if (remoteMessage) {
      console.log('🔔 Opened from quit:', remoteMessage);
    }
  });

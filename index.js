import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// 🔥 Register FIRST
AppRegistry.registerComponent(appName, () => App);

// 🌙 Background messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📩 Background:', remoteMessage);
});

// 🔔 Opened from background
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log('🔔 Opened from background:', remoteMessage);
});

// 🔔 Opened from killed
messaging()
  .getInitialNotification()
  .then(remoteMessage => {
    if (remoteMessage) {
      console.log('🔔 Opened from quit:', remoteMessage);
    }
  });

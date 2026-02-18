import 'intl';
import 'intl-pluralrules';
import './i18n';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import auth from '@react-native-firebase/auth';

import AppNavigator from './app/source/configs/navigation';
import {
  initFCM,
  listenForegroundNotifications,
  handleBackgroundNotifications,
} from './src/services/notifications';
import { bootstrapChat } from './src/chat/chatBootstrap';

enableScreens(true);

export default function App() {
  useEffect(() => {
    let unsubscribeFCM: (() => void) | undefined;

    const unsubscribeAuth = auth().onAuthStateChanged(async user => {
      if (!user) {
        if (unsubscribeFCM) unsubscribeFCM();
        return;
      }

      console.log('✅ User logged in:', user.uid);

      
        bootstrapChat('https://your-socket-server.com').catch(console.error);
      

      // Init FCM
      await initFCM(user.uid);

      // Listen foreground notifications
      unsubscribeFCM = listenForegroundNotifications();

      // Background notificationsr
      handleBackgroundNotifications();
    });

    return () => {
      if (unsubscribeFCM) unsubscribeFCM();
      unsubscribeAuth();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

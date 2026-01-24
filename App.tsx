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
} from './src/services/notifications';

import './app/source/modules/auth/firebaseConfig';

enableScreens(true);

export default function App() {
  useEffect(() => {
    let unsubscribeFCM: (() => void) | undefined;

    const unsubscribeAuth = auth().onAuthStateChanged(async user => {
      if (!user) {
        if (unsubscribeFCM) unsubscribeFCM();
        return;
      }

      // 🔥 Init FCM once user is logged in
      await initFCM();

      // 👀 Foreground notifications
      unsubscribeFCM = listenForegroundNotifications();
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

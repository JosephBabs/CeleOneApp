import React, { useEffect } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { d_assets } from '../../configs/assets';
import { auth } from '../../modules/auth/firebaseConfig'; // adjust path to your firebaseConfig
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
// import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initFCM } from '../../../../src/services/notifications';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const launched = await AsyncStorage.getItem('hasLaunched');

        if (!launched) {
          navigation.replace('OnboardingScreen');
        } else {
          const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
              console.log('User is logged in:', user.uid);
              initFCM(user.uid);
              // Navigate to MainNav
              navigation.replace('MainNav');
            } else {
              console.log('No user logged in, redirecting to Login');
              // Navigate to Login
              navigation.replace('Login');
            }
          });

          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // Fallback to Login if error
        navigation.replace('Login');
      }
    };

    checkAuth();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image source={d_assets.images.appLogo} style={styles.logo} />
      <ActivityIndicator size="large" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 20,
  },
});

export default SplashScreen;

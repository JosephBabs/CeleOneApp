import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  SafeAreaView,
  Switch,
  ScrollView,
  Image,
} from 'react-native';
import { Alert } from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme/ThemeContext';
import { COLORS, Colors } from '../../../core/theme/colors';
import { d_assets } from '../../configs/assets';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../auth/firebaseConfig';

const Settings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useAppTheme();
  const isDark = mode === 'dark';

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('notifications-enabled').then(value => {
      if (value !== null) setNotificationsEnabled(value === 'true');
    });
  }, []);

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await AsyncStorage.setItem('notifications-enabled', newValue.toString());
  };

  const auth = getAuth();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (!auth.currentUser) return;

      const uid = auth.currentUser.uid;
      const ref = doc(db, 'user_data', uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setUserProfile(snap.data());
      }
    };

    loadUser();
  }, [auth.currentUser]);

  const confirmLogout = () => {
    Alert.alert(
      t('settings.logout') || 'Logout',
      t('settings.confirmLogout') || 'Are you sure you want to log out?',
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              console.log('User logged out');
              // Navigate to login screen
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Try again.');
            }
          },
        },
      ],
    );
  };

  const backgroundColor = isDark
    ? Colors.darkBackground
    : Colors.lightBackground;
  const textColor = isDark ? Colors.textDark : Colors.textLight;

  const changeLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    await AsyncStorage.setItem('user-language', lng);
    setLanguageModalVisible(false);
  };

  // Icon mapping for options
  const optionIcons = {
    language: 'language-outline',
    notifications: 'notifications-outline',
    darkMode: 'moon-outline',
    privacyPolicy: 'document-text-outline',
    aboutApp: 'information-circle-outline',
    user: 'person-circle-outline',
  };

  const showAlert = (message: string) => {
    Alert.alert('Info', message, [{ text: 'OK', style: 'default' }], {
      cancelable: true,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header1}>
          <Text style={[styles.title, { color: textColor }]}>
            {t('settings.title')}
          </Text>
          <Image source={d_assets.images.appLogo} style={styles.logo} />
          {/* <Text style={styles.titleSimple2}>{t("home.explore")}</Text> */}
        </View>
        {/* <Text style={[styles.title, { color: textColor }]}>{t("settings.title")}</Text> */}

        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => setAccountOpen(!accountOpen)}
        >
          <View style={styles.iconText}>
            <Ionicons name="person-outline" size={24} color={textColor} />
            <Text style={[styles.optionText, { color: textColor }]}>
              {t('settings.monCompte')}
              {userProfile &&
                ` (${userProfile.firstName} ${userProfile.lastName})`}
            </Text>
          </View>

          <Ionicons
            name={accountOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={textColor}
          />
        </TouchableOpacity>
        {accountOpen && (
          <View style={styles.subMenu}>
            <TouchableOpacity
              style={styles.subItem}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="create-outline" size={20} color={textColor} />
              <Text style={[styles.subText, { color: textColor }]}>
                {t('settings.updateProfile') || 'Edit account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.subItem} onPress={confirmLogout}>
              <Ionicons name="log-out-outline" size={20} color="red" />
              <Text style={[styles.subText, { color: 'red' }]}>
                {t('settings.logout')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Language */}
        <TouchableOpacity
          style={[styles.optionButton]}
          onPress={() => setLanguageModalVisible(true)}
        >
          <View style={styles.iconText}>
            <Ionicons name={optionIcons.language} size={24} color={textColor} />
            <Text style={[styles.optionText, { color: textColor }]}>
              {t('settings.language')}
            </Text>
          </View>
          <Text style={[styles.optionValue, { color: textColor }]}>
            {i18n.language.toUpperCase()} ⌄
          </Text>
        </TouchableOpacity>

        {/* Notifications */}
        <View style={styles.optionButton}>
          <View style={styles.iconText}>
            <Ionicons
              name={optionIcons.notifications}
              size={24}
              color={textColor}
            />
            <Text style={[styles.optionText, { color: textColor }]}>
              {t('settings.notifications')}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#ccc', true: Colors.light.primary }}
            thumbColor={notificationsEnabled ? Colors.light.primary : '#f4f3f4'}
          />
        </View>

        {/* Dark Mode */}
        <View style={styles.optionButton}>
          <View style={styles.iconText}>
            <Ionicons name={optionIcons.darkMode} size={24} color={textColor} />
            <Text style={[styles.optionText, { color: textColor }]}>
              {t('settings.darkMode')}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#ccc', true: Colors.light.primary }}
            thumbColor={isDark ? Colors.light.primary : '#f4f3f4'}
          />
        </View>

        {/* Privacy Policy */}
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => showAlert(t('settings.privacyPolicyText'))}
        >
          <View style={styles.iconText}>
            <Ionicons
              name={optionIcons.privacyPolicy}
              size={24}
              color={textColor}
            />
            <Text style={[styles.optionText, { color: textColor }]}>
              {t('settings.privacyPolicy')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* About */}
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => showAlert(t('settings.aboutAppText'))}
        >
          <View style={styles.iconText}>
            <Ionicons name={optionIcons.aboutApp} size={24} color={textColor} />
            <Text style={[styles.optionText, { color: textColor }]}>
              {t('settings.aboutApp')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Language Selection Modal */}
        <Modal
          visible={languageModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.languageModal, { backgroundColor }]}>
              <Text style={[styles.languageTitle, { color: textColor }]}>
                {t('settings.selectLanguage')}
              </Text>

              {['en', 'fr', 'yo', 'gou', 'es'].map(lng => (
                <Pressable
                  key={lng}
                  style={styles.languageItem}
                  onPress={() => changeLanguage(lng)}
                >
                  <Text style={{ color: textColor }}>{t(`lang.${lng}`)}</Text>
                </Pressable>
              ))}

              <Pressable
                style={[styles.closeButton, { borderColor: textColor }]}
                onPress={() => setLanguageModalVisible(false)}
              >
                <Text style={{ color: textColor }}>{t('common.close')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    // paddingVertical: 20,
    // paddingHorizontal: 16,
    letterSpacing: 1,
    color: COLORS.light.primary,
    // marginBlockStart: 22
  },

  logo: {
    height: 40,
    width: 50,
    objectFit: 'contain',
  },
  header1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // marginBlockStart: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    // elevation: 1
  },
  optionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  iconText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // spacing between icon and text
  },
  optionText: {
    fontSize: 18,
  },
  optionValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  languageModal: {
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  languageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  languageItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  closeButton: {
    marginTop: 30,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  subMenu: {
    paddingLeft: 48,
    marginTop: 8,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  subText: {
    marginLeft: 12,
    fontSize: 15,
  },
});

export default Settings;

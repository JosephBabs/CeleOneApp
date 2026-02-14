import React, { useEffect, useMemo, useState } from 'react';
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
  Alert,
  Platform,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme/ThemeContext';
import { COLORS, Colors } from '../../../core/theme/colors';
import { d_assets } from '../../configs/assets';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../auth/firebaseConfig';

/**
 * Redesigned Profile + Settings page to match the provided screenshot:
 * - Big "Profile" header + top-right menu
 * - Avatar + Name + Email + small edit button overlay
 * - Green Premium card
 * - Clean list rows with icons + chevron
 * - Language row shows value on right
 * - Dark mode switch at bottom
 * - Added "Subscription Settings"
 * - Keeps your translation/theme/language modal/logout logic
 */

const Settings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useAppTheme();
  const isDark = mode === 'dark';

  const auth = getAuth();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Optional: subscription info placeholder (wire this to your billing later)
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('notifications-enabled').then(value => {
      if (value !== null) setNotificationsEnabled(value === 'true');
    });
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (!auth.currentUser) return;

      const uid = auth.currentUser.uid;
      const ref = doc(db, 'user_data', uid);
      const snap = await getDoc(ref);

      if (snap.exists()) setUserProfile(snap.data());
    };

    loadUser();
  }, [auth.currentUser]);

  const backgroundColor = isDark ? Colors.darkBackground : '#F6F7F9';
  const cardColor = isDark ? '#151515' : '#FFFFFF';
  const textColor = isDark ? Colors.textDark : '#111111';
  const subTextColor = isDark ? '#B8B8B8' : '#777777';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await AsyncStorage.setItem('notifications-enabled', newValue.toString());
  };

  const confirmLogout = () => {
    Alert.alert(
      t('settings.logout') || 'Logout',
      t('settings.confirmLogout') || 'Are you sure you want to log out?',
      [
        { text: t('settings.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('settings.confirm') || 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
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

  const changeLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    await AsyncStorage.setItem('user-language', lng);
    setLanguageModalVisible(false);
  };

  const showAlert = (message: string) => {
    Alert.alert('Info', message, [{ text: 'OK', style: 'default' }], {
      cancelable: true,
    });
  };

  const displayName = useMemo(() => {
    const f = userProfile?.firstName || 'Andrew';
    const l = userProfile?.lastName || 'Ainsley';
    return `${f} ${l}`;
  }, [userProfile]);

  const displayEmail = auth.currentUser?.email || 'andrew_ainsley@yourdomain.com';

  const languageLabel = useMemo(() => {
    const lng = (i18n.language || 'en').toLowerCase();
    if (lng.startsWith('en')) return 'English (US)';
    if (lng.startsWith('fr')) return 'Français';
    if (lng.startsWith('es')) return 'Español';
    if (lng.startsWith('yo')) return 'Yorùbá';
    if (lng.startsWith('gou')) return 'Goun';
    return lng.toUpperCase();
  }, [i18n.language]);

  // --- Row component (matches screenshot list style)
  const Row = ({
    icon,
    label,
    onPress,
    right,
    danger,
  }: {
    icon: string;
    label: string;
    onPress?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
  }) => {
    return (
      <TouchableOpacity
        activeOpacity={onPress ? 0.7 : 1}
        onPress={onPress}
        style={[styles.row, { borderBottomColor: dividerColor }]}
      >
        <View style={styles.rowLeft}>
          <View
            style={[
              styles.rowIconWrap,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
            ]}
          >
            <Ionicons
              name={icon as any}
              size={18}
              color={danger ? '#E53935' : isDark ? '#EDEDED' : '#222'}
            />
          </View>

          <Text
            style={[
              styles.rowLabel,
              { color: danger ? '#E53935' : textColor },
            ]}
          >
            {label}
          </Text>
        </View>

        <View style={styles.rowRight}>
          {right ? (
            right
          ) : (
            <Ionicons name="chevron-forward" size={18} color={subTextColor} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Header (Profile + menu) */}
        <View style={styles.topHeader}>
          <View style={styles.topHeaderLeft}>
            <Text style={[styles.headerTitle, { color: textColor }]}>
              {t('settings.title') || 'Profile'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.headerMenuBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F3F5' },
            ]}
            onPress={() => showAlert('More options')}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Profile summary */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Image
              source={{
                uri:
                  userProfile?.photoURL ||
                  'https://i.pravatar.cc/300?img=11',
              }}
              style={styles.avatar}
            />
            <TouchableOpacity
              style={[styles.avatarEdit, { backgroundColor: COLORS.light.primary }]}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
            >
              <Ionicons name="create" size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: textColor }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: subTextColor }]} numberOfLines={1}>
              {displayEmail}
            </Text>

            {/* Optional: small premium status pill */}
            <View style={styles.pillRow}>
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: isPremium
                      ? 'rgba(46, 204, 113, 0.14)'
                      : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : '#F2F3F5',
                    borderColor: isPremium ? 'rgba(46, 204, 113, 0.32)' : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={isPremium ? 'diamond' : 'lock-closed'}
                  size={14}
                  color={isPremium ? COLORS.light.primary : subTextColor}
                />
                <Text
                  style={[
                    styles.pillText,
                    { color: isPremium ? COLORS.light.primary : subTextColor },
                  ]}
                >
                  {isPremium ? 'Premium Active' : 'Free Plan'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Premium banner card (like screenshot) */}
        <View style={[styles.premiumCard, { backgroundColor: COLORS.light.primary }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.premiumTitle}>Enjoy All Benefits!</Text>
            <Text style={styles.premiumBody}>
              Enjoy listening songs & podcasts with better audio quality, without restrictions, and without ads.
            </Text>

            <TouchableOpacity
              style={styles.premiumBtn}
              activeOpacity={0.9}
              onPress={() => {
                // Navigate to subscription screen or open your paywall
                // navigation.navigate('Subscription');
                setIsPremium(true);
                Alert.alert('Subscription', 'Open your subscription paywall here.');
              }}
            >
              <Text style={[styles.premiumBtnText, { color: COLORS.light.primary }]}>
                Get Premium
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right image placeholder (kept local-friendly) */}
          <View style={styles.premiumArt}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1520975958225-29de2d06cfd3?auto=format&fit=crop&w=300&q=60',
              }}
              style={styles.premiumArtImg}
            />
          </View>
        </View>

        {/* Settings list container */}
        <View style={[styles.listCard, { backgroundColor: cardColor }]}>
          <Row
            icon="person-outline"
            label="Profile"
            onPress={() => navigation.navigate('Profile')}
          />

          <Row
            icon="notifications-outline"
            label="Notification"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            }
          />

          <Row icon="mic-outline" label="Audio & Video" onPress={() => showAlert('Audio & Video settings')} />

          <Row icon="play-circle-outline" label="Playback" onPress={() => showAlert('Playback settings')} />

          <Row icon="cloud-download-outline" label="Data Saver & Storage" onPress={() => showAlert('Storage settings')} />

          <Row icon="shield-checkmark-outline" label="Security" onPress={() => showAlert('Security settings')} />

          {/* NEW: Subscription Settings */}
          <Row
            icon="card-outline"
            label="Subscription Settings"
            onPress={() => {
              // navigation.navigate('Subscription');
              Alert.alert('Subscription Settings', 'Open subscription settings screen here.');
            }}
          />

          {/* Language */}
          <Row
            icon="language-outline"
            label="Language"
            onPress={() => setLanguageModalVisible(true)}
            right={
              <View style={styles.valueRight}>
                <Text style={[styles.valueText, { color: subTextColor }]}>{languageLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={subTextColor} />
              </View>
            }
          />

          {/* Dark Mode */}
          <Row
            icon="moon-outline"
            label="Dark Mode"
            right={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            }
          />
        </View>

        {/* Extra links (optional, clean) */}
        <View style={[styles.listCard, { backgroundColor: cardColor, marginTop: 14 }]}>
          <Row
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => showAlert(t('settings.privacyPolicyText') || 'Privacy policy details...')}
          />
          <Row
            icon="information-circle-outline"
            label="About App"
            onPress={() => showAlert(t('settings.aboutAppText') || 'About app details...')}
          />
          <Row
            icon="log-out-outline"
            label={t('settings.logout') || 'Logout'}
            onPress={confirmLogout}
            danger
          />
        </View>

        {/* Language Modal */}
        <Modal
          visible={languageModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: cardColor }]}>
              <View style={styles.modalTop}>
                <Text style={[styles.modalTitle, { color: textColor }]}>
                  {t('settings.selectLanguage') || 'Select Language'}
                </Text>
                <Pressable onPress={() => setLanguageModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={textColor} />
                </Pressable>
              </View>

              {['en', 'fr', 'yo', 'gou', 'es'].map(lng => (
                <Pressable
                  key={lng}
                  style={[styles.langRow, { borderBottomColor: dividerColor }]}
                  onPress={() => changeLanguage(lng)}
                >
                  <Text style={[styles.langText, { color: textColor }]}>{t(`lang.${lng}`)}</Text>
                  {i18n.language?.toLowerCase().startsWith(lng) ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.light.primary} />
                  ) : (
                    <View style={{ width: 18 }} />
                  )}
                </Pressable>
              ))}

              <Pressable
                style={[
                  styles.modalAction,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
                ]}
                onPress={() => setLanguageModalVisible(false)}
              >
                <Text style={[styles.modalActionText, { color: textColor }]}>
                  {t('common.close') || 'Close'}
                </Text>
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

  topHeader: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },

  pillRow: { marginTop: 10, flexDirection: 'row' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  premiumCard: {
    marginTop: 10,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
  },
  premiumTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  premiumBody: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 14,
  },
  premiumBtn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  premiumBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  premiumArt: {
    width: 92,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  premiumArtImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  listCard: {
    marginTop: 16,
    marginHorizontal: 18,
    borderRadius: 18,
    overflow: 'hidden',
  },

  row: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langText: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  modalAction: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalActionText: {
    fontSize: 15.5,
    fontWeight: '800',
  },
});

export default Settings;

// Settings.tsx
// Premium Profile + Settings + FULL-PAGE MODALS implementation
// - Saves settings to AsyncStorage + Firestore (so user recovers on another phone)
// - Audio & Video settings (quality, autoplay, captions, background play, etc.)
// - Playback settings (repeat, autoplay next, crossfade, speed default, normalize audio)
// - Data Saver settings (Wi-Fi only streaming/download, low data mode, image quality)
// - Security settings (change password with re-auth, app lock toggle, hide email, session sign-out all placeholder)
// - Subscription settings (fetch subscription from Firestore)
// - More options (Share app, Contact support)
// NOTE: These settings are “real” in the sense they persist + are usable across the app.
// To enforce them app-wide, read from AsyncStorage keys or Firestore on app start.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme/ThemeContext';
import { COLORS, Colors } from '../../../core/theme/colors';
import { getAuth, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../auth/firebaseConfig';

type SettingsDoc = {
  notificationsEnabled: boolean;
  darkMode: boolean;

  audioVideo: {
    audioQuality: 'auto' | 'low' | 'medium' | 'high';
    videoQuality: 'auto' | '360p' | '480p' | '720p' | '1080p';
    autoPlayVideos: boolean;
    captionsEnabled: boolean;
    backgroundPlay: boolean; // allow audio to continue (app-level integration required)
  };

  playback: {
    autoPlayNext: boolean;
    repeatMode: 'off' | 'one' | 'all';
    crossfadeSeconds: number; // 0..12
    defaultSpeed: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;
    normalizeAudio: boolean;
    skipSilence: boolean;
  };

  dataSaver: {
    lowDataMode: boolean;
    streamOnWifiOnly: boolean;
    downloadOnWifiOnly: boolean;
    reduceImageQuality: boolean;
    prefetchNext: boolean;
  };

  security: {
    appLockEnabled: boolean; // placeholder (biometrics/pin integration required)
    hideEmail: boolean;
  };

  language: string;

  updatedAt?: any;
};

type SubscriptionDoc = {
  plan?: 'free' | 'premium' | 'pro';
  status?: 'active' | 'inactive' | 'canceled' | 'trial';
  renewsAt?: any;
  expiresAt?: any;
  provider?: string;
};

const SETTINGS_ASYNC_KEY = 'app_user_settings_v1';

const DEFAULT_SETTINGS: SettingsDoc = {
  notificationsEnabled: true,
  darkMode: false,
  audioVideo: {
    audioQuality: 'auto',
    videoQuality: 'auto',
    autoPlayVideos: true,
    captionsEnabled: false,
    backgroundPlay: false,
  },
  playback: {
    autoPlayNext: true,
    repeatMode: 'off',
    crossfadeSeconds: 0,
    defaultSpeed: 1,
    normalizeAudio: true,
    skipSilence: false,
  },
  dataSaver: {
    lowDataMode: false,
    streamOnWifiOnly: false,
    downloadOnWifiOnly: true,
    reduceImageQuality: false,
    prefetchNext: true,
  },
  security: {
    appLockEnabled: false,
    hideEmail: false,
  },
  language: 'en',
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const k of Object.keys(override || {})) {
    const ov: any = (override as any)[k];
    const bv: any = (base as any)[k];
    if (ov && typeof ov === 'object' && !Array.isArray(ov) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, ov);
    } else if (ov !== undefined) {
      out[k] = ov;
    }
  }
  return out;
}

const Settings = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme } = useAppTheme();
  const isDark = mode === 'dark';

  const auth = getAuth();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [settings, setSettings] = useState<SettingsDoc>(DEFAULT_SETTINGS);
  const [hydrating, setHydrating] = useState(true);

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [activeModal, setActiveModal] = useState<
    null | 'audioVideo' | 'playback' | 'dataSaver' | 'security' | 'subscription' | 'moreOptions'
  >(null);

  const [subscription, setSubscription] = useState<SubscriptionDoc | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);

  const saveTimer = useRef<any>(null);

  const backgroundColor = isDark ? Colors.darkBackground : '#F6F7F9';
  const cardColor = isDark ? '#151515' : '#FFFFFF';
  const textColor = isDark ? Colors.textDark : '#111111';
  const subTextColor = isDark ? '#B8B8B8' : '#777777';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  const uid = auth.currentUser?.uid;

  const displayName = useMemo(() => {
    const f = userProfile?.firstName || 'Andrew';
    const l = userProfile?.lastName || 'Ainsley';
    return `${f} ${l}`.trim();
  }, [userProfile]);

  const displayEmail = useMemo(() => auth.currentUser?.email || 'user@domain.com', [auth.currentUser?.email]);

  const languageLabel = useMemo(() => {
    const lng = (i18n.language || 'en').toLowerCase();
    if (lng.startsWith('en')) return t('settings.lang_english_us') || 'English (US)';
    if (lng.startsWith('fr')) return t('settings.lang_french') || 'Français';
    if (lng.startsWith('es')) return t('settings.lang_spanish') || 'Español';
    if (lng.startsWith('yo')) return t('settings.lang_yoruba') || 'Yorùbá';
    if (lng.startsWith('gou')) return t('settings.lang_goun') || 'Goun';
    if (lng.startsWith('fon')) return t('settings.lang_fon') || 'Fon';
    return lng.toUpperCase();
  }, [i18n.language, t]);

  const isPremium = useMemo(() => {
    const plan = subscription?.plan || 'free';
    const status = subscription?.status || 'inactive';
    return (plan === 'premium' || plan === 'pro') && status === 'active';
  }, [subscription]);

  // ---- Firestore paths (simple + reliable)
  const userSettingsRef = useMemo(() => {
    if (!uid) return null;
    // store in /user_data/{uid}/app_settings/main
    // so it lives with your existing user_data doc but separated.
    return doc(db, 'user_data', uid, 'app_settings', 'main');
  }, [uid]);

  const userSubRef = useMemo(() => {
    if (!uid) return null;
    // subscription stored at /user_data/{uid}/subscription/main
    return doc(db, 'user_data', uid, 'subscription', 'main');
  }, [uid]);

  // ---- Load profile
  useEffect(() => {
    const loadUser = async () => {
      if (!uid) return;
      try {
        const ref = doc(db, 'user_data', uid);
        const snap = await getDoc(ref);
        if (snap.exists()) setUserProfile(snap.data());
      } catch (e) {
        console.log('profile load error', e);
      }
    };
    loadUser();
  }, [uid]);

  // ---- Hydrate settings: AsyncStorage -> Firestore -> merge -> apply
  useEffect(() => {
    const hydrate = async () => {
      if (!uid) {
        // still allow local-only settings when logged out
        try {
          const localStr = await AsyncStorage.getItem(SETTINGS_ASYNC_KEY);
          const local = localStr ? (JSON.parse(localStr) as Partial<SettingsDoc>) : {};
          const merged = deepMerge(DEFAULT_SETTINGS, local);
          setSettings(merged);
        } catch {}
        setHydrating(false);
        return;
      }

      try {
        const [localStr, remoteSnap] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_ASYNC_KEY),
          userSettingsRef ? getDoc(userSettingsRef) : Promise.resolve(null as any),
        ]);

        const local = localStr ? (JSON.parse(localStr) as Partial<SettingsDoc>) : {};
        const remote = remoteSnap?.exists() ? (remoteSnap.data() as Partial<SettingsDoc>) : {};

        const merged = deepMerge(DEFAULT_SETTINGS, deepMerge(remote || {}, local || {}));
        setSettings(merged);

        // apply language if stored (best effort)
        if (merged.language && merged.language !== i18n.language) {
          try {
            await i18n.changeLanguage(merged.language);
          } catch {}
        }

        // apply dark mode toggle (best effort) — we respect ThemeContext as source of truth:
        // if remote says dark and theme is not dark, user can toggle switch to sync.
      } catch (e) {
        console.log('settings hydrate error', e);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setHydrating(false);
      }
    };

    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, userSettingsRef]);

  // ---- Save settings (debounced) to AsyncStorage + Firestore
  const persistSettings = (next: SettingsDoc) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(SETTINGS_ASYNC_KEY, JSON.stringify(next));
      } catch {}

      if (uid && userSettingsRef) {
        try {
          await setDoc(
            userSettingsRef,
            {
              ...next,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch (e) {
          console.log('settings remote save error', e);
        }
      }
    }, 350);
  };

  const updateSettings = (patch: Partial<SettingsDoc>) => {
    setSettings(prev => {
      const next = deepMerge(prev, patch);
      persistSettings(next);
      return next;
    });
  };

  // ---- Notifications toggle
  const toggleNotifications = () => updateSettings({ notificationsEnabled: !settings.notificationsEnabled });

  // ---- Language change (save to local + firestore)
  const changeLanguage = async (lng: string) => {
    try {
      await i18n.changeLanguage(lng);
      updateSettings({ language: lng });
      await AsyncStorage.setItem('user-language', lng);
    } catch {}
    setLanguageModalVisible(false);
  };

  // ---- Logout
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
              Alert.alert(t('common.error') || 'Error', t('settings.logoutFailed') || 'Failed to logout. Try again.');
            }
          },
        },
      ],
    );
  };

  // ---- Subscription fetch
  const fetchSubscription = async () => {
    if (!uid || !userSubRef) return;
    setLoadingSub(true);
    try {
      const snap = await getDoc(userSubRef);
      if (snap.exists()) setSubscription(snap.data() as SubscriptionDoc);
      else setSubscription({ plan: 'free', status: 'inactive' });
    } catch (e) {
      console.log('sub fetch error', e);
      setSubscription({ plan: 'free', status: 'inactive' });
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    if (uid) fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // ---- More options actions
  const handleShareApp = async () => {
    try {
      await Share.share({
        message:
          t('settings.share_message') ||
          'Try this app! Download and enjoy the full experience.',
      });
    } catch {}
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent(t('settings.support_subject') || 'Support Request');
    const body = encodeURIComponent(
      `${t('settings.support_body_intro') || 'Hello Support,'}\n\n` +
        `${t('settings.support_body_details') || 'Describe your issue here...'}\n\n` +
        `UID: ${uid || 'N/A'}\nEmail: ${displayEmail}\n`,
    );

    const mailto = `mailto:support@yourapp.com?subject=${subject}&body=${body}`;
    const ok = await Linking.canOpenURL(mailto);
    if (ok) return Linking.openURL(mailto);

    Alert.alert(t('common.info') || 'Info', t('settings.support_unavailable') || 'Email app not available on this device.');
  };

  const showAlert = (message: string) => {
    Alert.alert(t('common.info') || 'Info', message, [{ text: 'OK', style: 'default' }], {
      cancelable: true,
    });
  };

  // --- Row component (matches list style)
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
  }) => (
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

        <Text style={[styles.rowLabel, { color: danger ? '#E53935' : textColor }]}>{label}</Text>
      </View>

      <View style={styles.rowRight}>
        {right ? right : <Ionicons name="chevron-forward" size={18} color={subTextColor} />}
      </View>
    </TouchableOpacity>
  );

  if (hydrating) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
          <Text style={{ marginTop: 10, color: subTextColor, fontWeight: '700' }}>
            {t('settings.loading') || 'Loading settings...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topHeader}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{t('settings.profile_title') || 'Profile'}</Text>

          <TouchableOpacity
            style={[
              styles.headerMenuBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F3F5' },
            ]}
            onPress={() => setActiveModal('moreOptions')}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Profile summary */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: userProfile?.photoURL || 'https://i.pravatar.cc/300?img=11' }}
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

            {!settings.security.hideEmail && (
              <Text style={[styles.profileEmail, { color: subTextColor }]} numberOfLines={1}>
                {displayEmail}
              </Text>
            )}

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
                <Text style={[styles.pillText, { color: isPremium ? COLORS.light.primary : subTextColor }]}>
                  {isPremium ? (t('settings.premium_active') || 'Premium Active') : (t('settings.free_plan') || 'Free Plan')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Premium card */}
        <View style={[styles.premiumCard, { backgroundColor: COLORS.light.primary }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.premiumTitle}>{t('settings.enjoy_benefits') || 'Enjoy All Benefits!'}</Text>
            <Text style={styles.premiumBody}>
              {t('settings.premium_desc') ||
                'Enjoy listening songs & podcasts with better audio quality, without restrictions, and without ads.'}
            </Text>

            <TouchableOpacity
              style={styles.premiumBtn}
              activeOpacity={0.9}
              onPress={() => setActiveModal('subscription')}
            >
              <Text style={[styles.premiumBtnText, { color: COLORS.light.primary }]}>
                {t('settings.get_premium') || 'Get Premium'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.premiumArt}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1520975958225-29de2d06cfd3?auto=format&fit=crop&w=300&q=60',
              }}
              style={styles.premiumArtImg}
            />
          </View>
        </View>

        {/* Settings list */}
        <View style={[styles.listCard, { backgroundColor: cardColor }]}>
          <Row icon="person-outline" label={t('settings.profile') || 'Profile'} onPress={() => navigation.navigate('Profile')} />

          <Row
            icon="notifications-outline"
            label={t('settings.notification') || 'Notification'}
            right={
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            }
          />

          <Row icon="mic-outline" label={t('settings.audio_video') || 'Audio & Video'} onPress={() => setActiveModal('audioVideo')} />
          <Row icon="play-circle-outline" label={t('settings.playback') || 'Playback'} onPress={() => setActiveModal('playback')} />
          <Row icon="cloud-download-outline" label={t('settings.data_saver') || 'Data Saver & Storage'} onPress={() => setActiveModal('dataSaver')} />
          <Row icon="shield-checkmark-outline" label={t('settings.security') || 'Security'} onPress={() => setActiveModal('security')} />

          <Row
            icon="card-outline"
            label={t('settings.subscription_settings') || 'Subscription Settings'}
            onPress={() => setActiveModal('subscription')}
            right={
              <View style={styles.valueRight}>
                <Text style={[styles.valueText, { color: subTextColor }]}>
                  {loadingSub ? (t('settings.loading') || 'Loading...') : isPremium ? (t('settings.premium') || 'Premium') : (t('settings.free') || 'Free')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={subTextColor} />
              </View>
            }
          />

          <Row
            icon="language-outline"
            label={t('settings.language') || 'Language'}
            onPress={() => setLanguageModalVisible(true)}
            right={
              <View style={styles.valueRight}>
                <Text style={[styles.valueText, { color: subTextColor }]}>{languageLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={subTextColor} />
              </View>
            }
          />

          <Row
            icon="moon-outline"
            label={t('settings.darkMode') || 'Dark Mode'}
            right={
              <Switch
                value={isDark}
                onValueChange={() => {
                  // theme context switch
                  toggleTheme();
                  // also persist preference for cross-device restore
                  updateSettings({ darkMode: !isDark });
                }}
                trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            }
          />
        </View>

        {/* Other links */}
        <View style={[styles.listCard, { backgroundColor: cardColor, marginTop: 14 }]}>
          <Row
            icon="document-text-outline"
            label={t('settings.privacyPolicy') || 'Privacy Policy'}
            onPress={() => showAlert(t('settings.privacyPolicyText') || 'Privacy policy details...')}
          />
          <Row
            icon="information-circle-outline"
            label={t('settings.aboutApp') || 'About App'}
            onPress={() => showAlert(t('settings.aboutAppText') || 'About app details...')}
          />
          <Row icon="log-out-outline" label={t('settings.logout') || 'Logout'} onPress={confirmLogout} danger />
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

              {['en', 'fr', 'yo', 'gou', 'es', 'fon'].map(lng => (
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

        {/* FULL-PAGE MODALS */}
        <AudioVideoModal
          visible={activeModal === 'audioVideo'}
          onClose={() => setActiveModal(null)}
          settings={settings}
          onChange={updateSettings}
          isDark={isDark}
          t={t}
        />

        <PlaybackModal
          visible={activeModal === 'playback'}
          onClose={() => setActiveModal(null)}
          settings={settings}
          onChange={updateSettings}
          isDark={isDark}
          t={t}
        />

        <DataSaverModal
          visible={activeModal === 'dataSaver'}
          onClose={() => setActiveModal(null)}
          settings={settings}
          onChange={updateSettings}
          isDark={isDark}
          t={t}
        />

        <SecurityModal
          visible={activeModal === 'security'}
          onClose={() => setActiveModal(null)}
          settings={settings}
          onChange={updateSettings}
          isDark={isDark}
          t={t}
        />

        <SubscriptionModal
          visible={activeModal === 'subscription'}
          onClose={() => setActiveModal(null)}
          isDark={isDark}
          t={t}
          subscription={subscription}
          loading={loadingSub}
          onRefresh={fetchSubscription}
          onOpenPaywall={() => Alert.alert(t('settings.subscription') || 'Subscription', t('settings.paywall_placeholder') || 'Open your paywall here.')}
        />

        <MoreOptionsModal
          visible={activeModal === 'moreOptions'}
          onClose={() => setActiveModal(null)}
          isDark={isDark}
          t={t}
          onShare={handleShareApp}
          onSupport={handleContactSupport}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;

/* ---------------- FULL PAGE MODALS ---------------- */

const FullPageShell = ({
  visible,
  title,
  subtitle,
  onClose,
  children,
  isDark,
  right,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  isDark: boolean;
  right?: React.ReactNode;
}) => {
  const bg = isDark ? Colors.darkBackground : '#F6F7F9';
  const card = isDark ? '#151515' : '#FFFFFF';
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.headerTitle, { color: text }]} numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={[modalStyles.headerSub, { color: sub }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          <View style={{ width: 44, alignItems: 'flex-end' }}>{right || null}</View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={[modalStyles.card, { backgroundColor: card }]}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  card: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '900', marginTop: 14, marginBottom: 10 },
  row: {
    paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, fontWeight: '800' },
  rowDesc: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  chipText: { fontSize: 13, fontWeight: '900' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  dangerBtn: {
    marginTop: 10,
    backgroundColor: '#E53935',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

const AudioVideoModal = ({
  visible,
  onClose,
  settings,
  onChange,
  isDark,
  t,
}: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  const audioChoices: Array<SettingsDoc['audioVideo']['audioQuality']> = ['auto', 'low', 'medium', 'high'];
  const videoChoices: Array<SettingsDoc['audioVideo']['videoQuality']> = ['auto', '360p', '480p', '720p', '1080p'];

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.audio_video') || 'Audio & Video'}
      subtitle={t('settings.audio_video_sub') || 'Quality, autoplay & captions'}
    >
      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.quality') || 'Quality'}</Text>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="musical-notes" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.audio_quality') || 'Audio quality'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>
              {t('settings.audio_quality_desc') || 'Controls streaming audio quality'}
            </Text>
          </View>
        </View>
      </View>

      <View style={modalStyles.chipRow}>
        {audioChoices.map(v => {
          const active = settings.audioVideo.audioQuality === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onChange({ audioVideo: { audioQuality: v } })}
              style={[
                modalStyles.chip,
                { backgroundColor: active ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: active ? '#fff' : text }]}>
                {t(`settings.audio_quality_${v}`) || v.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="film" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.video_quality') || 'Video quality'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>
              {t('settings.video_quality_desc') || 'Controls streaming video quality'}
            </Text>
          </View>
        </View>
      </View>

      <View style={modalStyles.chipRow}>
        {videoChoices.map(v => {
          const active = settings.audioVideo.videoQuality === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onChange({ audioVideo: { videoQuality: v } })}
              style={[
                modalStyles.chip,
                { backgroundColor: active ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: active ? '#fff' : text }]}>
                {t(`settings.video_quality_${v.replace('p', '')}`) || v.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.behavior') || 'Behavior'}</Text>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="play" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.autoplay_videos') || 'Autoplay videos'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.autoplay_videos_desc') || 'Play videos automatically in feeds'}</Text>
          </View>
        </View>
        <Switch
          value={settings.audioVideo.autoPlayVideos}
          onValueChange={(v: boolean) => onChange({ audioVideo: { autoPlayVideos: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="chatbubbles" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.captions') || 'Captions'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.captions_desc') || 'Enable captions when available'}</Text>
          </View>
        </View>
        <Switch
          value={settings.audioVideo.captionsEnabled}
          onValueChange={(v: boolean) => onChange({ audioVideo: { captionsEnabled: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="headset" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.background_play') || 'Background play'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.background_play_desc') || 'Continue audio when app is in background (requires player integration)'}</Text>
          </View>
        </View>
        <Switch
          value={settings.audioVideo.backgroundPlay}
          onValueChange={(v: boolean) => onChange({ audioVideo: { backgroundPlay: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <TouchableOpacity
        style={modalStyles.primaryBtn}
        onPress={() => Alert.alert(t('common.info') || 'Info', t('settings.applied_globally_hint') || 'These preferences are saved. Apply them inside your player and feeds.')}
      >
        <Text style={modalStyles.primaryBtnText}>{t('settings.how_it_works') || 'How it works'}</Text>
      </TouchableOpacity>
    </FullPageShell>
  );
};

const PlaybackModal = ({ visible, onClose, settings, onChange, isDark, t }: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  const speedOptions: Array<SettingsDoc['playback']['defaultSpeed']> = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const repeatOptions: Array<SettingsDoc['playback']['repeatMode']> = ['off', 'one', 'all'];

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.playback') || 'Playback'}
      subtitle={t('settings.playback_sub') || 'Speed, repeat & audio enhancements'}
    >
      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.playback_controls') || 'Controls'}</Text>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="play-skip-forward" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.autoplay_next') || 'Autoplay next'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.autoplay_next_desc') || 'Automatically play next track'}</Text>
          </View>
        </View>
        <Switch
          value={settings.playback.autoPlayNext}
          onValueChange={(v: boolean) => onChange({ playback: { autoPlayNext: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="repeat" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.repeat') || 'Repeat'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.repeat_desc') || 'Choose repeat mode for playback'}</Text>
          </View>
        </View>
      </View>

      <View style={modalStyles.chipRow}>
        {repeatOptions.map(v => {
          const active = settings.playback.repeatMode === v;
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onChange({ playback: { repeatMode: v } })}
              style={[
                modalStyles.chip,
                { backgroundColor: active ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: active ? '#fff' : text }]}>
                {t(`settings.repeat_${v}`) || v.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.speed') || 'Speed'}</Text>
      <View style={modalStyles.chipRow}>
        {speedOptions.map(v => {
          const active = settings.playback.defaultSpeed === v;
          return (
            <TouchableOpacity
              key={String(v)}
              onPress={() => onChange({ playback: { defaultSpeed: v } })}
              style={[
                modalStyles.chip,
                { backgroundColor: active ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: active ? '#fff' : text }]}>{v}x</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.audio_enhancements') || 'Audio enhancements'}</Text>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="pulse" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.normalize') || 'Normalize audio'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.normalize_desc') || 'Keep volume level consistent'}</Text>
          </View>
        </View>
        <Switch
          value={settings.playback.normalizeAudio}
          onValueChange={(v: boolean) => onChange({ playback: { normalizeAudio: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="cut" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.skip_silence') || 'Skip silence'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.skip_silence_desc') || 'Reduce silent parts for talks & sermons'}</Text>
          </View>
        </View>
        <Switch
          value={settings.playback.skipSilence}
          onValueChange={(v: boolean) => onChange({ playback: { skipSilence: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      {/* Crossfade (simple stepper) */}
      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="swap-horizontal" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.crossfade') || 'Crossfade'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>
              {(t('settings.crossfade_desc') || 'Smooth transition between songs') + ` • ${settings.playback.crossfadeSeconds}s`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() =>
              onChange({ playback: { crossfadeSeconds: clamp(settings.playback.crossfadeSeconds - 1, 0, 12) } })
            }
            style={{ padding: 10 }}
          >
            <Ionicons name="remove-circle-outline" size={22} color={text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              onChange({ playback: { crossfadeSeconds: clamp(settings.playback.crossfadeSeconds + 1, 0, 12) } })
            }
            style={{ padding: 10 }}
          >
            <Ionicons name="add-circle-outline" size={22} color={text} />
          </TouchableOpacity>
        </View>
      </View>
    </FullPageShell>
  );
};

const DataSaverModal = ({ visible, onClose, settings, onChange, isDark, t }: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.data_saver') || 'Data Saver & Storage'}
      subtitle={t('settings.data_saver_sub') || 'Save data, reduce downloads & optimize'}
    >
      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="speedometer" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.low_data_mode') || 'Low data mode'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.low_data_mode_desc') || 'Reduce quality and background fetch'}</Text>
          </View>
        </View>
        <Switch
          value={settings.dataSaver.lowDataMode}
          onValueChange={(v: boolean) => onChange({ dataSaver: { lowDataMode: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="wifi" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.stream_wifi_only') || 'Stream on Wi-Fi only'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.stream_wifi_only_desc') || 'Prevents mobile data usage for streaming'}</Text>
          </View>
        </View>
        <Switch
          value={settings.dataSaver.streamOnWifiOnly}
          onValueChange={(v: boolean) => onChange({ dataSaver: { streamOnWifiOnly: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="download" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.download_wifi_only') || 'Download on Wi-Fi only'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.download_wifi_only_desc') || 'Avoid downloads on mobile data'}</Text>
          </View>
        </View>
        <Switch
          value={settings.dataSaver.downloadOnWifiOnly}
          onValueChange={(v: boolean) => onChange({ dataSaver: { downloadOnWifiOnly: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="image" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.reduce_images') || 'Reduce image quality'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.reduce_images_desc') || 'Use smaller images to save data'}</Text>
          </View>
        </View>
        <Switch
          value={settings.dataSaver.reduceImageQuality}
          onValueChange={(v: boolean) => onChange({ dataSaver: { reduceImageQuality: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="sparkles" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.prefetch_next') || 'Prefetch next content'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.prefetch_next_desc') || 'Speeds up browsing but uses more data'}</Text>
          </View>
        </View>
        <Switch
          value={settings.dataSaver.prefetchNext}
          onValueChange={(v: boolean) => onChange({ dataSaver: { prefetchNext: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <TouchableOpacity
        style={modalStyles.primaryBtn}
        onPress={() => Alert.alert(t('common.info') || 'Info', t('settings.data_saver_hint') || 'Apply these flags in your fetch logic and media player (e.g., force low quality when Low Data Mode is enabled).')}
      >
        <Text style={modalStyles.primaryBtnText}>{t('settings.how_it_works') || 'How it works'}</Text>
      </TouchableOpacity>
    </FullPageShell>
  );
};

const SecurityModal = ({ visible, onClose, settings, onChange, isDark, t }: any) => {
  const auth = getAuth();
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';
  const border = isDark ? 'rgba(255,255,255,0.14)' : '#E6E6E6';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [busy, setBusy] = useState(false);

  const doChangePassword = async () => {
    if (!auth.currentUser?.email) return Alert.alert(t('common.error') || 'Error', t('settings.no_email_user') || 'This account has no email.');
    if (!currentPass.trim() || newPass.length < 6) {
      return Alert.alert(t('common.error') || 'Error', t('settings.password_rules') || 'Enter your current password and a new password (min 6 chars).');
    }
    if (newPass !== newPass2) {
      return Alert.alert(t('common.error') || 'Error', t('settings.password_mismatch') || 'New passwords do not match.');
    }

    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPass);

      setCurrentPass('');
      setNewPass('');
      setNewPass2('');

      Alert.alert(t('settings.success') || 'Success', t('settings.password_changed') || 'Password updated successfully.');
    } catch (e: any) {
      console.log('password change error', e);
      Alert.alert(t('common.error') || 'Error', e?.message || (t('settings.password_change_failed') || 'Failed to change password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.security') || 'Security'}
      subtitle={t('settings.security_sub') || 'Account protection & privacy'}
    >
      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.privacy') || 'Privacy'}</Text>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="eye-off" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.hide_email') || 'Hide email on profile'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.hide_email_desc') || 'Prevent showing email on profile header'}</Text>
          </View>
        </View>
        <Switch
          value={settings.security.hideEmail}
          onValueChange={(v: boolean) => onChange({ security: { hideEmail: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="lock-closed" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.app_lock') || 'App lock'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.app_lock_desc') || 'Require biometrics or PIN when opening (integration needed)'}</Text>
          </View>
        </View>
        <Switch
          value={settings.security.appLockEnabled}
          onValueChange={(v: boolean) => onChange({ security: { appLockEnabled: v } })}
          trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </View>

      <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.change_password') || 'Change password'}</Text>

      <TextInput
        value={currentPass}
        onChangeText={setCurrentPass}
        placeholder={t('settings.current_password') || 'Current password'}
        placeholderTextColor={sub}
        secureTextEntry
        style={[modalStyles.input, { borderColor: border, backgroundColor: inputBg, color: text }]}
      />
      <TextInput
        value={newPass}
        onChangeText={setNewPass}
        placeholder={t('settings.new_password') || 'New password'}
        placeholderTextColor={sub}
        secureTextEntry
        style={[modalStyles.input, { borderColor: border, backgroundColor: inputBg, color: text }]}
      />
      <TextInput
        value={newPass2}
        onChangeText={setNewPass2}
        placeholder={t('settings.confirm_new_password') || 'Confirm new password'}
        placeholderTextColor={sub}
        secureTextEntry
        style={[modalStyles.input, { borderColor: border, backgroundColor: inputBg, color: text }]}
      />

      <TouchableOpacity style={[modalStyles.primaryBtn, busy && { opacity: 0.6 }]} onPress={doChangePassword} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.primaryBtnText}>{t('settings.update_password') || 'Update password'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={modalStyles.dangerBtn}
        onPress={() => Alert.alert(t('settings.coming_soon') || 'Coming soon', t('settings.signout_all_desc') || 'You can implement “sign out all devices” with custom backend tokens.')}
      >
        <Text style={modalStyles.dangerBtnText}>{t('settings.signout_all') || 'Sign out all devices'}</Text>
      </TouchableOpacity>
    </FullPageShell>
  );
};

const SubscriptionModal = ({ visible, onClose, isDark, t, subscription, loading, onRefresh, onOpenPaywall }: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  const plan = subscription?.plan || 'free';
  const status = subscription?.status || 'inactive';

  const planLabel =
    plan === 'pro' ? (t('settings.pro') || 'Pro') : plan === 'premium' ? (t('settings.premium') || 'Premium') : (t('settings.free') || 'Free');

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.subscription_settings') || 'Subscription Settings'}
      subtitle={t('settings.subscription_sub') || 'Plan, status & billing info'}
      right={
        <TouchableOpacity onPress={onRefresh} style={{ padding: 10 }}>
          <Ionicons name="refresh" size={20} color={text} />
        </TouchableOpacity>
      }
    >
      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="card" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.current_plan') || 'Current plan'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.current_plan_desc') || 'Your active subscription plan'}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.light.primary} />
        ) : (
          <Text style={{ color: COLORS.light.primary, fontWeight: '900' }}>{planLabel}</Text>
        )}
      </View>

      <View style={[modalStyles.row, { borderTopColor: divider }]}>
        <View style={modalStyles.rowLeft}>
          <View style={[modalStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
            <Ionicons name="checkmark-circle" size={18} color={text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.status') || 'Status'}</Text>
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.status_desc') || 'Subscription state'}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.light.primary} />
        ) : (
          <Text style={{ color: status === 'active' ? '#2ECC71' : sub, fontWeight: '900' }}>
            {t(`settings.sub_status_${status}`) || status.toUpperCase()}
          </Text>
        )}
      </View>

      <TouchableOpacity style={modalStyles.primaryBtn} onPress={onOpenPaywall}>
        <Text style={modalStyles.primaryBtnText}>{t('settings.manage_subscription') || 'Manage subscription'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[modalStyles.primaryBtn, { backgroundColor: '#111' }]}
        onPress={() => Alert.alert(t('settings.coming_soon') || 'Coming soon', t('settings.billing_history_desc') || 'Add billing history screen here.')}
      >
        <Text style={modalStyles.primaryBtnText}>{t('settings.billing_history') || 'Billing history'}</Text>
      </TouchableOpacity>
    </FullPageShell>
  );
};

const MoreOptionsModal = ({ visible, onClose, isDark, t, onShare, onSupport }: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';
  const card = isDark ? '#151515' : '#FFFFFF';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 16,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 42, height: 4, borderRadius: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : '#DDD' }} />
          </View>

          <Text style={{ color: text, fontSize: 16, fontWeight: '900', marginBottom: 6 }}>
            {t('settings.more_options') || 'More options'}
          </Text>
          <Text style={{ color: sub, fontSize: 12.5, fontWeight: '700', marginBottom: 10 }}>
            {t('settings.more_options_sub') || 'Share, support & app info'}
          </Text>

          <TouchableOpacity
            style={[sheetRowStyles.row, { borderTopColor: divider }]}
            onPress={() => {
              onClose();
              onShare();
            }}
          >
            <View style={sheetRowStyles.left}>
              <View style={[sheetRowStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
                <Ionicons name="share-social" size={18} color={text} />
              </View>
              <View>
                <Text style={[sheetRowStyles.title, { color: text }]}>{t('settings.share_app') || 'Share app'}</Text>
                <Text style={[sheetRowStyles.desc, { color: sub }]}>{t('settings.share_app_desc') || 'Send app link to friends'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[sheetRowStyles.row, { borderTopColor: divider }]}
            onPress={() => {
              onClose();
              onSupport();
            }}
          >
            <View style={sheetRowStyles.left}>
              <View style={[sheetRowStyles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
                <Ionicons name="help-buoy" size={18} color={text} />
              </View>
              <View>
                <Text style={[sheetRowStyles.title, { color: text }]}>{t('settings.contact_support') || 'Contact support'}</Text>
                <Text style={[sheetRowStyles.desc, { color: sub }]}>{t('settings.contact_support_desc') || 'Get help and report issues'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.modalAction, { marginTop: 14 }]} onPress={onClose}>
            <Text style={[styles.modalActionText, { color: text }]}>{t('common.close') || 'Close'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const sheetRowStyles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15.5, fontWeight: '900' },
  desc: { fontSize: 12.5, fontWeight: '700', marginTop: 2 },
});

/* ---------------- MAIN STYLES ---------------- */

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
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F2F3F5',
  },
  modalActionText: {
    fontSize: 15.5,
    fontWeight: '800',
  },
});

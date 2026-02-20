/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-native/no-inline-styles */
// Settings.tsx
// ✅ Redesigned with FIXED top section (scroll behind it)
// ✅ Top card can EXPAND / COLLAPSE (no animated height)
// ✅ Settings SEARCH + indexed navigation chips
// ✅ Subscription uses your REAL collections:
//    - subscription_packages (packages)
//    - user_subscriptions (user subscription history / latest)
// ✅ Payment page UI (MTN Celtis + MoMo) with Mobile / Bank Card toggle (API later)
// ✅ DOES NOT remove/omit your existing functions (kept + extended)
// ✅ Keeps your existing translation keys (we only add fallbacks like t('settings.search') || 'Search settings')

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
  Animated,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme/ThemeContext';
import { COLORS, Colors } from '../../../core/theme/colors';
import {
  getAuth,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
} from 'firebase/firestore';
import { db } from '../auth/firebaseConfig';

type SettingsDoc = {
  notificationsEnabled: boolean;
  darkMode: boolean;

  audioVideo: {
    audioQuality: 'auto' | 'low' | 'medium' | 'high';
    videoQuality: 'auto' | '360p' | '480p' | '720p' | '1080p';
    autoPlayVideos: boolean;
    captionsEnabled: boolean;
    backgroundPlay: boolean;
  };

  playback: {
    autoPlayNext: boolean;
    repeatMode: 'off' | 'one' | 'all';
    crossfadeSeconds: number;
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
    appLockEnabled: boolean;
    hideEmail: boolean;
  };

  language: string;
  updatedAt?: any;
};

// Your real “user_subscriptions” doc shape
type UserSubscriptionRow = {
  uid: string;
  packageId: string;
  packageName: string;
  price: number;
  startAt: number;
  endAt: number;
  status: 'active' | 'inactive' | 'cancelled' | 'pending' | 'trial' | string;
  updatedAt?: any;
};

// Your real “subscription_packages” shape
type SubscriptionPackage = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  isActive: boolean;
  createdAt?: any;
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
    if (
      ov &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv, ov);
    } else if (ov !== undefined) {
      out[k] = ov;
    }
  }
  return out;
}

/* ================== FIXED HEADER TOKENS (matches your Jeunesse vibe) ================== */
const HERO_BG_LIGHT = '#fff';
const HERO_BG_DARK = '#0E0E0E';
const HERO_TEXT_LIGHT = 'rgba(6, 51, 37, 0.91)';
const HERO_TEXT_DARK = '#EDEDED';
const HERO_ICON_BG_LIGHT = 'rgba(219, 219, 219, 0.55)';
const HERO_ICON_BG_DARK = 'rgba(255,255,255,0.08)';
const HERO_RADIUS = 24;

const HERO_EXPANDED = Platform.select({ ios: 270, android: 260 }) as number;
const HERO_COLLAPSED = Platform.select({ ios: 138, android: 188 }) as number;

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
    | null
    | 'audioVideo'
    | 'playback'
    | 'dataSaver'
    | 'security'
    | 'subscription'
    | 'moreOptions'
    | 'packages'
    | 'payment'
  >(null);

  // (kept) old "subscription" variable — we still compute it for your UI logic
  const [subscription, setSubscription] = useState<SubscriptionDoc | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);

  // NEW: real subscription rows + packages
  const [userSubRow, setUserSubRow] = useState<UserSubscriptionRow | null>(null);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);

  // Payment UI state (API later)
  const [paymentProvider, setPaymentProvider] = useState<'mtn_celtis' | 'momo' | null>('mtn_celtis');
  const [paymentMethod, setPaymentMethod] = useState<'mobile' | 'card'>('mobile');
  const [payBusy, setPayBusy] = useState(false);

  // Search + indexing
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const sectionRefs = useRef<Record<string, View | null>>({
    mainSettings: null,
    otherLinks: null,
  });

  // Fixed header size handling
  const [headerHeight, setHeaderHeight] = useState(HERO_EXPANDED);
  const [headerExpanded, setHeaderExpanded] = useState(true);

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

  // Old isPremium logic — still supported
  const isPremium = useMemo(() => {
    const plan = subscription?.plan || 'free';
    const status = subscription?.status || 'inactive';
    return (plan === 'premium' || plan === 'pro') && status === 'active';
  }, [subscription]);

  // NEW: derive premium from your real row too (used in header pill)
  const isPremiumReal = useMemo(() => {
    const st = String(userSubRow?.status || '').toLowerCase();
    return st === 'active' && !!userSubRow?.packageId;
  }, [userSubRow]);

  // ---- Firestore paths (kept)
  const userSettingsRef = useMemo(() => {
    if (!uid) return null;
    return doc(db, 'user_data', uid, 'app_settings', 'main');
  }, [uid]);

  // (kept) old ref - not used for fetching now, but not removed
  const userSubRef = useMemo(() => {
    if (!uid) return null;
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

        if (merged.language && merged.language !== i18n.language) {
          try {
            await i18n.changeLanguage(merged.language);
          } catch {}
        }
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

  // ---- Subscription fetch (UPDATED to your REAL collections)
  const fetchSubscription = async () => {
    if (!uid) return;

    setLoadingSub(true);
    try {
      // 1) latest user subscription row
      const qy = query(
        collection(db, 'user_subscriptions'),
        where('uid', '==', uid),
        limit(1),
      );
      const snap = await getDocs(qy);

      if (!snap.empty) {
        const d = snap.docs[0].data() as any;
        const row: UserSubscriptionRow = {
          uid: d.uid,
          packageId: d.packageId,
          packageName: d.packageName,
          price: Number(d.price || 0),
          startAt: Number(d.startAt || 0),
          endAt: Number(d.endAt || 0),
          status: d.status,
          updatedAt: d.updatedAt,
        };
        setUserSubRow(row);

        // map to old SubscriptionDoc (kept) so your existing premium logic still works
        const status = String(row.status || '').toLowerCase();
        setSubscription({
          plan: status === 'active' ? 'premium' : 'free',
          status: status === 'active' ? 'active' : 'inactive',
          expiresAt: row.endAt ? row.endAt : undefined,
          provider: 'firestore',
        });
      } else {
        setUserSubRow(null);
        setSubscription({ plan: 'free', status: 'inactive' });
      }
    } catch (e) {
      console.log('sub fetch error', e);
      setUserSubRow(null);
      setSubscription({ plan: 'free', status: 'inactive' });
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    if (uid) fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // ---- Packages fetch
  const fetchPackages = async () => {
    setLoadingPackages(true);
    try {
      const qy = query(collection(db, 'subscription_packages'), where('isActive', '==', true));
      const snap = await getDocs(qy);

      const rows: SubscriptionPackage[] = snap.docs.map(d => {
        const x = d.data() as any;
        return {
          id: d.id,
          name: String(x.name || ''),
          price: Number(x.price || 0),
          durationDays: Number(x.durationDays || 0),
          isActive: !!x.isActive,
          createdAt: x.createdAt,
          updatedAt: x.updatedAt,
        };
      });

      setPackages(rows);
    } catch (e) {
      console.log('packages fetch error', e);
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  // ---- More options actions
  const handleShareApp = async () => {
    try {
      await Share.share({
        message: t('settings.share_message') || 'Try this app! Download and enjoy the full experience.',
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
    Alert.alert(t('common.info') || 'Info', message, [{ text: 'OK', style: 'default' }], { cancelable: true });
  };

  // ---- Create pending subscription (payment API later)
  const createPendingSubscription = async () => {
    if (!uid) return Alert.alert(t('common.error') || 'Error', t('settings.no_user') || 'You must be logged in.');
    if (!selectedPackage) return;

    setPayBusy(true);
    try {
      const startAt = Date.now();
      const endAt = startAt + selectedPackage.durationDays * 24 * 60 * 60 * 1000;

      await addDoc(collection(db, 'user_subscriptions'), {
        uid,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        price: selectedPackage.price,
        startAt,
        endAt,
        status: 'pending', // API later will mark active/cancelled
        paymentProvider: paymentProvider || null,
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        t('settings.subscription') || 'Subscription',
        t('settings.payment_pending') || 'Payment initialized (pending). Add payment API later to confirm.',
      );

      setActiveModal(null);
      setActiveModal('subscription');
      await fetchSubscription();
    } catch (e: any) {
      console.log('createPendingSubscription error', e);
      Alert.alert(t('common.error') || 'Error', e?.message || (t('settings.payment_failed') || 'Payment failed.'));
    } finally {
      setPayBusy(false);
    }
  };

  // --- Row component (kept)
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
          <Ionicons name={icon as any} size={18} color={danger ? '#E53935' : isDark ? '#EDEDED' : '#222'} />
        </View>

        <Text style={[styles.rowLabel, { color: danger ? '#E53935' : textColor }]}>{label}</Text>
      </View>

      <View style={styles.rowRight}>
        {right ? right : <Ionicons name="chevron-forward" size={18} color={subTextColor} />}
      </View>
    </TouchableOpacity>
  );

  // ================== SEARCH INDEX ==================
  const searchIndex = useMemo(() => {
    // IMPORTANT: use your existing translation keys (we only use fallbacks)
    const items = [
      {
        key: 'profile',
        title: t('settings.profile') || 'Profile',
        keywords: ['profile', 'account', 'user'],
        action: () => navigation.navigate('Profile'),
      },
      {
        key: 'notification',
        title: t('settings.notification') || 'Notification',
        keywords: ['notification', 'alerts', 'push'],
        action: () => {
          // highlight is optional; here we just scroll to settings block
          scrollToSection('mainSettings');
        },
      },
      {
        key: 'audioVideo',
        title: t('settings.audio_video') || 'Audio & Video',
        keywords: ['audio', 'video', 'quality', 'captions', 'background'],
        action: () => setActiveModal('audioVideo'),
      },
      {
        key: 'playback',
        title: t('settings.playback') || 'Playback',
        keywords: ['playback', 'repeat', 'speed', 'normalize', 'crossfade'],
        action: () => setActiveModal('playback'),
      },
      {
        key: 'dataSaver',
        title: t('settings.data_saver') || 'Data Saver & Storage',
        keywords: ['data', 'wifi', 'download', 'storage', 'images'],
        action: () => setActiveModal('dataSaver'),
      },
      {
        key: 'security',
        title: t('settings.security') || 'Security',
        keywords: ['security', 'password', 'lock', 'privacy', 'email'],
        action: () => setActiveModal('security'),
      },
      {
        key: 'subscription',
        title: t('settings.subscription_settings') || 'Subscription Settings',
        keywords: ['subscription', 'premium', 'package', 'billing', 'plan'],
        action: () => setActiveModal('subscription'),
      },
      {
        key: 'language',
        title: t('settings.language') || 'Language',
        keywords: ['language', 'fr', 'en', 'yo', 'es', 'fon', 'gou'],
        action: () => setLanguageModalVisible(true),
      },
      {
        key: 'darkMode',
        title: t('settings.darkMode') || 'Dark Mode',
        keywords: ['dark', 'theme', 'mode'],
        action: () => scrollToSection('mainSettings'),
      },
      {
        key: 'privacyPolicy',
        title: t('settings.privacyPolicy') || 'Privacy Policy',
        keywords: ['privacy', 'policy'],
        action: () => showAlert(t('settings.privacyPolicyText') || 'Privacy policy details...'),
      },
      {
        key: 'aboutApp',
        title: t('settings.aboutApp') || 'About App',
        keywords: ['about', 'app', 'version'],
        action: () => showAlert(t('settings.aboutAppText') || 'About app details...'),
      },
      {
        key: 'logout',
        title: t('settings.logout') || 'Logout',
        keywords: ['logout', 'sign out'],
        action: () => confirmLogout(),
      },
    ];

    return items;
  }, [t, navigation, confirmLogout, isDark]);

  const filteredSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter(it => {
      const hay = `${it.title} ${it.keywords.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [searchQuery, searchIndex]);

  const scrollToSection = (key: 'mainSettings' | 'otherLinks') => {
    const node = sectionRefs.current[key];
    if (!node) return;
    // measureLayout requires a parent ref; simplest is scrollToTop-ish with small delays
    node.measureLayout(
      // @ts-ignore
      scrollRef.current?.getInnerViewNode ? scrollRef.current.getInnerViewNode() : scrollRef.current,
      (_x: number, y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
      },
      () => {},
    );
  };

  // ================== FIXED TOP UI ==================
  const heroBg = isDark ? HERO_BG_DARK : HERO_BG_LIGHT;
  const heroText = isDark ? HERO_TEXT_DARK : HERO_TEXT_LIGHT;
  const heroIconBg = isDark ? HERO_ICON_BG_DARK : HERO_ICON_BG_LIGHT;

  const premiumLabel = useMemo(() => {
    // prefer your real subscription row
    if (loadingSub) return t('settings.loading') || 'Loading...';
    if (userSubRow) {
      const st = String(userSubRow.status || '').toLowerCase();
      const name = userSubRow.packageName || (t('settings.free_plan') || 'Free Plan');
      if (st === 'active') return name;
      if (st === 'pending') return `${name} · ${t('settings.pending') || 'Pending'}`;
      if (st === 'cancelled') return `${name} · ${t('settings.canceled') || 'Canceled'}`;
      return `${name} · ${t('settings.inactive') || 'Inactive'}`;
    }
    return t('settings.free_plan') || 'Free Plan';
  }, [userSubRow, loadingSub, t]);

  const toggleHeader = () => {
    const next = !headerExpanded;
    setHeaderExpanded(next);
    setSearchOpen(next ? searchOpen : false);
    setHeaderHeight(next ? HERO_EXPANDED : HERO_COLLAPSED);
  };

  const openSearch = () => {
    setHeaderExpanded(true);
    setHeaderHeight(HERO_EXPANDED);
    setSearchOpen(true);
    setTimeout(() => {}, 50);
  };

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
      {/* ================= FIXED TOP (stays on top) ================= */}
      <View
        style={[
          fixedHero.heroContainer,
          {
            height: headerHeight,
            backgroundColor: heroBg,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <View style={fixedHero.heroPinnedTop}>
          <View style={fixedHero.heroTopLeft}>
            <View style={[fixedHero.heroIcon, { backgroundColor: heroIconBg }]}>
              <Ionicons name="settings-outline" size={18} color={heroText} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[fixedHero.heroTitle, { color: heroText }]} numberOfLines={1}>
                {t('settings.profile_title') || 'Profile'}
              </Text>
              {/* <Text style={[fixedHero.heroSub, { color: isDark ? 'rgba(237,237,237,0.65)' : 'rgba(6, 51, 37, 0.65)' }]} numberOfLines={1}>
                {(t('settings.subtitle') || 'Account, playback & subscriptions')}
              </Text> */}
            </View>
          </View>

          <View style={fixedHero.heroTopRight}>
            <TouchableOpacity
              style={[fixedHero.heroIcon, { backgroundColor: heroIconBg }]}
              onPress={() => setActiveModal('moreOptions')}
              activeOpacity={0.9}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={heroText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[fixedHero.heroIcon, { backgroundColor: heroIconBg }]}
              onPress={openSearch}
              activeOpacity={0.9}
            >
              <Ionicons name="search" size={18} color={heroText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[fixedHero.heroIcon, { backgroundColor: heroIconBg }]}
              onPress={toggleHeader}
              activeOpacity={0.9}
            >
              <Ionicons name={headerExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={heroText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile + subscription summary (TOP CARD) */}
        <View style={{ marginTop: 12 }}>
          <View style={[fixedHero.topCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={fixedHero.avatarWrap}>
                <Image
                  source={{ uri: userProfile?.photoURL || 'https://i.pravatar.cc/300?img=11' }}
                  style={fixedHero.avatar}
                />
                <TouchableOpacity
                  style={[fixedHero.avatarEdit, { backgroundColor: COLORS.light.primary }]}
                  onPress={() => navigation.navigate('Profile')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create" size={14} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[fixedHero.name, { color: heroText }]} numberOfLines={1}>
                  {displayName}
                </Text>

                {!settings.security.hideEmail && (
                  <Text style={[fixedHero.email, { color: isDark ? 'rgba(237,237,237,0.70)' : 'rgba(6, 51, 37, 0.70)' }]} numberOfLines={1}>
                    {displayEmail}
                  </Text>
                )}

                {/* Plan row (fix overflow) */}
                <View style={fixedHero.planRow}>
                  <View
                    style={[
                      fixedHero.planPill,
                      {
                        backgroundColor: isPremiumReal
                          ? 'rgba(46, 204, 113, 0.14)'
                          : isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(255,255,255,0.92)',
                        borderColor: isPremiumReal ? 'rgba(46, 204, 113, 0.32)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isPremiumReal ? 'diamond' : 'lock-closed'}
                      size={14}
                      color={isPremiumReal ? COLORS.light.primary : (isDark ? '#EDEDED' : heroText)}
                    />
                    <Text
                      style={[
                        fixedHero.planText,
                        { color: isPremiumReal ? COLORS.light.primary : (isDark ? '#EDEDED' : heroText) },
                      ]}
                      numberOfLines={1}
                    >
                      {premiumLabel}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setActiveModal('subscription')}
                    style={[
                      fixedHero.manageBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.92)',
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                      },
                    ]}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="card-outline" size={16} color={heroText} />
                    <Text style={[fixedHero.manageBtnText, { color: heroText }]} numberOfLines={1}>
                      {t('settings.manage_subscription') || 'Manage'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Expandable area: search + index chips */}
        {headerExpanded && (
          <View style={{ marginTop: 12 }}>
            {/* Search bar */}
            {searchOpen && (
              <View style={[fixedHero.searchRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                <Ionicons name="search" size={16} color={isDark ? '#EDEDED' : 'rgba(6,51,37,0.75)'} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('settings.search') || 'Search settings'}
                  placeholderTextColor={isDark ? 'rgba(237,237,237,0.55)' : 'rgba(6,51,37,0.45)'}
                  style={[fixedHero.searchInput, { color: heroText }]}
                />
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  style={[fixedHero.searchBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.92)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                  activeOpacity={0.9}
                >
                  <Ionicons name="close" size={18} color={heroText} />
                </TouchableOpacity>
              </View>
            )}

            {/* Quick index chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fixedHero.quickRow}>
              <TouchableOpacity
                onPress={() => {
                  setSearchOpen(false);
                  setActiveModal('dataSaver')
                }}
                
                style={[fixedHero.quickPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                activeOpacity={0.9}
              >
                <Ionicons name="cloud-download-outline" size={16} color={heroText} />
                <Text style={[fixedHero.quickText, { color: heroText }]}>{t('settings.data_saver') || 'Data saver'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveModal('audioVideo')}
                style={[fixedHero.quickPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                activeOpacity={0.9}
              >
                <Ionicons name="mic-outline" size={16} color={heroText} />
                <Text style={[fixedHero.quickText, { color: heroText }]}>{t('settings.audio_video') || 'Audio & Video'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveModal('subscription')}
                style={[fixedHero.quickPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                activeOpacity={0.9}
              >
                <Ionicons name="card-outline" size={16} color={heroText} />
                <Text style={[fixedHero.quickText, { color: heroText }]}>{t('settings.subscription_settings') || 'Subscription'}</Text>
              </TouchableOpacity>

              
            </ScrollView>
          </View>
        )}
      </View>

      {/* ================= SCROLLING CONTENT (behind fixed header) ================= */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: headerHeight + 14, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Search results card */}
        {!!searchQuery.trim() && (
          <View style={[styles.searchCard, { backgroundColor: cardColor }]}>
            <View style={styles.searchHeader}>
              <Text style={[styles.searchTitle, { color: textColor }]}>
                {t('settings.search_results') || 'Search results'}
              </Text>
              <View style={[styles.badgeSoft, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
                <Text style={[styles.badgeSoftText, { color: textColor }]}>
                  {filteredSearch.length}
                </Text>
              </View>
            </View>

            {filteredSearch.length ? (
              <View style={{ marginTop: 10 }}>
                {filteredSearch.map(it => (
                  <TouchableOpacity
                    key={it.key}
                    onPress={() => {
                      setSearchOpen(false);
                      it.action();
                    }}
                    style={[styles.searchRow, { borderColor: dividerColor }]}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="arrow-forward-outline" size={18} color={subTextColor} />
                    <Text style={[styles.searchRowText, { color: textColor }]} numberOfLines={1}>
                      {it.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyBlock}>
                <Ionicons name="search-outline" size={40} color={isDark ? 'rgba(237,237,237,0.35)' : '#C7C7CC'} />
                <Text style={[styles.emptyTitle, { color: textColor }]}>{t('settings.no_results') || 'No results'}</Text>
                <Text style={[styles.emptySub, { color: subTextColor }]}>
                  {t('settings.no_results_sub') || 'Try another keyword.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Settings list */}
        <View
          ref={(r) => (sectionRefs.current.mainSettings = r)}
          style={[styles.listCard, { backgroundColor: cardColor }]}
        >
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
                <Text style={[styles.valueText, { color: subTextColor }]} numberOfLines={1}>
                  {loadingSub ? (t('settings.loading') || 'Loading...') : premiumLabel}
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
                <Text style={[styles.valueText, { color: subTextColor }]} numberOfLines={1}>
                  {languageLabel}
                </Text>
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
                  toggleTheme();
                  updateSettings({ darkMode: !isDark });
                }}
                trackColor={{ false: '#CFCFCF', true: COLORS.light.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            }
          />
        </View>

        {/* Other links */}
        <View
          ref={(r) => (sectionRefs.current.otherLinks = r)}
          style={[styles.listCard, { backgroundColor: cardColor, marginTop: 14 }]}
        >
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

        {/* Language Modal (kept) */}
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
                <Text style={[styles.modalActionText, { color: textColor }]}>{t('common.close') || 'Close'}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* FULL-PAGE MODALS (kept) */}
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
          userSubRow={userSubRow}
          onOpenPaywall={async () => {
            // open package selection
            if (!packages.length) await fetchPackages();
            setActiveModal('packages');
          }}
        />

        <PackageSelectionModal
          visible={activeModal === 'packages'}
          onClose={() => setActiveModal('subscription')}
          isDark={isDark}
          t={t}
          packages={packages}
          loading={loadingPackages}
          onRefresh={fetchPackages}
          current={userSubRow}
          onSelect={(pkg: SubscriptionPackage) => {
            setSelectedPackage(pkg);
            setActiveModal('payment');
          }}
        />

        <PaymentModal
          visible={activeModal === 'payment'}
          onClose={() => setActiveModal('packages')}
          isDark={isDark}
          t={t}
          pkg={selectedPackage}
          provider={paymentProvider}
          setProvider={setPaymentProvider}
          method={paymentMethod}
          setMethod={setPaymentMethod}
          busy={payBusy}
          onPay={createPendingSubscription}
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

/* ---------------- FULL PAGE SHELL (kept) ---------------- */

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

        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
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

/* ===================== EXISTING MODALS (your originals, unchanged logic) ===================== */

const AudioVideoModal = ({ visible, onClose, settings, onChange, isDark, t }: any) => {
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
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.audio_quality_desc') || 'Controls streaming audio quality'}</Text>
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
              <Text style={[modalStyles.chipText, { color: active ? '#fff' : text }]}>{t(`settings.audio_quality_${v}`) || v.toUpperCase()}</Text>
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
            <Text style={[modalStyles.rowDesc, { color: sub }]}>{t('settings.video_quality_desc') || 'Controls streaming video quality'}</Text>
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
        onPress={() =>
          Alert.alert(
            t('common.info') || 'Info',
            t('settings.applied_globally_hint') || 'These preferences are saved. Apply them inside your player and feeds.',
          )
        }
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
              <Text style={[modalStyles.chipText, { color: active ? '#fff' : text }]}>{t(`settings.repeat_${v}`) || v.toUpperCase()}</Text>
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
            onPress={() => onChange({ playback: { crossfadeSeconds: clamp(settings.playback.crossfadeSeconds - 1, 0, 12) } })}
            style={{ padding: 10 }}
          >
            <Ionicons name="remove-circle-outline" size={22} color={text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onChange({ playback: { crossfadeSeconds: clamp(settings.playback.crossfadeSeconds + 1, 0, 12) } })}
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
        onPress={() =>
          Alert.alert(
            t('common.info') || 'Info',
            t('settings.data_saver_hint') || 'Apply these flags in your fetch logic and media player (e.g., force low quality when Low Data Mode is enabled).',
          )
        }
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
            <Text style={[modalStyles.rowTitle, { color: text }]}>{t('settings.hide_email') || 'Hide email on profile header'}</Text>
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

const SubscriptionModal = ({
  visible,
  onClose,
  isDark,
  t,
  subscription,
  loading,
  onRefresh,
  onOpenPaywall,
  userSubRow,
}: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  const plan = subscription?.plan || 'free';
  const status = subscription?.status || 'inactive';

  const planLabel =
    plan === 'pro'
      ? (t('settings.pro') || 'Pro')
      : plan === 'premium'
        ? (t('settings.premium') || 'Premium')
        : (t('settings.free') || 'Free');

  const realName = userSubRow?.packageName || planLabel;
  const realStatus = String(userSubRow?.status || status);

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
      {/* Current package */}
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

        {loading ? <ActivityIndicator color={COLORS.light.primary} /> : <Text style={{ color: COLORS.light.primary, fontWeight: '900' }}>{realName}</Text>}
      </View>

      {/* Status */}
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
          <Text
            style={{
              color:
                String(realStatus).toLowerCase() === 'active'
                  ? '#2ECC71'
                  : String(realStatus).toLowerCase() === 'pending'
                    ? '#F59E0B'
                    : sub,
              fontWeight: '900',
            }}
          >
            {t(`settings.sub_status_${String(realStatus).toLowerCase()}`) || String(realStatus).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Manage subscription (fixed, no overflow) */}
      <TouchableOpacity style={modalStyles.primaryBtn} onPress={onOpenPaywall} activeOpacity={0.9}>
        <Ionicons name="pricetags-outline" size={18} color="#fff" />
        <Text style={modalStyles.primaryBtnText}>{t('settings.manage_subscription') || 'Manage subscription'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[modalStyles.primaryBtn, { backgroundColor: '#111' }]}
        onPress={() => Alert.alert(t('settings.coming_soon') || 'Coming soon', t('settings.billing_history_desc') || 'Add billing history screen here.')}
        activeOpacity={0.9}
      >
        <Text style={modalStyles.primaryBtnText}>{t('settings.billing_history') || 'Billing history'}</Text>
      </TouchableOpacity>
    </FullPageShell>
  );
};

const PackageSelectionModal = ({
  visible,
  onClose,
  isDark,
  t,
  packages,
  loading,
  onRefresh,
  current,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  t: any;
  packages: SubscriptionPackage[];
  loading: boolean;
  onRefresh: () => void;
  current: UserSubscriptionRow | null;
  onSelect: (pkg: SubscriptionPackage) => void;
}) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.packages') || 'Packages'}
      subtitle={t('settings.packages_sub') || 'Choose a subscription package'}
      right={
        <TouchableOpacity onPress={onRefresh} style={{ padding: 10 }}>
          <Ionicons name="refresh" size={20} color={text} />
        </TouchableOpacity>
      }
    >
      <View style={[styles.pkgHint, { borderColor: divider, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
        <Ionicons name="information-circle-outline" size={18} color={text} />
        <Text style={{ color: sub, fontWeight: '800', flex: 1 }}>
          {t('settings.packages_hint') || 'Select a package to continue to payment.'}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 18, alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.light.primary} />
          <Text style={{ marginTop: 8, color: sub, fontWeight: '700' }}>{t('settings.loading') || 'Loading...'}</Text>
        </View>
      ) : packages?.length ? (
        <View style={{ marginTop: 10 }}>
          {packages.map(p => {
            const isCurrent = current?.packageId === p.id && String(current?.status || '').toLowerCase() === 'active';
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => onSelect(p)}
                activeOpacity={0.9}
                style={[styles.pkgRow, { borderColor: divider, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }]}
              >
                <View style={[styles.pkgIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]}>
                  <Ionicons name="diamond-outline" size={18} color={text} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontWeight: '900', fontSize: 15 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={{ color: sub, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
                    {t('settings.duration') || 'Duration'}: {p.durationDays} {t('settings.days') || 'days'} · {t('settings.price') || 'Price'}: {p.price}
                  </Text>
                </View>

                {isCurrent ? (
                  <View style={[styles.badgeSolidMini, { backgroundColor: 'rgba(46,204,113,0.16)', borderColor: 'rgba(46,204,113,0.32)' }]}>
                    <Text style={{ color: '#2ECC71', fontWeight: '900', fontSize: 12 }}>{t('settings.active') || 'Active'}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={sub} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyBlock}>
          <Ionicons name="pricetags-outline" size={44} color={isDark ? 'rgba(237,237,237,0.35)' : '#C7C7CC'} />
          <Text style={[styles.emptyTitle, { color: text }]}>{t('settings.no_packages') || 'No active packages'}</Text>
          <Text style={[styles.emptySub, { color: sub }]}>{t('settings.no_packages_sub') || 'Create packages in subscription_packages.'}</Text>
        </View>
      )}
    </FullPageShell>
  );
};

const PaymentModal = ({
  visible,
  onClose,
  isDark,
  t,
  pkg,
  provider,
  setProvider,
  method,
  setMethod,
  busy,
  onPay,
}: any) => {
  const text = isDark ? Colors.textDark : '#111';
  const sub = isDark ? '#B8B8B8' : '#777';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF';

  return (
    <FullPageShell
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title={t('settings.payment') || 'Payment'}
      subtitle={t('settings.payment_sub') || 'Choose provider and method'}
    >
      {!pkg ? (
        <View style={styles.emptyBlock}>
          <Ionicons name="alert-circle-outline" size={44} color={sub} />
          <Text style={[styles.emptyTitle, { color: text }]}>{t('settings.no_package_selected') || 'No package selected'}</Text>
          <Text style={[styles.emptySub, { color: sub }]}>{t('settings.no_package_selected_sub') || 'Go back and choose a package.'}</Text>
        </View>
      ) : (
        <>
          <View style={[styles.payCard, { borderColor: divider, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
            <Text style={{ color: text, fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
              {pkg.name}
            </Text>
            <Text style={{ color: sub, fontWeight: '800', marginTop: 6 }}>
              {t('settings.price') || 'Price'}: {pkg.price} · {t('settings.duration') || 'Duration'}: {pkg.durationDays} {t('settings.days') || 'days'}
            </Text>
          </View>

          <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.payment_provider') || 'Payment provider'}</Text>

          <View style={modalStyles.chipRow}>
            <TouchableOpacity
              onPress={() => setProvider('mtn_celtis')}
              style={[
                modalStyles.chip,
                { backgroundColor: provider === 'mtn_celtis' ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: provider === 'mtn_celtis' ? '#fff' : text }]}>
                {t('settings.mtn_celtis') || 'MTN Celtis'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setProvider('momo')}
              style={[
                modalStyles.chip,
                { backgroundColor: provider === 'momo' ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: provider === 'momo' ? '#fff' : text }]}>
                {t('settings.momo') || 'MoMo'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[modalStyles.sectionTitle, { color: text }]}>{t('settings.payment_method') || 'Payment method'}</Text>

          <View style={modalStyles.chipRow}>
            <TouchableOpacity
              onPress={() => setMethod('mobile')}
              style={[
                modalStyles.chip,
                { backgroundColor: method === 'mobile' ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: method === 'mobile' ? '#fff' : text }]}>
                {t('settings.mobile_payment') || 'Mobile'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMethod('card')}
              style={[
                modalStyles.chip,
                { backgroundColor: method === 'card' ? COLORS.light.primary : isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' },
              ]}
            >
              <Text style={[modalStyles.chipText, { color: method === 'card' ? '#fff' : text }]}>
                {t('settings.bank_card') || 'Bank card'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.payHint, { borderColor: divider }]}>
            <Ionicons name="information-circle-outline" size={18} color={text} />
            <Text style={{ color: sub, fontWeight: '800', flex: 1 }}>
              {t('settings.payment_hint') || 'Payment API will be added later. For now this creates a pending subscription row in Firestore.'}
            </Text>
          </View>

          <TouchableOpacity
            style={[modalStyles.primaryBtn, busy && { opacity: 0.7 }]}
            onPress={onPay}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="lock-closed-outline" size={18} color="#fff" />}
            <Text style={modalStyles.primaryBtnText}>{t('settings.pay_now') || 'Pay now'}</Text>
          </TouchableOpacity>
        </>
      )}
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

          <TouchableOpacity style={[styles.modalAction, { marginTop: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F3F5' }]} onPress={onClose}>
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

/* ===================== FIXED HERO STYLES ===================== */
const fixedHero = StyleSheet.create({
  heroContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: Platform.select({ ios: 10, android: 10 }),
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: 'hidden',
    elevation: 6,
    zIndex: 50,
    borderBottomWidth: 1,
  },
  heroPinnedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  heroTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTitle: { fontSize: 20, fontWeight: '900' },
  heroSub: { marginTop: 4, fontWeight: '800', fontSize: 12.5 },

  topCard: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },

  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  name: { fontSize: 16.5, fontWeight: '900' },
  email: { marginTop: 2, fontSize: 12.5, fontWeight: '800' },

  planRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  planText: { fontSize: 12, fontWeight: '900', flex: 1 },

  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  manageBtnText: { fontWeight: '900', fontSize: 12 },

  searchRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontWeight: '900' },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  quickRow: { paddingTop: 10, gap: 10, paddingRight: 14 },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  quickText: { fontWeight: '900' },
});

/* ===================== MAIN STYLES ===================== */
const styles = StyleSheet.create({
  container: { flex: 1 },

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
    maxWidth: 200,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 160,
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
  },
  modalActionText: {
    fontSize: 15.5,
    fontWeight: '800',
  },

  // Search results
  searchCard: {
    marginTop: 12,
    marginHorizontal: 18,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF0F3',
  },
  searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchTitle: { fontSize: 15.5, fontWeight: '900' },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  searchRowText: { fontWeight: '900', flex: 1 },

  badgeSoft: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6' },
  badgeSoftText: { fontSize: 11, fontWeight: '900' },

  emptyBlock: { padding: 18, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '900' },
  emptySub: { marginTop: 6, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },

  // Packages
  pkgHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  pkgIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeSolidMini: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },

  // Payment
  payCard: { borderWidth: 1, borderRadius: 16, padding: 12 },
  payHint: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
});

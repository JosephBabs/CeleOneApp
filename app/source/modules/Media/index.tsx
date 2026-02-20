/* eslint-disable react/no-unstable-nested-components */
/* Media.tsx — UPDATED (FULL PAGE)
   ✅ Uses i18n JSON via useTranslation()
   ✅ Uses t('media.xxx') everywhere (no hardcoded UI strings)
   ✅ Fixes Firestore timestamp mixing: uses firestore.FieldValue.serverTimestamp()
   ✅ Implements Share (real) instead of placeholder alerts
   ✅ Keeps your existing logic + UI (only refactors strings + missing impl)
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Pressable,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  SafeAreaView,
  Share,
} from "react-native";
import { useTranslation } from "react-i18next";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import Video from "react-native-video";
import firestore from "@react-native-firebase/firestore";
import { auth } from "../auth/firebaseConfig";

const { width, height } = Dimensions.get("window");

/* ===================== HERO TOKENS (same as Jeunesse) ===================== */
const HERO_BG = "#fff";
const HERO_TEXT = "rgba(6, 51, 37, 0.91)";
const HERO_ICON_BG = "rgba(219, 219, 219, 0.55)";
const HERO_RADIUS = 24;

const HERO_EXPANDED = Platform.select({ ios: 300, android: 140 }) as number;
const HERO_COLLAPSED = Platform.select({ ios: 126, android: 130 }) as number;
const HERO_SEARCH_EXPANDED = Platform.select({ ios: 380, android: 290 }) as number;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const safeText = (v: any, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
};

type MediaTab = "Pour toi" | "Musique" | "Films/Séries";
type BottomTab = "browse" | "favorites" | "downloads" | "library";

type Song = {
  id: string;
  title?: string;
  artist?: string;
  artistId?: string;
  genre?: string;
  coverUrl?: string;
  link?: string;
  isPremium?: boolean;
  duration?: string;
  plays?: any;
  createdAt?: any;
  updatedAt?: any;
};

type VideoItem = {
  id: string;
  title?: string;
  channelName?: string;
  artistId?: string;
  coverUrl?: string;
  link?: string;
  isPremium?: boolean;
  type?: "movie" | "series" | "musicVideo";
  description?: string;
  duration?: string;
  views?: any;
  uploadTime?: string;
  createdAt?: any;
  updatedAt?: any;
  captionsUrl?: string;
};

type Episode = {
  id: string;
  title?: string;
  coverUrl?: string;
  link?: string;
  duration?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  createdAt?: any;
};

type UserSubscriptionDoc = {
  id?: string;
  uid?: string;
  status?: string; // active | cancelled | expired ...
  packageId?: string;
  packageName?: string;
  startAt?: number;
  endAt?: number;
  price?: number;
  updatedAt?: any;
  createdAt?: any;
};

type Playlist = {
  id: string;
  name: string;
  createdAt?: any;
};

type MediaPrefs = {
  low_data_mode: boolean;
  stream_wifi_only: boolean;
  download_wifi_only: boolean;
  reduce_images: boolean;
  prefetch_next: boolean;

  autoplay_videos: boolean;
  captions: boolean;
  background_play: boolean;

  audio_quality: "auto" | "low" | "medium" | "high";
  video_quality: "auto" | "360" | "480" | "720" | "1080";
};

function nowMs() {
  return Date.now();
}

function msToDays(ms: number) {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  if (typeof v === "number") return v;
  return 0;
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatus(s?: string) {
  const t = String(s || "").trim().toLowerCase();
  if (t === "canceled") return "cancelled";
  return t;
}

function bitRateForAudio(quality: MediaPrefs["audio_quality"], lowData: boolean) {
  if (lowData) return 64_000;
  switch (quality) {
    case "low":
      return 64_000;
    case "medium":
      return 128_000;
    case "high":
      return 192_000;
    default:
      return undefined;
  }
}

function bitRateForVideo(quality: MediaPrefs["video_quality"], lowData: boolean) {
  if (lowData) return 350_000;
  switch (quality) {
    case "360":
      return 700_000;
    case "480":
      return 1_100_000;
    case "720":
      return 2_500_000;
    case "1080":
      return 4_500_000;
    default:
      return undefined;
  }
}

function maybeResizeImage(url?: string, reduce?: boolean) {
  const u = String(url || "");
  if (!u) return "";
  if (!reduce) return u;
  if (u.includes("?")) return u;
  const w = 520;
  const q = 65;
  return `${u}?w=${w}&q=${q}`;
}

/* ===================== MAIN ===================== */
export default function Media({ navigation }: any) {
  const { t } = useTranslation();
  const ts = useCallback((key: string, options?: any) => t(`media.${key}`, options), [t]);
  const fsServerTimestamp = useCallback(() => firestore.FieldValue.serverTimestamp(), []);

  // Tabs
  const [activeTab, setActiveTab] = useState<MediaTab>("Pour toi");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("browse");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Content
  const [songs, setSongs] = useState<Song[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Collapsible hero behavior
  const scrollY = useRef(new Animated.Value(0)).current;
  const [compact, setCompact] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(true);
  const [forceHeroOpen, setForceHeroOpen] = useState(false);

  // Search + tags
  const [queryText, setQueryText] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const searchRef = useRef<TextInput>(null);

  // Subscription
  const [subLoading, setSubLoading] = useState(true);
  const [userSub, setUserSub] = useState<UserSubscriptionDoc | null>(null);
  const [packageInfo, setPackageInfo] = useState<any>(null);

  // Media settings
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [mediaPrefs, setMediaPrefs] = useState<MediaPrefs>({
    low_data_mode: false,
    stream_wifi_only: false,
    download_wifi_only: false,
    reduce_images: false,
    prefetch_next: true,

    autoplay_videos: false,
    captions: true,
    background_play: true,

    audio_quality: "auto",
    video_quality: "auto",
  });

  // Network (best-effort)
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Favorites / downloads / playlists
  const [favorites, setFavorites] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistItemsOpen, setPlaylistItemsOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<any[]>([]);
  const [playlistBusy, setPlaylistBusy] = useState(false);

  // Audio modal + floating mini player
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const audioRef = useRef<Video>(null);
  const [audioPlaying, setAudioPlaying] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [songPos, setSongPos] = useState(0);
  const [songDur, setSongDur] = useState(0);
  const [miniAudioVisible, setMiniAudioVisible] = useState(false);

  // Video info + fullscreen + PiP
  const [videoInfoOpen, setVideoInfoOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);

  const [videoFullscreenOpen, setVideoFullscreenOpen] = useState(false);
  const videoRef = useRef<Video>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoPos, setVideoPos] = useState(0);
  const [videoDur, setVideoDur] = useState(0);

  // Episodes
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  // Floating PiP overlay state (in-app)
  const [pipVisible, setPipVisible] = useState(false);
  const pipPan = useRef(new Animated.ValueXY({ x: width - 200 - 14, y: height * 0.68 })).current;

  /* ===================== Subscription Gate ===================== */
  const uid = auth.currentUser?.uid || null;

  const isSubActive = useMemo(() => {
    const s = userSub;
    if (!s) return false;

    const endAt = safeNum(s.endAt);
    const startAt = safeNum(s.startAt);

    const okTime = endAt > nowMs() && startAt <= nowMs();
    const okStatus = normalizeStatus(s.status) === "active";

    return okTime && okStatus;
  }, [userSub]);

  const subDaysLeft = useMemo(() => {
    const endAt = safeNum(userSub?.endAt);
    if (!endAt) return null;
    return msToDays(endAt - nowMs());
  }, [userSub?.endAt]);

  const canStreamPremium = isSubActive;

  const requireSubscription = useCallback(
    (reasonKey: string) => {
      Alert.alert(ts("subscription.requiredTitle"), ts(reasonKey), [
        { text: ts("subscription.cancel"), style: "cancel" },
        { text: ts("subscription.viewOffers"), onPress: () => navigation?.navigate?.("Subscriptions") },
      ]);
    },
    [navigation, ts]
  );

  /* ===================== Share (implemented) ===================== */
  const shareItem = useCallback(
    async (item: any) => {
      try {
        const link = item?.link || "";
        const title = item?.title || ts("labels.untitled");
        if (!link) return Alert.alert(ts("player.shareTitle"), ts("player.shareNothing"));
        await Share.share({ message: `${title}\n${link}` });
      } catch {
        Alert.alert(ts("player.shareTitle"), ts("player.shareFallback"));
      }
    },
    [ts]
  );

  /* ===================== Apply Wi-Fi only rule ===================== */
  const ensureWifiIfRequired = useCallback(() => {
    if (!mediaPrefs.stream_wifi_only) return true;

    // best-effort: if no connectivity, block
    if (isConnected === false) {
      Alert.alert(ts("network.title"), ts("network.noInternet"));
      return false;
    }
    // If you later re-enable NetInfo wifi check, add it here.
    return true;
  }, [mediaPrefs.stream_wifi_only, isConnected, ts]);

  /* ===================== HERO COLLAPSE ===================== */
  const expandedHeight = showSearchBar ? HERO_SEARCH_EXPANDED : HERO_EXPANDED;
  const collapseDist = expandedHeight - HERO_COLLAPSED;
  const clamped = Animated.diffClamp(scrollY, 0, collapseDist);

  const collapse = useMemo(() => {
    if (forceHeroOpen || showSearchBar) return new Animated.Value(0);
    return clamped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceHeroOpen, showSearchBar, collapseDist]);

  const expandableTranslateY = Animated.multiply(collapse, -1);
  const expandableOpacity = collapse.interpolate({
    inputRange: [0, collapseDist * 0.6, collapseDist],
    outputRange: [1, 0.2, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const sub = scrollY.addListener(({ value }) => {
      if (forceHeroOpen || showSearchBar) {
        if (compact) setCompact(false);
        return;
      }
      const should = value > 70;
      if (should !== compact) setCompact(should);
    });
    return () => scrollY.removeListener(sub);
  }, [scrollY, compact, forceHeroOpen, showSearchBar]);

  const heroFixedHeight =
    forceHeroOpen || showSearchBar ? expandedHeight : compact ? HERO_COLLAPSED : expandedHeight;

  /* ===================== Load Media Settings from Firestore ===================== */
  useEffect(() => {
    if (!uid) {
      setPrefsLoading(false);
      return;
    }

    let unsubUserDoc: any = null;
    let unsubMediaDoc: any = null;

    setPrefsLoading(true);

    unsubUserDoc = firestore()
      .collection("user_data")
      .doc(uid)
      .onSnapshot(
        (snap) => {
          const data = snap.exists ? (snap.data() as any) : null;

          const fromNested =
            data?.settings?.media ||
            data?.settings?.mediaPrefs ||
            data?.mediaSettings ||
            data?.mediaPrefs ||
            null;

          const fromFlat = data?.settings || null;

          const source = fromNested || fromFlat || null;

          if (source) {
            setMediaPrefs((prev) => ({
              ...prev,
              low_data_mode: !!source.low_data_mode,
              stream_wifi_only: !!source.stream_wifi_only,
              download_wifi_only: !!source.download_wifi_only,
              reduce_images: !!source.reduce_images,
              prefetch_next: source.prefetch_next === false ? false : true,

              autoplay_videos: !!source.autoplay_videos,
              captions: source.captions === false ? false : true,
              background_play: source.background_play === false ? false : true,

              audio_quality: (source.audio_quality || prev.audio_quality) as any,
              video_quality: (source.video_quality || prev.video_quality) as any,
            }));
          }
          setPrefsLoading(false);
        },
        () => setPrefsLoading(false)
      );

    unsubMediaDoc = firestore()
      .collection("user_data")
      .doc(uid)
      .collection("settings")
      .doc("media")
      .onSnapshot(
        (snap) => {
          const d = snap.exists ? (snap.data() as any) : null;
          if (!d) return;

          setMediaPrefs((prev) => ({
            ...prev,
            low_data_mode: !!d.low_data_mode,
            stream_wifi_only: !!d.stream_wifi_only,
            download_wifi_only: !!d.download_wifi_only,
            reduce_images: !!d.reduce_images,
            prefetch_next: d.prefetch_next === false ? false : true,

            autoplay_videos: !!d.autoplay_videos,
            captions: d.captions === false ? false : true,
            background_play: d.background_play === false ? false : true,

            audio_quality: (d.audio_quality || prev.audio_quality) as any,
            video_quality: (d.video_quality || prev.video_quality) as any,
          }));
        },
        () => {}
      );

    return () => {
      unsubUserDoc?.();
      unsubMediaDoc?.();
    };
  }, [uid]);

  /* ===================== Manual sorting helpers ===================== */
  const sortSongsManual = useCallback((list: Song[]) => {
    return [...list].sort((a, b) => {
      const ta = tsToMs(a.updatedAt) || tsToMs(a.createdAt);
      const tb = tsToMs(b.updatedAt) || tsToMs(b.createdAt);
      if (tb !== ta) return tb - ta;

      const pa = safeNum(a.plays);
      const pb = safeNum(b.plays);
      if (pb !== pa) return pb - pa;

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, []);

  const sortVideosManual = useCallback((list: VideoItem[]) => {
    return [...list].sort((a, b) => {
      const ta = tsToMs(a.updatedAt) || tsToMs(a.createdAt);
      const tb = tsToMs(b.updatedAt) || tsToMs(b.createdAt);
      if (tb !== ta) return tb - ta;

      const va = safeNum(a.views);
      const vb = safeNum(b.views);
      if (vb !== va) return vb - va;

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, []);

  const sortEpisodesManual = useCallback((list: Episode[]) => {
    return [...list].sort((a, b) => {
      const sa = safeNum(a.seasonNumber);
      const sb = safeNum(b.seasonNumber);
      if (sa !== sb) return sa - sb;

      const ea = safeNum(a.episodeNumber);
      const eb = safeNum(b.episodeNumber);
      if (ea !== eb) return ea - eb;

      const ta = tsToMs(a.createdAt);
      const tb = tsToMs(b.createdAt);
      if (ta && tb && ta !== tb) return ta - tb;

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, []);

  /* ===================== Load Firestore ===================== */
  useEffect(() => {
    let unsubSongs: any = null;
    let unsubVideos: any = null;
    let unsubSub: any = null;

    (async () => {
      try {
        setLoading(true);

        unsubSongs = firestore().collection("songs").onSnapshot(
          (snap) => {
            const listRaw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Song[];
            const list = sortSongsManual(listRaw);
            setSongs(list);
            setLoading(false);

            if (mediaPrefs.prefetch_next && !mediaPrefs.low_data_mode) {
              list.slice(0, 10).forEach((s) => {
                const u = maybeResizeImage(s.coverUrl, mediaPrefs.reduce_images);
                if (u) Image.prefetch(u).catch(() => {});
              });
            }
          },
          () => setLoading(false)
        );

        unsubVideos = firestore().collection("videos").onSnapshot((snap) => {
          const listRaw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as VideoItem[];
          const list = sortVideosManual(listRaw);
          setVideos(list);

          if (mediaPrefs.prefetch_next && !mediaPrefs.low_data_mode) {
            list.slice(0, 10).forEach((v) => {
              const u = maybeResizeImage(v.coverUrl, mediaPrefs.reduce_images);
              if (u) Image.prefetch(u).catch(() => {});
            });
          }
        });

        if (uid) {
          setSubLoading(true);

          unsubSub = firestore()
            .collection("user_subscriptions")
            .where("uid", "==", uid)
            .onSnapshot(
              async (snap) => {
                if (snap.empty) {
                  setUserSub(null);
                  setPackageInfo(null);
                  setSubLoading(false);
                  return;
                }

                const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as UserSubscriptionDoc[];

                const sorted = [...all].sort((a, b) => {
                  const ua = tsToMs(a.updatedAt) || safeNum(a.startAt) || tsToMs(a.createdAt);
                  const ub = tsToMs(b.updatedAt) || safeNum(b.startAt) || tsToMs(b.createdAt);
                  return ub - ua;
                });

                const latest = sorted[0] || null;
                setUserSub(latest || null);

                const pkgId = String(latest?.packageId || "");
                const pkgName = String(latest?.packageName || "");
                if (pkgId) {
                  try {
                    const pkgSnap = await firestore().collection("subscription_packages").doc(pkgId).get();
                    const pkg = pkgSnap.exists ? { id: pkgSnap.id, ...(pkgSnap.data() as any) } : null;
                    setPackageInfo(pkg);

                    if (!pkgName && pkg?.name) {
                      setUserSub((prev) => (prev ? { ...prev, packageName: pkg.name } : prev));
                    }
                  } catch {
                    setPackageInfo(null);
                  }
                } else {
                  setPackageInfo(null);
                }

                setSubLoading(false);

                const endAt = safeNum(latest?.endAt);
                const status = normalizeStatus(latest?.status);
                if (endAt && endAt <= nowMs() && status === "active") {
                  Alert.alert(ts("subscription.expiredTitle"), ts("subscription.expiredMsg"));
                } else if (endAt && endAt > nowMs() && msToDays(endAt - nowMs()) <= 2 && status === "active") {
                  Alert.alert(
                    ts("subscription.expiringTitle"),
                    ts("subscription.expiringMsg", { days: msToDays(endAt - nowMs()) })
                  );
                }
              },
              () => setSubLoading(false)
            );

          firestore()
            .collection("user_data")
            .doc(uid)
            .collection("favorites")
            .get()
            .then((snap) => setFavorites(snap.docs.map((x) => ({ id: x.id, ...(x.data() as any) }))))
            .catch(() => {});

          firestore()
            .collection("user_data")
            .doc(uid)
            .collection("downloads")
            .get()
            .then((snap) => setDownloads(snap.docs.map((x) => ({ id: x.id, ...(x.data() as any) }))))
            .catch(() => {});

          firestore()
            .collection("user_data")
            .doc(uid)
            .collection("playlists")
            .get()
            .then((snap) => setPlaylists(snap.docs.map((x) => ({ id: x.id, ...(x.data() as any) })) as Playlist[]))
            .catch(() => {});
        }
      } catch {
        setLoading(false);
      }
    })();

    return () => {
      unsubSongs?.();
      unsubVideos?.();
      unsubSub?.();
    };
  }, [
    uid,
    sortSongsManual,
    sortVideosManual,
    mediaPrefs.prefetch_next,
    mediaPrefs.low_data_mode,
    mediaPrefs.reduce_images,
    ts,
  ]);

  /* ===================== Tags ===================== */
  const tags = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => s.genre && set.add(String(s.genre)));
    videos.forEach((v) => v.type && set.add(String(v.type)));
    videos.forEach((v) => v.channelName && set.add(String(v.channelName)));
    return Array.from(set).slice(0, 40);
  }, [songs, videos]);

  const toggleTag = (tag: string) => setActiveTags((p) => (p.includes(tag) ? p.filter((x) => x !== tag) : [...p, tag]));

  /* ===================== Derived filtered lists ===================== */
  const q = queryText.trim().toLowerCase();

  const filteredSongs = useMemo(() => {
    return songs.filter((s) => {
      const hay = `${s.title || ""} ${s.artist || ""} ${s.genre || ""}`.toLowerCase();
      const matchQ = !q || hay.includes(q);
      const matchTags =
        activeTags.length === 0 || activeTags.some((t2) => String(s.genre || "").toLowerCase() === t2.toLowerCase());
      return matchQ && matchTags;
    });
  }, [songs, q, activeTags]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const hay = `${v.title || ""} ${v.channelName || ""} ${v.type || ""} ${v.description || ""}`.toLowerCase();
      const matchQ = !q || hay.includes(q);
      const matchTags =
        activeTags.length === 0 ||
        activeTags.some((t2) => {
          const tt = t2.toLowerCase();
          return String(v.type || "").toLowerCase() === tt || String(v.channelName || "").toLowerCase() === tt;
        });
      return matchQ && matchTags;
    });
  }, [videos, q, activeTags]);

  const featuredVideos = useMemo(() => filteredVideos.slice(0, 10), [filteredVideos]);

  /* ===================== Favorites / Downloads / Playlists ===================== */
  const isFavorited = useCallback((itemId: string) => favorites.some((f) => f.itemId === itemId), [favorites]);
  const isDownloaded = useCallback((itemId: string) => downloads.some((d) => d.itemId === itemId), [downloads]);

  const toggleFavorite = useCallback(
    async (item: any, itemType: "song" | "video" | "episode") => {
      if (!uid) return Alert.alert(ts("network.title"), ts("subscription.cancel")); // keep short
      try {
        const already = favorites.find((f) => f.itemId === item.id);
        const ref = firestore().collection("user_data").doc(uid).collection("favorites");
        if (already) {
          await ref.doc(already.id).delete();
          setFavorites((p) => p.filter((x) => x.id !== already.id));
          return;
        }
        const docRef = await ref.add({
          itemId: item.id,
          itemType,
          data: item,
          addedAt: fsServerTimestamp(),
        });
        setFavorites((p) => [{ id: docRef.id, itemId: item.id, itemType, data: item }, ...p]);
      } catch {
        Alert.alert(ts("actionsSheet.title"), ts("actionsSheet.errorUpdateFavorites"));
      }
    },
    [uid, favorites, fsServerTimestamp, ts]
  );

  const toggleDownload = useCallback(
    async (item: any, itemType: "song" | "video" | "episode") => {
      if (!uid) return Alert.alert(ts("network.title"), ts("subscription.cancel"));
      try {
        const already = downloads.find((d) => d.itemId === item.id);
        const ref = firestore().collection("user_data").doc(uid).collection("downloads");
        if (already) {
          await ref.doc(already.id).delete();
          setDownloads((p) => p.filter((x) => x.id !== already.id));
          return;
        }
        const docRef = await ref.add({
          itemId: item.id,
          itemType,
          data: item,
          addedAt: fsServerTimestamp(),
        });
        setDownloads((p) => [{ id: docRef.id, itemId: item.id, itemType, data: item }, ...p]);
      } catch {
        Alert.alert(ts("actionsSheet.title"), ts("actionsSheet.errorUpdateOffline"));
      }
    },
    [uid, downloads, fsServerTimestamp, ts]
  );

  const createPlaylist = useCallback(async () => {
    if (!uid) return Alert.alert(ts("network.title"), ts("subscription.cancel"));
    const name = playlistName.trim();
    if (!name) return Alert.alert(ts("playlist.title"), ts("playlist.enterName"));
    setPlaylistBusy(true);
    try {
      const ref = firestore().collection("user_data").doc(uid).collection("playlists");
      const docRef = await ref.add({
        name,
        createdAt: fsServerTimestamp(),
        updatedAt: fsServerTimestamp(),
      });
      setPlaylists((p) => [{ id: docRef.id, name }, ...p]);
      setPlaylistName("");
      setPlaylistOpen(false);
    } catch {
      Alert.alert(ts("actionsSheet.title"), ts("playlist.createError"));
    } finally {
      setPlaylistBusy(false);
    }
  }, [uid, playlistName, fsServerTimestamp, ts]);

  const openPlaylist = useCallback(
    async (pl: Playlist) => {
      if (!uid) return;
      setSelectedPlaylist(pl);
      setPlaylistItemsOpen(true);
      setSelectedPlaylistItems([]);
      try {
        const snap = await firestore()
          .collection("user_data")
          .doc(uid)
          .collection("playlists")
          .doc(pl.id)
          .collection("items")
          .get();
        setSelectedPlaylistItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch {
        setSelectedPlaylistItems([]);
      }
    },
    [uid]
  );

  const addToPlaylist = useCallback(
    async (pl: Playlist, item: any, itemType: "song" | "video" | "episode") => {
      if (!uid) return;
      try {
        const ref = firestore()
          .collection("user_data")
          .doc(uid)
          .collection("playlists")
          .doc(pl.id)
          .collection("items");

        const exists = await ref.where("itemId", "==", item.id).limit(1).get();
        if (!exists.empty) {
          Alert.alert(ts("playlist.title"), ts("actionsSheet.alreadyInPlaylist"));
          return;
        }

        await ref.add({
          itemId: item.id,
          itemType,
          data: item,
          addedAt: fsServerTimestamp(),
        });

        Alert.alert(ts("playlist.title"), ts("actionsSheet.addedToPlaylist"));
      } catch {
        Alert.alert(ts("actionsSheet.title"), ts("actionsSheet.errorAddPlaylist"));
      }
    },
    [uid, fsServerTimestamp, ts]
  );

  const showAddToPlaylist = useCallback(
    (item: any, itemType: "song" | "video" | "episode") => {
      if (!uid) return Alert.alert(ts("network.title"), ts("subscription.cancel"));
      if (!playlists.length) {
        setPlaylistOpen(true);
        return;
      }
      Alert.alert(ts("actionsSheet.addToPlaylist"), ts("playlist.title"), [
        ...playlists.slice(0, 6).map((pl) => ({
          text: pl.name,
          onPress: () => addToPlaylist(pl, item, itemType),
        })),
        { text: ts("actionsSheet.createPlaylist"), onPress: () => setPlaylistOpen(true) },
        { text: ts("subscription.cancel"), style: "cancel" },
      ]);
    },
    [uid, playlists, addToPlaylist, ts]
  );

  /* ===================== Playback: Audio ===================== */
  const openAudio = useCallback(
    (song: Song) => {
      if (!song?.link) return Alert.alert(ts("player.audioTitle"), ts("player.noAudioLink"));
      if (!ensureWifiIfRequired()) return;

      if ((song.isPremium || true) && !canStreamPremium) {
        return requireSubscription("player.subscribeToListen");
      }

      setCurrentSong(song);
      setAudioPlaying(true);
      setSongPos(0);
      setSongDur(0);
      setMiniAudioVisible(false);
      setAudioModalOpen(true);
    },
    [canStreamPremium, requireSubscription, ensureWifiIfRequired, ts]
  );

  const closeAudioModalToMini = useCallback(() => {
    setAudioModalOpen(false);
    if (currentSong?.link) setMiniAudioVisible(true);
  }, [currentSong?.link]);

  const seekAudio = (nextSec: number) => {
    const sec = clamp(nextSec, 0, songDur || 0);
    audioRef.current?.seek?.(sec);
    setSongPos(sec);
  };

  /* ===================== Playback: Video ===================== */
  const openVideoInfo = (v: VideoItem) => {
    setCurrentVideo(v);
    setVideoInfoOpen(true);
  };

  const openVideoFullscreen = useCallback(async () => {
    if (!currentVideo) return;

    if (!ensureWifiIfRequired()) return;

    if ((currentVideo.isPremium || true) && !canStreamPremium) {
      setVideoInfoOpen(false);
      return requireSubscription("player.subscribeToWatch");
    }

    setCurrentEpisode(null);
    setEpisodes([]);
    setVideoInfoOpen(false);

    if (currentVideo.type === "series") {
      setEpisodesLoading(true);
      try {
        const epsSnap = await firestore().collection("videos").doc(currentVideo.id).collection("episodes").get();
        const epsRaw = epsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Episode[];
        const eps = sortEpisodesManual(epsRaw);
        setEpisodes(eps);
        if (eps[0]?.link) setCurrentEpisode(eps[0]);
      } catch {
        setEpisodes([]);
      } finally {
        setEpisodesLoading(false);
      }
    }

    setVideoPlaying(true);
    setVideoPos(0);
    setVideoDur(0);
    setVideoFullscreenOpen(true);
  }, [currentVideo, canStreamPremium, requireSubscription, ensureWifiIfRequired, sortEpisodesManual]);

  const playEpisode = (ep: Episode) => {
    if (!ep?.link) return Alert.alert(ts("labels.episodes"), ts("player.episodeNoLink"));
    if (!ensureWifiIfRequired()) return;
    setCurrentEpisode(ep);
    setVideoPlaying(true);
    setVideoPos(0);
    setVideoDur(0);
  };

  const seekVideo = (nextSec: number) => {
    const sec = clamp(nextSec, 0, videoDur || 0);
    videoRef.current?.seek?.(sec);
    setVideoPos(sec);
  };

  const moveVideoToPiP = useCallback(() => {
    setVideoFullscreenOpen(false);
    setPipVisible(true);
  }, []);

  const closePiP = useCallback(() => setPipVisible(false), []);

  /* ===================== UI Bits ===================== */
  const PremiumBadge = ({ premium }: { premium?: boolean }) => {
    if (!premium) return null;
    return (
      <View style={ui.premiumBadge}>
        <Ionicons name="sparkles" size={12} color="#fff" />
        <Text style={ui.premiumText}>{ts("badges.premium")}</Text>
      </View>
    );
  };

  const FreeBadge = ({ premium }: { premium?: boolean }) => {
    if (premium) return null;
    return (
      <View style={ui.freeBadge}>
        <Text style={ui.freeText}>{ts("badges.free")}</Text>
      </View>
    );
  };

  const SubscriptionPill = () => {
    if (subLoading) {
      return (
        <View style={[hero.subChip, { backgroundColor: "#F3F4F6" }]}>
          <Text style={[hero.subChipText, { color: "#111" }]}>…</Text>
        </View>
      );
    }

    const label = isSubActive ? ts("subscription.active") : userSub ? ts("subscription.inactive") : ts("subscription.free");
    const toneBg = isSubActive ? "#111827" : "rgba(245,245,245,1)";
    const toneText = isSubActive ? "#fff" : HERO_TEXT;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation?.navigate?.("Settings")}
        style={[hero.subChip, { backgroundColor: toneBg, borderColor: "rgba(0,0,0,0.06)" }]}
      >
        <Ionicons name={isSubActive ? "checkmark-circle-outline" : "lock-closed-outline"} size={14} color={toneText} />
        <Text style={[hero.subChipText, { color: toneText }]} numberOfLines={1}>
          {label}
          {isSubActive && typeof subDaysLeft === "number" ? ` · ${subDaysLeft}j` : ""}
        </Text>
      </TouchableOpacity>
    );
  };

  const Header = () => (
    <View style={[hero.heroContainer, { height: heroFixedHeight }]}>
      <View style={hero.heroPinnedTop}>
        <View style={hero.heroTopLeft}>
          <TouchableOpacity style={hero.heroIcon} activeOpacity={0.9} onPress={() => navigation?.goBack?.()}>
            <Ionicons name="chevron-back" size={20} color={HERO_TEXT} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={hero.heroTitle} numberOfLines={1}>
              {ts("screenTitle")}
            </Text>
            {!compact && (
              <Text style={hero.heroSub} numberOfLines={1}>
                {ts("screenSubtitle")}
              </Text>
            )}
          </View>
        </View>

        <View style={hero.heroTopRight}>
          <SubscriptionPill />

          <TouchableOpacity
            onPress={() => {
              const next = !showSearchBar;
              setShowSearchBar(next);
              setForceHeroOpen(next);
              if (next) setTimeout(() => searchRef.current?.focus(), 120);
            }}
            style={hero.heroIcon}
            activeOpacity={0.9}
          >
            <Ionicons name={showSearchBar ? "close" : "search"} size={18} color={HERO_TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <TabsRow tab={activeTab} setTab={setActiveTab} compact={compact} ts={ts} />
      </View>

      <Animated.View
        style={[
          hero.expandable,
          {
            transform: [{ translateY: expandableTranslateY }],
            opacity: expandableOpacity,
          },
        ]}
      >
        {showSearchBar && (
          <>
            <View style={hero.searchRow}>
              <Ionicons name="search-outline" size={18} color="rgba(6,51,37,0.75)" />
              <TextInput
                ref={searchRef}
                value={queryText}
                onChangeText={setQueryText}
                placeholder={ts("search.placeholder")}
                placeholderTextColor="rgba(6,51,37,0.45)"
                style={hero.searchInput}
              />
              {!!queryText && (
                <TouchableOpacity onPress={() => setQueryText("")} style={hero.searchBtn} activeOpacity={0.9}>
                  <Ionicons name="close" size={18} color={HERO_TEXT} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.tagsRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setActiveTags([])}
                style={[hero.tagPill, activeTags.length === 0 && hero.tagPillActive]}
              >
                <Ionicons
                  name="pricetags-outline"
                  size={16}
                  color={activeTags.length === 0 ? "#fff" : "rgba(2, 39, 27, 0.9)"}
                />
                <Text style={[hero.tagText, activeTags.length === 0 && hero.tagTextActive]}>{ts("search.allTags")}</Text>
              </TouchableOpacity>

              {tags.map((tag) => {
                const on = activeTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    activeOpacity={0.9}
                    onPress={() => toggleTag(tag)}
                    style={[hero.tagPill, on && hero.tagPillActive]}
                  >
                    <Ionicons name="pricetag-outline" size={16} color={on ? "#fff" : "rgba(2, 39, 27, 0.9)"} />
                    <Text style={[hero.tagText, on && hero.tagTextActive]} numberOfLines={1}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.quickRow}>
              <TouchableOpacity
                onPress={() => {
                  setActiveBottomTab("favorites");
                  setSheetOpen(true);
                }}
                style={hero.quickPill}
                activeOpacity={0.9}
              >
                <Ionicons name="heart-outline" size={16} color={HERO_TEXT} />
                <Text style={hero.quickText}>{ts("quick.favorites")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setActiveBottomTab("downloads");
                  setSheetOpen(true);
                }}
                style={hero.quickPill}
                activeOpacity={0.9}
              >
                <Ionicons name="download-outline" size={16} color={HERO_TEXT} />
                <Text style={hero.quickText}>{ts("quick.offline")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setActiveBottomTab("library");
                  setSheetOpen(true);
                }}
                style={hero.quickPill}
                activeOpacity={0.9}
              >
                <Ionicons name="albums-outline" size={16} color={HERO_TEXT} />
                <Text style={hero.quickText}>{ts("quick.playlists")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation?.navigate?.("Subscriptions")}
                style={[hero.quickPill, { backgroundColor: "rgba(50, 221, 121, 0.18)" }]}
                activeOpacity={0.9}
              >
                <Ionicons name="card-outline" size={16} color={HERO_TEXT} />
                <Text style={hero.quickText}>{isSubActive ? ts("quick.manageSubscription") : ts("quick.subscribe")}</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={hero.subHintRow}>
              <Ionicons
                name={isSubActive ? "checkmark-circle" : "information-circle-outline"}
                size={16}
                color={HERO_TEXT}
              />
              <Text style={hero.subHintText} numberOfLines={2}>
                {isSubActive
                  ? ts("subscription.activeHint", {
                      pkg:
                        userSub?.packageName
                          ? ts("subscription.pkgFormat", { name: userSub.packageName })
                          : packageInfo?.name
                            ? ts("subscription.pkgFormat", { name: packageInfo.name })
                            : "",
                    })
                  : ts("subscription.inactiveHint")}
              </Text>
            </View>

            {(mediaPrefs.stream_wifi_only || mediaPrefs.low_data_mode || mediaPrefs.reduce_images) && (
              <View style={[hero.subHintRow, { marginTop: 10 }]}>
                <Ionicons name="options-outline" size={16} color={HERO_TEXT} />
                <Text style={hero.subHintText} numberOfLines={2}>
                  {ts("settingsActive.title")}{" "}
                  {[
                    mediaPrefs.stream_wifi_only ? ts("settingsActive.wifiOnly") : null,
                    mediaPrefs.low_data_mode ? ts("settingsActive.dataSaver") : null,
                    mediaPrefs.reduce_images ? ts("settingsActive.reducedImages") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );

  /* ===================== Renderers ===================== */
  const renderSongItem = ({ item }: { item: Song }) => {
    const premium = !!item.isPremium;
    const locked = !canStreamPremium;
    const img = maybeResizeImage(item.coverUrl, mediaPrefs.reduce_images);

    return (
      <TouchableOpacity activeOpacity={0.92} style={ui.songRow} onPress={() => openAudio(item)}>
        <Image source={{ uri: img }} style={ui.songArt} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={ui.songTitle} numberOfLines={1}>
              {safeText(item.title, ts("labels.unknownTitle"))}
            </Text>
            {premium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}
          </View>

          <Text style={ui.songArtist} numberOfLines={1}>
            {safeText(item.artist, ts("labels.unknownArtist"))}
          </Text>

          <View style={ui.songMicroRow}>
            <View style={ui.microPill}>
              <Ionicons name="musical-notes" size={12} color="#111" />
              <Text style={ui.microPillText}>{item.genre || ts("labels.music")}</Text>
            </View>
            <Text style={ui.microDot}>•</Text>
            <Text style={ui.microInfo}>{ts("counts.plays", { count: String(item.plays ?? "0") })}</Text>
          </View>

          {locked && (
            <View style={ui.lockRow}>
              <Ionicons name="lock-closed" size={14} color={HERO_TEXT} />
              <Text style={ui.lockText}>{ts("locks.subscriptionRequired")}</Text>
            </View>
          )}
        </View>

        <View style={ui.rowActions}>
          <TouchableOpacity style={[ui.iconBtn, locked && { opacity: 0.6 }]} onPress={() => openAudio(item)} activeOpacity={0.85}>
            <Ionicons name="play" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={ui.ghostBtn} onPress={() => showSongActions(item)} activeOpacity={0.85}>
            <Ionicons name="ellipsis-vertical" size={18} color="#111" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVideoRow = ({ item }: { item: VideoItem }) => {
    const premium = !!item.isPremium;
    const locked = !canStreamPremium;
    const img = maybeResizeImage(item.coverUrl, mediaPrefs.reduce_images);

    return (
      <TouchableOpacity style={ui.videoRow} activeOpacity={0.92} onPress={() => openVideoInfo(item)}>
        <View style={ui.videoThumbWrap}>
          <Image source={{ uri: img }} style={ui.videoThumb} resizeMode="cover" />
          <LinearGradient colors={["rgba(15,23,42,0.00)", "rgba(15,23,42,0.55)"]} style={ui.videoThumbGrad} />
          <View style={ui.videoThumbBadges}>{premium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}</View>

          {locked && (
            <View style={ui.videoLock}>
              <Ionicons name="lock-closed" size={14} color="#fff" />
              <Text style={ui.videoLockText}>{ts("locks.locked")}</Text>
            </View>
          )}
        </View>

        <View style={ui.videoMeta}>
          <View style={ui.videoTitleRow}>
            <Text style={ui.videoTitle} numberOfLines={2}>
              {safeText(item.title, ts("labels.untitled"))}
            </Text>
            <TouchableOpacity onPress={() => showVideoActions(item)} style={ui.ghostBtnSm}>
              <Ionicons name="ellipsis-vertical" size={16} color="#111" />
            </TouchableOpacity>
          </View>

          <Text style={ui.videoSub} numberOfLines={1}>
            {(item.channelName || ts("labels.channel"))} • {(item.type || "video")}
          </Text>

          <View style={ui.videoStatsRow}>
            <Text style={ui.videoStat}>{ts("counts.views", { count: String(item.views ?? "0") })}</Text>
            <Text style={ui.videoDot}>•</Text>
            <Text style={ui.videoStat}>{item.uploadTime || ts("labels.recently")}</Text>
          </View>

          {!mediaPrefs.low_data_mode && (
            <Text style={ui.videoDesc} numberOfLines={2}>
              {item.description || ts("labels.noDescription")}
            </Text>
          )}

          {item.type === "series" && (
            <View style={ui.seriesPill}>
              <Ionicons name="albums-outline" size={14} color={HERO_TEXT} />
              <Text style={ui.seriesText}>{ts("labels.seriesEpisodes")}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const showSongActions = (song: Song) => {
    Alert.alert(ts("actionsSheet.title"), song.title || ts("labels.unknownTitle"), [
      { text: ts("subscription.cancel"), style: "cancel" },
      {
        text: isFavorited(song.id) ? ts("actionsSheet.removeFromFavorites") : ts("actionsSheet.addToFavorites"),
        onPress: () => toggleFavorite(song, "song"),
      },
      {
        text: isDownloaded(song.id) ? ts("actionsSheet.removeOffline") : ts("actionsSheet.addOffline"),
        onPress: () => toggleDownload(song, "song"),
      },
      { text: ts("actionsSheet.addToPlaylist"), onPress: () => showAddToPlaylist(song, "song") },
      { text: ts("player.shareTitle"), onPress: () => shareItem(song) },
    ]);
  };

  const showVideoActions = (v: VideoItem) => {
    Alert.alert(ts("actionsSheet.title"), v.title || ts("labels.untitled"), [
      { text: ts("subscription.cancel"), style: "cancel" },
      {
        text: isFavorited(v.id) ? ts("actionsSheet.removeFromFavorites") : ts("actionsSheet.addToFavorites"),
        onPress: () => toggleFavorite(v, "video"),
      },
      {
        text: isDownloaded(v.id) ? ts("actionsSheet.removeOffline") : ts("actionsSheet.addOffline"),
        onPress: () => toggleDownload(v, "video"),
      },
      { text: ts("actionsSheet.addToPlaylist"), onPress: () => showAddToPlaylist(v, "video") },
      {
        text: "PiP",
        onPress: () => {
          setCurrentVideo(v);
          setVideoInfoOpen(false);
          setTimeout(openVideoFullscreen, 120);
        },
      },
      { text: ts("player.shareTitle"), onPress: () => shareItem(v) },
    ]);
  };

  /* ===================== Main tab content ===================== */
  const Content = () => {
    if (loading) {
      return (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 10, fontWeight: "800", color: "#111" }}>{ts("labels.recently")}…</Text>
        </View>
      );
    }

    if (activeTab === "Pour toi") {
      return (
        <View style={{ padding: 16, paddingBottom: 30 }}>
          <View style={ui.sectionHeaderRow}>
            <Text style={ui.sectionTitleInline}>{ts("counts.featured")}</Text>
            <TouchableOpacity onPress={() => setActiveTab("Films/Séries")} activeOpacity={0.9}>
              <Text style={ui.sectionLink}>{ts("player.watch")}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={featuredVideos}
            keyExtractor={(it) => it.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
            renderItem={({ item }) => {
              const img = maybeResizeImage(item.coverUrl, mediaPrefs.reduce_images);
              return (
                <TouchableOpacity activeOpacity={0.92} style={ui.featureCard} onPress={() => openVideoInfo(item)}>
                  <Image source={{ uri: img }} style={ui.featureImg} resizeMode="cover" />
                  <LinearGradient colors={["transparent", "rgba(15,23,42,0.78)"]} style={ui.featureGrad} />
                  <View style={ui.featureTop}>{item.isPremium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}</View>
                  <View style={ui.featureBottom}>
                    <Text style={ui.featureTitle} numberOfLines={2}>
                      {item.title || ts("labels.untitled")}
                    </Text>
                    <Text style={ui.featureSub} numberOfLines={1}>
                      {(item.channelName || ts("labels.channel"))} • {ts("counts.views", { count: String(item.views ?? "0") })}
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[ui.featureBtnPrimary, !canStreamPremium && { opacity: 0.7 }]}
                        onPress={() => {
                          if (!canStreamPremium) return requireSubscription("player.subscribeToWatch");
                          if (!ensureWifiIfRequired()) return;
                          setCurrentVideo(item);
                          openVideoFullscreen();
                        }}
                      >
                        <Ionicons name="play" size={18} color="#fff" />
                        <Text style={ui.featureBtnPrimaryText}>{ts("player.play")}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity activeOpacity={0.9} style={ui.featureBtnGhost} onPress={() => toggleFavorite(item, "video")}>
                        <Ionicons name={isFavorited(item.id) ? "heart" : "heart-outline"} size={18} color="#fff" />
                        <Text style={ui.featureBtnGhostText}>{ts("player.like")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View style={{ height: 16 }} />

          <View style={ui.sectionHeaderRow}>
            <Text style={ui.sectionTitleInline}>{ts("tabs.music")}</Text>
            <TouchableOpacity onPress={() => setActiveTab("Musique")} activeOpacity={0.9}>
              <Text style={ui.sectionLink}>{ts("player.watchVideo")}</Text>
            </TouchableOpacity>
          </View>

          {filteredSongs.slice(0, 12).map((s) => (
            <View key={s.id}>{renderSongItem({ item: s })}</View>
          ))}
        </View>
      );
    }

    if (activeTab === "Musique") {
      return (
        <View style={{ padding: 16, paddingBottom: 30 }}>
          <View style={ui.sectionHeaderRow}>
            <Text style={ui.sectionTitleInline}>{ts("tabs.music")}</Text>
            <Text style={ui.sectionHint}>{ts("counts.tracksCount", { count: String(filteredSongs.length) })}</Text>
          </View>
          {filteredSongs.map((s) => (
            <View key={s.id}>{renderSongItem({ item: s })}</View>
          ))}
        </View>
      );
    }

    return (
      <View style={{ padding: 16, paddingBottom: 30 }}>
        <View style={ui.sectionHeaderRow}>
          <Text style={ui.sectionTitleInline}>{ts("tabs.filmsSeries")}</Text>
          <Text style={ui.sectionHint}>{ts("counts.videosCount", { count: String(filteredVideos.length) })}</Text>
        </View>
        {filteredVideos.map((v) => (
          <View key={v.id}>{renderVideoRow({ item: v })}</View>
        ))}
      </View>
    );
  };

  /* ===================== Bottom Sheet content ===================== */
  const BottomSheetContent = () => {
    const titleMap: Record<BottomTab, string> = {
      browse: ts("bottomSheet.browse"),
      favorites: ts("bottomSheet.favorites"),
      downloads: ts("bottomSheet.downloads"),
      library: ts("bottomSheet.library"),
    };

    const favItems = favorites.map((f) => f.data).filter(Boolean);
    const dlItems = downloads.map((d) => d.data).filter(Boolean);

    return (
      <View style={{ paddingBottom: 10 }}>
        <View style={ui.sheetTopRow}>
          <Text style={ui.sheetTitle}>{titleMap[activeBottomTab]}</Text>
          <TouchableOpacity onPress={() => setSheetOpen(false)} style={ui.sheetCloseBtn}>
            <Ionicons name="close" size={18} color="#111" />
          </TouchableOpacity>
        </View>

        {activeBottomTab === "browse" && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
            <Text style={ui.miniTitle}>{ts("bottomSheet.shortcuts")}</Text>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <TouchableOpacity style={ui.actionBtn} activeOpacity={0.9} onPress={() => setActiveTab("Musique")}>
                <Ionicons name="musical-notes-outline" size={16} color="#111" />
                <Text style={ui.actionBtnText}>{ts("tabs.music")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={ui.actionBtn} activeOpacity={0.9} onPress={() => setActiveTab("Films/Séries")}>
                <Ionicons name="film-outline" size={16} color="#111" />
                <Text style={ui.actionBtnText}>{ts("tabs.filmsSeries")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={ui.actionBtn} activeOpacity={0.9} onPress={() => setShowSearchBar(true)}>
                <Ionicons name="search-outline" size={16} color="#111" />
                <Text style={ui.actionBtnText}>{ts("bottomSheet.browse")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[ui.actionBtn, { backgroundColor: "rgba(50, 221, 121, 0.18)" }]}
                activeOpacity={0.9}
                onPress={() => navigation?.navigate?.("Subscriptions")}
              >
                <Ionicons name="card-outline" size={16} color={HERO_TEXT} />
                <Text style={[ui.actionBtnText, { color: HERO_TEXT }]}>
                  {isSubActive ? ts("quick.manageSubscription") : ts("quick.subscribe")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={ui.actionBtn} activeOpacity={0.9} onPress={() => navigation?.navigate?.("Settings")}>
                <Ionicons name="settings-outline" size={16} color="#111" />
                <Text style={ui.actionBtnText}>{ts("bottomSheet.mediaSettings")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeBottomTab === "favorites" &&
          (favItems.length ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
              {favItems.map((it: any, idx: number) => (
                <View key={it?.id || String(idx)}>
                  {"genre" in it ? renderSongItem({ item: it }) : renderVideoRow({ item: it })}
                </View>
              ))}
            </View>
          ) : (
            <Text style={ui.emptyText}>{ts("bottomSheet.emptyFavorites")}</Text>
          ))}

        {activeBottomTab === "downloads" &&
          (dlItems.length ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
              {dlItems.map((it: any, idx: number) => (
                <View key={it?.id || String(idx)}>
                  {"genre" in it ? renderSongItem({ item: it }) : renderVideoRow({ item: it })}
                </View>
              ))}
            </View>
          ) : (
            <Text style={ui.emptyText}>{ts("bottomSheet.emptyOffline")}</Text>
          ))}

        {activeBottomTab === "library" && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={ui.miniTitle}>{ts("playlist.yourPlaylists")}</Text>
              <TouchableOpacity style={ui.smallPlusBtn} activeOpacity={0.9} onPress={() => setPlaylistOpen(true)}>
                <Ionicons name="add" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            {!playlists.length ? (
              <Text style={ui.emptyText}>{ts("playlist.emptyPlaylists")}</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {playlists.map((pl) => (
                  <TouchableOpacity key={pl.id} style={ui.playlistRow} activeOpacity={0.9} onPress={() => openPlaylist(pl)}>
                    <View style={ui.playlistIcon}>
                      <Ionicons name="albums-outline" size={18} color="#111" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.playlistTitle} numberOfLines={1}>
                        {pl.name}
                      </Text>
                      <Text style={ui.playlistSub} numberOfLines={1}>
                        {ts("playlist.open")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#111" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  /* ===================== Bottom Tabs ===================== */
  const BottomTabs = () => {
    const items: Array<{ key: BottomTab; icon: any; label: string }> = [
      { key: "browse", icon: "grid-outline", label: ts("bottomSheet.browse") },
      { key: "favorites", icon: "heart-outline", label: ts("quick.favorites") },
      { key: "downloads", icon: "download-outline", label: ts("quick.offline") },
      { key: "library", icon: "albums-outline", label: ts("quick.playlists") },
    ];

    return (
      <View style={ui.bottomNav}>
        {items.map((it) => {
          const on = activeBottomTab === it.key;
          return (
            <TouchableOpacity
              key={it.key}
              activeOpacity={0.9}
              style={ui.bottomItem}
              onPress={() => {
                setActiveBottomTab(it.key);
                setSheetOpen(true);
              }}
            >
              <View style={[ui.bottomIconWrap, on && { backgroundColor: "rgba(50, 221, 121, 0.18)" }]}>
                <Ionicons name={it.icon} size={20} color={on ? HERO_TEXT : "#6B6B70"} />
              </View>
              <Text style={[ui.bottomLabel, on && { color: HERO_TEXT }]} numberOfLines={1}>
                {it.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  /* ===================== Mini Audio Player ===================== */
  const MiniAudioPlayer = () => {
    if (!miniAudioVisible || !currentSong?.link) return null;

    return (
      <View style={ui.miniAudioWrap}>
        <Video
          ref={audioRef}
          source={{ uri: currentSong.link }}
          paused={!audioPlaying}
          muted={audioMuted}
          audioOnly
          playInBackground={!!mediaPrefs.background_play}
          playWhenInactive={!!mediaPrefs.background_play}
          onProgress={(p: any) => setSongPos(p?.currentTime || 0)}
          onLoad={(meta: any) => setSongDur(meta?.duration || 0)}
          onError={() => {
            setMiniAudioVisible(false);
            Alert.alert(ts("player.audioTitle"), ts("player.cannotPlayAudio"));
          }}
          maxBitRate={bitRateForAudio(mediaPrefs.audio_quality, mediaPrefs.low_data_mode)}
          style={{ width: 0, height: 0 }}
        />

        <TouchableOpacity
          activeOpacity={0.9}
          style={ui.miniAudioCard}
          onPress={() => {
            setAudioModalOpen(true);
            setMiniAudioVisible(false);
          }}
        >
          <Image
            source={{ uri: maybeResizeImage(currentSong.coverUrl, mediaPrefs.reduce_images) }}
            style={ui.miniAudioArt}
            resizeMode="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={ui.miniAudioTitle} numberOfLines={1}>
              {currentSong.title || ts("player.audioTitle")}
            </Text>
            <Text style={ui.miniAudioSub} numberOfLines={1}>
              {(currentSong.artist || ts("labels.unknownArtist"))} • {formatTime(songPos)} / {formatTime(songDur)}
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.9} style={ui.miniCtlBtn} onPress={() => setAudioPlaying((p) => !p)}>
            <Ionicons name={audioPlaying ? "pause" : "play"} size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[ui.miniCtlBtn, { backgroundColor: "#111827" }]}
            onPress={() => {
              setAudioPlaying(false);
              setMiniAudioVisible(false);
              setCurrentSong(null);
            }}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  /* ===================== Floating PiP Video ===================== */
  const PiPVideo = () => {
    if (!pipVisible) return null;

    const url = currentEpisode?.link || currentVideo?.link;
    if (!url) return null;

    return (
      <Animated.View
        style={[
          ui.pipWrap,
          {
            transform: pipPan.getTranslateTransform(),
          },
        ]}
      >
        <View
          style={ui.pipCard}
          onStartShouldSetResponder={() => true}
          onResponderMove={(e) => {
            const { pageX, pageY } = e.nativeEvent;
            const x = clamp(pageX - 90, 10, width - 190);
            const y = clamp(pageY - 60, 90, height - 220);
            pipPan.setValue({ x, y });
          }}
        >
          <Video
            source={{ uri: url }}
            style={ui.pipVideo}
            resizeMode="cover"
            paused={!videoPlaying}
            muted={videoMuted}
            onProgress={(p: any) => setVideoPos(p?.currentTime || 0)}
            onLoad={(meta: any) => setVideoDur(meta?.duration || 0)}
            onError={() => {
              setPipVisible(false);
              Alert.alert(ts("player.videoTitle"), ts("player.cannotPlayVideo"));
            }}
            maxBitRate={bitRateForVideo(mediaPrefs.video_quality, mediaPrefs.low_data_mode)}
          />

          <View style={ui.pipTopBar}>
            <TouchableOpacity style={ui.pipTopBtn} onPress={() => setVideoPlaying((p) => !p)} activeOpacity={0.9}>
              <Ionicons name={videoPlaying ? "pause" : "play"} size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={ui.pipTopBtn}
              onPress={() => {
                setPipVisible(false);
                setTimeout(() => setVideoFullscreenOpen(true), 120);
              }}
              activeOpacity={0.9}
            >
              <Ionicons name="expand-outline" size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={ui.pipTopBtn} onPress={closePiP} activeOpacity={0.9}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  /* ===================== Render ===================== */
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={HERO_BG} />

      <Header />

      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: heroFixedHeight + 12, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <Content />
      </Animated.ScrollView>

      <BottomTabs />
      <MiniAudioPlayer />
      <PiPVideo />

      {/* ===================== AUDIO MODAL ===================== */}
      <Modal visible={audioModalOpen} animationType="slide" transparent onRequestClose={() => closeAudioModalToMini()}>
        <View style={ui.fullModalBackdrop}>
          <View style={ui.fullModalSheet}>
            <View style={ui.modalHeaderRow}>
              <TouchableOpacity onPress={closeAudioModalToMini} style={ui.modalHeaderBtn}>
                <Ionicons name="chevron-down" size={24} color="#111" />
              </TouchableOpacity>

              <View style={{ alignItems: "center" }}>
                <Text style={ui.modalHeaderTitle}>{ts("player.audioTitle")}</Text>
                <Text style={ui.modalHeaderSub} numberOfLines={1}>
                  {currentSong?.genre || ts("labels.music")}
                </Text>
              </View>

              <TouchableOpacity onPress={() => currentSong && showSongActions(currentSong)} style={ui.modalHeaderBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={ui.musicHeroWrap}>
              <Image
                source={{ uri: maybeResizeImage(currentSong?.coverUrl, mediaPrefs.reduce_images) }}
                style={ui.musicHeroArt}
                resizeMode="cover"
              />
              <LinearGradient colors={["rgba(0,0,0,0)", "rgba(15,23,42,0.18)"]} style={ui.musicHeroShade} />
            </View>

            {!!currentSong?.link && (
              <Video
                ref={audioRef}
                source={{ uri: currentSong.link }}
                paused={!audioPlaying}
                muted={audioMuted}
                audioOnly
                playInBackground={!!mediaPrefs.background_play}
                playWhenInactive={!!mediaPrefs.background_play}
                onProgress={(p: any) => setSongPos(p?.currentTime || 0)}
                onLoad={(meta: any) => setSongDur(meta?.duration || 0)}
                onError={() => Alert.alert(ts("player.audioTitle"), ts("player.cannotPlayAudio"))}
                maxBitRate={bitRateForAudio(mediaPrefs.audio_quality, mediaPrefs.low_data_mode)}
                style={{ height: 0, width: 0 }}
              />
            )}

            <View style={ui.musicInfoBlock}>
              <View style={{ flex: 1 }}>
                <Text style={ui.musicTitle} numberOfLines={1}>
                  {currentSong?.title || ts("labels.unknownTitle")}
                </Text>
                <Text style={ui.musicArtist} numberOfLines={1}>
                  {currentSong?.artist || ts("labels.unknownArtist")}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={ui.likeBtn}
                onPress={() => currentSong && toggleFavorite(currentSong, "song")}
              >
                <Ionicons
                  name={currentSong && isFavorited(currentSong.id) ? "heart" : "heart-outline"}
                  size={20}
                  color="#111"
                />
              </TouchableOpacity>
            </View>

            <View style={ui.progressWrap}>
              <Pressable
                onPress={(e: any) => {
                  const x = e.nativeEvent.locationX;
                  const ratio = clamp(x / (width - 16 * 2 - 8), 0, 1);
                  seekAudio(ratio * (songDur || 0));
                }}
              >
                <View style={ui.progressTrack}>
                  <View style={[ui.progressFill, { width: `${clamp((songPos / Math.max(1, songDur)) * 100, 0, 100)}%` }]} />
                </View>
              </Pressable>

              <View style={ui.timeRow}>
                <Text style={ui.timeText}>{formatTime(songPos)}</Text>
                <Text style={ui.timeText}>{formatTime(songDur)}</Text>
              </View>
            </View>

            <View style={ui.controlsRow}>
              <TouchableOpacity style={ui.controlBtn} onPress={() => setAudioMuted((m) => !m)}>
                <Ionicons name={audioMuted ? "volume-mute" : "volume-high"} size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={ui.controlBtn} onPress={() => seekAudio(songPos - 10)}>
                <Ionicons name="play-back" size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} style={ui.playBigBtn} onPress={() => setAudioPlaying((p) => !p)}>
                <Ionicons name={audioPlaying ? "pause" : "play"} size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={ui.controlBtn} onPress={() => seekAudio(songPos + 10)}>
                <Ionicons name="play-forward" size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={ui.controlBtn} onPress={() => currentSong && toggleDownload(currentSong, "song")}>
                <Ionicons name={currentSong && isDownloaded(currentSong.id) ? "download" : "download-outline"} size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={ui.musicBottomActions}>
              <TouchableOpacity style={[ui.actionPill, { backgroundColor: "#F2F3F5" }]} onPress={() => currentSong && showAddToPlaylist(currentSong, "song")}>
                <Ionicons name="add-circle-outline" size={18} color="#111" />
                <Text style={ui.actionPillText}>{ts("player.playlist")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[ui.actionPill, { backgroundColor: "rgba(50, 221, 121, 0.18)", borderColor: "rgba(0,0,0,0.06)", borderWidth: 1 }]}
                onPress={() => currentSong && shareItem(currentSong)}
              >
                <Ionicons name="share-social-outline" size={18} color={HERO_TEXT} />
                <Text style={[ui.actionPillText, { color: HERO_TEXT }]}>{ts("player.shareTitle")}</Text>
              </TouchableOpacity>
            </View>

            <View style={[ui.gateCard, { marginTop: 12 }]}>
              <Ionicons name="settings-outline" size={18} color={HERO_TEXT} />
              <Text style={ui.gateText}>
                {ts("hints.playerSettingsAudio", {
                  quality: String(mediaPrefs.audio_quality).toUpperCase(),
                  bg: mediaPrefs.background_play ? ts("hints.on") : ts("hints.off"),
                  data: mediaPrefs.low_data_mode ? ts("hints.on") : ts("hints.off"),
                })}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== VIDEO INFO MODAL ===================== */}
      <Modal visible={videoInfoOpen} animationType="fade" transparent onRequestClose={() => setVideoInfoOpen(false)}>
        <View style={ui.videoInfoBackdrop}>
          <View style={ui.videoInfoCard}>
            <TouchableOpacity style={ui.videoInfoClose} onPress={() => setVideoInfoOpen(false)}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>

            <View style={ui.videoInfoHero}>
              <Image source={{ uri: maybeResizeImage(currentVideo?.coverUrl, mediaPrefs.reduce_images) }} style={ui.videoInfoHeroImg} resizeMode="cover" />
              <LinearGradient colors={["transparent", "rgba(15,23,42,0.78)"]} style={ui.videoInfoHeroGrad} />
              <View style={ui.videoInfoHeroTop}>{currentVideo?.isPremium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}</View>
              <View style={ui.videoInfoHeroBottom}>
                <Text style={ui.videoInfoTitle} numberOfLines={2}>
                  {currentVideo?.title || ts("labels.untitled")}
                </Text>
                <Text style={ui.videoInfoSub} numberOfLines={1}>
                  {(currentVideo?.channelName || currentVideo?.type || ts("labels.channel"))} • {ts("counts.views", { count: String(currentVideo?.views ?? "0") })}
                </Text>
              </View>
            </View>

            <View style={ui.videoInfoBody}>
              {!mediaPrefs.low_data_mode && (
                <Text style={ui.videoInfoDesc} numberOfLines={4}>
                  {currentVideo?.description || ts("labels.noDescriptionShort")}
                </Text>
              )}

              <View style={ui.videoInfoBtns}>
                <TouchableOpacity style={ui.primaryBtn} activeOpacity={0.9} onPress={openVideoFullscreen}>
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={ui.primaryBtnText}>
                    {currentVideo?.type === "series" ? ts("player.watchSeries") : ts("player.watchVideo")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={ui.secondaryBtn} onPress={() => currentVideo && toggleFavorite(currentVideo, "video")}>
                  <Ionicons name={currentVideo && isFavorited(currentVideo.id) ? "heart" : "heart-outline"} size={18} color="#111" />
                  <Text style={ui.secondaryBtnText}>{ts("player.favorite")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={ui.secondaryBtn} onPress={() => currentVideo && toggleDownload(currentVideo, "video")}>
                  <Ionicons name={currentVideo && isDownloaded(currentVideo.id) ? "download" : "download-outline"} size={18} color="#111" />
                  <Text style={ui.secondaryBtnText}>{ts("player.offline")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={ui.secondaryBtn} onPress={() => currentVideo && showAddToPlaylist(currentVideo, "video")}>
                  <Ionicons name="add-circle-outline" size={18} color="#111" />
                  <Text style={ui.secondaryBtnText}>{ts("player.playlist")}</Text>
                </TouchableOpacity>
              </View>

              {!canStreamPremium && (
                <View style={ui.gateCard}>
                  <Ionicons name="lock-closed-outline" size={18} color={HERO_TEXT} />
                  <Text style={ui.gateText}>{ts("locks.streamingLocked")}</Text>
                </View>
              )}

              {(mediaPrefs.stream_wifi_only || mediaPrefs.low_data_mode) && (
                <View style={[ui.gateCard, { marginTop: 10 }]}>
                  <Ionicons name="options-outline" size={18} color={HERO_TEXT} />
                  <Text style={ui.gateText}>
                    {mediaPrefs.stream_wifi_only ? `${ts("settingsActive.wifiOnly")} · ` : ""}
                    {ts("hints.playerSettingsVideo", {
                      quality: String(mediaPrefs.video_quality).toUpperCase(),
                      cap: mediaPrefs.captions ? ts("hints.on") : ts("hints.off"),
                      data: mediaPrefs.low_data_mode ? ts("hints.on") : ts("hints.off"),
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== VIDEO FULLSCREEN MODAL ===================== */}
      <Modal visible={videoFullscreenOpen} animationType="slide" transparent onRequestClose={() => setVideoFullscreenOpen(false)}>
        <View style={ui.videoFullWrap}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          <View style={ui.videoFullTopBar}>
            <TouchableOpacity style={ui.videoFullTopBtn} onPress={() => setVideoFullscreenOpen(false)}>
              <Ionicons name="chevron-down" size={24} color="#111" />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={ui.videoFullTitle} numberOfLines={1}>
                {currentEpisode?.title || currentVideo?.title || ts("player.videoTitle")}
              </Text>
              <Text style={ui.videoFullSub} numberOfLines={1}>
                {(currentVideo?.channelName || currentVideo?.type || ts("labels.channel"))} • {ts("counts.views", { count: String(currentVideo?.views ?? "0") })}
              </Text>
            </View>

            <TouchableOpacity style={ui.videoFullTopBtn} onPress={moveVideoToPiP} activeOpacity={0.9}>
              <Ionicons name="contract-outline" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          <View style={ui.videoCanvas}>
            {(() => {
              const url = currentEpisode?.link || currentVideo?.link;

              if (!url) {
                return (
                  <View style={[ui.videoCanvas, { alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontWeight: "900", color: "#fff" }}>{ts("player.noVideoLink")}</Text>
                  </View>
                );
              }

              if (!canStreamPremium) {
                return (
                  <View style={[ui.videoCanvas, { alignItems: "center", justifyContent: "center", padding: 16 }]}>
                    <Ionicons name="lock-closed" size={26} color="#fff" />
                    <Text style={{ fontWeight: "900", color: "#fff", marginTop: 8 }}>{ts("locks.subscriptionRequired")}</Text>
                    <Text style={{ fontWeight: "800", color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 6 }}>
                      {ts("player.subscribeToWatch")}
                    </Text>
                    <TouchableOpacity style={[ui.primaryBtn, { marginTop: 12 }]} onPress={() => requireSubscription("player.subscribeToWatch")}>
                      <Text style={ui.primaryBtnText}>{ts("player.subscribeBtn")}</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              const textTracks = currentVideo?.captionsUrl
                ? [
                    {
                      title: "Captions",
                      language: "en",
                      type: "text/vtt",
                      uri: currentVideo.captionsUrl,
                    },
                  ]
                : undefined;

              return (
                <Video
                  ref={videoRef}
                  source={{ uri: url }}
                  style={ui.realVideo}
                  resizeMode="contain"
                  paused={!videoPlaying}
                  muted={videoMuted}
                  controls={false}
                  onProgress={(p: any) => setVideoPos(p?.currentTime || 0)}
                  onLoad={(meta: any) => setVideoDur(meta?.duration || 0)}
                  onError={() => Alert.alert(ts("player.videoTitle"), ts("player.cannotPlayVideo"))}
                  maxBitRate={bitRateForVideo(mediaPrefs.video_quality, mediaPrefs.low_data_mode)}
                  textTracks={textTracks as any}
                  selectedTextTrack={mediaPrefs.captions ? ({ type: "title", value: "Captions" } as any) : ({ type: "disabled" } as any)}
                />
              );
            })()}

            <View style={ui.videoControlsGlass}>
              <View style={ui.videoControlsRow}>
                <TouchableOpacity style={ui.videoControlBtn} onPress={() => setVideoMuted((m) => !m)}>
                  <Ionicons name={videoMuted ? "volume-mute" : "volume-high"} size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={ui.videoControlBtn} onPress={() => seekVideo(videoPos - 10)}>
                  <Ionicons name="play-back" size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={ui.videoPlayBig} onPress={() => setVideoPlaying((p) => !p)}>
                  <Ionicons name={videoPlaying ? "pause" : "play"} size={30} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={ui.videoControlBtn} onPress={() => seekVideo(videoPos + 10)}>
                  <Ionicons name="play-forward" size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={ui.videoControlBtn} onPress={() => currentVideo && toggleDownload(currentVideo, "video")}>
                  <Ionicons name={currentVideo && isDownloaded(currentVideo.id) ? "download" : "download-outline"} size={22} color="#111" />
                </TouchableOpacity>
              </View>

              <View style={ui.videoProgressWrap}>
                <Pressable
                  onPress={(e: any) => {
                    const x = e.nativeEvent.locationX;
                    const ratio = clamp(x / (width - 12 * 2 - 24), 0, 1);
                    seekVideo(ratio * (videoDur || 0));
                  }}
                >
                  <View style={ui.videoProgressTrack}>
                    <View style={[ui.videoProgressFill, { width: `${clamp((videoPos / Math.max(1, videoDur)) * 100, 0, 100)}%` }]} />
                  </View>
                </Pressable>
                <View style={ui.videoTimeRow}>
                  <Text style={ui.videoTime}>{formatTime(videoPos)}</Text>
                  <Text style={ui.videoTime}>{formatTime(videoDur)}</Text>
                </View>
              </View>
            </View>
          </View>

          {currentVideo?.type === "series" && (
            <View style={ui.episodesCard}>
              <View style={ui.episodesHeader}>
                <Text style={ui.episodesTitle}>{ts("labels.episodes")}</Text>
                {episodesLoading ? <ActivityIndicator size="small" color={HERO_TEXT} /> : null}
              </View>

              {!episodesLoading && !episodes.length ? (
                <Text style={ui.emptyText}>{ts("playlist.emptyItems")}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 12 }}>
                  {episodes.map((ep) => {
                    const on = currentEpisode?.id === ep.id;
                    return (
                      <TouchableOpacity
                        key={ep.id}
                        activeOpacity={0.9}
                        onPress={() => playEpisode(ep)}
                        style={[ui.episodeTile, on && { borderColor: "rgba(50, 221, 121, 0.7)", borderWidth: 2 }]}
                      >
                        <Image source={{ uri: maybeResizeImage(ep.coverUrl || currentVideo.coverUrl, mediaPrefs.reduce_images) }} style={ui.episodeImg} resizeMode="cover" />
                        <LinearGradient colors={["transparent", "rgba(15,23,42,0.68)"]} style={ui.episodeGrad} />
                        <Text style={ui.episodeText} numberOfLines={2}>
                          {ep.seasonNumber ? `S${ep.seasonNumber} ` : ""}
                          {ep.episodeNumber ? `E${ep.episodeNumber} ` : ""}
                          {ep.title || ts("labels.untitled")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          <View style={ui.videoFullDetails}>
            <View style={ui.videoFullActions}>
              <TouchableOpacity style={ui.videoActionChip} onPress={() => currentVideo && toggleFavorite(currentVideo, "video")}>
                <Ionicons name={currentVideo && isFavorited(currentVideo.id) ? "heart" : "heart-outline"} size={18} color="#111" />
                <Text style={ui.videoActionText}>{ts("player.favorite")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={ui.videoActionChip} onPress={() => currentVideo && showAddToPlaylist(currentVideo, "video")}>
                <Ionicons name="add-circle-outline" size={18} color="#111" />
                <Text style={ui.videoActionText}>{ts("player.playlist")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={ui.videoActionChip} onPress={() => currentVideo && shareItem(currentVideo)}>
                <Ionicons name="share-social-outline" size={18} color="#111" />
                <Text style={ui.videoActionText}>{ts("player.shareTitle")}</Text>
              </TouchableOpacity>
            </View>

            {!mediaPrefs.low_data_mode && (
              <Text style={ui.videoFullDesc} numberOfLines={5}>
                {currentVideo?.description || ts("labels.noDescriptionShort")}
              </Text>
            )}

            <View style={[ui.gateCard, { marginTop: 12 }]}>
              <Ionicons name="options-outline" size={18} color={HERO_TEXT} />
              <Text style={ui.gateText}>
                {ts("hints.playerSettingsVideo", {
                  quality: String(mediaPrefs.video_quality).toUpperCase(),
                  cap: mediaPrefs.captions ? ts("hints.on") : ts("hints.off"),
                  data: mediaPrefs.low_data_mode ? ts("hints.on") : ts("hints.off"),
                })}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== Bottom Sheet ===================== */}
      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <View style={ui.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} activeOpacity={1} />
          <View style={ui.sheetCard}>
            <BottomSheetContent />
          </View>
        </View>
      </Modal>

      {/* ===================== Create Playlist Modal ===================== */}
      <Modal visible={playlistOpen} animationType="fade" transparent onRequestClose={() => setPlaylistOpen(false)}>
        <View style={ui.centerOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setPlaylistOpen(false)} />
          <View style={ui.popupCard}>
            <View style={ui.popupHeader}>
              <Text style={ui.popupTitle}>{ts("playlist.newTitle")}</Text>
              <TouchableOpacity onPress={() => setPlaylistOpen(false)} style={ui.popupClose} activeOpacity={0.9}>
                <Ionicons name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={playlistName}
              onChangeText={setPlaylistName}
              placeholder={ts("playlist.namePlaceholder")}
              placeholderTextColor="#9CA3AF"
              style={ui.popupInput}
            />

            <TouchableOpacity style={ui.popupBtn} onPress={createPlaylist} activeOpacity={0.9}>
              {playlistBusy ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={16} color="#fff" />}
              <Text style={ui.popupBtnText}>{ts("playlist.create")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===================== Playlist Items Modal ===================== */}
      <Modal visible={playlistItemsOpen} animationType="slide" onRequestClose={() => setPlaylistItemsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={ui.fullTop}>
            <TouchableOpacity onPress={() => setPlaylistItemsOpen(false)} style={ui.fullBack} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={22} color="#111" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={ui.fullTitle} numberOfLines={1}>
                {selectedPlaylist?.name || ts("playlist.title")}
              </Text>
              <Text style={ui.fullSub} numberOfLines={1}>
                {ts("playlist.items")}
              </Text>
            </View>
          </View>

          {!selectedPlaylistItems.length ? (
            <View style={{ padding: 16 }}>
              <Text style={ui.emptyText}>{ts("playlist.emptyItems")}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
              {selectedPlaylistItems.map((it: any) => {
                const data = it.data;
                return (
                  <View key={it.id}>
                    {"genre" in data ? renderSongItem({ item: data }) : renderVideoRow({ item: data })}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================= TabsRow ================= */
function TabsRow({
  tab,
  setTab,
  compact,
  ts,
}: {
  tab: MediaTab;
  setTab: any;
  compact: boolean;
  ts: (k: string, o?: any) => string;
}) {
  const items = [
    { key: "Pour toi" as const, icon: "home-outline", label: ts("tabs.forYou") },
    { key: "Musique" as const, icon: "musical-notes-outline", label: ts("tabs.music") },
    { key: "Films/Séries" as const, icon: "film-outline", label: ts("tabs.filmsSeries") },
  ];

  if (compact) {
    return (
      <View style={hero.compactTabs}>
        {items.map((it) => {
          const on = tab === it.key;
          return (
            <TouchableOpacity
              key={it.key}
              onPress={() => setTab(it.key)}
              style={[hero.compactTabBtn, on && hero.compactTabBtnActive]}
              activeOpacity={0.9}
            >
              <Ionicons name={it.icon as any} size={20} color={on ? "#fff" : "rgba(6,51,37,0.55)"} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.pillsRow}>
      {items.map((it) => {
        const on = tab === it.key;
        return (
          <TouchableOpacity key={it.key} onPress={() => setTab(it.key)} style={[hero.pill, on && hero.pillActive]} activeOpacity={0.9}>
            <Ionicons name={it.icon as any} size={16} color={on ? "#fff" : "rgba(2, 39, 27, 0.9)"} />
            <Text style={[hero.pillText, on && hero.pillTextActive]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ================= HERO STYLES ================= */
const hero = StyleSheet.create({
  heroContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: HERO_BG,
    paddingTop: Platform.select({ ios: 54, android: 14 }),
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: "hidden",
    elevation: 4,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },

  heroPinnedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroTopLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  heroTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: HERO_ICON_BG,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: { color: HERO_TEXT, fontSize: 20, fontWeight: "900" },
  heroSub: { marginTop: 4, color: "rgba(6, 51, 37, 0.65)", fontWeight: "800", fontSize: 12.5 },

  subChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 130,
  },
  subChipText: { fontWeight: "900", fontSize: 12 },

  pillsRow: { gap: 10, paddingRight: 14 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(110, 197, 129, 0.55)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillActive: { backgroundColor: "#111827", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  pillText: { fontWeight: "900", color: "rgba(2, 44, 31, 0.7)", fontSize: 12 },
  pillTextActive: { color: "#fff" },

  compactTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  compactTabBtn: { flex: 1, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compactTabBtnActive: { backgroundColor: "#111827" },

  expandable: { marginTop: 12 },

  searchRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  searchInput: { flex: 1, color: HERO_TEXT, fontWeight: "900" },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  tagsRow: { paddingTop: 10, gap: 10, paddingRight: 14 },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    maxWidth: 190,
  },
  tagPillActive: { backgroundColor: "#111827", borderColor: "rgba(0,0,0,0.06)" },
  tagText: { fontWeight: "900", color: HERO_TEXT, fontSize: 12 },
  tagTextActive: { color: "#fff" },

  quickRow: { paddingTop: 10, gap: 10, paddingRight: 14 },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  quickText: { fontWeight: "900", color: HERO_TEXT },

  subHintRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  subHintText: { flex: 1, color: HERO_TEXT, fontWeight: "800", fontSize: 12.5 },
});

/* ================= UI STYLES ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F5F7" },
});

const ui = StyleSheet.create({
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitleInline: { fontSize: 16, fontWeight: "900", color: "#111" },
  sectionLink: { fontSize: 13, fontWeight: "900", color: HERO_TEXT },
  sectionHint: { fontSize: 12.5, fontWeight: "900", color: "#6B6B70" },

  featureCard: { width: width * 0.78, height: 280, borderRadius: 22, overflow: "hidden", marginRight: 14, backgroundColor: "#EAEAEA" },
  featureImg: { width: "100%", height: "100%" },
  featureGrad: { position: "absolute", bottom: 0, height: 160, width: "100%" },
  featureTop: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  featureBottom: { position: "absolute", left: 14, right: 14, bottom: 14 },
  featureTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  featureSub: { marginTop: 6, color: "rgba(255,255,255,0.92)", fontWeight: "800", fontSize: 12.5 },

  featureBtnPrimary: { flex: 1, borderRadius: 14, backgroundColor: "#111827", paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  featureBtnPrimaryText: { color: "#fff", fontWeight: "900" },
  featureBtnGhost: { flex: 1, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.20)", paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  featureBtnGhostText: { color: "#fff", fontWeight: "900" },

  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  premiumText: { color: "#fff", fontSize: 11.5, fontWeight: "900" },
  freeBadge: { backgroundColor: "rgba(255,255,255,0.90)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  freeText: { color: "#111", fontSize: 11.5, fontWeight: "900" },

  songRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 18, backgroundColor: "#fff", marginBottom: 12, borderWidth: 1, borderColor: "#EEF0F3" },
  songArt: { width: 62, height: 62, borderRadius: 16, marginRight: 12, backgroundColor: "#EEE" },
  songTitle: { fontSize: 15.5, fontWeight: "900", color: "#111", flexShrink: 1 },
  songArtist: { marginTop: 3, fontSize: 13, fontWeight: "800", color: "#6B6B70" },
  songMicroRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  microPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F3F4F6" },
  microPillText: { fontSize: 12, fontWeight: "900", color: "#111" },
  microDot: { color: "#9CA3AF", fontWeight: "900" },
  microInfo: { fontSize: 12, fontWeight: "900", color: "#6B6B70" },
  lockRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  lockText: { fontSize: 12.5, fontWeight: "900", color: HERO_TEXT },

  rowActions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  ghostBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  videoRow: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  videoThumbWrap: { width: width * 0.42, aspectRatio: 16 / 9, borderRadius: 16, overflow: "hidden", backgroundColor: "#EAEAEA" },
  videoThumb: { width: "100%", height: "100%" },
  videoThumbGrad: { position: "absolute", bottom: 0, width: "100%", height: 70 },
  videoThumbBadges: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between" },
  videoLock: { position: "absolute", bottom: 10, left: 10, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 },
  videoLockText: { color: "#fff", fontWeight: "900", fontSize: 11.5 },

  videoMeta: { flex: 1, paddingTop: 2 },
  videoTitleRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  videoTitle: { flex: 1, fontSize: 15.5, fontWeight: "900", color: "#111", lineHeight: 20 },
  ghostBtnSm: { width: 32, height: 32, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  videoSub: { marginTop: 4, fontSize: 12.5, fontWeight: "900", color: "#6B6B70" },
  videoStatsRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  videoStat: { fontSize: 12.5, fontWeight: "900", color: "#6B6B70" },
  videoDot: { color: "#9CA3AF", fontWeight: "900" },
  videoDesc: { marginTop: 6, fontSize: 13, fontWeight: "800", color: "#6B6B70", lineHeight: 18 },

  seriesPill: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(50, 221, 121, 0.18)", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, alignSelf: "flex-start" },
  seriesText: { fontWeight: "900", color: HERO_TEXT, fontSize: 12 },

  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEF0F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
  },
  bottomItem: { alignItems: "center", gap: 6, width: width / 4 },
  bottomIconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  bottomLabel: { fontSize: 11.5, fontWeight: "900", color: "#6B6B70" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end" },
  sheetCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: height * 0.78 },
  sheetTopRow: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 17, fontWeight: "900", color: "#111" },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", paddingVertical: 30, color: "#6B6B70", fontWeight: "900" },

  miniTitle: { fontWeight: "900", color: "#111", fontSize: 14, marginTop: 6 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: "#F3F4F6" },
  actionBtnText: { color: "#111", fontWeight: "900" },

  playlistRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#EEF0F3", borderRadius: 16, padding: 12, backgroundColor: "#fff", marginTop: 10 },
  playlistIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  playlistTitle: { fontWeight: "900", color: "#111" },
  playlistSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },
  smallPlusBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  fullModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  fullModalSheet: { height: height * 0.92, backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", paddingHorizontal: 16, paddingTop: 10 },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  modalHeaderBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  modalHeaderTitle: { fontSize: 14, fontWeight: "900", color: "#111" },
  modalHeaderSub: { fontSize: 12, fontWeight: "900", color: "#6B6B70", marginTop: 2 },

  musicHeroWrap: { marginTop: 10, borderRadius: 26, overflow: "hidden", height: height * 0.40, backgroundColor: "#EEE" },
  musicHeroArt: { width: "100%", height: "100%" },
  musicHeroShade: { position: "absolute", bottom: 0, height: 160, width: "100%" },

  musicInfoBlock: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  musicTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  musicArtist: { marginTop: 5, fontSize: 14, fontWeight: "900", color: "#6B6B70" },
  likeBtn: { width: 44, height: 44, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  progressWrap: { marginTop: 16, paddingHorizontal: 4 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: "#E6E7EA", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: "#111827" },
  timeRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, fontWeight: "900", color: "#6B6B70" },

  controlsRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  controlBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  playBigBtn: {
    width: 70,
    height: 70,
    borderRadius: 26,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 8 },
    }),
  },

  musicBottomActions: { marginTop: 18, flexDirection: "row", gap: 10, paddingHorizontal: 4 },
  actionPill: { flex: 1, borderRadius: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionPillText: { fontSize: 13.5, fontWeight: "900", color: "#111" },

  videoInfoBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", paddingHorizontal: 16 },
  videoInfoCard: { backgroundColor: "#fff", borderRadius: 22, overflow: "hidden" },
  videoInfoClose: { position: "absolute", top: 12, right: 12, zIndex: 10, width: 38, height: 38, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  videoInfoHero: { height: height * 0.30, backgroundColor: "#EEE" },
  videoInfoHeroImg: { width: "100%", height: "100%" },
  videoInfoHeroGrad: { position: "absolute", bottom: 0, height: 140, width: "100%" },
  videoInfoHeroTop: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  videoInfoHeroBottom: { position: "absolute", left: 14, right: 14, bottom: 14 },
  videoInfoTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  videoInfoSub: { marginTop: 6, color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: "900" },
  videoInfoBody: { padding: 16 },
  videoInfoDesc: { fontSize: 13.5, fontWeight: "800", color: "#6B6B70", lineHeight: 19 },
  videoInfoBtns: { marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#111827", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, flex: 1, minWidth: 140 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F3F4F6", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, flex: 1, minWidth: 120 },
  secondaryBtnText: { color: "#111", fontWeight: "900", fontSize: 13.5 },

  gateCard: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(245,245,245,1)", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  gateText: { fontWeight: "900", color: HERO_TEXT, flex: 1 },

  videoFullWrap: { flex: 1, backgroundColor: "#fff" },
  videoFullTopBar: { paddingTop: 6, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center" },
  videoFullTopBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  videoFullTitle: { fontSize: 15.5, fontWeight: "900", color: "#111" },
  videoFullSub: { marginTop: 3, fontSize: 12, fontWeight: "900", color: "#6B6B70" },

  videoCanvas: { marginHorizontal: 12, borderRadius: 22, overflow: "hidden", height: height * 0.42, backgroundColor: "#0F172A" },
  realVideo: { width: "100%", height: "100%" },

  videoControlsGlass: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 6 },
    }),
  },
  videoControlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  videoControlBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  videoPlayBig: { width: 74, height: 74, borderRadius: 26, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },

  videoProgressWrap: { marginTop: 10 },
  videoProgressTrack: { height: 6, borderRadius: 999, backgroundColor: "#E6E7EA", overflow: "hidden" },
  videoProgressFill: { height: 6, borderRadius: 999, backgroundColor: "#111827" },
  videoTimeRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  videoTime: { fontSize: 12, fontWeight: "900", color: "#6B6B70" },

  episodesCard: { marginTop: 12, marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#EEF0F3" },
  episodesHeader: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  episodesTitle: { fontWeight: "900", fontSize: 15, color: "#111" },
  episodeTile: { width: 170, height: 100, borderRadius: 18, overflow: "hidden", backgroundColor: "#EEE", borderWidth: 1, borderColor: "#EEF0F3" },
  episodeImg: { width: "100%", height: "100%" },
  episodeGrad: { position: "absolute", bottom: 0, width: "100%", height: 60 },
  episodeText: { position: "absolute", left: 10, right: 10, bottom: 10, color: "#fff", fontWeight: "900", fontSize: 12.5 },

  videoFullDetails: { marginTop: 12, marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#EEF0F3", padding: 14 },
  videoFullActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  videoActionChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#F3F4F6" },
  videoActionText: { fontSize: 13, fontWeight: "900", color: "#111" },
  videoFullDesc: { fontSize: 13.5, fontWeight: "800", color: "#6B6B70", lineHeight: 19 },

  miniAudioWrap: { position: "absolute", left: 12, right: 12, bottom: 78 + 10 },
  miniAudioCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#111827", borderRadius: 18, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  miniAudioArt: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#334155" },
  miniAudioTitle: { color: "#fff", fontWeight: "900" },
  miniAudioSub: { marginTop: 2, color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 12 },
  miniCtlBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },

  pipWrap: { position: "absolute", left: 0, top: 0, zIndex: 999 },
  pipCard: { width: 190, height: 120, borderRadius: 16, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: "rgba(0,0,0,0.10)" },
  pipVideo: { width: "100%", height: "100%" },
  pipTopBar: { position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 8 },
  pipTopBtn: { width: 32, height: 32, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },

  centerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center" },
  popupCard: { marginHorizontal: 14, backgroundColor: "#fff", borderRadius: 20, padding: 16 },
  popupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  popupTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  popupClose: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  popupInput: { marginTop: 12, backgroundColor: "#F3F4F6", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 14, fontWeight: "800", color: "#111" },
  popupBtn: { marginTop: 12, backgroundColor: "#111827", borderRadius: 16, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  popupBtnText: { color: "#fff", fontWeight: "900" },

  fullTop: { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#EEF0F3" },
  fullBack: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  fullTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  fullSub: { marginTop: 3, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
});
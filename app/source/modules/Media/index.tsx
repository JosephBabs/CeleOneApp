// Media.tsx
// ✅ Real VIDEO playback (react-native-video) from link
// ✅ Real AUDIO playback (react-native-video audio-only) from link
// ✅ Premium/Free badges + gate play if user is Free (music blocked, premium videos blocked)
// ✅ Series episodes (if movie.type === "series" and episodes exist) + episodes list in player
// ✅ Favorites (add/remove) + Downloads (save item for Offline tab) in Firestore
// ✅ Artist profile modal (full screen) + all songs/albums/videos by artist
// ✅ Netflix-like home: Featured auto-rotates + gradient / beautiful UI
//
// FIRESTORE EXPECTED (minimal):
// videos/{id}: { title, coverUrl, link, isPremium, type: "movie"|"series"|"musicVideo", channelName, artistId, description, duration, views }
// videos/{id}/episodes/{eid}: { title, coverUrl, link, episodeNumber, seasonNumber, duration }
// songs/{id}: { title, coverUrl, link, isPremium, artistId, artist, genre, duration, plays }
// artists/{id}: { name, photoUrl, bio, bannerUrl }
// users/{uid}: { subscription: "free"|"premium" }
//
// user subcollections:
// users/{uid}/favorites/{autoId}: { itemId, itemType: "song"|"video"|"episode", data..., addedAt }
// users/{uid}/downloads/{autoId}: { itemId, itemType, data..., addedAt }  (NOTE: not true offline caching; metadata only)
//
// REQUIRED PACKAGES:
// - @react-native-firebase/firestore
// - @react-native-firebase/auth
// - react-native-video
// - react-native-linear-gradient
// - react-native-vector-icons/Ionicons

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  Alert,
  Animated,
  Modal,
  ActivityIndicator,
  StatusBar,
  Platform,
  SafeAreaView,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import Video from "react-native-video";

import { COLORS } from "../../../core/theme/colors";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const { width, height } = Dimensions.get("window");
const ITEM_SPACING = 16;
const CAROUSEL_WIDTH = width * 0.78;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
};

const safeText = (v: any, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);

type Subscription = "free" | "premium";

type Song = {
  id: string;
  title?: string;
  artist?: string;
  artistId?: string;
  genre?: string;
  coverUrl?: string;
  link?: string; // audio url
  isPremium?: boolean;
  duration?: string;
  plays?: any;
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
  isLive?: boolean;
};

type Episode = {
  id: string;
  title?: string;
  coverUrl?: string;
  link?: string;
  duration?: string;
  episodeNumber?: number;
  seasonNumber?: number;
};

const Media = ({ navigation }: any) => {
  // Tabs
  const [activeTab, setActiveTab] = useState<"Pour toi" | "Musique" | "Film/Série">("Pour toi");
  const [activeBottomTab, setActiveBottomTab] = useState<"grouping" | "favorites" | "downloads" | "library">("grouping");
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  // Content
  const [songs, setSongs] = useState<Song[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // User data
  const [subscription, setSubscription] = useState<Subscription>("free");

  // Favorites / downloads
  const [favorites, setFavorites] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);

  // Player state
  const [musicModalVisible, setMusicModalVisible] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const [videoInfoModalVisible, setVideoInfoModalVisible] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<VideoItem | null>(null);

  const [videoFullscreenVisible, setVideoFullscreenVisible] = useState(false);

  // Series episodes
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);

  // Artist modal
  const [artistModalVisible, setArtistModalVisible] = useState(false);
  const [artistLoading, setArtistLoading] = useState(false);
  const [artist, setArtist] = useState<any>(null);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [artistVideos, setArtistVideos] = useState<VideoItem[]>([]);

  // Playback (real)
  const audioRef = useRef<Video>(null);
  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // progress
  const [songPosition, setSongPosition] = useState(0);
  const [songDuration, setSongDuration] = useState(0);

  const [videoPosition, setVideoPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // animations
  const tabOpacity = useRef(new Animated.Value(1)).current;

  // featured carousel auto-rotate
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredTimer = useRef<any>(null);

  // ---------- Firestore subscriptions ----------
  useEffect(() => {
    const uid = auth().currentUser?.uid;

    const unsubUser = uid
      ? firestore()
          .collection("users")
          .doc(uid)
          .onSnapshot((snap) => {
            const sub = (snap.data()?.subscription || "free") as Subscription;
            setSubscription(sub === "premium" ? "premium" : "free");
          })
      : () => {};

    const unsubscribeSongs = firestore()
      .collection("songs")
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Song[];
        setSongs(list);
        setLoading(false);
      });

    const unsubscribeVideos = firestore()
      .collection("videos")
      .onSnapshot((snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as VideoItem[];
        setVideos(list);
      });

    const fetchFavorites = async () => {
      try {
        if (!uid) return;
        const snap = await firestore().collection("users").doc(uid).collection("favorites").get();
        setFavorites(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (e) {
        console.error("favorites:", e);
      }
    };

    const fetchDownloads = async () => {
      try {
        if (!uid) return;
        const snap = await firestore().collection("users").doc(uid).collection("downloads").get();
        setDownloads(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (e) {
        console.error("downloads:", e);
      }
    };

    const fetchPlaylists = async () => {
      try {
        if (!uid) return;
        const snap = await firestore().collection("users").doc(uid).collection("playlists").get();
        setPlaylists(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (e) {
        console.error("playlists:", e);
      }
    };

    fetchFavorites();
    fetchDownloads();
    fetchPlaylists();

    return () => {
      unsubUser?.();
      unsubscribeSongs();
      unsubscribeVideos();
      if (featuredTimer.current) clearInterval(featuredTimer.current);
    };
  }, []);

  // featured auto-change like Netflix
  useEffect(() => {
    if (!videos.length) return;
    if (featuredTimer.current) clearInterval(featuredTimer.current);
    featuredTimer.current = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % Math.max(1, videos.length));
    }, 6500);
    return () => {
      if (featuredTimer.current) clearInterval(featuredTimer.current);
    };
  }, [videos.length]);

  // ---------- derived ----------
  const userName = useMemo(() => "Joseph Babatunde", []);
  const greeting = useMemo(() => "Alleluia !", []);

  const genres = useMemo(() => [...new Set(songs.map((s) => s.genre).filter(Boolean))], [songs]);

  const groupingData = useMemo(
    () =>
      genres.map((g, i) => ({
        id: g,
        title: g,
        image: { uri: "https://images.unsplash.com/photo-1526481280695-3c687fd643ed?w=600" },
        colors: [
          ["rgba(47,165,169,0.95)", "rgba(47,165,169,0.35)"],
          ["rgba(15,23,42,0.95)", "rgba(15,23,42,0.35)"],
          ["rgba(99,102,241,0.90)", "rgba(99,102,241,0.30)"],
          ["rgba(16,185,129,0.90)", "rgba(16,185,129,0.30)"],
        ][i % 4],
      })),
    [genres]
  );

  const featured = useMemo(() => {
    if (!videos.length) return null;
    return videos[featuredIndex % videos.length];
  }, [videos, featuredIndex]);

  const isFavorited = useCallback(
    (itemId: string) => favorites.some((f) => f.itemId === itemId),
    [favorites]
  );
  const isDownloaded = useCallback(
    (itemId: string) => downloads.some((d) => d.itemId === itemId),
    [downloads]
  );

  // ---------- gating ----------
  const canPlayMusic = subscription === "premium";
  const canPlayPremiumVideo = subscription === "premium";

  const requirePremium = (reason: string) => {
    Alert.alert("Premium", reason, [
      { text: "Cancel", style: "cancel" },
      { text: "Upgrade", onPress: () => navigation?.navigate?.("Profile") },
    ]);
  };

  // ---------- actions ----------
  const handleTabChange = (tab: any) => {
    Animated.timing(tabOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const openMusicPlayer = (song: Song) => {
    if (!song?.link) return Alert.alert("No audio", "This song has no audio link.");
    if (!canPlayMusic) return requirePremium("Music playback is Premium. Upgrade to play music.");
    if (song.isPremium && subscription === "free") return requirePremium("This song is Premium.");

    setCurrentSong(song);
    setIsPlaying(true);
    setSongPosition(0);
    setSongDuration(0);
    setMusicModalVisible(true);
  };

  const openVideoInfo = (video: VideoItem) => {
    setCurrentVideo(video);
    setVideoInfoModalVisible(true);
  };

  const openVideoFullscreen = async () => {
    if (!currentVideo) return;
    if (currentVideo.isPremium && !canPlayPremiumVideo) return requirePremium("This video is Premium.");

    setCurrentEpisode(null);
    setEpisodes([]);
    setVideoInfoModalVisible(false);

    // if series, load episodes
    if (currentVideo.type === "series") {
      setEpisodesLoading(true);
      try {
        const epsSnap = await firestore().collection("videos").doc(currentVideo.id).collection("episodes").orderBy("seasonNumber", "asc").orderBy("episodeNumber", "asc").get();
        const eps = epsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Episode[];
        setEpisodes(eps);
        // auto pick first episode if exists
        if (eps[0]?.link) setCurrentEpisode(eps[0]);
      } catch (e) {
        console.error("episodes:", e);
      } finally {
        setEpisodesLoading(false);
      }
    }

    setTimeout(() => setVideoFullscreenVisible(true), 120);
  };

  const playEpisode = (ep: Episode) => {
    if (!ep?.link) return Alert.alert("No episode video", "This episode has no link.");
    setCurrentEpisode(ep);
    setIsPlaying(true);
    setVideoPosition(0);
    setVideoDuration(0);
  };

  const showSongOptions = (item: any) => {
    Alert.alert("Song Options", `What would you like to do with "${item?.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: isFavorited(item.id) ? "Remove Favorite" : "Add to Favorites", onPress: () => toggleFavorite(item, "song") },
      { text: isDownloaded(item.id) ? "Remove Download" : "Download", onPress: () => toggleDownload(item, "song") },
      { text: "View Artist", onPress: () => openArtistProfile(item.artistId) },
    ]);
  };

  const showVideoOptions = (item: any) => {
    Alert.alert("Video Options", `What would you like to do with "${item?.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: isFavorited(item.id) ? "Remove Favorite" : "Add to Favorites", onPress: () => toggleFavorite(item, "video") },
      { text: isDownloaded(item.id) ? "Remove Download" : "Download", onPress: () => toggleDownload(item, "video") },
      { text: "View Artist/Channel", onPress: () => openArtistProfile(item.artistId) },
    ]);
  };

  const toggleFavorite = async (item: any, itemType: "song" | "video" | "episode") => {
    try {
      const uid = auth().currentUser?.uid;
      if (!uid) return;

      const already = favorites.find((f) => f.itemId === item.id);
      const ref = firestore().collection("users").doc(uid).collection("favorites");

      if (already) {
        await ref.doc(already.id).delete();
        setFavorites((p) => p.filter((x) => x.id !== already.id));
        return;
      }

      const docRef = await ref.add({
        itemId: item.id,
        itemType,
        data: item,
        addedAt: firestore.FieldValue.serverTimestamp(),
      });

      setFavorites((p) => [{ id: docRef.id, itemId: item.id, itemType, data: item }, ...p]);
    } catch (e) {
      console.error("favorite:", e);
      Alert.alert("Error", "Failed to update favorites");
    }
  };

  const toggleDownload = async (item: any, itemType: "song" | "video" | "episode") => {
    // NOTE: This is metadata "download list" like YouTube Offline list,
    // but not true offline caching. True offline requires filesystem caching library.
    try {
      const uid = auth().currentUser?.uid;
      if (!uid) return;

      const already = downloads.find((d) => d.itemId === item.id);
      const ref = firestore().collection("users").doc(uid).collection("downloads");

      if (already) {
        await ref.doc(already.id).delete();
        setDownloads((p) => p.filter((x) => x.id !== already.id));
        return;
      }

      const docRef = await ref.add({
        itemId: item.id,
        itemType,
        data: item,
        addedAt: firestore.FieldValue.serverTimestamp(),
      });

      setDownloads((p) => [{ id: docRef.id, itemId: item.id, itemType, data: item }, ...p]);
    } catch (e) {
      console.error("download:", e);
      Alert.alert("Error", "Failed to update downloads");
    }
  };

  const openArtistProfile = async (artistId?: string) => {
    if (!artistId) return Alert.alert("Artist", "No artist profile found.");
    setArtistModalVisible(true);
    setArtistLoading(true);
    try {
      const artistSnap = await firestore().collection("artists").doc(artistId).get();
      const a = artistSnap.exists ? { id: artistSnap.id, ...(artistSnap.data() as any) } : null;
      setArtist(a);

      const songsSnap = await firestore().collection("songs").where("artistId", "==", artistId).get();
      setArtistSongs(songsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Song[]);

      const videosSnap = await firestore().collection("videos").where("artistId", "==", artistId).get();
      setArtistVideos(videosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as VideoItem[]);
    } catch (e) {
      console.error("artist:", e);
      Alert.alert("Error", "Failed to load artist");
    } finally {
      setArtistLoading(false);
    }
  };

  // ---------- real playback handlers ----------
  const onAudioProgress = (p: any) => {
    setSongPosition(p?.currentTime || 0);
  };
  const onAudioLoad = (meta: any) => {
    setSongDuration(meta?.duration || 0);
  };

  const onVideoProgress = (p: any) => setVideoPosition(p?.currentTime || 0);
  const onVideoLoad = (meta: any) => setVideoDuration(meta?.duration || 0);

  const seekAudio = (nextSec: number) => {
    const sec = clamp(nextSec, 0, songDuration || 0);
    audioRef.current?.seek?.(sec);
    setSongPosition(sec);
  };

  const seekVideo = (nextSec: number) => {
    const sec = clamp(nextSec, 0, videoDuration || 0);
    videoRef.current?.seek?.(sec);
    setVideoPosition(sec);
  };

  // ---------- renderers ----------
  const PremiumBadge = ({ premium }: { premium?: boolean }) => {
    if (!premium) return null;
    return (
      <View style={styles.premiumBadge}>
        <Ionicons name="sparkles" size={12} color="#fff" />
        <Text style={styles.premiumText}>Premium</Text>
      </View>
    );
  };

  const FreeBadge = ({ premium }: { premium?: boolean }) => {
    if (premium) return null;
    return (
      <View style={styles.freeBadge}>
        <Text style={styles.freeText}>FREE</Text>
      </View>
    );
  };

  const renderHeroItem = ({ item }: { item: VideoItem }) => {
    const premium = !!item.isPremium;
    const locked = premium && subscription === "free";

    return (
      <TouchableOpacity activeOpacity={0.92} style={styles.heroCard} onPress={() => openVideoInfo(item)}>
        <Image source={{ uri: item.coverUrl }} style={styles.heroImage} />
        <LinearGradient colors={["rgba(15,23,42,0.00)", "rgba(15,23,42,0.78)"]} style={styles.heroGradient} />
        <View style={styles.heroTopRow}>
          <FreeBadge premium={premium} />
          <PremiumBadge premium={premium} />
        </View>

        <View style={styles.heroBottom}>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {safeText(item.title, "Untitled")}
          </Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {(item.channelName || "Featured")} • {item.views || "0"} views
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.heroBtnPrimary, locked && { opacity: 0.7 }]}
              onPress={() => {
                setCurrentVideo(item);
                if (locked) return requirePremium("This movie is Premium.");
                openVideoFullscreen();
              }}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.heroBtnPrimaryText}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.heroBtnGhost}
              onPress={() => toggleFavorite(item, "video")}
            >
              <Ionicons name={isFavorited(item.id) ? "heart" : "heart-outline"} size={18} color="#fff" />
              <Text style={styles.heroBtnGhostText}>Like</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSongItem = ({ item }: { item: Song }) => {
    const premium = !!item.isPremium;
    const locked = subscription === "free"; // Free cannot play music at all (your requirement)
    return (
      <TouchableOpacity activeOpacity={0.92} style={styles.songRow} onPress={() => openMusicPlayer(item)}>
        <Image source={{ uri: item.coverUrl }} style={styles.songArt} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {safeText(item.title, "Unknown Title")}
            </Text>
            {premium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}
          </View>
          <TouchableOpacity onPress={() => openArtistProfile(item.artistId)} activeOpacity={0.8}>
            <Text style={styles.songArtist} numberOfLines={1}>
              {safeText(item.artist, "Unknown Artist")}
            </Text>
          </TouchableOpacity>

          <View style={styles.songMicroRow}>
            <View style={styles.microPill}>
              <Ionicons name="musical-notes" size={12} color="#0F172A" />
              <Text style={styles.microPillText}>{item.genre || "Music"}</Text>
            </View>
            <Text style={styles.microDot}>•</Text>
            <Text style={styles.microInfo}>{item.plays || "0"} plays</Text>
          </View>

          {locked && (
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={14} color="#8B5CF6" />
              <Text style={styles.lockText}>Premium required to play music</Text>
            </View>
          )}
        </View>

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.iconBtn, locked && { opacity: 0.6 }]}
            onPress={() => openMusicPlayer(item)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={() => showSongOptions(item)}>
            <Ionicons name="ellipsis-vertical" size={18} color="#6A6A6A" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVideoRow = ({ item }: { item: VideoItem }) => {
    const premium = !!item.isPremium;
    const locked = premium && subscription === "free";
    return (
      <TouchableOpacity style={styles.videoRow} activeOpacity={0.92} onPress={() => openVideoInfo(item)}>
        <View style={styles.videoThumbWrap}>
          <Image source={{ uri: item.coverUrl }} style={styles.videoThumb} />
          <LinearGradient colors={["rgba(15,23,42,0.00)", "rgba(15,23,42,0.55)"]} style={styles.videoThumbGrad} />
          <View style={styles.videoThumbBadges}>
            {premium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}
          </View>
          {locked && (
            <View style={styles.videoLock}>
              <Ionicons name="lock-closed" size={14} color="#fff" />
              <Text style={styles.videoLockText}>Locked</Text>
            </View>
          )}
        </View>

        <View style={styles.videoMeta}>
          <View style={styles.videoTitleRow}>
            <Text style={styles.videoTitle} numberOfLines={2}>
              {safeText(item.title, "Untitled")}
            </Text>
            <TouchableOpacity onPress={() => showVideoOptions(item)} style={styles.ghostBtnSm}>
              <Ionicons name="ellipsis-vertical" size={16} color="#6A6A6A" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => openArtistProfile(item.artistId)} activeOpacity={0.8}>
            <Text style={styles.videoSub} numberOfLines={1}>
              {item.channelName || "Channel"}
            </Text>
          </TouchableOpacity>

          <View style={styles.videoStatsRow}>
            <Text style={styles.videoStat}>{item.views || "0"} views</Text>
            <Text style={styles.videoDot}>•</Text>
            <Text style={styles.videoStat}>{item.uploadTime || "Recently"}</Text>
          </View>

          <Text style={styles.videoDesc} numberOfLines={2}>
            {item.description || "No description available."}
          </Text>

          {item.type === "series" && (
            <View style={styles.seriesPill}>
              <Ionicons name="albums-outline" size={14} color={COLORS.light.primary} />
              <Text style={styles.seriesText}>Series • Episodes available</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroupingItem = ({ item }: any) => (
    <TouchableOpacity activeOpacity={0.92} style={styles.genreCard} onPress={() => Alert.alert("Genre", item.title)}>
      <Image source={item.image} style={styles.genreBg} />
      <LinearGradient colors={item.colors} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={["transparent", "rgba(15,23,42,0.70)"]} style={styles.genreFade} />
      <Text style={styles.genreTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      );
    }

    if (activeTab === "Pour toi") {
      return (
        <Animated.View style={{ opacity: tabOpacity }}>
          <Text style={styles.sectionTitle}>Featured</Text>

          <FlatList
            data={videos}
            renderItem={renderHeroItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CAROUSEL_WIDTH + ITEM_SPACING}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyExtractor={(it: any) => it.id}
          />

          <View style={{ height: 16 }} />

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>Popular Songs</Text>
            <TouchableOpacity onPress={() => handleTabChange("Musique")}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={songs}
            renderItem={renderSongItem}
            scrollEnabled={false}
            keyExtractor={(it: any) => it.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          />
        </Animated.View>
      );
    }

    if (activeTab === "Musique") {
      return (
        <Animated.View style={{ opacity: tabOpacity }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>All Songs</Text>
            <Text style={styles.sectionHint}>{songs.length} items</Text>
          </View>

          <FlatList data={songs} renderItem={renderSongItem} keyExtractor={(it: any) => it.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} />
        </Animated.View>
      );
    }

    return (
      <Animated.View style={{ opacity: tabOpacity }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleInline}>All Videos</Text>
          <Text style={styles.sectionHint}>{videos.length} items</Text>
        </View>

        <FlatList data={videos} renderItem={renderVideoRow} keyExtractor={(it: any) => it.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} />
      </Animated.View>
    );
  };

  const renderBottomSheetContent = () => {
    const titleMap: any = { grouping: "Browse Genres", favorites: "Your Favorites", downloads: "Your Downloads", library: "Your Playlists" };

    const favItems = favorites.map((f) => f.data).filter(Boolean);
    const dlItems = downloads.map((d) => d.data).filter(Boolean);

    return (
      <View style={{ paddingBottom: 10 }}>
        <View style={styles.sheetTopRow}>
          <Text style={styles.sheetTitle}>{titleMap[activeBottomTab]}</Text>
          <TouchableOpacity onPress={() => setBottomSheetVisible(false)} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={18} color="#111" />
          </TouchableOpacity>
        </View>

        {activeBottomTab === "grouping" && (
          <FlatList
            data={groupingData}
            renderItem={renderGroupingItem}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyExtractor={(it: any) => it.id}
          />
        )}

        {activeBottomTab === "favorites" && (favItems.length ? <FlatList data={favItems} renderItem={({ item }) => ("link" in item && item.genre ? renderSongItem({ item }) : renderVideoRow({ item }))} keyExtractor={(it: any, idx) => it?.id || String(idx)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} /> : <Text style={styles.emptyText}>No favorites yet</Text>)}

        {activeBottomTab === "downloads" && (dlItems.length ? <FlatList data={dlItems} renderItem={({ item }) => ("link" in item && item.genre ? renderSongItem({ item }) : renderVideoRow({ item }))} keyExtractor={(it: any, idx) => it?.id || String(idx)} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} /> : <Text style={styles.emptyText}>No downloads yet</Text>)}

        {activeBottomTab === "library" && (playlists.length ? <Text style={styles.emptyText}>Playlists UI coming next.</Text> : <Text style={styles.emptyText}>No playlists yet</Text>)}
      </View>
    );
  };

  // ---------- MAIN ----------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top Bar with gradient accent */}
      <LinearGradient colors={["#FFFFFF", "rgba(47,165,169,0.08)"]} style={styles.topBar}>
        <TouchableOpacity style={styles.avatarChip} activeOpacity={0.9} onPress={() => navigation.navigate("Settings")}>
          <Image source={require("../../../assets/images/appLogo.png")} style={styles.avatarChipImg} />
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.userText}>{userName}</Text>
              <View style={[styles.subChip, subscription === "premium" ? styles.subChipPremium : styles.subChipFree]}>
                <Text style={[styles.subChipText, subscription === "premium" ? { color: "#fff" } : { color: "#0F172A" }]}>
                  {subscription === "premium" ? "Premium" : "Free"}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.navigate("MediaStream")}>
            <Ionicons name="search-outline" size={20} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Segmented Tabs */}
      <View style={styles.tabsWrap}>
        {["Pour toi", "Musique", "Film/Série"].map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity key={tab} activeOpacity={0.9} style={[styles.tabChip, active && styles.tabChipActive]} onPress={() => handleTabChange(tab as any)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {renderContent()}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {[
          { key: "grouping", icon: "grid" as any, label: "Genres" },
          { key: "favorites", icon: "heart" as any, label: "Likes" },
          { key: "downloads", icon: "download" as any, label: "Offline" },
          { key: "library", icon: "albums" as any, label: "Library" },
        ].map((t) => {
          const active = activeBottomTab === (t.key as any);
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              style={styles.bottomItem}
              onPress={() => {
                setActiveBottomTab(t.key as any);
                setBottomSheetVisible(true);
              }}
            >
              <View style={[styles.bottomIconWrap, active && { backgroundColor: "rgba(47,165,169,0.16)" }]}>
                <Ionicons name={t.icon} size={20} color={active ? COLORS.light.primary : "#8A8A8A"} />
              </View>
              <Text style={[styles.bottomLabel, active && { color: COLORS.light.primary }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---------- MUSIC PLAYER (REAL AUDIO) ---------- */}
      <Modal visible={musicModalVisible} animationType="slide" transparent>
        <View style={styles.fullModalBackdrop}>
          <View style={styles.fullModalSheet}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={() => setMusicModalVisible(false)} style={styles.modalHeaderBtn}>
                <Ionicons name="chevron-down" size={24} color="#111" />
              </TouchableOpacity>

              <View style={{ alignItems: "center" }}>
                <Text style={styles.modalHeaderTitle}>Now Playing</Text>
                <Text style={styles.modalHeaderSub} numberOfLines={1}>
                  {currentSong?.genre || "Music"}
                </Text>
              </View>

              <TouchableOpacity onPress={() => showSongOptions(currentSong)} style={styles.modalHeaderBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Art */}
            <View style={styles.musicHeroWrap}>
              <Image source={{ uri: currentSong?.coverUrl }} style={styles.musicHeroArt} />
              <LinearGradient colors={["rgba(0,0,0,0)", "rgba(15,23,42,0.18)"]} style={styles.musicHeroShade} />
            </View>

            {/* Hidden audio element (plays in background while modal open) */}
            {!!currentSong?.link && (
              <Video
                ref={audioRef}
                source={{ uri: currentSong.link }}
                paused={!isPlaying}
                muted={isMuted}
                audioOnly
                playInBackground={false}
                playWhenInactive={false}
                onProgress={onAudioProgress}
                onLoad={onAudioLoad}
                onError={() => Alert.alert("Audio error", "Cannot play this audio link.")}
                style={{ height: 0, width: 0 }}
              />
            )}

            {/* Info */}
            <View style={styles.musicInfoBlock}>
              <View style={{ flex: 1 }}>
                <Text style={styles.musicTitle} numberOfLines={1}>
                  {currentSong?.title || "Unknown Title"}
                </Text>
                <TouchableOpacity onPress={() => openArtistProfile(currentSong?.artistId)} activeOpacity={0.8}>
                  <Text style={styles.musicArtist} numberOfLines={1}>
                    {currentSong?.artist || "Unknown Artist"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.likeBtn} onPress={() => currentSong && toggleFavorite(currentSong, "song")}>
                <Ionicons name={currentSong && isFavorited(currentSong.id) ? "heart" : "heart-outline"} size={20} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Progress + seek */}
            <View style={styles.progressWrap}>
              <Pressable
                onPress={(e: any) => {
                  const x = e.nativeEvent.locationX;
                  const ratio = clamp(x / (width - 16 * 2 - 8), 0, 1);
                  seekAudio(ratio * (songDuration || 0));
                }}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${clamp((songPosition / Math.max(1, songDuration)) * 100, 0, 100)}%` }]} />
                </View>
              </Pressable>

              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(songPosition)}</Text>
                <Text style={styles.timeText}>{formatTime(songDuration)}</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlBtn} onPress={() => setIsMuted((m) => !m)}>
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => seekAudio(songPosition - 10)}>
                <Ionicons name="play-back" size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} style={styles.playBigBtn} onPress={() => setIsPlaying((p) => !p)}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => seekAudio(songPosition + 10)}>
                <Ionicons name="play-forward" size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => currentSong && toggleDownload(currentSong, "song")}>
                <Ionicons name={currentSong && isDownloaded(currentSong.id) ? "download" : "download-outline"} size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Purchase (UI) */}
            <View style={styles.musicBottomActions}>
              <TouchableOpacity style={[styles.actionPill, { backgroundColor: "#F2F3F5" }]} onPress={() => currentSong && showSongOptions(currentSong)}>
                <Ionicons name="options-outline" size={18} color="#111" />
                <Text style={styles.actionPillText}>Options</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionPill,
                  { backgroundColor: "rgba(47,165,169,0.14)", borderColor: "rgba(47,165,169,0.35)", borderWidth: 1 },
                ]}
                onPress={() => Alert.alert("Purchase", "Connect your payment flow here (song purchase).")}
              >
                <Ionicons name="card-outline" size={18} color={COLORS.light.primary} />
                <Text style={[styles.actionPillText, { color: COLORS.light.primary }]}>Buy Song</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- VIDEO INFO MODAL ---------- */}
      <Modal visible={videoInfoModalVisible} animationType="fade" transparent>
        <View style={styles.videoInfoBackdrop}>
          <View style={styles.videoInfoCard}>
            <TouchableOpacity style={styles.videoInfoClose} onPress={() => setVideoInfoModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>

            <View style={styles.videoInfoHero}>
              <Image source={{ uri: currentVideo?.coverUrl }} style={styles.videoInfoHeroImg} />
              <LinearGradient colors={["transparent", "rgba(15,23,42,0.78)"]} style={styles.videoInfoHeroGrad} />

              <View style={styles.videoInfoHeroTop}>
                {currentVideo?.isPremium ? <PremiumBadge premium /> : <FreeBadge premium={false} />}
              </View>

              <View style={styles.videoInfoHeroBottom}>
                <Text style={styles.videoInfoTitle} numberOfLines={2}>
                  {currentVideo?.title || "Untitled"}
                </Text>
                <Text style={styles.videoInfoSub} numberOfLines={1}>
                  {(currentVideo?.channelName || currentVideo?.type || "Channel")} • {currentVideo?.views || "0"} views
                </Text>
              </View>
            </View>

            <View style={styles.videoInfoBody}>
              <Text style={styles.videoInfoDesc} numberOfLines={4}>
                {currentVideo?.description || "No description available."}
              </Text>

              <View style={styles.videoInfoBtns}>
                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={openVideoFullscreen}>
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>{currentVideo?.type === "series" ? "Play Series" : "Play"}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => currentVideo && toggleFavorite(currentVideo, "video")}>
                  <Ionicons name={currentVideo && isFavorited(currentVideo.id) ? "heart" : "heart-outline"} size={18} color="#111" />
                  <Text style={styles.secondaryBtnText}>Favorite</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => currentVideo && toggleDownload(currentVideo, "video")}>
                  <Ionicons name={currentVideo && isDownloaded(currentVideo.id) ? "download" : "download-outline"} size={18} color="#111" />
                  <Text style={styles.secondaryBtnText}>Offline</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- VIDEO FULLSCREEN (REAL VIDEO + EPISODES) ---------- */}
      <Modal visible={videoFullscreenVisible} animationType="slide" transparent>
        <View style={styles.videoFullWrap}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* Top controls */}
          <View style={styles.videoFullTopBar}>
            <TouchableOpacity style={styles.videoFullTopBtn} onPress={() => setVideoFullscreenVisible(false)}>
              <Ionicons name="chevron-down" size={24} color="#111" />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={styles.videoFullTitle} numberOfLines={1}>
                {currentEpisode?.title || currentVideo?.title || "Video"}
              </Text>
              <Text style={styles.videoFullSub} numberOfLines={1}>
                {(currentVideo?.channelName || currentVideo?.type || "Channel")} • {currentVideo?.views || "0"} views
              </Text>
            </View>

            <TouchableOpacity style={styles.videoFullTopBtn} onPress={() => showVideoOptions(currentVideo)}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          {/* Video player */}
          <View style={styles.videoCanvas}>
            {(() => {
              const url = currentEpisode?.link || currentVideo?.link;
              if (!url) {
                return (
                  <View style={[styles.videoCanvas, { alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontWeight: "900", color: "#111" }}>No video link</Text>
                  </View>
                );
              }

              // Premium gate
              if (currentVideo?.isPremium && subscription === "free") {
                return (
                  <View style={[styles.videoCanvas, { alignItems: "center", justifyContent: "center", padding: 16 }]}>
                    <Ionicons name="lock-closed" size={26} color={COLORS.light.primary} />
                    <Text style={{ fontWeight: "900", color: "#111", marginTop: 8 }}>Premium movie</Text>
                    <Text style={{ fontWeight: "800", color: "#6B6B6B", textAlign: "center", marginTop: 6 }}>
                      Upgrade to Premium to watch this video.
                    </Text>
                    <TouchableOpacity style={[styles.primaryBtn, { marginTop: 12 }]} onPress={() => requirePremium("Upgrade to watch this movie.")}>
                      <Text style={styles.primaryBtnText}>Upgrade</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              return (
                <Video
                  ref={videoRef}
                  source={{ uri: url }}
                  style={styles.realVideo}
                  resizeMode="contain"
                  paused={!isPlaying}
                  muted={isMuted}
                  controls={false}
                  onProgress={onVideoProgress}
                  onLoad={onVideoLoad}
                  onError={() => Alert.alert("Video error", "Cannot play this video link.")}
                />
              );
            })()}

            {/* Glass overlay controls */}
            <View style={styles.videoControlsGlass}>
              <View style={styles.videoControlsRow}>
                <TouchableOpacity style={styles.videoControlBtn} onPress={() => setIsMuted((m) => !m)}>
                  <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.videoControlBtn} onPress={() => seekVideo(videoPosition - 10)}>
                  <Ionicons name="play-back" size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.videoPlayBig} onPress={() => setIsPlaying((p) => !p)}>
                  <Ionicons name={isPlaying ? "pause" : "play"} size={30} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.videoControlBtn} onPress={() => seekVideo(videoPosition + 10)}>
                  <Ionicons name="play-forward" size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.videoControlBtn} onPress={() => currentVideo && toggleDownload(currentVideo, "video")}>
                  <Ionicons name={currentVideo && isDownloaded(currentVideo.id) ? "download" : "download-outline"} size={22} color="#111" />
                </TouchableOpacity>
              </View>

              {/* progress seek */}
              <View style={styles.videoProgressWrap}>
                <Pressable
                  onPress={(e: any) => {
                    const x = e.nativeEvent.locationX;
                    const ratio = clamp(x / (width - 12 * 2 - 24), 0, 1);
                    seekVideo(ratio * (videoDuration || 0));
                  }}
                >
                  <View style={styles.videoProgressTrack}>
                    <View style={[styles.videoProgressFill, { width: `${clamp((videoPosition / Math.max(1, videoDuration)) * 100, 0, 100)}%` }]} />
                  </View>
                </Pressable>
                <View style={styles.videoTimeRow}>
                  <Text style={styles.videoTime}>{formatTime(videoPosition)}</Text>
                  <Text style={styles.videoTime}>{formatTime(videoDuration)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Episodes for series */}
          {currentVideo?.type === "series" && (
            <View style={styles.episodesCard}>
              <View style={styles.episodesHeader}>
                <Text style={styles.episodesTitle}>Episodes</Text>
                {episodesLoading ? <ActivityIndicator size="small" color={COLORS.light.primary} /> : null}
              </View>

              {!episodesLoading && !episodes.length ? (
                <Text style={styles.emptyText}>No episodes found</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 12 }}>
                  {episodes.map((ep) => {
                    const active = currentEpisode?.id === ep.id;
                    return (
                      <TouchableOpacity
                        key={ep.id}
                        activeOpacity={0.9}
                        onPress={() => playEpisode(ep)}
                        style={[styles.episodeTile, active && { borderColor: "rgba(47,165,169,0.75)", borderWidth: 2 }]}
                      >
                        <Image source={{ uri: ep.coverUrl || currentVideo.coverUrl }} style={styles.episodeImg} />
                        <LinearGradient colors={["transparent", "rgba(15,23,42,0.68)"]} style={styles.episodeGrad} />
                        <Text style={styles.episodeText} numberOfLines={2}>
                          {ep.seasonNumber ? `S${ep.seasonNumber} ` : ""}{ep.episodeNumber ? `E${ep.episodeNumber} ` : ""}{ep.title || "Episode"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Details */}
          <View style={styles.videoFullDetails}>
            <View style={styles.videoFullActions}>
              <TouchableOpacity style={styles.videoActionChip} onPress={() => currentVideo && toggleFavorite(currentVideo, "video")}>
                <Ionicons name={currentVideo && isFavorited(currentVideo.id) ? "heart" : "heart-outline"} size={18} color="#111" />
                <Text style={styles.videoActionText}>Like</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.videoActionChip} onPress={() => openArtistProfile(currentVideo?.artistId)}>
                <Ionicons name="person-outline" size={18} color="#111" />
                <Text style={styles.videoActionText}>Artist</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.videoActionChip} onPress={() => Alert.alert("Share", "Share link here")}>
                <Ionicons name="share-social-outline" size={18} color="#111" />
                <Text style={styles.videoActionText}>Share</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.videoFullDesc} numberOfLines={5}>
              {currentVideo?.description || "No description available."}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ---------- ARTIST PROFILE MODAL ---------- */}
      <Modal visible={artistModalVisible} animationType="slide" transparent>
        <View style={styles.artistWrap}>
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
          <View style={styles.artistTop}>
            <TouchableOpacity style={styles.artistClose} onPress={() => setArtistModalVisible(false)}>
              <Ionicons name="chevron-down" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <LinearGradient colors={["#0F172A", "rgba(47,165,169,0.35)", "#FFFFFF"]} style={styles.artistBody}>
            {artistLoading ? (
              <View style={{ paddingTop: 80, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>Loading artist…</Text>
              </View>
            ) : (
              <>
                <View style={styles.artistHeader}>
                  <Image
                    source={{ uri: artist?.photoUrl || "https://images.unsplash.com/photo-1520975682031-a7d4a1c1c3c0?w=400" }}
                    style={styles.artistAvatar}
                  />
                  <Text style={styles.artistName}>{artist?.name || "Artist"}</Text>
                  <Text style={styles.artistBio} numberOfLines={3}>
                    {artist?.bio || "No bio available."}
                  </Text>
                </View>

                <View style={styles.artistSections}>
                  <Text style={styles.artistSectionTitle}>Top Songs</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {artistSongs.slice(0, 12).map((s) => (
                      <TouchableOpacity key={s.id} activeOpacity={0.9} style={styles.artistCard} onPress={() => openMusicPlayer(s)}>
                        <Image source={{ uri: s.coverUrl }} style={styles.artistCardImg} />
                        <Text style={styles.artistCardTitle} numberOfLines={1}>{s.title || "Song"}</Text>
                        <Text style={styles.artistCardSub} numberOfLines={1}>{s.genre || "Music"}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={[styles.artistSectionTitle, { marginTop: 18 }]}>Videos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {artistVideos.slice(0, 12).map((v) => (
                      <TouchableOpacity key={v.id} activeOpacity={0.9} style={styles.artistCard} onPress={() => openVideoInfo(v)}>
                        <Image source={{ uri: v.coverUrl }} style={styles.artistCardImg} />
                        <Text style={styles.artistCardTitle} numberOfLines={1}>{v.title || "Video"}</Text>
                        <Text style={styles.artistCardSub} numberOfLines={1}>{v.type || "Video"}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </Modal>

      {/* ---------- Bottom Sheet ---------- */}
      <Modal visible={bottomSheetVisible} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setBottomSheetVisible(false)} activeOpacity={1} />
          <View style={styles.sheetCard}>{renderBottomSheetContent()}</View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Media;

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  avatarChip: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarChipImg: { width: 44, height: 44, borderRadius: 16 },
  greetingText: { fontSize: 12, color: "#6B6B6B", fontWeight: "800" },
  userText: { fontSize: 16, color: "#111", fontWeight: "900", marginTop: 1 },
  topBarActions: { flexDirection: "row", gap: 10 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },

  subChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  subChipFree: { backgroundColor: "rgba(15,23,42,0.08)" },
  subChipPremium: { backgroundColor: "#8B5CF6" },
  subChipText: { fontWeight: "900", fontSize: 11.5 },

  tabsWrap: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 10 },
  tabChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "#F2F3F5" },
  tabChipActive: { backgroundColor: "rgba(47,165,169,0.18)", borderWidth: 1, borderColor: "rgba(47,165,169,0.35)" },
  tabText: { fontSize: 13.5, fontWeight: "900", color: "#444" },
  tabTextActive: { color: COLORS.light.primary },

  sectionTitle: { paddingHorizontal: 16, marginTop: 10, marginBottom: 10, fontSize: 20, color: "#111", fontWeight: "900" },
  sectionTitleInline: { fontSize: 18, color: "#111", fontWeight: "900" },
  sectionHeaderRow: { paddingHorizontal: 16, marginTop: 8, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLink: { fontSize: 13.5, fontWeight: "900", color: COLORS.light.primary },
  sectionHint: { fontSize: 12.5, fontWeight: "900", color: "#7A7A7A" },

  loadingWrap: { paddingVertical: 70, alignItems: "center", justifyContent: "center" },

  heroCard: { width: CAROUSEL_WIDTH, height: 280, marginRight: ITEM_SPACING, borderRadius: 24, overflow: "hidden", backgroundColor: "#EEE" },
  heroImage: { width: "100%", height: "100%" },
  heroGradient: { position: "absolute", bottom: 0, height: 170, width: "100%" },
  heroTopRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroBottom: { position: "absolute", left: 14, right: 14, bottom: 14 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { marginTop: 6, color: "rgba(255,255,255,0.90)", fontSize: 12.5, fontWeight: "800" },
  heroBtnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.light.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, flex: 1, minWidth: 130 },
  heroBtnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  heroBtnGhost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.20)", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, flex: 1, minWidth: 120 },
  heroBtnGhostText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#8B5CF6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  premiumText: { color: "#fff", fontSize: 11.5, fontWeight: "900" },
  freeBadge: { backgroundColor: "rgba(255,255,255,0.90)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  freeText: { color: "#0F172A", fontSize: 11.5, fontWeight: "900" },

  songRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 18, backgroundColor: "#fff", marginBottom: 12, borderWidth: 1, borderColor: "#EFEFEF" },
  songArt: { width: 62, height: 62, borderRadius: 16, marginRight: 12, backgroundColor: "#EEE" },
  songTitle: { fontSize: 15.5, fontWeight: "900", color: "#111", flexShrink: 1 },
  songArtist: { marginTop: 3, fontSize: 13, fontWeight: "800", color: "#6B6B6B" },
  songMicroRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  microPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F2F3F5" },
  microPillText: { fontSize: 12, fontWeight: "900", color: "#0F172A" },
  microDot: { color: "#A0A0A0", fontWeight: "900" },
  microInfo: { fontSize: 12, fontWeight: "900", color: "#7A7A7A" },
  lockRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  lockText: { fontSize: 12.5, fontWeight: "900", color: "#8B5CF6" },

  rowActions: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.light.primary, alignItems: "center", justifyContent: "center" },
  ghostBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },

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
  ghostBtnSm: { width: 32, height: 32, borderRadius: 12, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  videoSub: { marginTop: 4, fontSize: 12.5, fontWeight: "900", color: "#6B6B6B" },
  videoStatsRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  videoStat: { fontSize: 12.5, fontWeight: "900", color: "#7A7A7A" },
  videoDot: { color: "#A0A0A0", fontWeight: "900" },
  videoDesc: { marginTop: 6, fontSize: 13, fontWeight: "800", color: "#6A6A6A", lineHeight: 18 },

  seriesPill: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(47,165,169,0.14)", borderWidth: 1, borderColor: "rgba(47,165,169,0.30)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, alignSelf: "flex-start" },
  seriesText: { fontWeight: "900", color: COLORS.light.primary, fontSize: 12 },

  genreCard: { width: (width - 16 * 2 - 12) / 2, height: 120, borderRadius: 18, overflow: "hidden", marginBottom: 12 },
  genreBg: { width: "100%", height: "100%", opacity: 0.34 },
  genreFade: { position: "absolute", bottom: 0, height: 60, width: "100%" },
  genreTitle: { position: "absolute", left: 12, bottom: 12, color: "#fff", fontSize: 15, fontWeight: "900" },

  bottomNav: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 1 },
    }),
  },
  bottomItem: { alignItems: "center", gap: 6 },
  bottomIconWrap: { width: 40, height: 40, borderRadius: 16, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  bottomLabel: { fontSize: 11.5, fontWeight: "900", color: "#8A8A8A" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheetCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: height * 0.78 },
  sheetTopRow: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 17, fontWeight: "900", color: "#111" },
  sheetCloseBtn: { width: 34, height: 34, borderRadius: 14, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", paddingVertical: 30, color: "#7A7A7A", fontWeight: "900" },

  fullModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  fullModalSheet: { height: height * 0.92, backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden", paddingHorizontal: 16, paddingTop: 10 },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  modalHeaderBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  modalHeaderTitle: { fontSize: 14, fontWeight: "900", color: "#111" },
  modalHeaderSub: { fontSize: 12, fontWeight: "900", color: "#7A7A7A", marginTop: 2 },

  musicHeroWrap: { marginTop: 10, borderRadius: 26, overflow: "hidden", height: height * 0.40, backgroundColor: "#EEE" },
  musicHeroArt: { width: "100%", height: "100%" },
  musicHeroShade: { position: "absolute", bottom: 0, height: 160, width: "100%" },

  musicInfoBlock: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  musicTitle: { fontSize: 20, fontWeight: "900", color: "#111" },
  musicArtist: { marginTop: 5, fontSize: 14, fontWeight: "900", color: "#6B6B6B" },
  likeBtn: { width: 44, height: 44, borderRadius: 18, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },

  progressWrap: { marginTop: 16, paddingHorizontal: 4 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: "#E6E7EA", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: COLORS.light.primary },
  timeRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, fontWeight: "900", color: "#7A7A7A" },

  controlsRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  controlBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  playBigBtn: {
    width: 70,
    height: 70,
    borderRadius: 26,
    backgroundColor: COLORS.light.primary,
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
  videoInfoDesc: { fontSize: 13.5, fontWeight: "800", color: "#5E5E5E", lineHeight: 19 },
  videoInfoBtns: { marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.light.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, flex: 1, minWidth: 140 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F2F3F5", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, flex: 1, minWidth: 120 },
  secondaryBtnText: { color: "#111", fontWeight: "900", fontSize: 13.5 },

  videoFullWrap: { flex: 1, backgroundColor: "#fff" },
  videoFullTopBar: { paddingTop: 6, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center" },
  videoFullTopBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  videoFullTitle: { fontSize: 15.5, fontWeight: "900", color: "#111" },
  videoFullSub: { marginTop: 3, fontSize: 12, fontWeight: "900", color: "#7A7A7A" },

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
  videoControlBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },
  videoPlayBig: { width: 74, height: 74, borderRadius: 26, backgroundColor: COLORS.light.primary, alignItems: "center", justifyContent: "center" },

  videoProgressWrap: { marginTop: 10 },
  videoProgressTrack: { height: 6, borderRadius: 999, backgroundColor: "#E6E7EA", overflow: "hidden" },
  videoProgressFill: { height: 6, borderRadius: 999, backgroundColor: COLORS.light.primary },
  videoTimeRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  videoTime: { fontSize: 12, fontWeight: "900", color: "#6F6F6F" },

  episodesCard: { marginTop: 12, marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#EFEFEF" },
  episodesHeader: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  episodesTitle: { fontWeight: "900", fontSize: 15, color: "#111" },
  episodeTile: { width: 170, height: 100, borderRadius: 18, overflow: "hidden", backgroundColor: "#EEE", borderWidth: 1, borderColor: "#EEF2F7" },
  episodeImg: { width: "100%", height: "100%" },
  episodeGrad: { position: "absolute", bottom: 0, width: "100%", height: 60 },
  episodeText: { position: "absolute", left: 10, right: 10, bottom: 10, color: "#fff", fontWeight: "900", fontSize: 12.5 },

  videoFullDetails: { marginTop: 12, marginHorizontal: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#EFEFEF", padding: 14 },
  videoFullActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  videoActionChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#F2F3F5" },
  videoActionText: { fontSize: 13, fontWeight: "900", color: "#111" },
  videoFullDesc: { fontSize: 13.5, fontWeight: "800", color: "#5E5E5E", lineHeight: 19 },

  artistWrap: { flex: 1, backgroundColor: "#0F172A" },
  artistTop: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 6 },
  artistClose: { width: 42, height: 42, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  artistBody: { flex: 1 },
  artistHeader: { alignItems: "center", paddingTop: 20, paddingHorizontal: 16 },
  artistAvatar: { width: 92, height: 92, borderRadius: 28, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  artistName: { marginTop: 12, color: "#fff", fontWeight: "900", fontSize: 20 },
  artistBio: { marginTop: 8, color: "rgba(255,255,255,0.85)", fontWeight: "800", textAlign: "center", lineHeight: 18 },
  artistSections: { marginTop: 22, paddingBottom: 24 },
  artistSectionTitle: { paddingHorizontal: 16, color: "#0F172A", fontWeight: "900", fontSize: 16, marginBottom: 12 },
  artistCard: { width: 140, borderRadius: 18, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEF2F7" },
  artistCardImg: { width: "100%", height: 90, backgroundColor: "#EEE" },
  artistCardTitle: { paddingHorizontal: 10, paddingTop: 10, fontWeight: "900", color: "#0F172A" },
  artistCardSub: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10, fontWeight: "900", color: "#64748B", fontSize: 12 },
});

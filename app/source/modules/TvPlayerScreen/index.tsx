// TvPlayerScreen.tsx (YouTube-like white + teal redesign)
// ✅ Top player always visible (like YouTube)
// ✅ Channel selection via dropdown modal
// ✅ Visitor view stays clean (browse only)
// ✅ Owner-only: manage ONLY their channel (create/edit/delete)
// ✅ Content types: Videos + Podcasts
// ✅ Add by YouTube link OR upload video file (mp4) + title + description + schedule
// ✅ When a scheduled item is near, highlight as "Up next"
// ------------------------------------------------------------
// REQUIRED PACKAGES:
// 1) react-native-video
// 2) react-native-webview
// 3) react-native-image-picker
// ------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import Video from "react-native-video";
import { WebView } from "react-native-webview";
import * as ImagePicker from "react-native-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";

import { COLORS } from "../../../core/theme/colors";
import { auth, db } from "../auth/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { d_assets } from "../../configs/assets";

const { height: H, width: W } = Dimensions.get("window");

// ✅ Adjust these to your VPS endpoints
// Image thumbnails (already working for you)
const CDN_IMAGE_UPLOAD_ENDPOINT = "https://cdn.celeonetv.com/api/uploads/posts";
// Video uploads (create this endpoint on your VPS; should return { url })
const CDN_VIDEO_UPLOAD_ENDPOINT = "https://cdn.celeonetv.com/api/uploads/videos";

// Highlight if scheduled within next hours
const UP_NEXT_HOURS = 6;

type Channel = {
  id: string;
  name?: string;
  description?: string;
  streamLink?: string; // optional m3u8
  ownerId?: string;
  logo?: string;
};

type MediaItem = {
  id: string;
  type: "video" | "podcast";
  title?: string;
  description?: string;
  link?: string; // YouTube URL or direct mp4 URL
  thumbnail?: string;
  scheduledAt?: any; // Firestore timestamp/date/string
  createdAt?: any;
  updatedAt?: any;
};

function toDate(value: any): Date | null {
  try {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatWhen(d: Date | null) {
  if (!d) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function isPast(d: Date | null) {
  if (!d) return false;
  return d.getTime() < Date.now();
}

function isUpNext(d: Date | null) {
  if (!d) return false;
  const now = Date.now();
  const diff = d.getTime() - now;
  return diff > 0 && diff <= UP_NEXT_HOURS * 60 * 60 * 1000;
}

function isYouTubeLink(url: string) {
  const u = (url || "").toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}

function extractYouTubeId(url: string) {
  try {
    const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
    if (short?.[1]) return short[1];
    const v = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
    if (v?.[1]) return v[1];
    const emb = url.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
    if (emb?.[1]) return emb[1];
    return null;
  } catch {
    return null;
  }
}

function makeYouTubeHTML(url: string) {
  const id = extractYouTubeId(url);
  const safeId = id || "";
  return `
  <!doctype html>
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
      <style>
        html, body { margin:0; padding:0; height:100%; background:#fff; }
        iframe { width:100%; height:100%; border:0; }
      </style>
    </head>
    <body>
      ${
        safeId
          ? `<iframe
                src="https://www.youtube.com/embed/${safeId}?rel=0&modestbranding=1&playsinline=1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>`
          : `<div style="font-family:Arial;padding:16px;">Invalid YouTube link</div>`
      }
    </body>
  </html>`;
}

async function pickImageAsset() {
  const res = await ImagePicker.launchImageLibrary({
    mediaType: "photo",
    selectionLimit: 1,
    quality: 0.85,
  });
  if (res.didCancel) return null;
  if (res.errorCode) throw new Error(res.errorMessage || "Image picker error");
  const a = res.assets?.[0];
  if (!a?.uri) return null;
  return {
    uri: a.uri,
    type: a.type || "image/jpeg",
    name: a.fileName || "thumb.jpg",
  };
}

async function pickVideoAsset() {
  const res = await ImagePicker.launchImageLibrary({
    mediaType: "video",
    selectionLimit: 1,
  });
  if (res.didCancel) return null;
  if (res.errorCode) throw new Error(res.errorMessage || "Video picker error");
  const a = res.assets?.[0];
  if (!a?.uri) return null;
  return {
    uri: a.uri,
    type: a.type || "video/mp4",
    name: a.fileName || "video.mp4",
  };
}

async function uploadMultipart(endpoint: string, file: { uri: string; type: string; name: string }) {
  const fd = new FormData();
  fd.append("file", file as any);

  const r = await fetch(endpoint, { method: "POST", body: fd });
  if (!r.ok) {
    const text = await r.text();
    console.log("UPLOAD ERROR:", r.status, text);
    throw new Error(`Upload failed (${r.status})`);
  }
  const data = await r.json();
  if (!data?.url) throw new Error("Upload server did not return url");
  return data.url as string;
}

export default function TvPlayerScreen({ navigation }: any) {
  const currentUser = auth.currentUser;

  // player state
  const liveRef = useRef<Video>(null);
  const [playerMode, setPlayerMode] = useState<"live" | "media">("live");
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [playerHeight, setPlayerHeight] = useState(H * 0.32);

  // data
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [podcasts, setPodcasts] = useState<MediaItem[]>([]);

  // channel selection modal
  const [channelPickerOpen, setChannelPickerOpen] = useState(false);

  // tabs
  const [tab, setTab] = useState<"videos" | "podcasts">("videos");

  // currently selected media
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);

  // owner manage sheet (only for owner)
  const [manageOpen, setManageOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [streamLink, setStreamLink] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelDesc, setChannelDesc] = useState("");

  // create/edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editKind, setEditKind] = useState<"video" | "podcast">("video");
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);

  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLink, setFLink] = useState(""); // youtube OR mp4
  const [fThumb, setFThumb] = useState("");
  const [fDate, setFDate] = useState(""); // YYYY-MM-DD
  const [fTime, setFTime] = useState(""); // HH:mm

  const isOwner = useMemo(() => {
    if (!selectedChannel?.ownerId || !currentUser?.uid) return false;
    return selectedChannel.ownerId === currentUser.uid;
  }, [selectedChannel?.ownerId, currentUser?.uid]);

  const channelLogo = selectedChannel?.logo || (d_assets?.images?.appLogo as any);

  const sortedVideos = useMemo(() => sortMedia(videos), [videos]);
  const sortedPodcasts = useMemo(() => sortMedia(podcasts), [podcasts]);

  const listData = tab === "videos" ? sortedVideos : sortedPodcasts;

  const upNextIds = useMemo(() => {
    const map = new Set<string>();
    listData.forEach((it) => {
      const d = toDate(it.scheduledAt);
      if (isUpNext(d)) map.add(it.id);
    });
    return map;
  }, [listData]);

  function sortMedia(items: MediaItem[]) {
    const cloned = [...items];
    cloned.sort((a, b) => {
      const da = toDate(a.scheduledAt) || toDate(a.createdAt) || new Date(0);
      const dbb = toDate(b.scheduledAt) || toDate(b.createdAt) || new Date(0);
      // upcoming first
      const aPast = isPast(da);
      const bPast = isPast(dbb);
      if (aPast !== bPast) return aPast ? 1 : -1;
      return da.getTime() - dbb.getTime();
    });
    return cloned;
  }

  /* ================= FETCH ================= */
  const fetchChannels = async () => {
    const snap = await getDocs(collection(db, "channels"));
    const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Channel[];
    setChannels(data);
    if (!selectedChannel && data.length) setSelectedChannel(data[0]);
    return data;
  };

  const fetchChannelContent = async (channelId: string) => {
    // Your structure: channels/{id}/videos and channels/{id}/podcasts
    const videosSnap = await getDocs(collection(db, "channels", channelId, "videos"));
    const podcastsSnap = await getDocs(collection(db, "channels", channelId, "podcasts"));

    const v = videosSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any), type: "video" })) as any[];
    const p = podcastsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any), type: "podcast" })) as any[];

    setVideos(v);
    setPodcasts(p);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchChannels();
        if (data?.[0]?.id) {
          setSelectedChannel(data[0]);
          await fetchChannelContent(data[0].id);
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Failed to load TV");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedChannel?.id) return;
    (async () => {
      await fetchChannelContent(selectedChannel.id);

      // Default player behavior:
      // If stream exists => play live, else play first available media item
      if (selectedChannel.streamLink) {
        setPlayerMode("live");
        setActiveMedia(null);
      } else {
        const first = (tab === "videos" ? sortedVideos : sortedPodcasts)?.[0] || sortedVideos?.[0] || sortedPodcasts?.[0] || null;
        if (first?.link) {
          setPlayerMode("media");
          setActiveMedia(first);
        } else {
          setPlayerMode("live");
          setActiveMedia(null);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel?.id]);

  /* ================= PLAYER CONTROLS ================= */
  const toggleControls = () => {
    setShowControls((v) => !v);
    setTimeout(() => setShowControls(false), 2200);
  };

  const toggleFullScreen = () => {
    const next = !isFullScreen;
    setIsFullScreen(next);
    setPlayerHeight(next ? H : H * 0.32);
    StatusBar.setHidden(next);
  };

  const playMedia = (item: MediaItem) => {
    setActiveMedia(item);
    setPlayerMode("media");
    setPlaying(true);
  };

  const playLive = () => {
    if (!selectedChannel?.streamLink) {
      Alert.alert("No Live Stream", "This channel is not streaming right now.");
      return;
    }
    setActiveMedia(null);
    setPlayerMode("live");
    setPlaying(true);
  };

  /* ================= OWNER: OPEN MANAGE ================= */
  const openManage = () => {
    if (!selectedChannel) return;
    if (!isOwner) return;

    setChannelName(selectedChannel.name || "");
    setChannelDesc(selectedChannel.description || "");
    setStreamLink(selectedChannel.streamLink || "");
    setManageOpen(true);
  };

  const saveChannel = async () => {
    if (!selectedChannel) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "channels", selectedChannel.id), {
        name: channelName.trim(),
        description: channelDesc.trim(),
        streamLink: streamLink.trim(),
        updatedAt: serverTimestamp(),
      });

      setSelectedChannel((p) =>
        p ? { ...p, name: channelName.trim(), description: channelDesc.trim(), streamLink: streamLink.trim() } : p
      );

      Alert.alert("Saved", "Channel updated successfully");
      setManageOpen(false);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update channel");
    } finally {
      setSaving(false);
    }
  };

  /* ================= OWNER: CREATE/EDIT MEDIA ================= */
  const resetForm = () => {
    setEditingItem(null);
    setFTitle("");
    setFDesc("");
    setFLink("");
    setFThumb("");
    setFDate("");
    setFTime("");
  };

  const openCreate = (kind: "video" | "podcast") => {
    if (!isOwner) return;
    setEditKind(kind);
    resetForm();
    setEditOpen(true);
  };

  const openEdit = (kind: "video" | "podcast", item: MediaItem) => {
    if (!isOwner) return;
    setEditKind(kind);
    setEditingItem(item);

    setFTitle(item.title || "");
    setFDesc(item.description || "");
    setFLink(item.link || "");
    setFThumb(item.thumbnail || "");

    const d = toDate(item.scheduledAt);
    if (d) {
      setFDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setFTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      setFDate("");
      setFTime("");
    }

    setEditOpen(true);
  };

  const buildScheduledAt = () => {
    const dd = fDate.trim();
    const tt = fTime.trim();
    if (!dd || !tt) return null;
    const d = new Date(`${dd}T${tt}:00`);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const uploadThumb = async () => {
    try {
      const file = await pickImageAsset();
      if (!file) return;
      setSaving(true);
      const url = await uploadMultipart(CDN_IMAGE_UPLOAD_ENDPOINT, file);
      setFThumb(url);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload error", e?.message || "Failed to upload image");
    } finally {
      setSaving(false);
    }
  };

  const uploadVideoFile = async () => {
    try {
      const file = await pickVideoAsset();
      if (!file) return;
      setSaving(true);
      const url = await uploadMultipart(CDN_VIDEO_UPLOAD_ENDPOINT, file);
      setFLink(url); // video link now points to uploaded mp4
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload error", e?.message || "Failed to upload video");
    } finally {
      setSaving(false);
    }
  };

  const saveMedia = async () => {
    if (!selectedChannel) return;
    if (!isOwner) return;

    const title = fTitle.trim();
    const desc = fDesc.trim();
    const link = fLink.trim();
    const thumb = fThumb.trim();
    const scheduledAt = buildScheduledAt();

    if (!title) {
      Alert.alert("Validation", "Title is required");
      return;
    }

    // For podcasts: we expect link (youtube OR uploaded)
    if (editKind === "podcast" && !link) {
      Alert.alert("Validation", "Podcast needs a YouTube link or uploaded video");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title,
        description: desc,
        link: link || "",
        thumbnail: thumb || "",
        scheduledAt: scheduledAt || null,
        updatedAt: serverTimestamp(),
      };

      const coll = editKind === "video" ? "videos" : "podcasts";

      if (editingItem?.id) {
        await updateDoc(doc(db, "channels", selectedChannel.id, coll, editingItem.id), payload);
      } else {
        await addDoc(collection(db, "channels", selectedChannel.id, coll), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      await fetchChannelContent(selectedChannel.id);
      setEditOpen(false);
      resetForm();
      Alert.alert("Success", editingItem?.id ? "Updated" : "Created");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteMedia = async (kind: "video" | "podcast", id: string) => {
    if (!selectedChannel) return;
    if (!isOwner) return;

    Alert.alert("Delete", "Delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const coll = kind === "video" ? "videos" : "podcasts";
            await deleteDoc(doc(db, "channels", selectedChannel.id, coll, id));
            await fetchChannelContent(selectedChannel.id);
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  };

  /* ================= RENDER ================= */
  const headerRight = (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <TouchableOpacity
        onPress={() => setChannelPickerOpen(true)}
        style={styles.iconBtn}
        activeOpacity={0.9}
      >
        <Ionicons name="chevron-down" size={18} color="#0F172A" />
      </TouchableOpacity>

      {isOwner && (
        <TouchableOpacity onPress={openManage} style={styles.iconBtnTeal} activeOpacity={0.9}>
          <Ionicons name="settings-outline" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={styles.iconBtn}
            activeOpacity={0.9}
          >
            <Ionicons name="chevron-back" size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.appTitle} numberOfLines={1}>
              {selectedChannel?.name || "TV"}
            </Text>
            <Text style={styles.appSub} numberOfLines={1}>
              {selectedChannel?.description || "Live & Videos"}
            </Text>
          </View>

          {headerRight}
        </View>

        {/* Player (YouTube-like) */}
        <View style={[styles.playerWrap, { height: playerHeight }]}>
          <Pressable style={{ flex: 1 }} onPress={toggleControls}>
            <View style={styles.playerCard}>
              {playerMode === "media" && activeMedia?.link ? (
                isYouTubeLink(activeMedia.link) ? (
                  <WebView
                    source={{ html: makeYouTubeHTML(activeMedia.link) }}
                    style={{ flex: 1, backgroundColor: "#fff" }}
                    javaScriptEnabled
                    allowsFullscreenVideo
                  />
                ) : (
                  <Video
                    source={{ uri: activeMedia.link }}
                    style={{ flex: 1, backgroundColor: "#fff" }}
                    resizeMode="contain"
                    controls={true}
                    paused={!playing}
                    muted={muted}
                  />
                )
              ) : selectedChannel?.streamLink ? (
                <Video
                  ref={liveRef}
                  source={{ uri: selectedChannel.streamLink, type: "m3u8" as any }}
                  style={{ flex: 1, backgroundColor: "#fff" }}
                  resizeMode="contain"
                  controls={true}
                  paused={!playing}
                  muted={muted}
                />
              ) : (
                <View style={styles.noLive}>
                  <Ionicons name="radio-outline" size={30} color="#0F172A" />
                  <Text style={styles.noLiveTitle}>No live stream right now</Text>
                  <Text style={styles.noLiveSub}>Select a video/podcast below</Text>
                </View>
              )}

              {/* Overlay controls (minimal, YouTube-like) */}
              {showControls && (
                <View style={styles.controls}>
                  <View style={styles.controlsTop}>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>
                        {playerMode === "live" ? "LIVE" : tab.toUpperCase()}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.ctrlIconBtn} onPress={toggleFullScreen} activeOpacity={0.9}>
                      <Ionicons name={isFullScreen ? "contract" : "expand"} size={20} color="#0F172A" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.controlsMiddle}>
                    <TouchableOpacity style={styles.bigPlay} onPress={() => setPlaying((v) => !v)} activeOpacity={0.9}>
                      <Ionicons name={playing ? "pause" : "play"} size={26} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.controlsBottom}>
                    <TouchableOpacity style={styles.ctrlRowBtn} onPress={() => setMuted((m) => !m)} activeOpacity={0.9}>
                      <Ionicons name={muted ? "volume-mute" : "volume-high"} size={18} color="#0F172A" />
                      <Text style={styles.ctrlRowText}>{muted ? "Muted" : "Sound"}</Text>
                    </TouchableOpacity>

                    {!!selectedChannel?.streamLink && (
                      <TouchableOpacity style={styles.ctrlRowBtn} onPress={playLive} activeOpacity={0.9}>
                        <Ionicons name="radio" size={18} color="#0F172A" />
                        <Text style={styles.ctrlRowText}>Live</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        </View>

        {/* Channel name + description (YouTube style) */}
        <View style={styles.channelInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.channelAvatar}>
              {typeof channelLogo === "number" ? (
                <Image source={channelLogo} style={styles.channelAvatarImg} />
              ) : (
                <Image source={{ uri: selectedChannel?.logo || "" }} style={styles.channelAvatarImg} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.channelName} numberOfLines={1}>
                {selectedChannel?.name || "Channel"}
              </Text>
              <Text style={styles.channelDesc} numberOfLines={2}>
                {selectedChannel?.description || "—"}
              </Text>
            </View>

            {/* Owner buttons only (for this owned channel) */}
            {isOwner && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={styles.ownerBtn} onPress={() => openCreate("video")} activeOpacity={0.9}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.ownerBtnText}>Video</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.ownerBtnOutline} onPress={() => openCreate("podcast")} activeOpacity={0.9}>
                  <Ionicons name="add" size={18} color={COLORS.light.primary} />
                  <Text style={styles.ownerBtnTextOutline}>Podcast</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setTab("videos")}
              style={[styles.tabBtn, tab === "videos" && styles.tabBtnActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.tabText, tab === "videos" && styles.tabTextActive]}>Videos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTab("podcasts")}
              style={[styles.tabBtn, tab === "podcasts" && styles.tabBtnActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.tabText, tab === "podcasts" && styles.tabTextActive]}>Podcasts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* List like YouTube */}
        <FlatList
          data={listData}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 18, paddingTop: 6 }}
          renderItem={({ item }) => {
            const up = upNextIds.has(item.id);
            const when = toDate(item.scheduledAt);

            return (
              <TouchableOpacity
                style={[styles.itemRow, up && styles.itemRowUpNext]}
                onPress={() => item.link ? playMedia(item) : Alert.alert("No Video", "This item has no video link yet")}
                activeOpacity={0.92}
              >
                <View style={styles.thumbBox}>
                  <Image
                    source={{ uri: item.thumbnail || "https://via.placeholder.com/320x180.png?text=Video" }}
                    style={styles.thumb}
                  />
                  {up && (
                    <View style={styles.upNextBadge}>
                      <Ionicons name="time-outline" size={14} color="#0F172A" />
                      <Text style={styles.upNextText}>Up next</Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title || "Untitled"}
                  </Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {selectedChannel?.name || "Channel"} · {when ? formatWhen(when) : "No schedule"}
                  </Text>
                  {!!item.description && (
                    <Text style={styles.itemDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>

                {/* Owner actions only */}
                {isOwner && (
                  <View style={{ gap: 10, paddingLeft: 10 }}>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => openEdit(tab === "videos" ? "video" : "podcast", item)} activeOpacity={0.9}>
                      <Ionicons name="create-outline" size={18} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.miniBtn, { backgroundColor: "#FEE2E2" }]}
                      onPress={() => deleteMedia(tab === "videos" ? "video" : "podcast", item.id)}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="videocam-outline" size={26} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No {tab} yet</Text>
              <Text style={styles.emptySub}>
                {isOwner ? "Add a YouTube link or upload a video." : "Come back later for new content."}
              </Text>
            </View>
          }
        />

        {/* CHANNEL PICKER (dropdown) */}
        <Modal visible={channelPickerOpen} transparent animationType="fade" onRequestClose={() => setChannelPickerOpen(false)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setChannelPickerOpen(false)}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Select channel</Text>
              <ScrollView style={{ maxHeight: H * 0.55 }} showsVerticalScrollIndicator={false}>
                {channels.map((ch) => {
                  const active = ch.id === selectedChannel?.id;
                  return (
                    <TouchableOpacity
                      key={ch.id}
                      style={[styles.pickerRow, active && styles.pickerRowActive]}
                      onPress={() => {
                        setSelectedChannel(ch);
                        setChannelPickerOpen(false);
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.pickerAvatar}>
                        <Image source={d_assets.images.appLogo} style={styles.pickerAvatarImg} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerName, active && { color: COLORS.light.primary }]} numberOfLines={1}>
                          {ch.name || "Channel"}
                        </Text>
                        <Text style={styles.pickerDesc} numberOfLines={1}>
                          {ch.description || "—"}
                        </Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={18} color={COLORS.light.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        {/* OWNER MANAGE CHANNEL */}
        <Modal visible={manageOpen} transparent animationType="slide" onRequestClose={() => setManageOpen(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Manage channel</Text>
                <TouchableOpacity onPress={() => setManageOpen(false)} style={styles.iconBtn} activeOpacity={0.9}>
                  <Ionicons name="close" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
                  <Text style={styles.label}>Channel name</Text>
                  <TextInput value={channelName} onChangeText={setChannelName} placeholder="Name" placeholderTextColor="#94A3B8" style={styles.input} />

                  <Text style={styles.label}>Channel description</Text>
                  <TextInput
                    value={channelDesc}
                    onChangeText={setChannelDesc}
                    placeholder="Description"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { height: 90 }]}
                    multiline
                  />

                  <Text style={styles.label}>Live stream link (m3u8)</Text>
                  <TextInput value={streamLink} onChangeText={setStreamLink} placeholder="https://...m3u8" placeholderTextColor="#94A3B8" style={styles.input} />

                  <TouchableOpacity style={styles.primaryBtn} onPress={saveChannel} activeOpacity={0.92} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>

        {/* CREATE / EDIT MEDIA */}
        <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editingItem ? "Edit" : "Add"} {editKind === "video" ? "Video" : "Podcast"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditOpen(false);
                    resetForm();
                  }}
                  style={styles.iconBtn}
                  activeOpacity={0.9}
                >
                  <Ionicons name="close" size={18} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 }}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput value={fTitle} onChangeText={setFTitle} placeholder="Title" placeholderTextColor="#94A3B8" style={styles.input} />

                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    value={fDesc}
                    onChangeText={setFDesc}
                    placeholder="Description"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, { height: 90 }]}
                    multiline
                  />

                  <Text style={styles.label}>Video link (YouTube OR mp4)</Text>
                  <TextInput value={fLink} onChangeText={setFLink} placeholder="https://youtube.com/... or https://cdn...mp4" placeholderTextColor="#94A3B8" style={styles.input} />

                  {/* Upload actions */}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={uploadVideoFile} activeOpacity={0.92} disabled={saving}>
                      {saving ? <ActivityIndicator color={COLORS.light.primary} /> : <Ionicons name="cloud-upload-outline" size={18} color={COLORS.light.primary} />}
                      <Text style={styles.secondaryText}>Upload video</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryBtn} onPress={uploadThumb} activeOpacity={0.92} disabled={saving}>
                      {saving ? <ActivityIndicator color={COLORS.light.primary} /> : <Ionicons name="image-outline" size={18} color={COLORS.light.primary} />}
                      <Text style={styles.secondaryText}>Upload thumb</Text>
                    </TouchableOpacity>
                  </View>

                  {!!fThumb && (
                    <View style={styles.thumbPreview}>
                      <Image source={{ uri: fThumb }} style={styles.thumbPreviewImg} />
                    </View>
                  )}

                  <Text style={styles.label}>Schedule (optional)</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TextInput value={fDate} onChangeText={setFDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" style={[styles.input, { flex: 1 }]} />
                    <TextInput value={fTime} onChangeText={setFTime} placeholder="HH:mm" placeholderTextColor="#94A3B8" style={[styles.input, { width: 120 }]} />
                  </View>

                  <TouchableOpacity style={styles.primaryBtn} onPress={saveMedia} activeOpacity={0.92} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{editingItem ? "Update" : "Publish"}</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={() => {
                      setEditOpen(false);
                      resetForm();
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.ghostText}>Cancel</Text>
                  </TouchableOpacity>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

/* ================= STYLES (white + teal, YouTube vibe) ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7FB" },
  safe: { flex: 1 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F5F7FB" },
  loadingText: { color: "#64748B", fontWeight: "800" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  appTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  appSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: "#64748B" },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnTeal: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  playerWrap: { backgroundColor: "#fff", paddingHorizontal: 12, paddingTop: 10 },
  playerCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  noLive: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fff" },
  noLiveTitle: { fontWeight: "900", color: "#0F172A" },
  noLiveSub: { fontWeight: "700", color: "#64748B", fontSize: 12 },

  controls: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 12,
    justifyContent: "space-between",
  },
  controlsTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  ctrlIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  controlsMiddle: { alignItems: "center", justifyContent: "center" },
  bigPlay: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: COLORS.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  controlsBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ctrlRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  ctrlRowText: { fontWeight: "900", color: "#0F172A", fontSize: 12 },

  channelInfo: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  channelAvatar: { width: 42, height: 42, borderRadius: 14, overflow: "hidden", backgroundColor: "#F1F5F9" },
  channelAvatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  channelName: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  channelDesc: { marginTop: 2, fontSize: 12, fontWeight: "700", color: "#64748B" },

  ownerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  ownerBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  ownerBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAF7F7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(47,165,169,0.35)",
  },
  ownerBtnTextOutline: { color: COLORS.light.primary, fontWeight: "900", fontSize: 12 },

  tabs: {
    marginTop: 12,
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEF2F7" },
  tabText: { fontWeight: "900", color: "#64748B" },
  tabTextActive: { color: "#0F172A" },

  itemRow: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    padding: 12,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  itemRowUpNext: { borderColor: "rgba(47,165,169,0.45)" },

  thumbBox: { width: 122, height: 78, borderRadius: 14, overflow: "hidden", backgroundColor: "#F1F5F9" },
  thumb: { width: "100%", height: "100%" },
  upNextBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  upNextText: { fontWeight: "900", color: "#0F172A", fontSize: 11 },

  itemTitle: { fontWeight: "900", color: "#0F172A", fontSize: 13.5 },
  itemMeta: { marginTop: 6, fontWeight: "800", color: "#64748B", fontSize: 12 },
  itemDesc: { marginTop: 6, fontWeight: "700", color: "#64748B", fontSize: 12 },

  miniBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 26, gap: 6 },
  emptyTitle: { fontWeight: "900", color: "#0F172A" },
  emptySub: { fontWeight: "700", color: "#64748B", fontSize: 12 },

  /* Picker */
  pickerOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.25)", justifyContent: "flex-start", paddingTop: 90, paddingHorizontal: 12 },
  pickerCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    padding: 12,
  },
  pickerTitle: { fontWeight: "900", color: "#0F172A", marginBottom: 10 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14 },
  pickerRowActive: { backgroundColor: "#EAF7F7" },
  pickerAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F1F5F9", overflow: "hidden" },
  pickerAvatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  pickerName: { fontWeight: "900", color: "#0F172A" },
  pickerDesc: { marginTop: 2, fontWeight: "700", color: "#64748B", fontSize: 12 },

  /* Sheets */
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.25)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, maxHeight: "92%" },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 999, backgroundColor: "#E2E8F0", marginBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontWeight: "900", fontSize: 16, color: "#0F172A" },

  label: { marginTop: 12, marginBottom: 8, fontWeight: "900", color: "#64748B", fontSize: 12 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontWeight: "800", color: "#0F172A" },

  primaryBtn: { marginTop: 16, backgroundColor: COLORS.light.primary, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#EAF7F7",
    borderWidth: 1,
    borderColor: "rgba(47,165,169,0.35)",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: { fontWeight: "900", color: COLORS.light.primary, fontSize: 12 },

  thumbPreview: { marginTop: 10, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#EEF2F7" },
  thumbPreviewImg: { width: "100%", height: 150 },

  ghostBtn: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  ghostText: { color: COLORS.light.primary, fontWeight: "900" },
});

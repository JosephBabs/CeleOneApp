/* eslint-disable react/no-unstable-nested-components */
// AdminMusicAndFilms.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  FlatList,
  ScrollView,
  TextInput,
  Platform,
  Linking,
  Keyboard,
  Pressable,
} from "react-native";

import Modal from "react-native-modal";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation, NavigationProp } from "@react-navigation/native";
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

import * as ImagePicker from "react-native-image-picker";
import { pick, types, isCancel } from "@react-native-documents/picker";

import { ENV } from "../../../../src/config/env";
import { uploadFileToCDN } from "../../../../src/chat/upload";

/* ================= TYPES ================= */

export interface Music {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration?: string;
  coverUrl?: string; // local uri or CDN url
  audioUrl?: string; // CDN url
  description?: string;

  year?: string;
  language?: string;
  country?: string;
  label?: string;
  composers?: string;
  producers?: string;
  explicit?: boolean;
}

export interface Film {
  id: string;
  title: string;
  director: string;
  genre?: string;
  duration?: string;
  coverUrl?: string;
  videoUrl?: string; // CDN url
  description?: string;
  cast?: string;
  rating?: string;

  year?: string;
  language?: string;
  country?: string;
  trailerUrl?: string;
  producers?: string;
  writers?: string;

  // ✅ quality metadata you can store
  videoQuality?: VideoQuality;
}

type ContentType = "music" | "film";

type VideoQuality = "auto" | "240p" | "360p" | "480p" | "720p" | "1080p";

/* ================= COMPONENT ================= */

export default function AdminMusicAndFilms() {
  const navigation = useNavigation<NavigationProp<any>>();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [contentType, setContentType] = useState<ContentType>("music");

  const [musics, setMusics] = useState<Music[]>([]);
  const [films, setFilms] = useState<Film[]>([]);

  const [search, setSearch] = useState("");

  const [editingItem, setEditingItem] = useState<Music | Film | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [newMusic, setNewMusic] = useState<Partial<Music>>({});
  const [newFilm, setNewFilm] = useState<Partial<Film>>({});

  // ✅ prevents keyboard closing while typing + avoids empty space:
  // - do NOT wrap inputs in KeyboardAvoidingView inside modal
  // - use react-native-modal avoidKeyboard
  // - keep sheet height stable and allow scroll
  const sheetScrollRef = useRef<ScrollView | null>(null);

  /* ================= FETCH ================= */

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [musicSnap, filmSnap] = await Promise.all([
        getDocs(collection(db, "songs")),
        getDocs(collection(db, "videos")),
      ]);

      setMusics(musicSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Music)));
      setFilms(filmSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Film)));
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const list = useMemo(
    () => (contentType === "music" ? musics : films),
    [contentType, musics, films]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((item: any) => {
      const t = String(item.title || "").toLowerCase();
      const sub =
        contentType === "music"
          ? String((item as any).artist || "").toLowerCase()
          : String((item as any).director || "").toLowerCase();
      const g = String(item.genre || "").toLowerCase();
      return t.includes(q) || sub.includes(q) || g.includes(q);
    });
  }, [list, search, contentType]);

  /* ================= URL HELPERS ================= */

  const openUrl = async (url?: string) => {
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) return Alert.alert("Error", "Invalid URL");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Failed to open URL");
    }
  };

  /* ================= PICK COVER IMAGE ================= */

  const pickCoverImage = async () => {
    const res = await ImagePicker.launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.85,
    });

    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    const coverUrl = asset.uri;
    if (contentType === "music") setNewMusic((p) => ({ ...p, coverUrl }));
    else setNewFilm((p) => ({ ...p, coverUrl }));
  };

  /* ================= UPLOAD HELPERS ================= */

  const uploadToCDN = async (file: { uri: string; name: string; type: string }) => {
    if (!ENV?.uploadKey) throw new Error("Missing ENV.uploadKey");
    return await uploadFileToCDN(file, ENV.uploadKey);
  };

  /* ================= UPLOAD AUDIO (MUSIC) ================= */

  const pickAndUploadAudio = async () => {
    try {
      const res = await pick({
        allowMultiSelection: false,
        type: [types.audio, types.allFiles],
      });

      const f = res?.[0];
      if (!f?.uri) return;

      setBusy(true);
      const url = await uploadToCDN({
        uri: f.uri,
        name: f.name ?? `audio_${Date.now()}.mp3`,
        type: f.type ?? "audio/mpeg",
      });

      setNewMusic((p) => ({ ...p, audioUrl: url }));
      Alert.alert("Uploaded", "Audio uploaded successfully");
    } catch (e: any) {
      if (isCancel(e)) return;
      Alert.alert("Upload error", e?.message || "Failed to upload audio");
    } finally {
      setBusy(false);
    }
  };

  /* ================= UPLOAD VIDEO (FILMS) ================= */

  const pickAndUploadVideo = async () => {
    try {
      const res = await pick({
        allowMultiSelection: false,
        type: [types.video, types.allFiles],
      });

      const f = res?.[0];
      if (!f?.uri) return;

      setBusy(true);
      const url = await uploadToCDN({
        uri: f.uri,
        name: f.name ?? `video_${Date.now()}.mp4`,
        type: f.type ?? "video/mp4",
      });

      setNewFilm((p) => ({ ...p, videoUrl: url }));
      Alert.alert("Uploaded", "Video uploaded successfully");
    } catch (e: any) {
      if (isCancel(e)) return;
      Alert.alert("Upload error", e?.message || "Failed to upload video");
    } finally {
      setBusy(false);
    }
  };

  /* ================= CREATE ================= */

  const openCreate = () => {
    Keyboard.dismiss();
    setEditingItem(null);
    if (contentType === "music") setNewMusic({});
    else setNewFilm({ videoQuality: "auto" });
    setCreateOpen(true);
  };

  const createMusic = async () => {
    if (!newMusic.title?.trim() || !newMusic.artist?.trim()) {
      Alert.alert("Validation", "Title and Artist required");
      return;
    }
    try {
      setBusy(true);
      await addDoc(collection(db, "songs"), {
        ...newMusic,
        title: newMusic.title.trim(),
        artist: newMusic.artist.trim(),
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreateOpen(false);
      setNewMusic({});
      fetchData();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to create music");
    } finally {
      setBusy(false);
    }
  };

  const createFilm = async () => {
    if (!newFilm.title?.trim() || !newFilm.director?.trim()) {
      Alert.alert("Validation", "Title and Director required");
      return;
    }
    if (!newFilm.videoUrl?.trim()) {
      Alert.alert("Validation", "Please upload a video (or paste a video URL)");
      return;
    }
    try {
      setBusy(true);
      await addDoc(collection(db, "videos"), {
        ...newFilm,
        title: newFilm.title.trim(),
        director: newFilm.director.trim(),
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setCreateOpen(false);
      setNewFilm({ videoQuality: "auto" });
      fetchData();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to create film");
    } finally {
      setBusy(false);
    }
  };

  /* ================= UPDATE ================= */

  const openEdit = (item: Music | Film) => {
    Keyboard.dismiss();
    setEditingItem(item);
    const isMusic = "artist" in item;
    setContentType(isMusic ? "music" : "film");
    if (isMusic) setNewMusic({ ...(item as Music) });
    else setNewFilm({ videoQuality: "auto", ...(item as Film) });
    setEditOpen(true);
  };

  const updateItem = async () => {
    if (!editingItem) return;

    try {
      setBusy(true);

      const isMusic = "artist" in editingItem;
      const ref = isMusic ? doc(db, "songs", editingItem.id) : doc(db, "videos", editingItem.id);

      await updateDoc(ref, {
        ...(isMusic ? newMusic : newFilm),
        updatedAt: serverTimestamp(),
      });

      setEditingItem(null);
      setEditOpen(false);
      fetchData();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  /* ================= DELETE ================= */

  const deleteItem = async (type: "songs" | "videos", id: string) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            await deleteDoc(doc(db, type, id));
            fetchData();
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to delete");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /* ================= RENDER ITEM ================= */

  const renderItem = ({ item }: { item: Music | Film }) => {
    const isMusic = "artist" in item;
    const sub = isMusic ? (item as Music).artist : (item as Film).director;
    const url = isMusic ? (item as Music).audioUrl : (item as Film).videoUrl;

    return (
      <TouchableOpacity activeOpacity={0.92} onPress={() => openEdit(item)} style={styles.card}>
        <View style={styles.coverWrap}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.cover} />
          ) : (
            <View style={styles.coverFallback}>
              <Ionicons name={isMusic ? "musical-notes-outline" : "film-outline"} size={22} color="#6B6B70" />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{isMusic ? "MUSIC" : "FILM"}</Text>
            </View>
          </View>

          <Text style={styles.desc} numberOfLines={1}>{sub || "—"}</Text>

          <View style={styles.chipsRow}>
            {!!(item as any).genre && (
              <View style={styles.chip}>
                <Ionicons name="pricetag-outline" size={14} color="#6B6B70" />
                <Text style={styles.chipText}>{(item as any).genre}</Text>
              </View>
            )}
            {!!(item as any).duration && (
              <View style={styles.chip}>
                <Ionicons name="time-outline" size={14} color="#6B6B70" />
                <Text style={styles.chipText}>{(item as any).duration}</Text>
              </View>
            )}
            {!!(item as any).year && (
              <View style={styles.chip}>
                <Ionicons name="calendar-outline" size={14} color="#6B6B70" />
                <Text style={styles.chipText}>{(item as any).year}</Text>
              </View>
            )}
            {!isMusic && !!(item as any).videoQuality && (
              <View style={styles.chip}>
                <Ionicons name="videocam-outline" size={14} color="#6B6B70" />
                <Text style={styles.chipText}>{(item as any).videoQuality}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          {!!url && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => openUrl(url)}>
              <Ionicons name="open-outline" size={18} color="#111" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "rgba(239,68,68,0.12)" }]}
            onPress={() => deleteItem(isMusic ? "songs" : "videos", item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /* ================= SHEET FORM (NO KeyboardAvoidingView) ================= */

  const SheetForm = ({ mode }: { mode: "create" | "edit" }) => {
    const isMusic = contentType === "music";
    const data = isMusic ? newMusic : newFilm;

    const close = () => {
      if (busy) return;
      Keyboard.dismiss();
      if (mode === "create") setCreateOpen(false);
      else setEditOpen(false);
    };

    const setVideoQuality = (q: VideoQuality) => setNewFilm((p) => ({ ...p, videoQuality: q }));

    return (
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>
              {mode === "create" ? (isMusic ? "Add Music" : "Add Film") : isMusic ? "Edit Music" : "Edit Film"}
            </Text>
            <Text style={styles.sheetSub}>Fill the fields and save</Text>
          </View>

          <TouchableOpacity onPress={close} disabled={busy} style={styles.sheetClose}>
            <Ionicons name="close" size={18} color="#111" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={(r) => (sheetScrollRef.current = r)}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 22 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          {/* Tap outside inputs to dismiss keyboard (but do NOT close modal) */}
          <Pressable onPress={Keyboard.dismiss}>
            {/* Cover */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickCoverImage} activeOpacity={0.9} disabled={busy}>
              {data.coverUrl ? (
                <Image source={{ uri: data.coverUrl }} style={styles.coverImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={36} color="#999" />
                  <Text style={styles.imagePlaceholderText}>Tap to select cover image</Text>
                  <Text style={styles.imageHint}>Tip: upload cover to CDN later if needed</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <Field label="Title *">
              <TextInput
                style={styles.input}
                placeholder={isMusic ? "Enter music title" : "Enter film title"}
                placeholderTextColor="#8C8C8F"
                value={(data.title as any) || ""}
                onChangeText={(v) => (isMusic ? setNewMusic((p) => ({ ...p, title: v })) : setNewFilm((p) => ({ ...p, title: v })))}
                returnKeyType="next"
              />
            </Field>

            {isMusic ? (
              <>
                <Field label="Artist *">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter artist name"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.artist as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, artist: v }))}
                  />
                </Field>

                <Field label="Album">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter album name"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.album as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, album: v }))}
                  />
                </Field>

                <Field label="Genre">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter genre"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.genre as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, genre: v }))}
                  />
                </Field>

                <Field label="Duration">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 3:45"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.duration as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, duration: v }))}
                  />
                </Field>

                <Field label="Audio (upload to CDN)">
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.uploadBtn, busy && { opacity: 0.7 }]}
                      onPress={pickAndUploadAudio}
                      disabled={busy}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="cloud-upload-outline" size={18} color="#111" />
                      <Text style={styles.uploadBtnText}>{newMusic.audioUrl ? "Replace audio" : "Upload audio"}</Text>
                    </TouchableOpacity>

                    {!!newMusic.audioUrl && (
                      <TouchableOpacity style={styles.openBtn} onPress={() => openUrl(newMusic.audioUrl)} activeOpacity={0.9}>
                        <Ionicons name="open-outline" size={18} color="#111" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {!!newMusic.audioUrl && (
                    <Text style={styles.smallHint} numberOfLines={2}>
                      {newMusic.audioUrl}
                    </Text>
                  )}
                </Field>

                <Field label="Year">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 2026"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.year as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, year: v }))}
                    keyboardType="number-pad"
                  />
                </Field>

                <Field label="Language">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., English"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.language as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, language: v }))}
                  />
                </Field>

                <Field label="Country">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Benin"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.country as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, country: v }))}
                  />
                </Field>

                <Field label="Label">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Independent"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.label as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, label: v }))}
                  />
                </Field>

                <Field label="Producers">
                  <TextInput
                    style={styles.input}
                    placeholder="Comma separated"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.producers as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, producers: v }))}
                  />
                </Field>

                <Field label="Composers">
                  <TextInput
                    style={styles.input}
                    placeholder="Comma separated"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.composers as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, composers: v }))}
                  />
                </Field>

                <Field label="Description">
                  <TextInput
                    style={styles.textarea}
                    placeholder="Enter description"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.description as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, description: v }))}
                    multiline
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Director *">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter director name"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.director as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, director: v }))}
                  />
                </Field>

                <Field label="Genre">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter genre"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.genre as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, genre: v }))}
                  />
                </Field>

                <Field label="Duration">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 2h 15m"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.duration as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, duration: v }))}
                  />
                </Field>

                {/* ✅ Video Upload + URL */}
                <Field label="Video (upload to CDN)">
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.uploadBtn, busy && { opacity: 0.7 }]}
                      onPress={pickAndUploadVideo}
                      disabled={busy}
                      activeOpacity={0.9}
                    >
                      <Ionicons name="cloud-upload-outline" size={18} color="#111" />
                      <Text style={styles.uploadBtnText}>{newFilm.videoUrl ? "Replace video" : "Upload video"}</Text>
                    </TouchableOpacity>

                    {!!newFilm.videoUrl && (
                      <TouchableOpacity style={styles.openBtn} onPress={() => openUrl(newFilm.videoUrl)} activeOpacity={0.9}>
                        <Ionicons name="open-outline" size={18} color="#111" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {!!newFilm.videoUrl && (
                    <Text style={styles.smallHint} numberOfLines={2}>
                      {newFilm.videoUrl}
                    </Text>
                  )}

                  <View style={styles.divider} />

                  <Text style={styles.microLabel}>Or paste video URL</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.videoUrl as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, videoUrl: v }))}
                    autoCapitalize="none"
                  />
                </Field>

                {/* ✅ Video Quality (metadata selection) */}
                <Field label="Video Quality">
                  <View style={styles.qualityRow}>
                    {(["auto", "240p", "360p", "480p", "720p", "1080p"] as VideoQuality[]).map((q) => {
                      const on = (newFilm.videoQuality || "auto") === q;
                      return (
                        <TouchableOpacity
                          key={q}
                          activeOpacity={0.9}
                          onPress={() => setVideoQuality(q)}
                          style={[styles.qPill, on && styles.qPillOn]}
                        >
                          <Text style={[styles.qPillText, on && styles.qPillTextOn]}>{q.toUpperCase()}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.smallHint}>
                    This stores selected quality as metadata. (Actual transcoding needs server-side processing.)
                  </Text>
                </Field>

                <Field label="Trailer URL">
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.trailerUrl as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, trailerUrl: v }))}
                    autoCapitalize="none"
                  />
                </Field>

                <Field label="Cast">
                  <TextInput
                    style={styles.input}
                    placeholder="Comma separated"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.cast as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, cast: v }))}
                  />
                </Field>

                <Field label="Rating">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., PG-13, R"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.rating as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, rating: v }))}
                  />
                </Field>

                <Field label="Year">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 2026"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.year as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, year: v }))}
                    keyboardType="number-pad"
                  />
                </Field>

                <Field label="Language">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., French"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.language as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, language: v }))}
                  />
                </Field>

                <Field label="Country">
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Nigeria"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.country as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, country: v }))}
                  />
                </Field>

                <Field label="Writers">
                  <TextInput
                    style={styles.input}
                    placeholder="Comma separated"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.writers as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, writers: v }))}
                  />
                </Field>

                <Field label="Producers">
                  <TextInput
                    style={styles.input}
                    placeholder="Comma separated"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.producers as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, producers: v }))}
                  />
                </Field>

                <Field label="Description">
                  <TextInput
                    style={styles.textarea}
                    placeholder="Enter description"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.description as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, description: v }))}
                    multiline
                  />
                </Field>
              </>
            )}
          </Pressable>

          <View style={styles.sheetBtns}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: "#F2F3F5" }]}
              onPress={close}
              disabled={busy}
            >
              <Text style={[styles.btnText, { color: "#444" }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: COLORS.light.primary }, busy && { opacity: 0.7 }]}
              onPress={mode === "create" ? (isMusic ? createMusic : createFilm) : updateItem}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: "#fff" }]}>{mode === "create" ? "Save" : "Update"}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  function Field({ label, children }: { label: string; children: any }) {
    return (
      <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
        <Text style={styles.label}>{label}</Text>
        {children}
      </View>
    );
  }

  /* ================= UI ================= */

  const Hero = () => (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Music & Films</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {filtered.length} items · manage content
          </Text>
        </View>

        <TouchableOpacity style={styles.createPill} onPress={openCreate} activeOpacity={0.9}>
          <Ionicons name="add" size={18} color="#0E0E10" />
          <Text style={styles.createPillText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.75)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search title, artist/director, genre…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.searchInput}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} style={styles.clearBtn}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, contentType === "music" && styles.tabOn]}
          onPress={() => setContentType("music")}
          activeOpacity={0.9}
        >
          <Ionicons name="musical-notes-outline" size={16} color={contentType === "music" ? "#111" : "rgba(255,255,255,0.85)"} />
          <Text style={[styles.tabText, contentType === "music" && styles.tabTextOn]}>Music</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, contentType === "film" && styles.tabOn]}
          onPress={() => setContentType("film")}
          activeOpacity={0.9}
        >
          <Ionicons name="film-outline" size={16} color={contentType === "film" ? "#111" : "rgba(255,255,255,0.85)"} />
          <Text style={[styles.tabText, contentType === "film" && styles.tabTextOn]}>Films</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <Hero />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name={contentType === "music" ? "musical-notes-outline" : "film-outline"} size={34} color="#111" />
              </View>
              <Text style={styles.emptyTitle}>{contentType === "music" ? "No music added yet" : "No films added yet"}</Text>
              <Text style={styles.emptySub}>Tap “Create” to add new content.</Text>
            </View>
          }
        />
      )}

      {/* ✅ Create Sheet (NO KeyboardAvoidingView; avoidKeyboard handled by Modal) */}
      <Modal
        isVisible={createOpen}
        onBackdropPress={() => !busy && (Keyboard.dismiss(), setCreateOpen(false))}
        onBackButtonPress={() => !busy && (Keyboard.dismiss(), setCreateOpen(false))}
        style={styles.sheetModal}
        backdropOpacity={0.45}
        useNativeDriver
        hideModalContentWhileAnimating
        avoidKeyboard
        propagateSwipe
      >
        <SheetForm mode="create" />
      </Modal>

      {/* ✅ Edit Sheet */}
      <Modal
        isVisible={editOpen}
        onBackdropPress={() => !busy && (Keyboard.dismiss(), setEditOpen(false))}
        onBackButtonPress={() => !busy && (Keyboard.dismiss(), setEditOpen(false))}
        style={styles.sheetModal}
        backdropOpacity={0.45}
        useNativeDriver
        hideModalContentWhileAnimating
        avoidKeyboard
        propagateSwipe
      >
        <SheetForm mode="edit" />
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#0E0E10",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroSub: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 12.5 },

  createPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  createPillText: { fontWeight: "900", color: "#0E0E10", fontSize: 13 },

  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: "#fff", fontWeight: "800" },
  clearBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },

  tabs: {
    marginTop: 12,
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 6,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 14,
  },
  tabOn: { backgroundColor: "#fff" },
  tabText: { color: "rgba(255,255,255,0.85)", fontWeight: "900" },
  tabTextOn: { color: "#111" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  coverWrap: { width: 56, height: 70, borderRadius: 18, overflow: "hidden", backgroundColor: "#F2F3F5" },
  cover: { width: "100%", height: "100%" },
  coverFallback: { flex: 1, alignItems: "center", justifyContent: "center" },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontSize: 15.5, fontWeight: "900", color: "#111" },
  desc: { marginTop: 4, fontSize: 12.5, fontWeight: "800", color: "#6B6B70" },

  typePill: { backgroundColor: "rgba(47,165,169,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  typePillText: { fontSize: 11, fontWeight: "900", color: COLORS.light.primary },

  chipsRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "#F6F7F9", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  chipText: { fontWeight: "800", color: "#6B6B70", fontSize: 12 },

  actions: { flexDirection: "row", gap: 10, marginLeft: 6 },
  iconBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },

  empty: { paddingTop: 60, alignItems: "center", paddingHorizontal: 24 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 14, fontWeight: "900", fontSize: 16, color: "#111" },
  emptySub: { marginTop: 6, fontWeight: "700", color: "#6B6B70", textAlign: "center" },

  sheetModal: { margin: 0, justifyContent: "flex-end" },

  // ✅ important: stable height + no KeyboardAvoidingView = no empty space & keyboard won't collapse
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    height: "92%",
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEFF2",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  sheetSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
  sheetClose: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },

  label: { fontSize: 13, fontWeight: "900", color: "#111", marginBottom: 8 },
  microLabel: { fontSize: 12, fontWeight: "900", color: "#111", marginBottom: 8, marginTop: 8 },

  input: {
    backgroundColor: "#F6F7F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "800",
    color: "#111",
  },
  textarea: {
    backgroundColor: "#F6F7F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "800",
    color: "#111",
    minHeight: 110,
    textAlignVertical: "top",
  },

  imagePicker: {
    marginTop: 14,
    marginHorizontal: 16,
    height: 190,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F6F7F9",
    alignItems: "center",
    justifyContent: "center",
  },
  coverImage: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  imagePlaceholderText: { marginTop: 10, fontWeight: "900", color: "#666", textAlign: "center" },
  imageHint: { marginTop: 6, fontWeight: "700", color: "#999", textAlign: "center", fontSize: 12 },

  uploadBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F6F7F9",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadBtnText: { fontWeight: "900", color: "#111" },

  openBtn: {
    width: 54,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F6F7F9",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    alignItems: "center",
    justifyContent: "center",
  },

  smallHint: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: "800",
    color: "#6B6B70",
  },

  divider: { height: 1, backgroundColor: "#EEF0F3", marginVertical: 10 },

  // quality pills
  qualityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F6F7F9",
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  qPillOn: {
    backgroundColor: "rgba(47,165,169,0.12)",
    borderColor: "rgba(47,165,169,0.35)",
  },
  qPillText: { fontWeight: "900", fontSize: 12, color: "#111" },
  qPillTextOn: { color: COLORS.light.primary },

  sheetBtns: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "900", fontSize: 14 },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  KeyboardAvoidingView,
  Platform,
  Linking,
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

/* ================= TYPES ================= */

export interface Music {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration?: string;
  coverUrl?: string;
  audioUrl?: string;
  description?: string;
}

export interface Film {
  id: string;
  title: string;
  director: string;
  genre?: string;
  duration?: string;
  coverUrl?: string;
  videoUrl?: string;
  description?: string;
  cast?: string;
  rating?: string;
}

type ContentType = "music" | "film";

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

  const list = useMemo(() => (contentType === "music" ? musics : films), [contentType, musics, films]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((item: any) => {
      const t = String(item.title || "").toLowerCase();
      const sub = contentType === "music" ? String((item as any).artist || "").toLowerCase() : String((item as any).director || "").toLowerCase();
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

  /* ================= IMAGE PICKER ================= */

  const pickImage = async (isEdit: boolean) => {
    const res = await ImagePicker.launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.85,
    });

    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    // NOTE: This returns local URI. If you want a permanent URL,
    // upload to Firebase Storage then save the download URL.
    const coverUrl = asset.uri;

    if (contentType === "music") {
      if (isEdit) setNewMusic((p) => ({ ...p, coverUrl }));
      else setNewMusic((p) => ({ ...p, coverUrl }));
    } else {
      if (isEdit) setNewFilm((p) => ({ ...p, coverUrl }));
      else setNewFilm((p) => ({ ...p, coverUrl }));
    }
  };

  /* ================= CREATE ================= */

  const openCreate = () => {
    setEditingItem(null);
    if (contentType === "music") setNewMusic({});
    else setNewFilm({});
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
    try {
      setBusy(true);
      await addDoc(collection(db, "videos"), {
        ...newFilm,
        title: newFilm.title.trim(),
        director: newFilm.director.trim(),
        createdBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });
      setCreateOpen(false);
      setNewFilm({});
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
    setEditingItem(item);
    const isMusic = "artist" in item;
    setContentType(isMusic ? "music" : "film");
    if (isMusic) setNewMusic(item);
    else setNewFilm(item);
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
    const sub = "artist" in item ? item.artist : item.director;
    const url = "artist" in item ? item.audioUrl : item.videoUrl;

    return (
      <TouchableOpacity activeOpacity={0.92} onPress={() => openEdit(item)} style={styles.card}>
        {/* cover */}
        <View style={styles.coverWrap}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.cover} />
          ) : (
            <View style={styles.coverFallback}>
              <Ionicons name={contentType === "music" ? "musical-notes-outline" : "film-outline"} size={22} color="#6B6B70" />
            </View>
          )}
        </View>

        {/* body */}
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{contentType === "music" ? "MUSIC" : "FILM"}</Text>
            </View>
          </View>

          <Text style={styles.desc} numberOfLines={1}>
            {sub || "—"}
          </Text>

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
          </View>
        </View>

        {/* actions */}
        <View style={styles.actions}>
          {!!url && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => openUrl(url)}>
              <Ionicons name="open-outline" size={18} color="#111" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: "rgba(239,68,68,0.12)" }]}
            onPress={() => deleteItem("artist" in item ? "songs" : "videos", item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /* ================= SHEET FORM ================= */

  const SheetForm = ({ mode }: { mode: "create" | "edit" }) => {
    const isMusic = contentType === "music";
    const data = isMusic ? newMusic : newFilm;

    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{mode === "create" ? (isMusic ? "Add Music" : "Add Film") : isMusic ? "Edit Music" : "Edit Film"}</Text>
              <Text style={styles.sheetSub}>Fill the fields and save</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (mode === "create") setCreateOpen(false);
                else setEditOpen(false);
              }}
              disabled={busy}
              style={styles.sheetClose}
            >
              <Ionicons name="close" size={18} color="#111" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            {/* Cover */}
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(mode === "edit")} activeOpacity={0.9}>
              {data.coverUrl ? (
                <Image source={{ uri: data.coverUrl }} style={styles.coverImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={36} color="#999" />
                  <Text style={styles.imagePlaceholderText}>Tap to select cover image</Text>
                  <Text style={styles.imageHint}>Local URI (upload to Storage later for permanent URL)</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Common */}
            <Field label="Title *">
              <TextInput
                style={styles.input}
                placeholder={isMusic ? "Enter music title" : "Enter film title"}
                placeholderTextColor="#8C8C8F"
                value={(data.title as any) || ""}
                onChangeText={(v) => (isMusic ? setNewMusic((p) => ({ ...p, title: v })) : setNewFilm((p) => ({ ...p, title: v })))}
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

                <Field label="Audio URL">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter audio URL"
                    placeholderTextColor="#8C8C8F"
                    value={(newMusic.audioUrl as any) || ""}
                    onChangeText={(v) => setNewMusic((p) => ({ ...p, audioUrl: v }))}
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

                <Field label="Video URL">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter video URL"
                    placeholderTextColor="#8C8C8F"
                    value={(newFilm.videoUrl as any) || ""}
                    onChangeText={(v) => setNewFilm((p) => ({ ...p, videoUrl: v }))}
                  />
                </Field>

                <Field label="Cast">
                  <TextInput
                    style={styles.input}
                    placeholder="Enter cast members"
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

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#F2F3F5" }]}
                onPress={() => {
                  if (busy) return;
                  if (mode === "create") setCreateOpen(false);
                  else setEditOpen(false);
                }}
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
      </KeyboardAvoidingView>
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

      {/* Create Sheet */}
      <Modal isVisible={createOpen} onBackdropPress={() => !busy && setCreateOpen(false)} style={{ margin: 0, justifyContent: "flex-end" }}>
        <SheetForm mode="create" />
      </Modal>

      {/* Edit Sheet */}
      <Modal isVisible={editOpen} onBackdropPress={() => !busy && setEditOpen(false)} style={{ margin: 0, justifyContent: "flex-end" }}>
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

  // Sheets
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", overflow: "hidden" },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEFF2",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  sheetSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
  sheetClose: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F2F3F5", alignItems: "center", justifyContent: "center" },

  label: { fontSize: 13, fontWeight: "900", color: "#111", marginBottom: 8 },

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

  sheetBtns: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "900", fontSize: 14 },
});

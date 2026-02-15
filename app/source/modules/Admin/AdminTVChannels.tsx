// AdminTVChannels.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { db } from "../auth/firebaseConfig";
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

/* ================= CDN CONFIG ================= */
// Your upload API endpoint (Express on VPS proxied via Nginx)
const CDN_UPLOAD_API = "https://cdn.celeonetv.com/api/uploads/posts";
// Files are served here (nginx static)
const CDN_PUBLIC_BASE = "https://cdn.celeonetv.com/uploads/posts/";

/* ================= TYPES ================= */
type Mode = "create" | "edit" | "manage" | null;
type Tab = "programs" | "podcasts";

/* ================= MAIN ================= */
export default function AdminTVChannels({ navigation }: any) {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [mode, setMode] = useState<Mode>(null);

  // Channel form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [streamLink, setStreamLink] = useState("");
  const [channelLogo, setChannelLogo] = useState<string>(""); // optional thumbnail/logo URL

  // Manage tab
  const [tab, setTab] = useState<Tab>("programs");

  // Lists
  const [programs, setPrograms] = useState<any[]>([]);
  const [podcasts, setPodcasts] = useState<any[]>([]);

  // Program form
  const [programTitle, setProgramTitle] = useState("");
  const [programThumb, setProgramThumb] = useState(""); // URL
  const [programCategory, setProgramCategory] = useState("");

  // Podcast form
  const [podcastTitle, setPodcastTitle] = useState("");
  const [podcastLink, setPodcastLink] = useState("");
  const [podcastThumb, setPodcastThumb] = useState(""); // URL
  const [podcastCategory, setPodcastCategory] = useState("");

  const [busy, setBusy] = useState(false);

  /* ================= FETCH ================= */
  const fetchChannels = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "channels"));
      setChannels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load channels");
    } finally {
      setLoading(false);
    }
  };

  const fetchProgramsAndPodcasts = async (channelId: string) => {
    try {
      const [programsSnap, podcastsSnap] = await Promise.all([
        getDocs(collection(db, "channels", channelId, "programs")),
        getDocs(collection(db, "channels", channelId, "podcasts")),
      ]);

      setPrograms(programsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPodcasts(podcastsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load programs/podcasts");
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  /* ================= CDN UPLOAD (RN -> VPS) ================= */
  const uploadToCDN = async (imageUri: string) => {
    // Important: for iOS remove file://
    const uri = Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri;

    const form = new FormData();
    form.append("file", {
      uri,
      type: "image/jpeg",
      name: `upload_${Date.now()}.jpg`,
    } as any);

    const res = await fetch(CDN_UPLOAD_API, {
      method: "POST",
      body: form,
      // No token (as you requested)
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // If server returned HTML error, show it
      throw new Error(`Upload failed (${res.status}): ${text.slice(0, 120)}...`);
    }

    if (!res.ok) {
      throw new Error(json?.error || `Upload failed (${res.status})`);
    }

    // { url, filename }
    if (!json?.url) {
      // fallback if your API returns only filename
      if (json?.filename) return `${CDN_PUBLIC_BASE}${json.filename}`;
      throw new Error("Upload failed: missing url");
    }

    return json.url as string;
  };

  const pickAndUpload = async (target: "channel" | "program" | "podcast") => {
    if (busy) return;

    const result = await ImagePicker.launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.85,
    });

    if (result.didCancel) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;

    try {
      setBusy(true);
      const url = await uploadToCDN(uri);

      if (target === "channel") setChannelLogo(url);
      if (target === "program") setProgramThumb(url);
      if (target === "podcast") setPodcastThumb(url);

      Alert.alert("Uploaded", "Image uploaded successfully");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Upload Error", e?.message || "Failed to upload image");
    } finally {
      setBusy(false);
    }
  };

  /* ================= CRUD ================= */
  const resetAll = () => {
    setMode(null);
    setSelectedChannel(null);

    setName("");
    setDescription("");
    setStreamLink("");
    setChannelLogo("");

    setPrograms([]);
    setPodcasts([]);

    setProgramTitle("");
    setProgramThumb("");
    setProgramCategory("");

    setPodcastTitle("");
    setPodcastLink("");
    setPodcastThumb("");
    setPodcastCategory("");

    setTab("programs");
  };

  const openCreate = () => {
    resetAll();
    setMode("create");
  };

  const openEdit = (item: any) => {
    setSelectedChannel(item);
    setName(item.name || "");
    setDescription(item.description || "");
    setStreamLink(item.streamLink || "");
    setChannelLogo(item.logo || item.thumbnail || item.image || "");
    setMode("edit");
  };

  const openManage = async (item: any) => {
    setSelectedChannel(item);
    setTab("programs");
    setMode("manage");
    await fetchProgramsAndPodcasts(item.id);
  };

  const createChannel = async () => {
    if (busy) return;
    if (!name.trim()) return Alert.alert("Validation", "Channel name is required");

    try {
      setBusy(true);
      await addDoc(collection(db, "channels"), {
        name: name.trim(),
        description: description?.trim() || "",
        streamLink: streamLink?.trim() || "",
        logo: channelLogo || "",
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Channel created");
      resetAll();
      fetchChannels();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to create channel");
    } finally {
      setBusy(false);
    }
  };

  const updateChannel = async () => {
    if (busy) return;
    if (!selectedChannel) return;
    if (!name.trim()) return Alert.alert("Validation", "Channel name is required");

    try {
      setBusy(true);
      await updateDoc(doc(db, "channels", selectedChannel.id), {
        name: name.trim(),
        description: description?.trim() || "",
        streamLink: streamLink?.trim() || "",
        logo: channelLogo || "",
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Channel updated");
      resetAll();
      fetchChannels();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update channel");
    } finally {
      setBusy(false);
    }
  };

  const deleteChannel = async (id: string) => {
    Alert.alert("Delete channel?", "This cannot be undone.", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            await deleteDoc(doc(db, "channels", id));
            fetchChannels();
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to delete channel");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /* ================= PROGRAM / PODCAST ================= */
  const addProgram = async () => {
    if (!selectedChannel) return;
    if (!programTitle.trim()) return Alert.alert("Validation", "Program title is required");

    try {
      setBusy(true);
      await addDoc(collection(db, "channels", selectedChannel.id, "programs"), {
        title: programTitle.trim(),
        thumbnail: programThumb || "",
        category: programCategory?.trim() || "",
        createdAt: serverTimestamp(),
      });

      setProgramTitle("");
      setProgramThumb("");
      setProgramCategory("");

      await fetchProgramsAndPodcasts(selectedChannel.id);
      Alert.alert("Success", "Program added");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to add program");
    } finally {
      setBusy(false);
    }
  };

  const addPodcast = async () => {
    if (!selectedChannel) return;
    if (!podcastTitle.trim()) return Alert.alert("Validation", "Podcast title is required");
    if (!podcastLink.trim()) return Alert.alert("Validation", "Video link is required");

    try {
      setBusy(true);
      await addDoc(collection(db, "channels", selectedChannel.id, "podcasts"), {
        title: podcastTitle.trim(),
        link: podcastLink.trim(),
        thumbnail: podcastThumb || "",
        category: podcastCategory?.trim() || "",
        createdAt: serverTimestamp(),
      });

      setPodcastTitle("");
      setPodcastLink("");
      setPodcastThumb("");
      setPodcastCategory("");

      await fetchProgramsAndPodcasts(selectedChannel.id);
      Alert.alert("Success", "Podcast added");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to add podcast");
    } finally {
      setBusy(false);
    }
  };

  /* ================= UI HELPERS ================= */
  const statsText = useMemo(() => {
    return `${channels.length} channels`;
  }, [channels.length]);

  const renderChannel = ({ item }: any) => (
    <TouchableOpacity style={styles.card} onPress={() => openManage(item)} activeOpacity={0.92}>
      <View style={styles.cardLeft}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Icon name="tv-outline" size={18} color={COLORS.light.primary} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.rowBetween}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>CHANNEL</Text>
          </View>
        </View>

        <Text style={styles.desc} numberOfLines={2}>
          {item.description || "No description"}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            {item.streamLink ? "Live link set" : "No stream link"}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.smallBtn} onPress={() => openEdit(item)}>
            <Icon name="create-outline" size={16} color="#111" />
            <Text style={styles.smallBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.smallBtn, styles.dangerBtn]} onPress={() => deleteChannel(item.id)}>
            <Icon name="trash-outline" size={16} color="#fff" />
            <Text style={[styles.smallBtnText, { color: "#fff" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  /* ================= MODAL CONTENT ================= */
  const closeModal = () => resetAll();

  const ModalHeader = ({ title }: { title: string }) => (
    <View style={styles.modalHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.modalTitle}>{title}</Text>
        <Text style={styles.modalSub}>
          {mode === "manage"
            ? `${programs.length} programs · ${podcasts.length} podcasts`
            : "Fill the details then save"}
        </Text>
      </View>

      <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
        <Icon name="close" size={18} color="#111" />
      </TouchableOpacity>
    </View>
  );

  const Divider = () => <View style={styles.divider} />;

  /* ================= UI ================= */
  return (
    <View style={styles.screen}>
      {/* ===== HERO HEADER ===== */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>TV Channels</Text>
            <Text style={styles.heroSub}>{statsText} · manage live & content</Text>
          </View>

          <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
            <Icon name="add" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== LIST ===== */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={channels}
          renderItem={renderChannel}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="tv-outline" size={54} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No channels yet</Text>
              <Text style={styles.emptySub}>Create your first TV channel.</Text>
              <TouchableOpacity onPress={openCreate} style={styles.primaryBtn}>
                <Text style={styles.primaryText}>Create Channel</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ===== PREMIUM MODAL (BOTTOM SHEET) ===== */}
      <Modal visible={!!mode} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* ===== CREATE / EDIT ===== */}
                {(mode === "create" || mode === "edit") && (
                  <>
                    <ModalHeader title={mode === "create" ? "Create Channel" : "Edit Channel"} />

                    <TouchableOpacity
                      style={styles.uploadCard}
                      activeOpacity={0.9}
                      onPress={() => pickAndUpload("channel")}
                      disabled={busy}
                    >
                      {channelLogo ? (
                        <Image source={{ uri: channelLogo }} style={styles.uploadImage} />
                      ) : (
                        <View style={styles.uploadPlaceholder}>
                          <Icon name="image-outline" size={26} color="#9CA3AF" />
                          <Text style={styles.uploadText}>
                            Tap to upload channel logo / thumbnail
                          </Text>
                          <Text style={styles.uploadHint}>
                            Saved as CDN link and stored in Firestore
                          </Text>
                        </View>
                      )}

                      {busy && (
                        <View style={styles.uploadBusy}>
                          <ActivityIndicator color="#fff" />
                          <Text style={styles.uploadBusyText}>Uploading...</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <Input label="Channel name *" value={name} onChangeText={setName} placeholder="e.g. Cèlè One" />
                    <Input label="Description" value={description} onChangeText={setDescription} placeholder="Short description" multiline />
                    <Input label="Stream link" value={streamLink} onChangeText={setStreamLink} placeholder="https://live.../hls/KEY.m3u8" />

                    <TouchableOpacity
                      style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                      onPress={mode === "create" ? createChannel : updateChannel}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === "create" ? "Create" : "Update"}</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkBtn} onPress={closeModal}>
                      <Text style={styles.linkText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* ===== MANAGE ===== */}
                {mode === "manage" && (
                  <>
                    <ModalHeader title={selectedChannel?.name || "Manage Channel"} />

                    <View style={styles.pillTabs}>
                      <TouchableOpacity
                        style={[styles.pill, tab === "programs" && styles.pillActive]}
                        onPress={() => setTab("programs")}
                      >
                        <Text style={[styles.pillText, tab === "programs" && styles.pillTextActive]}>
                          Programs
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.pill, tab === "podcasts" && styles.pillActive]}
                        onPress={() => setTab("podcasts")}
                      >
                        <Text style={[styles.pillText, tab === "podcasts" && styles.pillTextActive]}>
                          Podcasts
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Divider />

                    {/* ===== PROGRAMS ===== */}
                    {tab === "programs" && (
                      <>
                        <Text style={styles.sectionTitle}>Programs ({programs.length})</Text>

                        {programs.length > 0 ? (
                          <View style={{ gap: 10 }}>
                            {programs.map((p) => (
                              <View key={p.id} style={styles.miniRow}>
                                <View style={styles.miniLeft}>
                                  {p.thumbnail ? (
                                    <Image source={{ uri: p.thumbnail }} style={styles.miniThumb} />
                                  ) : (
                                    <View style={styles.miniThumbFallback}>
                                      <Icon name="play-circle-outline" size={18} color="#9CA3AF" />
                                    </View>
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.miniTitle} numberOfLines={1}>{p.title}</Text>
                                  <Text style={styles.miniSub} numberOfLines={1}>{p.category || "No category"}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.helperText}>No programs yet.</Text>
                        )}

                        <Divider />

                        <Text style={styles.sectionTitle}>Add new program</Text>

                        <TouchableOpacity
                          style={styles.inlineUpload}
                          onPress={() => pickAndUpload("program")}
                          disabled={busy}
                          activeOpacity={0.9}
                        >
                          {programThumb ? (
                            <Image source={{ uri: programThumb }} style={styles.inlineUploadImg} />
                          ) : (
                            <View style={styles.inlineUploadPh}>
                              <Icon name="cloud-upload-outline" size={18} color="#6B7280" />
                              <Text style={styles.inlineUploadText}>Upload program thumbnail</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        <Input label="Title *" value={programTitle} onChangeText={setProgramTitle} placeholder="Program title" />
                        <Input label="Category" value={programCategory} onChangeText={setProgramCategory} placeholder="e.g. Gospel, Teaching..." />

                        <TouchableOpacity
                          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                          onPress={addProgram}
                          disabled={busy}
                        >
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Add Program</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.linkBtn} onPress={closeModal}>
                          <Text style={styles.linkText}>Close</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {/* ===== PODCASTS ===== */}
                    {tab === "podcasts" && (
                      <>
                        <Text style={styles.sectionTitle}>Podcasts ({podcasts.length})</Text>

                        {podcasts.length > 0 ? (
                          <View style={{ gap: 10 }}>
                            {podcasts.map((p) => (
                              <View key={p.id} style={styles.miniRow}>
                                <View style={styles.miniLeft}>
                                  {p.thumbnail ? (
                                    <Image source={{ uri: p.thumbnail }} style={styles.miniThumb} />
                                  ) : (
                                    <View style={styles.miniThumbFallback}>
                                      <Icon name="videocam-outline" size={18} color="#9CA3AF" />
                                    </View>
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.miniTitle} numberOfLines={1}>{p.title}</Text>
                                  <Text style={styles.miniSub} numberOfLines={1}>{p.category || "No category"}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.helperText}>No podcasts yet.</Text>
                        )}

                        <Divider />

                        <Text style={styles.sectionTitle}>Add new podcast</Text>

                        <TouchableOpacity
                          style={styles.inlineUpload}
                          onPress={() => pickAndUpload("podcast")}
                          disabled={busy}
                          activeOpacity={0.9}
                        >
                          {podcastThumb ? (
                            <Image source={{ uri: podcastThumb }} style={styles.inlineUploadImg} />
                          ) : (
                            <View style={styles.inlineUploadPh}>
                              <Icon name="cloud-upload-outline" size={18} color="#6B7280" />
                              <Text style={styles.inlineUploadText}>Upload podcast thumbnail</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        <Input label="Title *" value={podcastTitle} onChangeText={setPodcastTitle} placeholder="Podcast title" />
                        <Input label="Video link *" value={podcastLink} onChangeText={setPodcastLink} placeholder="YouTube/Vimeo link..." />
                        <Input label="Category" value={podcastCategory} onChangeText={setPodcastCategory} placeholder="e.g. Sermon, Interview..." />

                        <TouchableOpacity
                          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
                          onPress={addPodcast}
                          disabled={busy}
                        >
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Add Podcast</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.linkBtn} onPress={closeModal}>
                          <Text style={styles.linkText}>Close</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

/* ================= UI PARTS ================= */
function Input({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...(props as any)}
        style={[styles.input, props.multiline && styles.textarea]}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F5F7" },

  /* HERO */
  hero: {
    backgroundColor: "#0E0E10",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    fontSize: 12.5,
  },
  addBtn: { backgroundColor: "#fff", padding: 12, borderRadius: 999 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* LIST CARD */
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  cardLeft: { width: 56, height: 56 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#EEE" },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(47,165,169,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: {
    backgroundColor: "rgba(47,165,169,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: COLORS.light.primary, fontWeight: "900", fontSize: 10 },
  name: { fontSize: 15.5, fontWeight: "900", color: "#111", flex: 1 },
  desc: { fontSize: 12.5, color: "#6B6B70", marginTop: 6 },
  metaRow: { marginTop: 8 },
  metaText: { fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    borderRadius: 14,
    flex: 1,
  },
  dangerBtn: { backgroundColor: "#EF4444" },
  smallBtnText: { fontWeight: "900", fontSize: 12, color: "#111" },

  /* EMPTY */
  empty: { padding: 22, alignItems: "center" },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#111" },
  emptySub: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700", textAlign: "center" },

  /* MODAL */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: "92%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  modalSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  divider: { height: 1, backgroundColor: "#EEF0F3", marginVertical: 14 },

  /* FORMS */
  label: { fontSize: 12, fontWeight: "900", color: "#111", marginBottom: 8 },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  textarea: { minHeight: 88, textAlignVertical: "top" },

  /* Upload cards */
  uploadCard: {
    height: 170,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    marginBottom: 14,
    justifyContent: "center",
  },
  uploadImage: { width: "100%", height: "100%" },
  uploadPlaceholder: { alignItems: "center", paddingHorizontal: 14 },
  uploadText: { marginTop: 10, fontWeight: "900", color: "#111", fontSize: 13 },
  uploadHint: { marginTop: 6, fontWeight: "700", color: "#6B6B70", fontSize: 12, textAlign: "center" },
  uploadBusy: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  uploadBusyText: { color: "#fff", fontWeight: "900" },

  inlineUpload: {
    height: 68,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  inlineUploadImg: { width: "100%", height: "100%" },
  inlineUploadPh: { flexDirection: "row", alignItems: "center", gap: 10 },
  inlineUploadText: { fontWeight: "900", color: "#111" },

  sectionTitle: { fontSize: 14.5, fontWeight: "900", color: "#111", marginBottom: 10 },
  helperText: { fontSize: 12.5, color: "#6B6B70", fontWeight: "700" },

  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  miniLeft: { width: 54, height: 44 },
  miniThumb: { width: 54, height: 44, borderRadius: 14, backgroundColor: "#EEE" },
  miniThumbFallback: {
    width: 54,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  miniTitle: { fontSize: 13.5, fontWeight: "900", color: "#111" },
  miniSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  /* Tabs */
  pillTabs: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  pill: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center" },
  pillActive: { backgroundColor: "#111" },
  pillText: { fontWeight: "900", color: "#111" },
  pillTextActive: { color: "#fff" },

  /* Buttons */
  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 6,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  linkBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  linkText: { color: COLORS.light.primary, fontWeight: "900" },
});

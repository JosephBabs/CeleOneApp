import React, { useEffect, useState } from "react";
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
} from "firebase/firestore";

/* ================= MAIN ================= */
export default function AdminTVChannels({ navigation }: any) {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [mode, setMode] = useState<"create" | "edit" | "manage" | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [streamLink, setStreamLink] = useState("");

  const [programs, setPrograms] = useState<any[]>([]);
  const [podcasts, setPodcasts] = useState<any[]>([]);

  const [programTitle, setProgramTitle] = useState("");
  const [programThumb, setProgramThumb] = useState("");
  const [programCategory, setProgramCategory] = useState("");

  const [podcastTitle, setPodcastTitle] = useState("");
  const [podcastLink, setPodcastLink] = useState("");
  const [podcastCategory, setPodcastCategory] = useState("");

  /* ================= FETCH ================= */
  const fetchChannels = async () => {
    const snap = await getDocs(collection(db, "channels"));
    setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  /* ================= CRUD ================= */
  const createChannel = async () => {
    if (!name.trim()) return Alert.alert("Name required");

    await addDoc(collection(db, "channels"), {
      name,
      description,
      streamLink,
      createdAt: new Date(),
    });

    resetForm();
    fetchChannels();
  };

  const updateChannel = async () => {
    if (!selectedChannel) return;

    await updateDoc(doc(db, "channels", selectedChannel.id), {
      name,
      description,
      streamLink,
      updatedAt: new Date(),
    });

    resetForm();
    fetchChannels();
  };

  const deleteChannel = async (id: string) => {
    Alert.alert("Delete channel?", "This cannot be undone", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "channels", id));
          fetchChannels();
        },
      },
    ]);
  };

  const openManage = async (channel: any) => {
    setSelectedChannel(channel);
    setMode("manage");

    const programsSnap = await getDocs(collection(db, "channels", channel.id, "programs"));
    setPrograms(programsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    const podcastsSnap = await getDocs(collection(db, "channels", channel.id, "podcasts"));
    setPodcasts(podcastsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const resetForm = () => {
    setMode(null);
    setSelectedChannel(null);
    setName("");
    setDescription("");
    setStreamLink("");
  };

  /* ================= PROGRAM / PODCAST ================= */
  const addProgram = async () => {
    await addDoc(collection(db, "channels", selectedChannel.id, "programs"), {
      title: programTitle,
      thumbnail: programThumb,
      category: programCategory,
      createdAt: new Date(),
    });
    setProgramTitle("");
    setProgramThumb("");
    setProgramCategory("");
    openManage(selectedChannel);
  };

  const addPodcast = async () => {
    await addDoc(collection(db, "channels", selectedChannel.id, "podcasts"), {
      title: podcastTitle,
      link: podcastLink,
      category: podcastCategory,
      createdAt: new Date(),
    });
    setPodcastTitle("");
    setPodcastLink("");
    setPodcastCategory("");
    openManage(selectedChannel);
  };

  /* ================= CARD ================= */
  const renderChannel = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openManage(item)}
      activeOpacity={0.9}
    >
      <View style={styles.iconBox}>
        <Icon name="tv" size={18} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {item.description || "No description"}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => {
            setSelectedChannel(item);
            setName(item.name);
            setDescription(item.description);
            setStreamLink(item.streamLink);
            setMode("edit");
          }}
        >
          <Icon name="pencil" size={18} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => deleteChannel(item.id)}>
          <Icon name="trash" size={18} color="red" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>TV Channels</Text>
        <TouchableOpacity onPress={() => setMode("create")}>
          <Icon name="add" size={26} />
        </TouchableOpacity>
      </View>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={channels}
          renderItem={renderChannel}
          keyExtractor={i => i.id}
          contentContainerStyle={{ gap: 12 }}
        />
      )}

      {/* MODAL */}
      <Modal visible={!!mode} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* CREATE / EDIT */}
              {(mode === "create" || mode === "edit") && (
                <>
                  <Text style={styles.modalTitle}>
                    {mode === "create" ? "Create Channel" : "Edit Channel"}
                  </Text>

                  <Input placeholder="Channel name" value={name} onChangeText={setName} />
                  <Input placeholder="Description" value={description} onChangeText={setDescription} />
                  <Input placeholder="Stream link" value={streamLink} onChangeText={setStreamLink} />

                  <PrimaryButton
                    label={mode === "create" ? "Create" : "Update"}
                    onPress={mode === "create" ? createChannel : updateChannel}
                  />
                </>
              )}

              {/* MANAGE */}
              {mode === "manage" && (
                <>
                  <Text style={styles.modalTitle}>{selectedChannel?.name}</Text>

                  <Section title={`Programs (${programs.length})`} />
                  {programs.map(p => (
                    <Text key={p.id} style={styles.item}>{p.title}</Text>
                  ))}

                  <Input placeholder="Program title" value={programTitle} onChangeText={setProgramTitle} />
                  <Input placeholder="Thumbnail" value={programThumb} onChangeText={setProgramThumb} />
                  <Input placeholder="Category" value={programCategory} onChangeText={setProgramCategory} />
                  <PrimaryButton label="Add Program" onPress={addProgram} />

                  <Section title={`Podcasts (${podcasts.length})`} />
                  {podcasts.map(p => (
                    <Text key={p.id} style={styles.item}>{p.title}</Text>
                  ))}

                  <Input placeholder="Podcast title" value={podcastTitle} onChangeText={setPodcastTitle} />
                  <Input placeholder="Video link" value={podcastLink} onChangeText={setPodcastLink} />
                  <Input placeholder="Category" value={podcastCategory} onChangeText={setPodcastCategory} />
                  <PrimaryButton label="Add Podcast" onPress={addPodcast} />
                </>
              )}

              <TouchableOpacity style={styles.close} onPress={resetForm}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= UI PARTS ================= */
const Input = (props: any) => (
  <TextInput {...props} style={styles.input} />
);

const PrimaryButton = ({ label, onPress }: any) => (
  <TouchableOpacity style={styles.primaryBtn} onPress={onPress}>
    <Text style={styles.primaryText}>{label}</Text>
  </TouchableOpacity>
);

const Section = ({ title }: any) => (
  <Text style={styles.section}>{title}</Text>
);

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7", padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "600" },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "600" },
  desc: { fontSize: 12, color: "#777" },
  actions: { flexDirection: "row", gap: 14 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: "90%",
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },

  input: {
    backgroundColor: "#f3f3f3",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },

  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 8,
  },
  primaryText: { color: "#fff", fontWeight: "600" },

  section: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "600",
  },

  item: {
    paddingVertical: 6,
    fontSize: 13,
    color: "#555",
  },

  close: { alignItems: "center", marginTop: 16 },
  closeText: { fontSize: 16, color: COLORS.light.primary },
});

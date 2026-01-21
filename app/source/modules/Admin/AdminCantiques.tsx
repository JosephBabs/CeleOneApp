import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../auth/firebaseConfig";
import { COLORS } from "../../../core/theme/colors";
import { RichEditor, RichToolbar } from "react-native-pell-rich-editor";

export default function AdminCantiques({ navigation }: any) {
  const [cantiques, setCantiques] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [editingCantique, setEditingCantique] = useState<any>(null);
  const richText = useRef<RichEditor>(null);
  const [richEditorContent, setRichEditorContent] = useState("");

  const [newCantique, setNewCantique] = useState({
    language: "goun",
    title: "",
    hymnNumber: "",
    hymnContent: "",
    musicalKey: "",
  });

  useEffect(() => {
    fetchCantiques();
    fetchAdminName();
  }, []);

  const fetchCantiques = async () => {
    const snap = await getDocs(collection(db, "cantiques"));
    setCantiques(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchAdminName = async () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    const docSnap = await getDoc(doc(db, "user_data", email));
    if (docSnap.exists()) {
      const d = docSnap.data();
      setAdminName(`${d.firstName} ${d.lastName}`);
    }
  };

  const resetForm = () => {
    setNewCantique({
      language: "goun",
      title: "",
      hymnNumber: "",
      hymnContent: "",
      musicalKey: "",
    });
    setRichEditorContent("");
  };

  const handleCreateCantique = async () => {
    if (!newCantique.title?.trim() || !newCantique.hymnNumber?.trim()) {
      Alert.alert("Validation", "Title and Hymn Number are required");
      return;
    }

    const cantiqueData = {
      ...newCantique,
      hymnContent: richEditorContent,
      author: adminName || "Admin",
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "cantiques"), cantiqueData);

    resetForm();
    setShowCreateForm(false);
    fetchCantiques();
  };

  const handleDeleteCantique = async (id: string) => {
    Alert.alert("Delete", "Delete this cantique?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "cantiques", id));
          fetchCantiques();
        },
      },
    ]);
  };

  const handleEditCantique = (cantique: any) => {
    setEditingCantique(cantique);
    setNewCantique({
      language: cantique.language || "goun",
      title: cantique.title || "",
      hymnNumber: cantique.hymnNumber || "",
      hymnContent: cantique.hymnContent || "",
      musicalKey: cantique.musicalKey || "",
    });
    setRichEditorContent(cantique.hymnContent || "");
    setShowEditForm(true);
  };

  const handleUpdateCantique = async () => {
    if (!editingCantique || !newCantique.title?.trim() || !newCantique.hymnNumber?.trim()) {
      Alert.alert("Validation", "Title and Hymn Number are required");
      return;
    }

    await updateDoc(doc(db, "cantiques", editingCantique.id), {
      ...newCantique,
      hymnContent: richEditorContent,
      updatedAt: serverTimestamp(),
    });

    resetForm();
    setShowEditForm(false);
    setEditingCantique(null);
    fetchCantiques();
  };

  const renderCantique = ({ item }: any) => (
    <View style={styles.cantiqueCard}>
      <View style={styles.cantiqueHeader}>
        <View>
          <Text style={styles.cantiqueLanguage}>{item.language}</Text>
          <Text style={styles.cantiqueAuthor}>{item.author || "Admin"}</Text>
        </View>
        <Text style={styles.cantiqueDate}>
          {item.createdAt?.toDate?.().toLocaleDateString() || ""}
        </Text>
      </View>

      <Text style={styles.cantiqueTitle}>{item.title}</Text>
      <Text style={styles.cantiqueNumber}>Hymn #{item.hymnNumber}</Text>
      <Text style={styles.cantiqueKey}>Key: {item.musicalKey || "Not specified"}</Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => handleEditCantique(item)}
        >
          <Icon name="create" size={16} color="#fff" />
          <Text style={styles.btnText}> Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteCantique(item.id)}
        >
          <Icon name="trash" size={16} color="#fff" />
          <Text style={styles.btnText}> Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={22} color="#333" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Manage Cantiques</Text>

      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => setShowCreateForm(!showCreateForm)}
      >
        <Text style={styles.createText}>Create New Cantique</Text>
      </TouchableOpacity>

      {showCreateForm && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.form}>
            {/* LANGUAGE */}
            <TouchableOpacity
              style={styles.inputWithIcon}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Icon name="language" size={20} color="#666" />
              <Text style={styles.categoryText}>
                {newCantique.language}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Cantique title"
              value={newCantique.title}
              onChangeText={t => setNewCantique({ ...newCantique, title: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Hymn number"
              value={newCantique.hymnNumber}
              onChangeText={t => setNewCantique({ ...newCantique, hymnNumber: t })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Musical key (optional)"
              value={newCantique.musicalKey}
              onChangeText={t => setNewCantique({ ...newCantique, musicalKey: t })}
            />
            <Text style={styles.label}>Hymn Content (HTML Editor)</Text>
            <RichToolbar
              editor={richText}
              actions={["bold", "italic", "insertImage", "fontSize"]}
              iconMap={{ insertImage: "image" }}
            />
            <RichEditor
              ref={richText}
              onChange={setRichEditorContent}
              placeholder="Enter hymn content..."
              initialContentHTML={richEditorContent}
              style={styles.richEditor}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateCantique}>
              <Text style={styles.submitText}>Publish</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {showEditForm && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.form}>
            <Text style={styles.editTitle}>Edit Cantique</Text>

            {/* LANGUAGE */}
            <TouchableOpacity
              style={styles.inputWithIcon}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Icon name="language" size={20} color="#666" />
              <Text style={styles.categoryText}>
                {newCantique.language}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Cantique title"
              value={newCantique.title}
              onChangeText={t => setNewCantique({ ...newCantique, title: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Hymn number"
              value={newCantique.hymnNumber}
              onChangeText={t => setNewCantique({ ...newCantique, hymnNumber: t })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Musical key (optional)"
              value={newCantique.musicalKey}
              onChangeText={t => setNewCantique({ ...newCantique, musicalKey: t })}
            />
            <Text style={styles.label}>Hymn Content (HTML Editor)</Text>
            <RichToolbar
              editor={richText}
              actions={["bold", "italic", "insertImage", "fontSize"]}
              iconMap={{ insertImage: "image" }}
            />
            <RichEditor
              ref={richText}
              onChange={setRichEditorContent}
              placeholder="Enter hymn content..."
              initialContentHTML={richEditorContent}
              style={styles.richEditor}
            />

            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowEditForm(false); resetForm(); setEditingCantique(null); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateCantique}>
                <Text style={styles.submitText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <FlatList
        data={cantiques}
        keyExtractor={(i) => i.id}
        renderItem={renderCantique}
        scrollEnabled={false}
      />

      {/* LANGUAGE MODAL */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {["goun", "yoruba", "francais", "anglais"].map(lang => (
              <TouchableOpacity
                key={lang}
                style={styles.modalItem}
                onPress={() => {
                  setNewCantique({ ...newCantique, language: lang });
                  setShowLanguagePicker(false);
                }}
              >
                <Text style={styles.modalItemText}>{lang}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backText: { marginLeft: 8, color: COLORS.light.primary },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  createBtn: { backgroundColor: COLORS.light.primary, padding: 14, borderRadius: 8, marginBottom: 12 },
  createText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  form: { marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 6, marginBottom: 10 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  richEditor: { borderWidth: 1, borderColor: "#ddd", borderRadius: 6, height: 200, marginBottom: 10 },

  inputWithIcon: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 6, marginBottom: 10 },
  categoryText: { marginLeft: 10, fontWeight: "600" },

  submitBtn: { backgroundColor: "green", padding: 14, borderRadius: 8 },
  submitText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  cantiqueCard: { padding: 14, borderRadius: 8, backgroundColor: "#fafafa", marginBottom: 12 },
  cantiqueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cantiqueLanguage: { fontSize: 12, color: COLORS.light.primary, fontWeight: "bold" },
  cantiqueAuthor: { fontSize: 12, color: "#888", marginTop: 2 },
  cantiqueDate: { fontSize: 12, color: "#888" },
  cantiqueTitle: { fontSize: 18, fontWeight: "600", marginBottom: 6 },
  cantiqueNumber: { color: "#555", marginBottom: 4 },
  cantiqueKey: { color: "#555", marginBottom: 10 },

  buttonRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },

  editBtn: { backgroundColor: "#007bff", padding: 8, borderRadius: 6, marginRight: 10 },
  deleteBtn: { backgroundColor: "#dc3545", padding: 8, borderRadius: 6 },
  btnText: { color: "#fff" },

  editTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  editButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  cancelBtn: { backgroundColor: "#6c757d", padding: 14, borderRadius: 8, flex: 1, marginRight: 10 },
  cancelText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  modalContent: { backgroundColor: "#fff", margin: 40, borderRadius: 10 },
  modalItem: { padding: 16, borderBottomWidth: 1, borderColor: "#eee" },
  modalItemText: { textAlign: "center", fontWeight: "600" },
  modalClose: { textAlign: "center", padding: 16, color: "red" },
});

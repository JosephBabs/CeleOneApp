import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import Modal from "react-native-modal";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { RichEditor, RichToolbar } from "react-native-pell-rich-editor";

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../auth/firebaseConfig";

type CantiqueDoc = {
  id: string;
  title: string;
  hymnNumber: number;
  musicalKey?: string;
  hymnContent: string;
  language: string;
  author?: string;
  createdAt?: any;
  updatedAt?: any;
};

const LANGS = ["All", "goun", "yoruba", "francais", "anglais"] as const;

function safeNum(v: any) {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

export default function AdminCantiques({ navigation }: any) {
  const uid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [adminName, setAdminName] = useState("Admin");

  const [cantiques, setCantiques] = useState<CantiqueDoc[]>([]);

  // Search / filter
  const [selectedLanguage, setSelectedLanguage] = useState<(typeof LANGS)[number]>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sheets
  const [langFilterOpen, setLangFilterOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Editor
  const richRef = useRef<RichEditor>(null);
  const [richHTML, setRichHTML] = useState("");

  // Form
  const [editing, setEditing] = useState<CantiqueDoc | null>(null);
  const [form, setForm] = useState({
    language: "goun",
    title: "",
    hymnNumber: "",
    musicalKey: "",
  });

  /* ================= Load admin name ================= */
  useEffect(() => {
    (async () => {
      try {
        if (!uid) return;
        const snap = await getDoc(doc(db, "user_data", uid)); // ✅ FIX: use uid, not email
        if (snap.exists()) {
          const d: any = snap.data();
          const nm = `${d.firstName || ""} ${d.lastName || ""}`.trim();
          if (nm) setAdminName(nm);
        }
      } catch {}
    })();
  }, [uid]);

  /* ================= Realtime cantiques (premium) ================= */
  useEffect(() => {
    const qy = query(collection(db, "cantiques"), orderBy("hymnNumber", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as CantiqueDoc[];
        // Ensure hymnNumber is numeric (safety)
        const fixed = arr
          .map((x) => ({ ...x, hymnNumber: safeNum((x as any).hymnNumber) }))
          .sort((a, b) => a.hymnNumber - b.hymnNumber);
        setCantiques(fixed);
        setLoading(false);
      },
      (err) => {
        console.error("cantiques snapshot error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let list = [...cantiques];

    if (selectedLanguage !== "All") {
      list = list.filter((c) => c.language === selectedLanguage);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const titleMatch = (c.title || "").toLowerCase().includes(q);
        const numMatch = String(c.hymnNumber || "").includes(q);
        return titleMatch || numMatch;
      });
    }
    return list;
  }, [cantiques, selectedLanguage, searchQuery]);

  /* ================= helpers ================= */
  const resetForm = () => {
    setForm({ language: "goun", title: "", hymnNumber: "", musicalKey: "" });
    setRichHTML("");
    setEditing(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const selectAllFrenchVisible = () => {
    setSelectedIds(new Set(filtered.filter((c) => c.language === "francais").map((c) => c.id)));
  };

  /* ================= Create ================= */
  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const createCantique = async () => {
    if (!form.title.trim() || !form.hymnNumber.trim()) {
      Alert.alert("Validation", "Title and Hymn Number are required");
      return;
    }

    const hymnNumber = safeNum(form.hymnNumber);
    if (!hymnNumber) {
      Alert.alert("Validation", "Hymn Number must be a valid number");
      return;
    }

    try {
      setBusy(true);
      await addDoc(collection(db, "cantiques"), {
        language: form.language,
        title: form.title.trim(),
        hymnNumber,
        musicalKey: form.musicalKey.trim(),
        hymnContent: richHTML,
        author: adminName || "Admin",
        createdAt: serverTimestamp(),
      });
      setCreateOpen(false);
      resetForm();
      Alert.alert("Success", "Cantique published");
    } catch (e) {
      console.error("create cantique error:", e);
      Alert.alert("Error", "Failed to publish cantique");
    } finally {
      setBusy(false);
    }
  };

  /* ================= Edit ================= */
  const openEdit = (cantique: CantiqueDoc) => {
    setEditing(cantique);
    setForm({
      language: cantique.language || "goun",
      title: cantique.title || "",
      hymnNumber: String(cantique.hymnNumber || ""),
      musicalKey: cantique.musicalKey || "",
    });
    setRichHTML(cantique.hymnContent || "");
    setEditOpen(true);
  };

  const updateCantique = async () => {
    if (!editing) return;
    if (!form.title.trim() || !form.hymnNumber.trim()) {
      Alert.alert("Validation", "Title and Hymn Number are required");
      return;
    }
    const hymnNumber = safeNum(form.hymnNumber);
    if (!hymnNumber) {
      Alert.alert("Validation", "Hymn Number must be a valid number");
      return;
    }

    try {
      setBusy(true);
      await updateDoc(doc(db, "cantiques", editing.id), {
        language: form.language,
        title: form.title.trim(),
        hymnNumber,
        musicalKey: form.musicalKey.trim(),
        hymnContent: richHTML,
        updatedAt: serverTimestamp(),
      });

      setEditOpen(false);
      resetForm();
      Alert.alert("Success", "Cantique updated");
    } catch (e) {
      console.error("update cantique error:", e);
      Alert.alert("Error", "Failed to update cantique");
    } finally {
      setBusy(false);
    }
  };

  /* ================= Delete ================= */
  const deleteCantique = (id: string) => {
    Alert.alert("Delete", "Delete this cantique?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            await deleteDoc(doc(db, "cantiques", id));
          } catch (e) {
            console.error("delete cantique error:", e);
            Alert.alert("Error", "Failed to delete cantique");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;

    Alert.alert("Bulk Delete", `Delete ${selectedIds.size} selected cantiques?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            await Promise.all(Array.from(selectedIds).map((id) => deleteDoc(doc(db, "cantiques", id))));
            setSelectedIds(new Set());
            setSelectMode(false);
          } catch (e) {
            console.error("bulk delete error:", e);
            Alert.alert("Error", "Failed to delete selected");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /* ================= UI ================= */
  const Header = () => (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Cantiques</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            Manage hymns · {filtered.length} shown
          </Text>
        </View>

        <TouchableOpacity style={styles.createPill} onPress={openCreate} activeOpacity={0.9}>
          <Icon name="add" size={18} color="#0E0E10" />
          <Text style={styles.createPillText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.75)" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search title or number…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.searchInput}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
              <Icon name="close" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.filterPill} onPress={() => setLangFilterOpen(true)} activeOpacity={0.9}>
          <Icon name="filter" size={16} color="#0E0E10" />
          <Text style={styles.filterPillText}>{selectedLanguage}</Text>
          <Icon name="chevron-down" size={16} color="#0E0E10" />
        </TouchableOpacity>
      </View>

      <View style={styles.topActions}>
        <TouchableOpacity
          style={[styles.modeBtn, selectMode && { backgroundColor: "rgba(239,68,68,0.16)" }]}
          onPress={() => {
            if (selectMode) {
              setSelectMode(false);
              setSelectedIds(new Set());
            } else {
              setSelectMode(true);
            }
          }}
        >
          <Icon name={selectMode ? "close" : "checkbox-outline"} size={16} color="#fff" />
          <Text style={styles.modeBtnText}>{selectMode ? "Cancel Select" : "Select Mode"}</Text>
        </TouchableOpacity>

        {selectMode && (
          <>
            <TouchableOpacity style={styles.modeBtn} onPress={selectAllVisible}>
              <Icon name="checkmark-done-outline" size={16} color="#fff" />
              <Text style={styles.modeBtnText}>Select All</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeBtn} onPress={selectAllFrenchVisible}>
              <Icon name="flag-outline" size={16} color="#fff" />
              <Text style={styles.modeBtnText}>Select French</Text>
            </TouchableOpacity>

            {selectedIds.size > 0 && (
              <TouchableOpacity style={[styles.modeBtn, { backgroundColor: "#EF4444" }]} onPress={bulkDelete}>
                <Icon name="trash-outline" size={16} color="#fff" />
                <Text style={styles.modeBtnText}>Delete ({selectedIds.size})</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: CantiqueDoc }) => {
    const selected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => (selectMode ? toggleSelect(item.id) : openEdit(item))}
        style={[
          styles.card,
          selected && styles.cardSelected,
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.hymnNumber}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>

              <View style={styles.langPill}>
                <Icon name="language-outline" size={14} color={COLORS.light.primary} />
                <Text style={styles.langPillText}>{item.language}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Icon name="musical-notes-outline" size={14} color="#6B6B70" />
                <Text style={styles.metaText}>
                  {item.musicalKey?.trim() ? `Key: ${item.musicalKey}` : "Key: —"}
                </Text>
              </View>

              {!!item.author && (
                <View style={styles.metaChip}>
                  <Icon name="person-outline" size={14} color="#6B6B70" />
                  <Text style={styles.metaText}>{item.author}</Text>
                </View>
              )}
            </View>
          </View>

          {!selectMode && (
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                <Icon name="create-outline" size={18} color="#111" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: "rgba(239,68,68,0.12)" }]}
                onPress={() => deleteCantique(item.id)}
              >
                <Icon name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {selectMode && (
            <View style={styles.checkWrap}>
              <View style={[styles.check, selected && styles.checkOn]}>
                {selected && <Icon name="checkmark" size={16} color="#fff" />}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F5F7" }}>
      <Header />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 34 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="musical-notes-outline" size={34} color="#111" />
              </View>
              <Text style={styles.emptyTitle}>No cantiques found</Text>
              <Text style={styles.emptySub}>Try changing language filter or search.</Text>
            </View>
          }
        />
      )}

      {/* ===== Language Filter Sheet ===== */}
      <Modal isVisible={langFilterOpen} onBackdropPress={() => setLangFilterOpen(false)} style={{ margin: 0, justifyContent: "flex-end" }}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Filter language</Text>
              <Text style={styles.sheetSub}>Choose what to display</Text>
            </View>
            <TouchableOpacity onPress={() => setLangFilterOpen(false)} style={styles.sheetClose}>
              <Icon name="close" size={18} color="#111" />
            </TouchableOpacity>
          </View>

          {LANGS.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={styles.sheetRow}
              onPress={() => {
                setSelectedLanguage(lang);
                setLangFilterOpen(false);
              }}
            >
              <Text style={styles.sheetRowText}>{lang}</Text>
              {selectedLanguage === lang && <Icon name="checkmark" size={18} color={COLORS.light.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* ===== Create Sheet ===== */}
      <Modal isVisible={createOpen} onBackdropPress={() => !busy && setCreateOpen(false)} style={{ margin: 0, justifyContent: "flex-end" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.editorSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Create Cantique</Text>
                <Text style={styles.sheetSub}>Publish a new hymn</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateOpen(false)} disabled={busy} style={styles.sheetClose}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.langSelect} onPress={() => setLangPickerOpen(true)}>
              <Icon name="language-outline" size={18} color="#111" />
              <Text style={styles.langSelectText}>{form.language}</Text>
              <Icon name="chevron-down" size={18} color="#111" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Cantique title *"
              placeholderTextColor="#8C8C8F"
              value={form.title}
              onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Hymn number *"
              placeholderTextColor="#8C8C8F"
              value={form.hymnNumber}
              onChangeText={(v) => setForm((p) => ({ ...p, hymnNumber: v }))}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Musical key (optional)"
              placeholderTextColor="#8C8C8F"
              value={form.musicalKey}
              onChangeText={(v) => setForm((p) => ({ ...p, musicalKey: v }))}
            />

            <Text style={styles.label}>Hymn Content (HTML)</Text>
            <RichToolbar
              editor={richRef}
              actions={["bold", "italic", "underline", "heading1", "heading2", "insertBulletsList", "insertOrderedList"]}
            />
            <View style={styles.richWrap}>
              <RichEditor
                ref={richRef}
                initialContentHTML={richHTML}
                onChange={setRichHTML}
                placeholder="Enter hymn content..."
                editorStyle={{ backgroundColor: "#fff" }}
              />
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#F2F3F5" }]}
                onPress={() => {
                  if (busy) return;
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                <Text style={[styles.btnText, { color: "#444" }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: COLORS.light.primary }, busy && { opacity: 0.7 }]}
                onPress={createCantique}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: "#fff" }]}>Publish</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== Edit Sheet ===== */}
      <Modal isVisible={editOpen} onBackdropPress={() => !busy && setEditOpen(false)} style={{ margin: 0, justifyContent: "flex-end" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.editorSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Edit Cantique</Text>
                <Text style={styles.sheetSub}>Update hymn details</Text>
              </View>
              <TouchableOpacity onPress={() => setEditOpen(false)} disabled={busy} style={styles.sheetClose}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.langSelect} onPress={() => setLangPickerOpen(true)}>
              <Icon name="language-outline" size={18} color="#111" />
              <Text style={styles.langSelectText}>{form.language}</Text>
              <Icon name="chevron-down" size={18} color="#111" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Cantique title *"
              placeholderTextColor="#8C8C8F"
              value={form.title}
              onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
            />

            <TextInput
              style={styles.input}
              placeholder="Hymn number *"
              placeholderTextColor="#8C8C8F"
              value={form.hymnNumber}
              onChangeText={(v) => setForm((p) => ({ ...p, hymnNumber: v }))}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Musical key (optional)"
              placeholderTextColor="#8C8C8F"
              value={form.musicalKey}
              onChangeText={(v) => setForm((p) => ({ ...p, musicalKey: v }))}
            />

            <Text style={styles.label}>Hymn Content (HTML)</Text>
            <RichToolbar
              editor={richRef}
              actions={["bold", "italic", "underline", "heading1", "heading2", "insertBulletsList", "insertOrderedList"]}
            />
            <View style={styles.richWrap}>
              <RichEditor
                ref={richRef}
                initialContentHTML={richHTML}
                onChange={setRichHTML}
                placeholder="Enter hymn content..."
                editorStyle={{ backgroundColor: "#fff" }}
              />
            </View>

            <View style={styles.sheetBtns}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#F2F3F5" }]}
                onPress={() => {
                  if (busy) return;
                  setEditOpen(false);
                  resetForm();
                }}
              >
                <Text style={[styles.btnText, { color: "#444" }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: COLORS.light.primary }, busy && { opacity: 0.7 }]}
                onPress={updateCantique}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: "#fff" }]}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== Language Picker Sheet (for form) ===== */}
      <Modal isVisible={langPickerOpen} onBackdropPress={() => setLangPickerOpen(false)} style={{ margin: 0, justifyContent: "flex-end" }}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Choose language</Text>
              <Text style={styles.sheetSub}>Language of the hymn</Text>
            </View>
            <TouchableOpacity onPress={() => setLangPickerOpen(false)} style={styles.sheetClose}>
              <Icon name="close" size={18} color="#111" />
            </TouchableOpacity>
          </View>

          {LANGS.filter((l) => l !== "All").map((lang) => (
            <TouchableOpacity
              key={lang}
              style={styles.sheetRow}
              onPress={() => {
                setForm((p) => ({ ...p, language: lang as any }));
                setLangPickerOpen(false);
              }}
            >
              <Text style={styles.sheetRowText}>{lang}</Text>
              {form.language === lang && <Icon name="checkmark" size={18} color={COLORS.light.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

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

  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
  },
  filterPillText: { fontWeight: "900", color: "#0E0E10" },

  topActions: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  modeBtnText: { color: "#fff", fontWeight: "900", fontSize: 12.5 },

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
  },
  cardSelected: {
    borderColor: COLORS.light.primary,
    borderWidth: 2,
    backgroundColor: "rgba(47,165,169,0.07)",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },

  badge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 18 },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { flex: 1, fontWeight: "900", color: "#111", fontSize: 15.5 },

  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(47,165,169,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  langPillText: { fontWeight: "900", color: COLORS.light.primary, fontSize: 12 },

  metaRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F6F7F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaText: { fontWeight: "800", color: "#6B6B70", fontSize: 12 },

  cardActions: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#F2F3F5",
    alignItems: "center",
    justifyContent: "center",
  },

  checkWrap: { marginLeft: 6 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D0D2D7",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkOn: { backgroundColor: COLORS.light.primary, borderColor: COLORS.light.primary },

  empty: { paddingTop: 50, alignItems: "center", paddingHorizontal: 24 },
  emptyIcon: { width: 70, height: 70, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 14, fontWeight: "900", fontSize: 16, color: "#111" },
  emptySub: { marginTop: 6, fontWeight: "700", color: "#6B6B70", textAlign: "center" },

  // Sheets
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 16 },
  editorSheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 16, maxHeight: "92%" },

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

  sheetRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F3F5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetRowText: { fontWeight: "900", color: "#111", fontSize: 14.5 },

  langSelect: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: "#F6F7F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langSelectText: { fontWeight: "900", color: "#111" },

  input: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: "#F6F7F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "800",
    color: "#111",
  },
  label: { marginTop: 14, marginHorizontal: 16, fontWeight: "900", color: "#111" },

  richWrap: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8EAEE",
    height: 220,
    backgroundColor: "#fff",
  },

  sheetBtns: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "900", fontSize: 14 },
});

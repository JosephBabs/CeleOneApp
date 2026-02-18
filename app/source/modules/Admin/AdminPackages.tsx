// AdminPackages.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../core/theme/colors";
import { db } from "../auth/firebaseConfig";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import useAdminEnglish from "../../../../src/hooks/useAdminEnglish";

export default function AdminPackages({ navigation }: any) {
  const { t } = useTranslation();
  useAdminEnglish();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [qText, setQText] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const [draft, setDraft] = useState({
    name: "",
    price: "",
    durationDays: "",
    isActive: true,
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "subscription_packages"), orderBy("createdAt", "desc")));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const text = qText.trim().toLowerCase();
    if (!text) return items;
    return items.filter(p => String(p.name || "").toLowerCase().includes(text));
  }, [items, qText]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ name: "", price: "", durationDays: "", isActive: true });
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setDraft({
      name: String(p.name || ""),
      price: String(p.price ?? ""),
      durationDays: String(p.durationDays ?? ""),
      isActive: !!p.isActive,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.price.trim() || !draft.durationDays.trim()) {
      Alert.alert(t("adminPackages.title"), t("adminJeunesse.children.required"));
      return;
    }
    try {
      const payload = {
        name: draft.name.trim(),
        price: Number(draft.price),
        durationDays: Number(draft.durationDays),
        isActive: !!draft.isActive,
        updatedAt: serverTimestamp(),
      };

      if (editing?.id) {
        await updateDoc(doc(db, "subscription_packages", editing.id), payload);
      } else {
        await addDoc(collection(db, "subscription_packages"), { ...payload, createdAt: serverTimestamp() });
      }

      setModalOpen(false);
      await load();
      Alert.alert(t("adminPackages.title"), t("adminPackages.saved"));
    } catch (e: any) {
      Alert.alert(t("adminPackages.title"), e?.message || "Error");
    }
  };

  const remove = (p: any) => {
    Alert.alert(t("adminPackages.title"), t("adminPackages.confirmDelete"), [
      { text: t("common.no") },
      {
        text: t("common.yes"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "subscription_packages", p.id));
            await load();
          } catch (e: any) {
            Alert.alert(t("adminPackages.title"), e?.message || "Error");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: any) => {
    const active = !!item.isActive;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => openEdit(item)}>
        <View style={styles.cardLeft}>
          <View style={styles.avatarFallback}>
            <Icon name="pricetag-outline" size={20} color={active ? "#0F766E" : "#6B7280"} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.badgePill, { backgroundColor: active ? "rgba(34,197,94,0.14)" : "rgba(148,163,184,0.25)" }]}>
              <Text style={[styles.badgeText, { color: active ? "#15803D" : "#475569" }]}>{active ? t("adminPackages.active") : "OFF"}</Text>
            </View>
          </View>

          <Text style={styles.email} numberOfLines={1}>
            {t("adminPackages.price")}: {item.price ?? "—"} · {t("adminPackages.durationDays")}: {item.durationDays ?? "—"}
          </Text>
        </View>

        <TouchableOpacity onPress={() => remove(item)} style={styles.trashBtn} activeOpacity={0.9}>
          <Icon name="trash-outline" size={18} color="#111" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* HERO */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{t("adminPackages.title")}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>{t("adminPackages.subtitle")}</Text>
          </View>

          <TouchableOpacity onPress={openCreate} style={styles.heroAction} activeOpacity={0.9}>
            <Icon name="add" size={20} color="#111" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Icon name="search" size={16} color="rgba(255,255,255,0.75)" />
          <TextInput
            value={qText}
            onChangeText={setQText}
            placeholder={`${t("common.search")}…`}
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* MODAL */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.overlay}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{editing ? t("common.edit") : t("common.create")}</Text>
                    <Text style={styles.modalSub}>{t("adminPackages.subtitle")}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.modalCloseBtn}>
                    <Icon name="close" size={18} color="#111" />
                  </TouchableOpacity>
                </View>

                <Field label={t("adminPackages.name")} value={draft.name} onChangeText={(v: any) => setDraft(s => ({ ...s, name: v }))} />
                <Field label={t("adminPackages.price")} value={draft.price} onChangeText={(v: any) => setDraft(s => ({ ...s, price: v }))} keyboardType="numeric" />
                <Field label={t("adminPackages.durationDays")} value={draft.durationDays} onChangeText={(v: any) => setDraft(s => ({ ...s, durationDays: v }))} keyboardType="numeric" />

                <TouchableOpacity
                  style={[styles.switchRow, draft.isActive && { borderColor: "rgba(34,197,94,0.35)" }]}
                  onPress={() => setDraft(s => ({ ...s, isActive: !s.isActive }))}
                  activeOpacity={0.9}
                >
                  <View style={styles.switchIcon}>
                    <Icon name={draft.isActive ? "checkmark-circle-outline" : "close-circle-outline"} size={18} color={draft.isActive ? "#16A34A" : "#6B7280"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>{t("adminPackages.active")}</Text>
                    <Text style={styles.switchSub}>{draft.isActive ? "ON" : "OFF"}</Text>
                  </View>
                  <View style={[styles.switchPill, draft.isActive ? styles.switchOn : styles.switchOff]} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.primaryBtn} onPress={save}>
                  <Icon name="save-outline" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t("common.save")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkBtn} onPress={() => setModalOpen(false)}>
                  <Text style={styles.linkText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholderTextColor="#9CA3AF" style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F5F7" },

  hero: {
    backgroundColor: "#0E0E10",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
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
  heroSub: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 12.5 },
  heroAction: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  searchRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: "#fff", fontWeight: "800" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  cardLeft: { width: 54, height: 54 },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(47,165,169,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { fontSize: 15.5, fontWeight: "900", color: "#111", flex: 1 },
  email: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700" },
  badgePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 10.5, fontWeight: "900" },

  trashBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: "92%" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  modalSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  label: { fontSize: 12, fontWeight: "900", color: "#111", marginBottom: 8 },
  input: { backgroundColor: "#F3F4F6", borderRadius: 14, padding: 14, fontSize: 14, fontWeight: "800", color: "#111" },

  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  linkBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  linkText: { color: COLORS.light.primary, fontWeight: "900" },

  switchRow: {
    marginTop: 6,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
  },
  switchIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  switchTitle: { fontWeight: "900", color: "#111" },
  switchSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },
  switchPill: { width: 52, height: 30, borderRadius: 999 },
  switchOn: { backgroundColor: "rgba(34,197,94,0.25)" },
  switchOff: { backgroundColor: "#F3F4F6" },
});

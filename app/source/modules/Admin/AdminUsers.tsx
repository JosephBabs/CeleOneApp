// AdminUsers.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { db } from "../auth/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

/* ================= NOTE (DATA SHAPE) =================
Expected (in user_data):
- id (doc id) can be email or uid depending on your setup
- firstName, lastName, email
- photoURL (or avatarUrl) optional
- status: "pending" | "approved" | "rejected" (for admin validation)
- restricted: boolean
- subscription: { plan, status, expiresAt, verified, lastPaymentRef } OR flat fields
- userId / uid (optional) -> used to compute chatrooms membership
====================================================== */

/* ================= MAIN COMPONENT ================= */
export default function AdminUsers({ navigation }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // computed / fetched extra info
  const [memberChatrooms, setMemberChatrooms] = useState<any[]>([]);
  const [subDraft, setSubDraft] = useState({
    plan: "",
    status: "",
    expiresAt: "",
    paymentRef: "",
    verified: false,
  });

  // filter/search
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [qText, setQText] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  /* ================= FETCH USERS ================= */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "user_data"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    } catch (e) {
      console.error("Fetch users error:", e);
      Alert.alert("Error", "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  /* ================= MEMBERSHIP (CHATROOMS) =================
    This tries both:
    - members array contains uid/userId
    - members array contains email
  */
  const fetchUserChatrooms = async (user: any) => {
    try {
      setDetailsLoading(true);
      setMemberChatrooms([]);

      const uid = user?.uid || user?.userId || user?.id;
      const email = user?.email;

      // Try by uid/userId
      let rooms: any[] = [];
      if (uid) {
        const roomsSnap = await getDocs(
          query(collection(db, "chatrooms"), where("members", "array-contains", uid))
        );
        rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      // If no rooms found, try by email
      if ((!rooms || rooms.length === 0) && email) {
        const roomsSnap2 = await getDocs(
          query(collection(db, "chatrooms"), where("members", "array-contains", email))
        );
        rooms = roomsSnap2.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      setMemberChatrooms(rooms || []);
    } catch (e) {
      console.error("Fetch chatrooms error:", e);
      // don't block UI
      setMemberChatrooms([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  /* ================= ACTIONS ================= */
  const deleteUser = async (userId: string) => {
    Alert.alert("Delete user", "This action is irreversible. Continue?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "user_data", userId));
            setSelectedUser(null);
            fetchUsers();
          } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to delete user");
          }
        },
      },
    ]);
  };

  const toggleRestriction = async (user: any) => {
    try {
      await updateDoc(doc(db, "user_data", user.id), {
        restricted: !user.restricted,
        updatedAt: serverTimestamp(),
      });
      setSelectedUser(null);
      fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update restriction");
    }
  };

  const setValidationStatus = async (user: any, status: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "user_data", user.id), {
        status,
        validatedAt: serverTimestamp(),
        validatedBy: "admin",
      });
      // refresh selected user in-place
      const updated = { ...user, status };
      setSelectedUser(updated);
      fetchUsers();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to update user status");
    }
  };

  const saveSubscription = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, "user_data", selectedUser.id), {
        subscription: {
          plan: subDraft.plan?.trim() || "",
          status: subDraft.status?.trim() || "",
          expiresAt: subDraft.expiresAt?.trim() || "",
          lastPaymentRef: subDraft.paymentRef?.trim() || "",
          verified: !!subDraft.verified,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Saved", "Subscription updated");
      fetchUsers();

      // update modal preview
      setSelectedUser((u: any) => ({
        ...u,
        subscription: {
          ...(u?.subscription || {}),
          plan: subDraft.plan?.trim() || "",
          status: subDraft.status?.trim() || "",
          expiresAt: subDraft.expiresAt?.trim() || "",
          lastPaymentRef: subDraft.paymentRef?.trim() || "",
          verified: !!subDraft.verified,
        },
      }));
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save subscription");
    }
  };

  /* ================= OPEN USER DETAILS ================= */
  const openUser = async (user: any) => {
    setSelectedUser(user);

    // init subscription editor from user doc
    const sub = user?.subscription || {};
    setSubDraft({
      plan: sub?.plan || "",
      status: sub?.status || "",
      expiresAt: sub?.expiresAt || "",
      paymentRef: sub?.lastPaymentRef || "",
      verified: !!sub?.verified,
    });

    await fetchUserChatrooms(user);
  };

  /* ================= FILTERED LIST ================= */
  const filteredUsers = useMemo(() => {
    const text = qText.trim().toLowerCase();

    let list = [...users];

    if (filter !== "all") {
      list = list.filter((u) => (u.status || "approved") === filter);
    }

    if (text) {
      list = list.filter((u) => {
        const full = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        return full.includes(text) || email.includes(text);
      });
    }

    // pending first
    list.sort((a, b) => {
      const sa = a.status || "approved";
      const sb = b.status || "approved";
      if (sa === sb) return 0;
      if (sa === "pending") return -1;
      if (sb === "pending") return 1;
      return sa.localeCompare(sb);
    });

    return list;
  }, [users, filter, qText]);

  /* ================= USER CARD ================= */
  const renderUser = ({ item }: any) => {
    const status = item.status || "approved";
    const badge =
      status === "pending"
        ? { text: "PENDING", bg: "rgba(245,158,11,0.14)", fg: "#B45309" }
        : status === "rejected"
        ? { text: "REJECTED", bg: "rgba(239,68,68,0.14)", fg: "#B91C1C" }
        : { text: "APPROVED", bg: "rgba(34,197,94,0.14)", fg: "#15803D" };

    const photo = item.photoURL || item.avatarUrl || item.profilePicture || "";

    return (
      <TouchableOpacity style={styles.card} onPress={() => openUser(item)} activeOpacity={0.92}>
        <View style={styles.cardLeft}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Icon name="person-outline" size={20} color={COLORS.light.primary} />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.name} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </Text>

            {item.restricted ? (
              <View style={[styles.badgePill, { backgroundColor: "rgba(239,68,68,0.14)" }]}>
                <Text style={[styles.badgeText, { color: "#B91C1C" }]}>RESTRICTED</Text>
              </View>
            ) : (
              <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</Text>
              </View>
            )}
          </View>

          <Text style={styles.email} numberOfLines={1}>
            {item.email}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              Role: {item.role || "User"} · Parish: {item.parish || "—"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              Subscription: {item?.subscription?.plan || "—"} · {item?.subscription?.status || "—"}
            </Text>
          </View>
        </View>

        <Icon name="chevron-forward" size={18} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* ===== HERO HEADER (Premium) ===== */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Users</Text>
            <Text style={styles.heroSub}>
              {users.length} total · validate new users · manage subscriptions
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Icon name="search" size={16} color="rgba(255,255,255,0.75)" />
          <TextInput
            value={qText}
            onChangeText={setQText}
            placeholder="Search name or email..."
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={styles.searchInput}
          />
        </View>

        {/* Filter pills */}
        <View style={styles.pills}>
          <Pill label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <Pill label="Pending" active={filter === "pending"} onPress={() => setFilter("pending")} />
          <Pill label="Approved" active={filter === "approved"} onPress={() => setFilter("approved")} />
          <Pill label="Rejected" active={filter === "rejected"} onPress={() => setFilter("rejected")} />
        </View>
      </View>

      {/* LIST */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="people-outline" size={54} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No users</Text>
              <Text style={styles.emptySub}>Try changing filters or search.</Text>
            </View>
          }
        />
      )}

      {/* DETAILS MODAL */}
      <Modal
        visible={!!selectedUser}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <View style={styles.modal}>
              {selectedUser && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>User Details</Text>
                      <Text style={styles.modalSub}>
                        Validate user · view memberships · manage subscription
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedUser(null)}
                      style={styles.modalCloseBtn}
                    >
                      <Icon name="close" size={18} color="#111" />
                    </TouchableOpacity>
                  </View>

                  {/* Profile row */}
                  <View style={styles.profileRow}>
                    {selectedUser.photoURL || selectedUser.avatarUrl ? (
                      <Image
                        source={{ uri: selectedUser.photoURL || selectedUser.avatarUrl }}
                        style={styles.profileAvatar}
                      />
                    ) : (
                      <View style={styles.profileAvatarFallback}>
                        <Icon name="person-outline" size={24} color={COLORS.light.primary} />
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>
                        {selectedUser.firstName} {selectedUser.lastName}
                      </Text>
                      <Text style={styles.profileEmail}>{selectedUser.email}</Text>
                      <Text style={styles.profileMeta}>
                        Role: {selectedUser.role || "User"} · Parish: {selectedUser.parish || "—"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Status / validation */}
                  <Text style={styles.sectionTitle}>Validation</Text>
                  <View style={styles.twoBtns}>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { flex: 1 }]}
                      onPress={() => setValidationStatus(selectedUser, "approved")}
                    >
                      <Icon name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.primaryText}>Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dangerBtn, { flex: 1 }]}
                      onPress={() => setValidationStatus(selectedUser, "rejected")}
                    >
                      <Icon name="close-circle-outline" size={16} color="#fff" />
                      <Text style={styles.primaryText}>Reject</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.divider} />

                  {/* Membership */}
                  <Text style={styles.sectionTitle}>Chatrooms membership</Text>
                  {detailsLoading ? (
                    <View style={{ paddingVertical: 10 }}>
                      <ActivityIndicator color={COLORS.light.primary} />
                    </View>
                  ) : memberChatrooms.length === 0 ? (
                    <Text style={styles.helperText}>No chatrooms found for this user.</Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {memberChatrooms.slice(0, 10).map((r) => (
                        <View key={r.id} style={styles.roomRow}>
                          <View style={styles.roomIcon}>
                            <Icon name="chatbubble-ellipses-outline" size={16} color="#111" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roomName} numberOfLines={1}>
                              {r.name || "Chatroom"}
                            </Text>
                            <Text style={styles.roomSub} numberOfLines={1}>
                              {r.isPublic ? "Public" : "Private"} · members: {(r.members || []).length}
                            </Text>
                          </View>
                        </View>
                      ))}
                      {memberChatrooms.length > 10 && (
                        <Text style={styles.helperText}>
                          Showing first 10 rooms (total {memberChatrooms.length})
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.divider} />

                  {/* Subscription editor */}
                  <Text style={styles.sectionTitle}>Subscription & Payments</Text>

                  <Field
                    label="Plan"
                    value={subDraft.plan}
                    onChangeText={(t) => setSubDraft((s) => ({ ...s, plan: t }))}
                    placeholder="e.g. Basic / Premium"
                  />
                  <Field
                    label="Status"
                    value={subDraft.status}
                    onChangeText={(t) => setSubDraft((s) => ({ ...s, status: t }))}
                    placeholder="active / expired / pending"
                  />
                  <Field
                    label="Expires at"
                    value={subDraft.expiresAt}
                    onChangeText={(t) => setSubDraft((s) => ({ ...s, expiresAt: t }))}
                    placeholder="YYYY-MM-DD"
                  />
                  <Field
                    label="Payment reference"
                    value={subDraft.paymentRef}
                    onChangeText={(t) => setSubDraft((s) => ({ ...s, paymentRef: t }))}
                    placeholder="Transaction ref / receipt id"
                  />

                  <TouchableOpacity
                    style={[
                      styles.switchRow,
                      subDraft.verified && { borderColor: "rgba(34,197,94,0.35)" },
                    ]}
                    onPress={() => setSubDraft((s) => ({ ...s, verified: !s.verified }))}
                    activeOpacity={0.9}
                  >
                    <View style={styles.switchIcon}>
                      <Icon
                        name={subDraft.verified ? "shield-checkmark" : "shield-outline"}
                        size={18}
                        color={subDraft.verified ? "#16A34A" : "#6B7280"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitle}>Payment verified</Text>
                      <Text style={styles.switchSub}>Toggle after confirming payment.</Text>
                    </View>
                    <View
                      style={[
                        styles.switchPill,
                        subDraft.verified ? styles.switchOn : styles.switchOff,
                      ]}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.primaryBtn} onPress={saveSubscription}>
                    <Icon name="save-outline" size={16} color="#fff" />
                    <Text style={styles.primaryText}>Save subscription</Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  {/* Restrict / delete */}
                  <Text style={styles.sectionTitle}>Security</Text>

                  <TouchableOpacity style={styles.grayBtn} onPress={() => toggleRestriction(selectedUser)}>
                    <Icon name="ban-outline" size={18} color="#111" />
                    <Text style={styles.grayBtnText}>
                      {selectedUser.restricted ? "Unrestrict User" : "Restrict User"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteRow} onPress={() => deleteUser(selectedUser.id)}>
                    <Icon name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.deleteText}>Delete User</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.linkBtn} onPress={() => setSelectedUser(null)}>
                    <Text style={styles.linkText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

/* ================= UI PARTS ================= */
function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
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

  /* Search */
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

  /* Pills */
  pills: { marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pillActive: { backgroundColor: "#fff" },
  pillText: { color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 12 },
  pillTextActive: { color: "#111" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* Cards */
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
  },
  cardLeft: { width: 54, height: 54 },
  avatarImg: { width: 54, height: 54, borderRadius: 18, backgroundColor: "#EEE" },
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
  metaRow: { marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  badgePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 10.5, fontWeight: "900" },

  /* Empty */
  empty: { padding: 22, alignItems: "center" },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#111" },
  emptySub: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700", textAlign: "center" },

  /* Modal */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: "92%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
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

  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  profileAvatar: { width: 62, height: 62, borderRadius: 20, backgroundColor: "#EEE" },
  profileAvatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "rgba(47,165,169,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontSize: 16, fontWeight: "900", color: "#111" },
  profileEmail: { marginTop: 4, fontSize: 12.5, fontWeight: "800", color: "#6B6B70" },
  profileMeta: { marginTop: 6, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  divider: { height: 1, backgroundColor: "#EEF0F3", marginVertical: 14 },
  sectionTitle: { fontSize: 14.5, fontWeight: "900", color: "#111", marginBottom: 10 },
  helperText: { fontSize: 12.5, color: "#6B6B70", fontWeight: "700" },

  /* Chatrooms */
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  roomName: { fontSize: 13.5, fontWeight: "900", color: "#111" },
  roomSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  /* Inputs */
  label: { fontSize: 12, fontWeight: "900", color: "#111", marginBottom: 8 },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
  },

  /* Buttons */
  twoBtns: { flexDirection: "row", gap: 10 },
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
  dangerBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  grayBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  grayBtnText: { fontWeight: "900", color: "#111" },

  deleteRow: {
    marginTop: 10,
    backgroundColor: "#111",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: { color: "#fff", fontWeight: "900" },

  /* Verified toggle */
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
  switchIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { fontWeight: "900", color: "#111" },
  switchSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },
  switchPill: { width: 52, height: 30, borderRadius: 999 },
  switchOn: { backgroundColor: "rgba(34,197,94,0.25)" },
  switchOff: { backgroundColor: "#F3F4F6" },

  linkBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  linkText: { color: COLORS.light.primary, fontWeight: "900" },
});

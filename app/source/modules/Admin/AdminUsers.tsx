import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
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
} from "firebase/firestore";

/* ================= MAIN COMPONENT ================= */
export default function AdminUsers({ navigation }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  /* ================= FETCH USERS ================= */
  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "user_data"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Fetch users error:", e);
    } finally {
      setLoading(false);
    }
  };

  /* ================= ACTIONS ================= */
  const deleteUser = async (userId: string) => {
    Alert.alert(
      "Delete user",
      "This action is irreversible. Continue?",
      [
        { text: "Cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "user_data", userId));
            setSelectedUser(null);
            fetchUsers();
          },
        },
      ]
    );
  };

  const toggleRestriction = async (user: any) => {
    await updateDoc(doc(db, "user_data", user.id), {
      restricted: !user.restricted,
    });
    setSelectedUser(null);
    fetchUsers();
  };

  /* ================= USER CARD ================= */
  const renderUser = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedUser(item)}
      activeOpacity={0.85}
    >
      <View style={styles.avatar}>
        <Icon name="person" size={20} color="#000" />
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>

      {item.restricted && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>RESTRICTED</Text>
        </View>
      )}

      <Icon name="chevron-forward" size={18} color="#bbb" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Users</Text>
      </View>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* USER MODAL */}
      <Modal
        visible={!!selectedUser}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {selectedUser && (
              <>
                <Text style={styles.modalTitle}>User Details</Text>

                <Detail label="Name" value={`${selectedUser.firstName} ${selectedUser.lastName}`} />
                <Detail label="Email" value={selectedUser.email} />
                <Detail label="Parish" value={selectedUser.parish || "—"} />
                <Detail label="Role" value={selectedUser.role || "User"} />
                <Detail
                  label="Status"
                  value={selectedUser.restricted ? "Restricted" : "Active"}
                />

                {/* ACTIONS */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => toggleRestriction(selectedUser)}
                >
                  <Icon name="ban" size={18} />
                  <Text style={styles.actionText}>
                    {selectedUser.restricted ? "Unrestrict User" : "Restrict User"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => deleteUser(selectedUser.id)}
                >
                  <Icon name="trash" size={18} color="red" />
                  <Text style={[styles.actionText, { color: "red" }]}>
                    Delete User
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedUser(null)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= DETAIL ROW ================= */
const Detail = ({ label, value }: any) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    padding: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#ededed",
    alignItems: "center",
    justifyContent: "center",
  },

  info: {
    flex: 1,
    marginLeft: 12,
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
  },

  email: {
    fontSize: 13,
    color: "#777",
  },

  badge: {
    backgroundColor: "#ffe5e5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },

  badgeText: {
    fontSize: 10,
    color: "red",
    fontWeight: "600",
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },

  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },

  detailRow: {
    marginBottom: 8,
  },

  detailLabel: {
    fontSize: 12,
    color: "#777",
  },

  detailValue: {
    fontSize: 15,
    fontWeight: "500",
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },

  deleteBtn: {
    borderTopWidth: 1,
    borderColor: "#eee",
  },

  actionText: {
    fontSize: 15,
    fontWeight: "500",
  },

  closeBtn: {
    marginTop: 12,
    alignItems: "center",
  },

  closeText: {
    color: COLORS.light.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});

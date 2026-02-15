import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { db } from "../auth/firebaseConfig";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function AdminPlatformRequests({ navigation }: any) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(
    () => requests.filter((r) => (r?.status || "pending") === "pending"),
    [requests]
  );

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "platformRequests"));
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchRequests();
    } finally {
      setRefreshing(false);
    }
  };

  const handleApprove = async (request: any) => {
    try {
      setBusyId(request.id);

      // Create the platform in chatrooms collection
      const platformData = {
        name: request.platformName || "Untitled platform",
        description: request.description || "",
        avatar: request.avatar || "",

        createdBy: request.userId,
        members: request.userId ? [request.userId] : [],
        admins: request.userId ? [request.userId] : [],

        isPublic: false, // private by default
        isClosed: false,
        blockedUsers: [],
        pinnedMessages: [],

        // IMPORTANT: use serverTimestamp() for Firestore consistency
        createdAt: serverTimestamp(),

        // optional stats fields
        unreadCount: 0,
        lastMessage: "",
      };

      await addDoc(collection(db, "chatrooms"), platformData);

      // Update request status
      await updateDoc(doc(db, "platformRequests", request.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Platform created successfully");
      await fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      Alert.alert("Error", "Failed to create platform");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setBusyId(requestId);
      await updateDoc(doc(db, "platformRequests", requestId), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });
      await fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      Alert.alert("Error", "Failed to reject request");
    } finally {
      setBusyId(null);
    }
  };

  const Row = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value: string;
    icon: string;
  }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Icon name={icon as any} size={14} color="#6B6B70" />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value || "—"}
      </Text>
    </View>
  );

  const renderRequestItem = ({ item }: any) => {
    const isBusy = busyId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.badge}>
            <Icon
              name="layers-outline"
              size={14}
              color={COLORS.light.primary}
            />
            <Text style={styles.badgeText}>PLATFORM REQUEST</Text>
          </View>

          {isBusy ? (
            <ActivityIndicator size="small" color={COLORS.light.primary} />
          ) : (
            <Icon name="chevron-forward" size={18} color="#B9BBC2" />
          )}
        </View>

        <Text style={styles.platformName} numberOfLines={1}>
          {item.platformName || "Untitled platform"}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {item.userEmail || "Unknown user"}
        </Text>

        {!!item.description && (
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
        )}

        <View style={styles.metaBox}>
          <Row
            icon="person-outline"
            label="Requested by"
            value={item.userId || "—"}
          />
          <Row icon="key-outline" label="Request ID" value={item.id} />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, isBusy && { opacity: 0.6 }]}
            onPress={() => handleReject(item.id)}
            disabled={isBusy}
            activeOpacity={0.9}
          >
            <Icon name="close" size={18} color="#EF4444" />
            <Text style={[styles.actionText, { color: "#EF4444" }]}>
              Reject
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, isBusy && { opacity: 0.6 }]}
            onPress={() => handleApprove(item)}
            disabled={isBusy}
            activeOpacity={0.9}
          >
            <Icon name="checkmark" size={18} color="#fff" />
            <Text style={[styles.actionText, { color: "#fff" }]}>
              Approve
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Premium hero header */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Platform Requests</Text>
            <Text style={styles.heroSub}>
              {pending.length} pending · create private platforms in chatrooms
            </Text>
          </View>

          <TouchableOpacity
            onPress={fetchRequests}
            style={styles.refreshBtn}
            activeOpacity={0.9}
          >
            <Icon name="refresh" size={18} color="#0E0E10" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 26 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="checkmark-done-outline" size={30} color="#111" />
              </View>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptySub}>
                There are no pending platform requests right now.
              </Text>
            </View>
          }
        />
      )}
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
  heroSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    fontSize: 12.5,
  },

  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  refreshText: { fontWeight: "900", color: "#0E0E10", fontSize: 13 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(47,165,169,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: { fontWeight: "900", color: COLORS.light.primary, fontSize: 12 },

  platformName: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#111" },
  email: { marginTop: 4, fontSize: 12.5, fontWeight: "800", color: "#6B6B70" },

  description: {
    marginTop: 10,
    color: "#444",
    fontWeight: "700",
    lineHeight: 18,
  },

  metaBox: {
    marginTop: 12,
    backgroundColor: "#F6F7F9",
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontWeight: "900", color: "#6B6B70", fontSize: 12.5 },
  rowValue: { fontWeight: "900", color: "#111", fontSize: 12.5, maxWidth: "55%" },

  actions: { marginTop: 12, flexDirection: "row", gap: 12 },

  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionText: { fontWeight: "900", fontSize: 13.5 },

  rejectBtn: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  approveBtn: { backgroundColor: COLORS.light.primary },

  empty: { paddingTop: 60, alignItems: "center", paddingHorizontal: 24 },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 14, fontWeight: "900", fontSize: 16, color: "#111" },
  emptySub: {
    marginTop: 6,
    fontWeight: "700",
    color: "#6B6B70",
    textAlign: "center",
  },
});

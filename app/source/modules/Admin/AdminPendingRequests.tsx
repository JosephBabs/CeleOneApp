import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { db } from "../auth/firebaseConfig";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function AdminPendingRequests({ navigation }: any) {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const requestsSnapshot = await getDocs(collection(db, "joinRequests"));
      setRequests(requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "joinRequests", requestId), { status: "approved" });
      fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "joinRequests", requestId), { status: "rejected" });
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const renderRequestItem = ({ item }: any) => (
    <View style={styles.requestItem}>
      <Text style={styles.requestUser}>{item.userEmail}</Text>
      <Text>Requested to join: {item.chatroomName}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
          <Text style={styles.btnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Pending Join Requests</Text>

      <FlatList
        data={requests.filter(r => r.status === "pending")}
        keyExtractor={(item) => item.id}
        renderItem={renderRequestItem}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  backBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.light.primary, padding: 10, borderRadius: 8, marginBottom: 20 },
  backText: { color: "#fff", marginLeft: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: COLORS.light.primary },
  list: { flex: 1 },
  requestItem: { padding: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  requestUser: { fontSize: 16, fontWeight: "bold" },
  buttonRow: { flexDirection: "row", marginTop: 10 },
  approveBtn: { backgroundColor: "green", padding: 8, borderRadius: 5, marginRight: 10 },
  rejectBtn: { backgroundColor: "red", padding: 8, borderRadius: 5 },
  btnText: { color: "#fff" },
});

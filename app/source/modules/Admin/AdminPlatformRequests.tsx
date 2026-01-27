import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from "react-native";
import { db } from "../auth/firebaseConfig";
import { collection, getDocs, updateDoc, doc, addDoc, arrayUnion } from "firebase/firestore";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function AdminPlatformRequests({ navigation }: any) {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const requestsSnapshot = await getDocs(collection(db, "platformRequests"));
      setRequests(requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  const handleApprove = async (request: any) => {
    try {
      // Create the platform in chatrooms collection
      const platformData = {
        name: request.platformName,
        description: request.description,
        avatar: "", // Default avatar
        createdBy: request.userId,
        members: [request.userId], // Creator as first member
        admins: [request.userId], // Creator as admin/moderator
        isPublic: false, // Private by default
        isClosed: false,
        blockedUsers: [],
        pinnedMessages: [],
        createdAt: new Date(),
      };

      await addDoc(collection(db, "chatrooms"), platformData);

      // Update request status
      await updateDoc(doc(db, "platformRequests", request.id), { status: "approved" });

      Alert.alert("Success", "Platform created successfully");
      fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      Alert.alert("Error", "Failed to create platform");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "platformRequests", requestId), { status: "rejected" });
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const renderRequestItem = ({ item }: any) => (
    <View style={styles.requestItem}>
      <Text style={styles.requestUser}>{item.userEmail}</Text>
      <Text style={styles.platformName}>{item.platformName}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
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

      <Text style={styles.title}>Platform Creation Requests</Text>

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
  requestItem: { padding: 15, borderBottomWidth: 1, borderColor: "#ddd", marginBottom: 10 },
  requestUser: { fontSize: 16, fontWeight: "bold", color: "#333" },
  platformName: { fontSize: 18, fontWeight: "600", color: COLORS.light.primary, marginTop: 5 },
  description: { fontSize: 14, color: "#666", marginTop: 5, marginBottom: 10 },
  buttonRow: { flexDirection: "row", marginTop: 10 },
  approveBtn: { backgroundColor: "green", padding: 8, borderRadius: 5, marginRight: 10 },
  rejectBtn: { backgroundColor: "red", padding: 8, borderRadius: 5 },
  btnText: { color: "#fff" },
});

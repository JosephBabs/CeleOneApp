import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import {  db } from "../auth/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function AdminUsers({ navigation }: any) {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "user_data"));
      setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const renderUserItem = ({ item }: any) => (
    <View style={styles.userItem}>
      <Text style={styles.userEmail}>{item.email}</Text>
      <Text>{item.firstName} {item.lastName}</Text>
      <Text>{item.parishName}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Firebase Users List</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
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
  userItem: { padding: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  userEmail: { fontSize: 16, fontWeight: "bold" },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { auth } from "../auth/firebaseConfig";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function AdminDashboard({ navigation }: any) {
  const handleLogout = () => {
    auth.signOut();
    navigation.replace("Login");
  };

  const menuItems = [
    { id: "1", title: "Manage Posts", icon: "document-text", navigateTo: "AdminPosts", bgColor: "#f6fdffff", borderColor: COLORS.light.primary },
    { id: "2", title: "Manage Chatrooms", icon: "chatbubbles", navigateTo: "AdminChatrooms", bgColor: "#f6fdffff", borderColor: COLORS.light.primary },
    { id: "3", title: "View Users", icon: "people", navigateTo: "AdminUsers", bgColor: "#f6fdffff", borderColor: COLORS.light.primary },
    { id: "4", title: "View Profiles", icon: "person", navigateTo: "AdminProfiles", bgColor: "#f6fdffff", borderColor: COLORS.light.primary },
    { id: "5", title: "Pending Requests", icon: "checkmark-circle", navigateTo: "AdminPendingRequests", bgColor: "#f6fdffff", borderColor: COLORS.light.primary },
  ];

  const renderMenuItem = ({ item }: any) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: item.bgColor, borderColor: item.borderColor, borderWidth: 2 }]} onPress={() => navigation.navigate(item.navigateTo)}>
      <Icon name={item.icon} size={35} color={COLORS.light.primary} />
      <Text style={styles.cardText}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.welcome}>Welcome, {auth.currentUser?.email}</Text>
      </View>

      <FlatList
        data={menuItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
      />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="log-out" size={24} color={COLORS.light.primary} />
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { alignItems: "center", marginBottom: 30 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center", marginBottom: 10, color: COLORS.light.primary },
  welcome: { fontSize: 16, textAlign: "center", marginBottom: 10, color: "#292828ff" },
  grid: { paddingBottom: 20 },
  card: { flex: 1, margin: 5, padding: 25, borderRadius: 15, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardText: { color: "#252525ff", fontSize: 14, fontWeight: "normal", marginTop: 10, textAlign: "center" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", padding: 15, borderRadius: 8, marginTop: 20 },
  btnText: { color: COLORS.light.primary, marginLeft: 10, fontSize: 16 },
});

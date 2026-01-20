import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { db } from "../auth/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function AdminProfiles({ navigation }: any) {
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const profilesSnapshot = await getDocs(collection(db, "user_data"));
      setProfiles(profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const renderProfileItem = ({ item }: any) => (
    <View style={styles.profileItem}>
      <Text style={styles.profileEmail}>{item.email}</Text>
      <Text>{item.firstName} {item.lastName}</Text>
      <Text>{item.parishName}</Text>
      <Text>{item.phone}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>User Profiles</Text>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={renderProfileItem}
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
  profileItem: { padding: 15, borderBottomWidth: 1, borderColor: "#ddd" },
  profileEmail: { fontSize: 16, fontWeight: "bold" },
});

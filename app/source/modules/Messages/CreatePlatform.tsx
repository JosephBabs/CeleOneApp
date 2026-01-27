import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { auth, db } from "../auth/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";

export default function CreatePlatform({ navigation }: any) {
  const [platformName, setPlatformName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!platformName.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      const requestData = {
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        platformName: platformName.trim(),
        description: description.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "platformRequests"), requestData);

      Alert.alert("Success", "Your platform creation request has been submitted to the admin");
      navigation.goBack();
    } catch (error) {
      console.error("Error submitting request:", error);
      Alert.alert("Error", "Failed to submit request. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Create Platform Request</Text>

      <TextInput
        style={styles.input}
        placeholder="Platform Name"
        value={platformName}
        onChangeText={setPlatformName}
        maxLength={50}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        maxLength={200}
      />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit Request</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  backBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.light.primary, padding: 10, borderRadius: 8, marginBottom: 20 },
  backText: { color: "#fff", marginLeft: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 30, color: COLORS.light.primary, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: "top" },
  submitBtn: { backgroundColor: COLORS.light.primary, padding: 15, borderRadius: 8, alignItems: "center", marginTop: 20 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

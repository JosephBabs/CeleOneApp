import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

import { COLORS } from "../../../core/theme/colors";

export default function Notifications() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const unsubscribe = firestore()
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(data);
      });

    return unsubscribe;
  }, []);

  const clearAll = async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const snap = await firestore()
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .get();

    const batch = firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  };

  const handlePress = async (item: any) => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    // Mark as read
    await firestore()
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .doc(item.id)
      .set({ read: true }, { merge: true });

    // Navigate based on notification type
    if (item.data?.type === "chat") {
      navigation.navigate("ChatRoom", { roomId: item.data.roomId });
    }

    if (item.data?.type === "post") {
      navigation.navigate("PostDetail", { postId: item.data.postId });
    }

    if (item.data?.type === "comment") {
      navigation.navigate("PostDetail", { postId: item.data.postId });
    }
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
      <View style={styles.iconContainer}>
        <Icon
          name={
            item.data?.type === "chat"
              ? "chatbubble-outline"
              : item.data?.type === "comment"
              ? "chatbox-ellipses-outline"
              : "notifications-outline"
          }
          size={24}
          color={COLORS.light.primary}
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <Text style={styles.time}>
          {item.createdAt?.toDate
            ? item.createdAt.toDate().toLocaleString()
            : ""}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("notifications.title")}</Text>
        <TouchableOpacity onPress={clearAll}>
          <Text style={styles.clearText}>{t("notifications.clearAll")}</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon
            name="notifications-off-outline"
            size={40}
            color={COLORS.light.primary}
          />
          <Text style={styles.emptyText}>
            {t("notifications.noNotifications")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginBlockStart: 22,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.light.primary,
  },
  clearText: {
    fontSize: 14,
    color: "#007BFF",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 1,
    alignItems: "center",
    elevation: 0.5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginVertical: 2,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.light.primary,
    marginTop: 8,
  },
});

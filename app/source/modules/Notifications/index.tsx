import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";

import { COLORS } from "../../../core/theme/colors";

export default function Notifications() {
  const { t } = useTranslation();

  // Example notifications data
  const [notifications, setNotifications] = useState([
    {
      id: "1",
      title: t("notifications.newMessage"),
      description: t("notifications.newMessageDesc"),
      icon: "chatbubble-outline",
      time: "2h ago",
    },
    {
      id: "2",
      title: t("notifications.updateAvailable"),
      description: t("notifications.updateAvailableDesc"),
      icon: "cloud-download-outline",
      time: "5h ago",
    },
    {
      id: "3",
      title: t("notifications.systemAlert"),
      description: t("notifications.systemAlertDesc"),
      icon: "alert-circle-outline",
      time: "1d ago",
    },
  ]);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.iconContainer}>
        <Icon name={item.icon} size={24} color={COLORS.light.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        
        <Text style={styles.headerTitle}>{t("notifications.title")}</Text>
        <TouchableOpacity onPress={() => setNotifications([])}>
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
          <Icon name="notifications-off-outline" size={40} color={COLORS.light.primary} />
          <Text style={styles.emptyText}>{t("notifications.noNotifications")}</Text>
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
    // borderRadius: 10,
    padding: 12,
    marginBottom: 1,
    alignItems: "center",
    // shadowColor: "#000",
    // shadowOpacity: 0.05,
    // shadowOffset: { width: 0, height: 2 },
    // shadowRadius: 5,
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

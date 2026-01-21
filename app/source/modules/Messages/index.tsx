import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";

import { useTranslation } from "react-i18next";
import styless from "../../../../styles";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { d_assets } from "../../configs/assets";
import { auth, db } from "../auth/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  getDoc,
} from "firebase/firestore";

export default function Messages({ navigation }: any) {
  const { t } = useTranslation();
  const currentUser = auth.currentUser;

  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [userChatRooms, setUserChatRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchChatRooms();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Fetch all chat rooms from Firebase
  const fetchChatRooms = async () => {
    try {
      setLoading(true);
      const roomsQuery = query(collection(db, "chatrooms"));

      const unsubscribe = onSnapshot(roomsQuery, async (querySnapshot) => {
        const rooms = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Check which rooms the user is a member of
        const userRooms = rooms.filter((room) =>
          room.members && room.members.includes(currentUser?.uid)
        );

        // Calculate unread counts for user rooms
        const userRoomsWithUnread = await Promise.all(
          userRooms.map(async (room) => {
            const unreadCount = await getUnreadCount(room.id);
            return { ...room, unreadCount };
          })
        );

        setChatRooms(rooms);
        setUserChatRooms(userRoomsWithUnread);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error fetching chat rooms:", error);
      setLoading(false);
    }
  };

  // Get unread message count for a specific room
  const getUnreadCount = async (roomId: string): Promise<number> => {
    try {
      if (!currentUser?.uid) return 0;

      const messagesQuery = query(
        collection(db, "chatrooms", roomId, "messages"),
        where("userId", "!=", currentUser.uid)
      );

      const messagesSnapshot = await getDocs(messagesQuery);
      return messagesSnapshot.size;
    } catch {
      console.error("Error getting unread count");
      return 0;
    }
  };

  // Check if user has pending request for a room
  const checkPendingRequest = async (roomId: string): Promise<boolean> => {
    try {
      const requestsQuery = query(
        collection(db, "joinRequests"),
        where("userId", "==", currentUser?.uid),
        where("roomId", "==", roomId)
      );
      const snapshot = await getDocs(requestsQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking pending request:", error);
      return false;
    }
  };

  // Handle opening chat or requesting join
  const handleOpenChat = async (room: any) => {
    const isUserMember = userChatRooms.some((r) => r.id === room.id);

    if (isUserMember) {
      // User is a member, open chat
      navigation.navigate("ChatRoom", {
        chatId: room.id,
        chatName: room.name,
        chatAvatar: room.avatar,
      });
    } else if (room.isPublic) {
      // Public room, add user and open chat
      try {
        // Add user to room members
        const roomRef = doc(db, "chatrooms", room.id);
        await updateDoc(roomRef, {
          members: arrayUnion(currentUser?.uid),
        });
        // Open chat
        navigation.navigate("ChatRoom", {
          chatId: room.id,
          chatName: room.name,
          chatAvatar: room.avatar,
        });
      } catch (error) {
        Alert.alert(t('messagesScreen.error'), t('messagesScreen.failedJoinRoom'));
      }
    } else {
      // Private room, show join request modal
      const hasPending = await checkPendingRequest(room.id);
      setSelectedRoom({ ...room, hasPendingRequest: hasPending });
      setShowModal(true);
    }
  };

  // Submit join request to Firebase
  const handleApplyToJoin = async () => {
    if (!selectedRoom || !currentUser) return;

    try {
      setPendingRequest(true);

      // Add join request to Firebase
      await addDoc(collection(db, "joinRequests"), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        status: "pending", // pending, approved, rejected
        createdAt: serverTimestamp(),
      });

      setShowModal(false);
      setShowConfirmation(true);
      setPendingRequest(false);
    } catch (error) {
      console.error("Error submitting join request:", error);
      Alert.alert(t('messagesScreen.error'), t('messagesScreen.failedSendRequest'));
      setPendingRequest(false);
    }
  };

  const renderRoomItem = ({ item }: any) => {
    const isUserMember = userChatRooms.some(r => r.id === item.id);
    const statusText = isUserMember 
      ? null 
      : item.isPublic 
        ? t("messages.public")
        : t("messages.private");

    // Use app icon as fallback if no avatar
    const avatarSource = item.avatar && typeof item.avatar === "string" && item.avatar.trim() !== "" && item.avatar.startsWith('http')
      ? { uri: item.avatar }
      : d_assets.images.appLogo; 

    return (
      <Pressable style={styles.card} onPress={() => handleOpenChat(item)}>
        {/* Avatar */}
        <View style={styles.iconContainer}>
          <Image 
            source={avatarSource}
            style={styles.avatar}
            defaultSource={d_assets.images.appLogo}
          />
          {!isUserMember && !item.isPublic && (
            <View style={styles.lockBadge}>
              <Icon name="lock-closed" size={12} color="#fff" />
            </View>
          )}
        </View>

        {/* Chat Info */}
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && { fontWeight: "bold", color: "#000" },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || item.description || t("messages.noMessagesYet")}
          </Text>
        </View>

        {/* Unread Messages Badge or Status */}
        {isUserMember && item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount}</Text>
          </View>
        )}

        {/* Status text if not joined */}
        {!isUserMember && (
          <Text style={[styles.pendingText, item.isPublic && { color: "#4CAF50" }]}>
            {statusText}
          </Text>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: "#fff" }]}>
      <View style={styless.header1}>
        <Image
          source={d_assets.images.appLogo}
          style={styless.logo}
        />

        <View style={styless.headerIcons}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
          >
            <Icon
              name="notifications-outline"
              size={24}
              color="#444"
              style={styless.iconRight}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>{t("messages.title")}</Text>

      {/* Your Chat Rooms */}
      {userChatRooms.length > 0 && (
        <>
          <Text style={styles.subTitle}>{t("messages.yourRooms")}</Text>
          <FlatList
            data={userChatRooms}
            keyExtractor={(item) => item.id}
            renderItem={renderRoomItem}
            contentContainerStyle={{ paddingBottom: 10 }}
            scrollEnabled={false}
          />
        </>
      )}

      {/* Available Chat Rooms */}
      <Text style={styles.subTitle}>{t("messages.availableRooms")}</Text>
      <FlatList
        data={chatRooms.filter((room) => !userChatRooms.some((r) => r.id === room.id))}
        keyExtractor={(item) => item.id}
        renderItem={renderRoomItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        scrollEnabled={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t("messages.noRooms")}</Text>
        }
      />

      {/* Modal for Join Request */}
      <Modal transparent visible={showModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("messages.requestTitle")}</Text>
            <Text style={styles.modalText}>
              {selectedRoom?.hasPendingRequest
                ? t("messages.alreadyRequested", { name: selectedRoom?.name })
                : t("messages.requestText", { name: selectedRoom?.name })
              }
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              {!selectedRoom?.hasPendingRequest && (
                <TouchableOpacity
                  style={[styles.applyBtn, pendingRequest && { opacity: 0.5 }]}
                  onPress={handleApplyToJoin}
                  disabled={pendingRequest}
                >
                  {pendingRequest ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.applyText}>{t("common.apply")}</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Dialog */}
      <Modal transparent visible={showConfirmation} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Icon
              name="checkmark-circle"
              size={60}
              color={COLORS.light.primary}
              style={{ textAlign: "center", marginBottom: 10 }}
            />
            <Text style={styles.modalTitle}>{t("messages.requestSent")}</Text>
            <Text style={styles.modalText}>
              {t("messages.confirmText", { name: selectedRoom?.name })}
            </Text>
            <TouchableOpacity
              style={[styles.applyBtn, { marginTop: 10 }]}
              onPress={() => setShowConfirmation(false)}
            >
              <Text style={styles.applyText}>{t("common.ok")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "flex-start" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    paddingStart: 20,
    color: COLORS.light.primary,
    backgroundColor: COLORS.white,
    padding: 10,
    elevation: 1,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingStart: 20,
    marginBottom: 10,
    marginTop: 15,
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    elevation: 0.4,
    padding: 12,
    marginVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderColor: "#ddd",
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E6F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
    position: "relative",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 25,
  },
  lockBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
  },
  chatInfo: {
    flex: 1,
    flexDirection: "column",
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  lastMessage: {
    fontSize: 13,
    color: "#555",
    marginTop: 2,
  },
  badge: {
    backgroundColor: COLORS.light.primary,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.light.primary,
    marginLeft: 8,
    fontWeight: "500",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#f0f0f0",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "90%",
    elevation: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: COLORS.light.primary,
    textAlign: "center",
  },
  modalText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    marginRight: 15,
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    color: "#999",
  },
  applyBtn: {
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  applyText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
});

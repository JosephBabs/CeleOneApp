import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Share,
  Modal,
  // ScrollView,
  FlatList,
  // Dimensions,
} from "react-native";
// import { Ionicons } from "@expo/vector-icons";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
// import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { COLORS } from "../../../core/theme/colors";
// import { COLORS } from "../theme/colors";
import { d_assets } from "../../configs/assets";
import { auth, db } from "../auth/firebaseConfig";
import {
  collection,
  getDoc,
  doc,
} from "firebase/firestore";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  role?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  avatar: string;
  createdBy: string;
  members: string[];
  admins: string[];
  pinnedMessages: string[];
  blockedUsers: string[];
  isClosed: boolean;
}

export default function GroupInfo({ route, navigation }: any) {
  const { t } = useTranslation();
  const { chatId, chatName, chatAvatar } = route.params;
  const [isMuted, setIsMuted] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  // const insets = useSafeAreaInsets();

  const fetchChatRoom = useCallback(async () => {
    try {
      setLoading(true);
      const roomDoc = await getDoc(doc(db, "chatrooms", chatId));
      if (roomDoc.exists()) {
        const roomData = { id: roomDoc.id, ...roomDoc.data() } as ChatRoom;
        setChatRoom(roomData);
        await fetchMembers(roomData.members || []);
      }
    } catch (error) {
      console.error("Error fetching chat room:", error);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
      fetchChatRoom();
    }
  }, [chatId, fetchChatRoom]);

  const fetchMembers = async (memberIds: string[]) => {
    try {
      const memberPromises = memberIds.map(async (userId) => {
        const userDoc = await getDoc(doc(db, "user_data", userId));
        if (userDoc.exists()) {
          return {
            id: userDoc.id,
            ...userDoc.data(),
          } as User;
        }
        return null;
      });

      const membersData = await Promise.all(memberPromises);
      const validMembers = membersData.filter((member) => member !== null) as User[];
      setMembers(validMembers);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const HEADER_EXPANDED_HEIGHT = 250;
  const HEADER_COLLAPSED_HEIGHT = 70;

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const animatedHeaderStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HEADER_EXPANDED_HEIGHT - HEADER_COLLAPSED_HEIGHT],
      [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT],
      Extrapolate.CLAMP
    ),
  }));

  const animatedImageStyle = useAnimatedStyle(() => {
    const size = interpolate(scrollY.value, [0, 180], [100, 40], Extrapolate.CLAMP);
    const radius = interpolate(scrollY.value, [0, 180], [50, 20], Extrapolate.CLAMP);
    return { width: size, height: size, borderRadius: radius };
  });

  const handleShareGroupLink = async () => {
    const link = "https://yourapp.com/group/xyz123";
    await Share.share({ message: link });
  };

  const handleExitGroup = () => {
    Alert.alert(t("groupInfo.exitGroup"), t("groupInfo.exitGroupConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("groupInfo.exitGroup"), style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  const handleDeleteConversation = () => {
    Alert.alert(t("groupInfo.deleteConversation"), t("groupInfo.deleteConversationConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("groupInfo.deleteConversation"), style: "destructive", onPress: () => {} },
    ]);
  };

  const handleReportGroup = () => {
    Alert.alert(t("groupInfo.reportGroup"), t("groupInfo.reportGroupConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("groupInfo.reportGroup"), style: "default", onPress: () => {} },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Animated.View style={[styles.header, animatedHeaderStyle]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        </View>
        <Animated.Image source={{ uri: chatAvatar }} style={[styles.avatar, animatedImageStyle]} />
        <Text style={styles.groupName}>{chatName}</Text>
        <Text style={styles.groupDesc}>{t("groupInfo.publicGroup")} • {t("groupInfo.membersCount", { count: 23421 })}</Text>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={styles.optionRow}>
          <Ionicons name="notifications-off-outline" size={22} color="#555" />
          <Text style={styles.optionText}>{t("groupInfo.muteNotifications")}</Text>
          <Switch
            value={isMuted}
            onValueChange={setIsMuted}
            thumbColor={isMuted ? COLORS.light.primary : "#ccc"}
          />
        </View>

        <TouchableOpacity style={styles.optionRow} onPress={handleShareGroupLink}>
          <Ionicons name="link-outline" size={22} color="#555" />
          <Text style={styles.optionText}>{t("groupInfo.groupInviteLink")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => setShowMembersModal(true)}
        >
          <Ionicons name="people-outline" size={22} color="#555" />
          <Text style={styles.optionText}>{t("groupInfo.viewGroupMembers")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={handleDeleteConversation}>
          <Ionicons name="trash-outline" size={22} color="orangered" />
          <Text style={[styles.optionText, { color: "orangered" }]}>{t("groupInfo.deleteConversation")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={handleReportGroup}>
          <Ionicons name="flag-outline" size={22} color="tomato" />
          <Text style={[styles.optionText, { color: "tomato" }]}>{t("groupInfo.reportGroup")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionRow, { marginTop: 20 }]} onPress={handleExitGroup}>
          <Ionicons name="exit-outline" size={22} color="red" />
          <Text style={[styles.optionText, { color: "red" }]}>{t("groupInfo.exitGroup")}</Text>
        </TouchableOpacity>
      </Animated.ScrollView>

      {/* Group Members Modal */}
      <Modal visible={showMembersModal} animationType="slide" onRequestClose={() => setShowMembersModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("groupInfo.groupMembers")}</Text>
            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
              <Ionicons name="close" size={26} color="#000" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <Image
                  source={{ uri: item.avatar || d_assets.images.appLogo }}
                  style={styles.memberAvatar}
                  defaultSource={d_assets.images.appLogo}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {item.firstName || ""} {item.lastName || ""} {chatRoom?.admins?.includes(item.id) ? t("groupInfo.admin") : t("groupInfo.member")}
                  </Text>
                  {chatRoom?.blockedUsers?.includes(item.id) && (
                    <Text style={{ fontSize: 12, color: "#FF6B6B" }}>{t("groupInfo.blocked")}</Text>
                  )}
                </View>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: "#f5faff",
    borderBottomWidth: 0.4,
    borderColor: "#ccc",
    overflow: "hidden",
  },
  headerTop: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    position: "absolute",
    top: 40,
    left: 16,
  },
  avatar: {
    marginTop: 10,
    marginBottom: 5,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "bold",
  },
  groupDesc: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderColor: "#eee",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderColor: "#ddd",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.5,
    borderColor: "#f0f0f0",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberName: {
    fontSize: 16,
  },
});

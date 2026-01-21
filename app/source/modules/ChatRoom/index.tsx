import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import styles from "./chatStyle";
import { COLORS } from "../../../core/theme/colors";
import { d_assets } from "../../configs/assets";
import { auth, db } from "../auth/firebaseConfig";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  query,
  getDocs,
  getDoc,
  where,
} from "firebase/firestore";

interface Message {
  id: string;
  text?: string;
  image?: string[];
  caption?: string;
  sender: "me" | "other";
  username: string;
  userId: string;
  userEmail: string;
  avatar: string;
  timestamp: string;
  createdAt?: any;
  replyTo?: string;
  replyToUsername?: string;
  isSending?: boolean;
  type?: "text" | "image";
  animatedValue?: Animated.Value;
  isPinned?: boolean;
  pinExpiry?: number;
  canDelete?: boolean;
  canUnwrite?: boolean;
}

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

export default function ChatRoom({ route, navigation }: any) {
  const { t } = useTranslation();
  const { chatId, chatName, chatAvatar } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToUsername, setReplyingToUsername] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  
  // Admin controls states
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showUserAdminMenu, setShowUserAdminMenu] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  
  // Pin states
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasReplies, setHasReplies] = useState(false);

  // Initialize current user and chat room
  useEffect(() => {
    fetchCurrentUser();
    fetchChatRoom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (currentUser && chatRoom) {
      const userIsMember = chatRoom.members?.includes(currentUser.id) || false;
      setIsMember(userIsMember);

      if (userIsMember) {
        fetchMessages();
      } else {
        checkPendingRequest();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, chatRoom]);

  const fetchCurrentUser = async () => {
    try {
      if (auth.currentUser?.uid) {
        const userDoc = await getDoc(doc(db, "user_data", auth.currentUser.uid));
        if (userDoc.exists()) {
          setCurrentUser({
            id: auth.currentUser.uid,
            ...userDoc.data(),
          } as User);
        }
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchChatRoom = async () => {
    try {
      const roomDoc = await getDoc(doc(db, "chatrooms", chatId));
      if (roomDoc.exists()) {
        setChatRoom({ id: roomDoc.id, ...roomDoc.data() } as ChatRoom);
      }
    } catch (error) {
      console.error("Error fetching chat room:", error);
    }
  };

  const checkPendingRequest = async () => {
    try {
      if (!currentUser) return;

      const requestsQuery = query(
        collection(db, "joinRequests"),
        where("userId", "==", currentUser.id),
        where("chatRoomId", "==", chatId)
      );

      const querySnapshot = await getDocs(requestsQuery);
      const hasPendingRequest = !querySnapshot.empty;
      setJoinRequestSent(hasPendingRequest);
    } catch (error) {
      console.error("Error checking pending request:", error);
    }
  };

  const sendJoinRequest = async () => {
    try {
      if (!currentUser || !chatRoom) return;

      const requestData = {
        userId: currentUser.id,
        userName: `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim(),
        userEmail: currentUser.email,
        chatRoomId: chatId,
        chatRoomName: chatRoom.name,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "joinRequests"), requestData);
      setJoinRequestSent(true);
      Alert.alert("Success", "Join request sent successfully!");
    } catch (error) {
      console.error("Error sending join request:", error);
      Alert.alert("Error", "Failed to send join request. Please try again.");
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const messagesQuery = query(
        collection(db, "chatrooms", chatId, "messages")
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        (querySnapshot) => {
          const fetchedMessages: Message[] = querySnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const messageId = docSnap.id;

            const message: Message = {
              id: messageId,
              text: data.text,
              image: data.image,
              caption: data.caption,
              sender: data.userId === auth.currentUser?.uid ? "me" : "other",
              username: data.userName || "User",
              userId: data.userId,
              userEmail: data.userEmail,
              avatar: data.userProfileImage || d_assets.images.appLogo,
              timestamp: data.createdAt?.toDate?.()
                ? new Date(data.createdAt.toDate()).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Now",
              createdAt: data.createdAt,
              type: data.type || "text",
              replyTo: data.replyToId,
              replyToUsername: data.replyToUsername,
              isPinned: chatRoom?.pinnedMessages?.includes(messageId) || false,
              pinExpiry: data.pinExpiry,
              canDelete: data.userId === auth.currentUser?.uid || chatRoom?.admins?.includes(auth.currentUser?.uid || ""),
              canUnwrite: chatRoom?.admins?.includes(auth.currentUser?.uid || "") || data.userId === auth.currentUser?.uid,
              animatedValue: new Animated.Value(0),
            };

            return message;
          });

          // Sort by timestamp
          fetchedMessages.sort((a, b) => {
            const timeA = a.createdAt?.toDate?.() || new Date();
            const timeB = b.createdAt?.toDate?.() || new Date();
            return timeA.getTime() - timeB.getTime();
          });

          // Calculate unread count and check for replies
          let unreadCount = 0;
          let hasReplies = false;

          fetchedMessages.forEach((message) => {
            if (message.sender === "other") {
              // Check if this message is a reply to current user
              if (message.replyToUsername === currentUser?.firstName ||
                  message.replyToUsername === currentUser?.lastName ||
                  message.replyToUsername === `${currentUser?.firstName} ${currentUser?.lastName}`.trim()) {
                hasReplies = true;
              }
              unreadCount++;
            }
          });

          setMessages(fetchedMessages);
          setUnreadCount(unreadCount);
          setHasReplies(hasReplies);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching messages:", error);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error("Error setting up messages listener:", error);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      const messageData: any = {
        text: inputText.trim(),
        type: "text",
        userId: auth.currentUser?.uid,
        userEmail: auth.currentUser?.email,
        userName: currentUser
          ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
          : "User",
        userProfileImage: currentUser?.avatar || d_assets.images.appLogo,
        createdAt: serverTimestamp(),
        memberList: chatRoom?.members || [], // Include for read permission
      };

      if (replyingTo) {
        messageData.replyToId = replyingTo;
        messageData.replyToUsername = replyingToUsername;
      }

      await addDoc(collection(db, "chatrooms", chatId, "messages"), messageData);
      
      setInputText("");
      setReplyingTo(null);
      setReplyingToUsername(null);
      
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (error: any) {
      console.error("Error sending message:", error);
      if (error.code === 'permission-denied') {
        Alert.alert(t('chatRoomAlerts.permissionDenied'), t('chatRoomAlerts.noPermissionSend'));
      } else {
        Alert.alert(t('chatRoomAlerts.error'), t('chatRoomAlerts.failedSendMessage'));
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      Alert.alert(
        t('chatRoomAlerts.deleteMessage'),
        t('chatRoomAlerts.deleteMessageConfirm'),
        [
          { text: t('chatRoomAlerts.cancel'), onPress: () => setShowMessageMenu(false) },
          {
            text: t('chatRoomAlerts.delete'),
            onPress: async () => {
              try {
                await deleteDoc(doc(db, "chatrooms", chatId, "messages", messageId));
                setShowMessageMenu(false);
                Alert.alert(t('chatRoomAlerts.success'), t('chatRoomAlerts.messageDeleted'));
              } catch (error: any) {
                console.error("Error deleting message:", error);
                if (error.code === 'permission-denied') {
                  Alert.alert(t('chatRoomAlerts.error'), t('chatRoomAlerts.noPermissionDelete'));
                } else {
                  Alert.alert(t('chatRoomAlerts.error'), t('chatRoomAlerts.failedDelete'));
                }
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error showing delete dialog:", error);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!chatRoom) return;

    try {
      const messageRef = doc(db, "chatrooms", chatId, "messages", messageId);
      const roomRef = doc(db, "chatrooms", chatId);

      const currentPins = chatRoom.pinnedMessages || [];
      
      if (currentPins.includes(messageId)) {
        // Unpin
        await updateDoc(roomRef, {
          pinnedMessages: arrayRemove(messageId),
        });
        Alert.alert(t('chatRoomAlerts.success'), t('chatRoomAlerts.messageUnpinned'));
      } else {
        // Check if at max pins (7)
        if (currentPins.length >= 7) {
          Alert.alert(t('chatRoomAlerts.limitReached'), t('chatRoomAlerts.maxPins'));
          return;
        }

        // Pin with 24-hour expiry
        const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
        await updateDoc(messageRef, {
          pinExpiry: expiryTime,
        });
        await updateDoc(roomRef, {
          pinnedMessages: arrayUnion(messageId),
        });
        Alert.alert(t('chatRoomAlerts.success'), t('chatRoomAlerts.messagePinned'));
      }
      setShowMessageMenu(false);
    } catch (error) {
      console.error("Error pinning message:", error);
    }
  };

  const handleRemovePin = async (messageId: string) => {
    if (!chatRoom?.admins?.includes(auth.currentUser?.uid || "")) {
      Alert.alert(t('chatRoomAlerts.permissionDenied'), t('chatRoomAlerts.onlyAdminsPin'));
      return;
    }

    try {
      const roomRef = doc(db, "chatrooms", chatId);
      await updateDoc(roomRef, {
        pinnedMessages: arrayRemove(messageId),
      });
      Alert.alert(t('chatRoomAlerts.success'), t('chatRoomAlerts.pinRemoved'));
    } catch (error) {
      console.error("Error removing pin:", error);
    }
  };

  const handleBlockUser = async (userId: string, userName: string) => {
    if (!chatRoom?.admins?.includes(auth.currentUser?.uid || "")) {
      Alert.alert(t('chatRoomAlerts.permissionDenied'), t('chatRoomAlerts.onlyAdminsBlock'));
      return;
    }

    try {
      const roomRef = doc(db, "chatrooms", chatId);
      await updateDoc(roomRef, {
        blockedUsers: arrayUnion(userId),
      });
      Alert.alert(t('chatRoomAlerts.success'), `${userName} ${t('chatRoomAlerts.userBlocked')}`);
      setShowUserAdminMenu(false);
    } catch (error) {
      console.error("Error blocking user:", error);
    }
  };

  const handleMakeAdmin = async (userId: string, userName: string) => {
    if (!chatRoom?.admins?.includes(auth.currentUser?.uid || "")) {
      Alert.alert(t('chatRoomAlerts.permissionDenied'), t('chatRoomAlerts.onlyAdminsAssign'));
      return;
    }

    try {
      const roomRef = doc(db, "chatrooms", chatId);
      await updateDoc(roomRef, {
        admins: arrayUnion(userId),
      });
      Alert.alert(t('chatRoomAlerts.success'), `${userName} ${t('chatRoomAlerts.userAdmin')}`);
      setShowUserAdminMenu(false);
    } catch (error) {
      console.error("Error making admin:", error);
    }
  };

  const handleCloseGroup = async () => {
    if (!chatRoom?.admins?.includes(auth.currentUser?.uid || "")) {
      Alert.alert(t('chatRoomAlerts.permissionDenied'), t('chatRoomAlerts.onlyAdminsClose'));
      return;
    }

    Alert.alert(t('chatRoomAlerts.closeGroup'), t('chatRoomAlerts.closeGroupConfirm'), [
      { text: t('chatRoomAlerts.cancel') },
      {
        text: t('chatRoomAlerts.close'),
        onPress: async () => {
          try {
            const roomRef = doc(db, "chatrooms", chatId);
            await updateDoc(roomRef, {
              isClosed: true,
            });
            Alert.alert(t('chatRoomAlerts.success'), t('chatRoomAlerts.groupClosed'));
          } catch (error) {
            console.error("Error closing group:", error);
          }
        },
      },
    ]);
  };

  const handleScrollToMessage = (messageId: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }
    setShowPinnedList(false);
  };

  const createPanResponder = (msg: Message) =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dx > 25,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          msg.animatedValue?.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: () => {
        setReplyingTo(msg.id);
        setReplyingToUsername(msg.username);
        Animated.timing(msg.animatedValue!, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      },
    });

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender === "me";
    const panResponder = createPanResponder(item);

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [
            { translateX: item.animatedValue || new Animated.Value(0) },
          ],
        }}
      >
        <View
          style={[
            styles.messageRow,
            isMe ? styles.rowRight : styles.rowLeft,
            item.isPinned && styles.pinnedMessageRow,
          ]}
        >
          {!isMe && (
            <Image
              // source={{ uri: item.avatar }}
              source={d_assets.images.appLogo}
              style={styles.userAvatar}
              defaultSource={d_assets.images.appLogo}
            />
          )}

          <TouchableOpacity
            style={[
              styles.messageBubble,
              isMe ? styles.myBubble : styles.otherBubble,
              item.isPinned && styles.pinnedBubble,
            ]}
            onLongPress={() => {
              setSelectedMessage(item);
              setShowMessageMenu(true);
            }}
          >
            {!isMe && <Text style={styles.username}>{item.username}</Text>}

            {item.replyTo && (
              <TouchableOpacity style={styles.replyBox} onPress={() => handleScrollToMessage(item.replyTo!)}>
                <Text style={styles.replyLabel}>↳ {item.replyToUsername}</Text>
                <Text style={[styles.replyText, { fontStyle: "italic" }]} numberOfLines={3}>
                  {messages.find((m) => m.id === item.replyTo)?.text || "Media message"}
                </Text>
              </TouchableOpacity>
            )}

            {item.isPinned && (
              <View style={styles.pinnedLabel}>
                <Ionicons name="pin" size={12} color="#FF6B6B" />
                <Text style={styles.pinnedText}>Pinned</Text>
              </View>
            )}

            {item.text && <Text style={styles.messageText}>{item.text}</Text>}

            <View style={styles.footerRow}>
              <Text style={styles.timestamp}>{item.timestamp}</Text>
              {isMe && (
                <Ionicons
                  name={item.isSending ? "time-outline" : "checkmark-done"}
                  size={14}
                  color="#aaa"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const isAdmin = chatRoom?.admins?.includes(auth.currentUser?.uid || "");

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 34}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerGroup}
              onPress={() =>
                navigation.navigate("GroupInfo", { chatId, chatName, chatAvatar })
              }
            >
              <Image
                source={{ uri: chatAvatar }}
                style={styles.headerAvatar}
                defaultSource={d_assets.images.appLogo}
              />
              <View>
                <Text style={styles.headerTitle}>{chatName}</Text>
                <Text style={{ fontSize: 12, color: "#666" }}>
                  {chatRoom?.members?.length || 0} members
                  {chatRoom?.isClosed && " • Closed"}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              
              <TouchableOpacity onPress={() => setShowPinnedList(true)}>
                <Ionicons name="pin" size={22} color="#FF6B6B" />
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => setShowGroupSettings(true)}
                  style={{ marginLeft: 8 }}
                >
                  <Ionicons name="settings-outline" size={22} color="#000" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Messages or Join Request */}
          {isMember ? (
            <View style={styles.chatBg}>
              <Image
                source={d_assets.images.chatBg}
                style={styles.chatTiledBg}
                resizeMode="repeat" // works only on iOS
              />
              {loading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text>{t('chatRoom.loadingMessages')}</Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMessage}
                  contentContainerStyle={styles.chatList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
                Join {chatName}
              </Text>
              <Text style={{ textAlign: "center", color: "#666", marginBottom: 20 }}>
                This is a private chat room. Send a join request to participate.
              </Text>
              {joinRequestSent ? (
                <View style={{ alignItems: "center" }}>
                  <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                  <Text style={{ marginTop: 10, color: "#4CAF50", fontWeight: "500" }}>
                    Join request sent
                  </Text>
                  <Text style={{ marginTop: 5, color: "#666", textAlign: "center" }}>
                    Your request is pending approval from the administrators.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.light.primary,
                    paddingHorizontal: 30,
                    paddingVertical: 12,
                    borderRadius: 8,
                  }}
                  onPress={sendJoinRequest}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Send Join Request</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Replying Preview */}
          {replyingTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                Replying to: {replyingToUsername}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Area */}
          {isMember && (
            <View style={styles.inputArea}>
              <TouchableOpacity>
                <Ionicons name="document-attach-outline" size={24} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity style={{ marginHorizontal: 8 }}>
                <Ionicons name="mic-outline" size={24} color="#555" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#aaa"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!chatRoom?.isClosed && !chatRoom?.blockedUsers?.includes(auth.currentUser?.uid || "")}
              />
              <TouchableOpacity onPress={sendMessage}>
                <Ionicons name="send" size={24} color="#2FA5A9" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Message Menu Modal */}
      <Modal transparent visible={showMessageMenu} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowMessageMenu(false)}
        >
          <View style={styles.messageMenuModal}>
            {selectedMessage?.sender === "me" && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleDeleteMessage(selectedMessage.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                <Text style={styles.menuText}>Delete</Text>
              </TouchableOpacity>
            )}
            {isAdmin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handlePinMessage(selectedMessage?.id || "")}
              >
                <Ionicons
                  name={selectedMessage?.isPinned ? "pin-off-outline" : "pin"}
                  size={20}
                  color="#FF6B6B"
                />
                <Text style={styles.menuText}>
                  {selectedMessage?.isPinned ? "Unpin" : "Pin (24h)"}
                </Text>
              </TouchableOpacity>
            )}
            {isAdmin && selectedMessage?.sender !== "me" && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setSelectedUser(selectedMessage);
                  setShowMessageMenu(false);
                  setShowUserAdminMenu(true);
                }}
              >
                <Ionicons name="person-remove-outline" size={20} color="#FFA500" />
                <Text style={styles.menuText}>User Options</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowMessageMenu(false)}
            >
              <Ionicons name="close" size={20} color="#666" />
              <Text style={styles.menuText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* User Admin Menu Modal */}
      <Modal transparent visible={showUserAdminMenu} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowUserAdminMenu(false)}
        >
          <View style={styles.messageMenuModal}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleMakeAdmin(selectedUser?.userId || "", selectedUser?.username || "")
              }
            >
              <Ionicons name="crown-outline" size={20} color="#FFD700" />
              <Text style={styles.menuText}>Make Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() =>
                handleBlockUser(selectedUser?.userId || "", selectedUser?.username || "")
              }
            >
              <Ionicons name="ban" size={20} color="#FF6B6B" />
              <Text style={styles.menuText}>Block from Writing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowUserAdminMenu(false)}
            >
              <Ionicons name="close" size={20} color="#666" />
              <Text style={styles.menuText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pinned Messages List Modal */}
      <Modal transparent visible={showPinnedList} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: "#ddd",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>Pinned Messages</Text>
            <TouchableOpacity onPress={() => setShowPinnedList(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={messages.filter((m) => m.isPinned)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{
                  padding: 12,
                  borderBottomWidth: 1,
                  borderColor: "#eee",
                  backgroundColor: "#FFF9E6",
                }}
                onPress={() => handleScrollToMessage(item.id)}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "bold", fontSize: 14 }}>
                      {item.username}
                    </Text>
                    <Text
                      style={{
                        color: "#555",
                        marginTop: 4,
                        fontSize: 13,
                      }}
                      numberOfLines={2}
                    >
                      {item.text || "Image"}
                    </Text>
                    <Text style={{ color: "#999", fontSize: 11, marginTop: 4 }}>
                      {item.timestamp}
                    </Text>
                  </View>
                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() => handleRemovePin(item.id)}
                      style={{ marginLeft: 8 }}
                    >
                      <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: "#999" }}>No pinned messages</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Group Settings Modal */}
      <Modal transparent visible={showGroupSettings} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: "#ddd",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>Group Settings</Text>
            <TouchableOpacity onPress={() => setShowGroupSettings(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
              Admin Actions
            </Text>

            <TouchableOpacity
              style={{
                padding: 12,
                backgroundColor: "#F0F0F0",
                borderRadius: 8,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={handleCloseGroup}
            >
              <Ionicons
                name="lock-closed"
                size={20}
                color={chatRoom?.isClosed ? "#FF6B6B" : "#666"}
              />
              <Text
                style={{
                  marginLeft: 12,
                  fontSize: 14,
                  fontWeight: "500",
                  color: chatRoom?.isClosed ? "#FF6B6B" : "#333",
                }}
              >
                {chatRoom?.isClosed ? "Group Closed" : "Close Group"}
              </Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 14, color: "#555", marginBottom: 12, marginTop: 20 }}>
              Group Members ({chatRoom?.members?.length || 0})
            </Text>

            <FlatList
              data={chatRoom?.members || []}
              scrollEnabled={false}
              keyExtractor={(item) => item}
              renderItem={({ item: userId }) => (
                <View
                  style={{
                    padding: 12,
                    backgroundColor: "#F9F9F9",
                    borderRadius: 8,
                    marginBottom: 8,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "500" }}>
                    {chatRoom?.admins?.includes(userId) ? "👑 Admin" : "👤 Member"}
                  </Text>
                  {chatRoom?.blockedUsers?.includes(userId) && (
                    <Text style={{ fontSize: 11, color: "#FF6B6B" }}>🚫 Blocked</Text>
                  )}
                </View>
              )}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

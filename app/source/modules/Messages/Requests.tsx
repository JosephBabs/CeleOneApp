import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
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
  updateDoc,
  doc,
  arrayUnion,
} from "firebase/firestore";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
}

interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  receiverId: string;
  status: string;
  createdAt: any;
}

export default function Requests({ navigation, onClose }: any) {
  const { t } = useTranslation();
  const currentUser = auth.currentUser;

  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchFriendRequests();
    }
  }, [currentUser]);

  // Fetch friend requests
  const fetchFriendRequests = async () => {
    try {
      setLoadingRequests(true);
      if (!currentUser) return;

      const requestsQuery = query(
        collection(db, "friendRequests"),
        where("receiverId", "==", currentUser.uid),
        where("status", "==", "pending")
      );

      const sentRequestsQuery = query(
        collection(db, "friendRequests"),
        where("senderId", "==", currentUser.uid)
      );

      const [requestsSnapshot, sentSnapshot] = await Promise.all([
        getDocs(requestsQuery),
        getDocs(sentRequestsQuery)
      ]);

      const requestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FriendRequest[];

      const sentData = sentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FriendRequest[];

      setFriendRequests(requestsData);
      setSentRequests(sentData);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Search users
  const searchUsers = async (searchTerm: string) => {
    try {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      const usersQuery = query(
        collection(db, "user_data"),
        where("email", ">=", searchTerm.toLowerCase()),
        where("email", "<=", searchTerm.toLowerCase() + '\uf8ff')
      );

      const querySnapshot = await getDocs(usersQuery);
      const usersData = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as User))
        .filter(user => user.id !== currentUser?.uid); // Exclude current user

      setSearchResults(usersData);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Send friend request
  const sendFriendRequest = async (receiverId: string) => {
    try {
      if (!currentUser) return;

      const requestData = {
        senderId: currentUser.uid,
        senderName: `${currentUser.displayName || ""}`.trim(),
        senderEmail: currentUser.email,
        receiverId,
        status: "pending",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "friendRequests"), requestData);
      Alert.alert("Success", "Friend request sent!");
      fetchFriendRequests();
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (requestId: string, senderId: string, senderName: string) => {
    try {
      if (!currentUser) return;

      // Update request status
      await updateDoc(doc(db, "friendRequests", requestId), {
        status: "accepted",
      });

      // Create friendship
      await addDoc(collection(db, "friends"), {
        users: [currentUser.uid, senderId],
        createdAt: serverTimestamp(),
      });

      // Create personal chat room with sender's name
      const chatRoomData = {
        name: senderName,
        avatar: "",
        createdBy: currentUser.uid,
        members: [currentUser.uid, senderId],
        admins: [currentUser.uid, senderId],
        isPublic: false,
        isPersonal: true,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "chatrooms"), chatRoomData);

      Alert.alert("Success", "Friend request accepted!");
      fetchFriendRequests();
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request");
    }
  };

  // Reject friend request
  const rejectFriendRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "friendRequests", requestId), {
        status: "rejected",
      });

      Alert.alert("Success", "Friend request rejected");
      fetchFriendRequests();
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Error", "Failed to reject friend request");
    }
  };

  const renderSearchResult = ({ item }: { item: User }) => {
    const isRequestSent = sentRequests.some(req => req.receiverId === item.id && req.status === "pending");

    return (
      <View style={styles.userItem}>
        <Image
          source={item.avatar ? { uri: item.avatar } : d_assets.images.appLogo}
          style={styles.userAvatar}
          defaultSource={d_assets.images.appLogo}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.firstName || ""} {item.lastName || ""}
          </Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, isRequestSent && { backgroundColor: "#ccc" }]}
          onPress={() => !isRequestSent && sendFriendRequest(item.id)}
          disabled={isRequestSent}
        >
          <Text style={styles.actionText}>
            {isRequestSent ? "Sent" : "Send Request"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestItem}>
      <Image
        source={d_assets.images.appLogo}
        style={styles.userAvatar}
        defaultSource={d_assets.images.appLogo}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.senderName}</Text>
        <Text style={styles.userEmail}>{item.senderEmail}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: COLORS.light.primary }]}
          onPress={() => acceptFriendRequest(item.id, item.senderId)}
        >
          <Text style={styles.actionText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#ff6b6b" }]}
          onPress={() => rejectFriendRequest(item.id)}
        >
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.sentItem}>
      <Image
        source={d_assets.images.appLogo}
        style={styles.userAvatar}
        defaultSource={d_assets.images.appLogo}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.senderName}</Text>
        <Text style={styles.userEmail}>{item.senderEmail}</Text>
        <Text style={styles.statusText}>
          {item.status === "pending" ? "Pending" : item.status}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onClose ? onClose() : navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("requests.title")}</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search users by email..."
        value={userSearch}
        onChangeText={(text) => {
          setUserSearch(text);
          searchUsers(text);
        }}
      />

      {loading && <ActivityIndicator size="small" color={COLORS.light.primary} />}

      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={renderSearchResult}
        ListHeaderComponent={
          <>
            {friendRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Friend Requests</Text>
                <FlatList
                  data={friendRequests}
                  keyExtractor={(item) => item.id}
                  renderItem={renderFriendRequest}
                  scrollEnabled={false}
                />
              </>
            )}
            {sentRequests.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Sent Requests</Text>
                <FlatList
                  data={sentRequests}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSentRequest}
                  scrollEnabled={false}
                />
              </>
            )}
          </>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    margin: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f5f5f5",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  sentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  statusText: {
    fontSize: 12,
    color: "#999",
  },
  actionButton: {
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
});

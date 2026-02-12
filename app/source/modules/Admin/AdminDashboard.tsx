import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { auth, db } from "../auth/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function AdminDashboard({ navigation }: any) {
  const [loading, setLoading] = useState(true);

  const [counts, setCounts] = useState({
    users: 0,
    chatrooms: 0,
    posts: 0,
    pendingRequests: 0,
    platformRequests: 0,
    cantiques: 0,
    tvChannels: 0,
    filmsAndSongs: 0,
    videos: 0,
  });

  /* ================= FETCH COUNTS ================= */
  const fetchCounts = async () => {
    try {
      const [
        usersSnap,
        chatroomsSnap,
        postsSnap,
        pendingSnap,
        platformSnap,
        cantiquesSnap,
        tvSnap,
        filmsAndSongsSnap,
        videsoSnap,
      ] = await Promise.all([
        getDocs(collection(db, "user_data")),
        getDocs(collection(db, "chatrooms")),
        getDocs(collection(db, "posts")),
        getDocs(collection(db, "joinRequests")),
        getDocs(collection(db, "platformRequests")),
        getDocs(collection(db, "cantiques")),
        getDocs(collection(db, "channels")),
        getDocs(collection(db, "songs"), ),
        getDocs(collection(db, "videos"), ),
      ]);

      setCounts({
        users: usersSnap.size,
        chatrooms: chatroomsSnap.size,
        posts: postsSnap.size,
        pendingRequests: pendingSnap.size,
        platformRequests: platformSnap.size,
        cantiques: cantiquesSnap.size,
        tvChannels: tvSnap.size,
        filmsAndSongs: filmsAndSongsSnap.size,
        videos: videsoSnap.size, // Use the size of the videos collection
      });
    } catch (error) {
      console.error("Error fetching dashboard counts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  /* ================= DASHBOARD CARDS ================= */
  const stats = [
    {
      id: "1",
      label: "Users",
      value: counts.users,
      icon: "people",
      route: "AdminUsers",
    },
    {
      id: "2",
      label: "Chatrooms",
      value: counts.chatrooms,
      icon: "chatbubbles",
      route: "AdminChatrooms",
    },
    {
      id: "3",
      label: "Posts",
      value: counts.posts,
      icon: "document-text",
      route: "AdminPosts",
    },
    {
      id: "4",
      label: "Pending Requests",
      value: counts.pendingRequests,
      icon: "time",
      route: "AdminPendingRequests",
    },
    {
      id: "5",
      label: "Platform Requests",
      value: counts.platformRequests,
      icon: "layers",
      route: "AdminPlatformRequests",
    },
    {
      id: "6",
      label: "Cantiques",
      value: counts.cantiques,
      icon: "musical-notes",
      route: "AdminCantiques",
    },
    {
      id: "7",
      label: "TV Channels",
      value: counts.tvChannels,
      icon: "tv",
      route: "AdminTVChannels",
    },
    
    {
      id: "8",
      label: "Films & Songs",
      value: counts.filmsAndSongs + counts.videos || 0,
      icon: "film",
      route: "AdminMusicAndFilms",
    },
  ];

  const renderCard = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate(item.route)}
    >
      <View style={styles.iconBox}>
        <Icon name={item.icon} size={26} color={COLORS.light.primary} />
      </View>

      <View style={styles.textBox}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.value}>{item.value}</Text>
      </View>

      <Icon name="chevron-forward" size={18} color="#bbb" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Welcome, {auth.currentUser?.email}
        </Text>
      </View>

      {/* Loader */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      ) : (
        <FlatList
          data={stats}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    padding: 16,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#ededed",
    alignItems: "center",
    justifyContent: "center",
  },

  textBox: {
    flex: 1,
    marginLeft: 10,
  },

  label: {
    fontSize: 13,
    color: "#777",
  },

  value: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginTop: 2,
  },
});

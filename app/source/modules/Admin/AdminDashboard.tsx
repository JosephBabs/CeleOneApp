import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import { auth, db } from "../auth/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

type StatItem = {
  id: string;
  label: string;
  value: number;
  icon: string;
  route: string;
  tint: string;
};

export default function AdminDashboard({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
        songsSnap,
        videosSnap,
      ] = await Promise.all([
        getDocs(collection(db, "user_data")),
        getDocs(collection(db, "chatrooms")),
        getDocs(collection(db, "posts")),
        getDocs(collection(db, "joinRequests")),
        getDocs(collection(db, "platformRequests")),
        getDocs(collection(db, "cantiques")),
        getDocs(collection(db, "channels")),
        getDocs(collection(db, "songs")),
        getDocs(collection(db, "videos")),
      ]);

      setCounts({
        users: usersSnap.size,
        chatrooms: chatroomsSnap.size,
        posts: postsSnap.size,
        pendingRequests: pendingSnap.size,
        platformRequests: platformSnap.size,
        cantiques: cantiquesSnap.size,
        tvChannels: tvSnap.size,
        filmsAndSongs: songsSnap.size,
        videos: videosSnap.size,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching dashboard counts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCounts();
  };

  const email = auth.currentUser?.email || "admin@domain.com";

  const totalMedia = useMemo(() => {
    return (counts.filmsAndSongs || 0) + (counts.videos || 0);
  }, [counts.filmsAndSongs, counts.videos]);

  /* ================= DASHBOARD CARDS ================= */
  const stats: StatItem[] = [
    {
      id: "1",
      label: "Users",
      value: counts.users,
      icon: "people-outline",
      route: "AdminUsers",
      tint: "#3B82F6",
    },
    {
      id: "2",
      label: "Chatrooms",
      value: counts.chatrooms,
      icon: "chatbubbles-outline",
      route: "AdminChatrooms",
      tint: "#8B5CF6",
    },
    {
      id: "3",
      label: "Posts",
      value: counts.posts,
      icon: "newspaper-outline",
      route: "AdminPosts",
      tint: "#10B981",
    },
    {
      id: "4",
      label: "Pending Requests",
      value: counts.pendingRequests,
      icon: "time-outline",
      route: "AdminPendingRequests",
      tint: "#F59E0B",
    },
    {
      id: "5",
      label: "Platform Requests",
      value: counts.platformRequests,
      icon: "layers-outline",
      route: "AdminPlatformRequests",
      tint: "#EF4444",
    },
    {
      id: "6",
      label: "Cantiques",
      value: counts.cantiques,
      icon: "musical-notes-outline",
      route: "AdminCantiques",
      tint: "#06B6D4",
    },
    {
      id: "7",
      label: "TV Channels",
      value: counts.tvChannels,
      icon: "tv-outline",
      route: "AdminTVChannels",
      tint: "#0EA5E9",
    },
    {
      id: "8",
      label: "Films & Songs",
      value: totalMedia,
      icon: "film-outline",
      route: "AdminMusicAndFilms",
      tint: COLORS.light.primary || "#008080",
    },
  ];

  const renderCard = ({ item }: { item: StatItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate(item.route)}
    >
      <View style={[styles.cardTop]}>
        <View style={[styles.iconPill, { backgroundColor: `${item.tint}1A` }]}>
          <Icon name={item.icon} size={22} color={item.tint} />
        </View>

        <Icon name="chevron-forward" size={18} color="#B8B8BC" />
      </View>

      <Text style={styles.value}>{item.value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {item.label}
      </Text>

      <View style={[styles.footerPill, { backgroundColor: `${item.tint}12` }]}>
        <View style={[styles.dot, { backgroundColor: item.tint }]} />
        <Text style={[styles.footerPillText, { color: item.tint }]}>
          View details
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroTitle}>Admin Dashboard</Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {email}
            </Text>
          </View>

          <View style={styles.heroBadge}>
            <Icon name="shield-checkmark" size={16} color="#fff" />
            <Text style={styles.heroBadgeText}>ADMIN</Text>
          </View>
        </View>

        <View style={styles.heroBottomRow}>
          <View style={styles.heroChip}>
            <Icon name="pulse-outline" size={16} color="#fff" />
            <Text style={styles.heroChipText}>
              Live stats · {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
            </Text>
          </View>

          <TouchableOpacity onPress={onRefresh} activeOpacity={0.9} style={styles.refreshBtn}>
            <Icon name="refresh" size={18} color="#0E0E10" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loader */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      ) : (
        <FlatList
          data={stats}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.light.primary}
              colors={[COLORS.light.primary]}
            />
          }
        />
      )}
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F5F7",
    paddingHorizontal: 14,
    paddingTop: 14,
  },

  hero: {
    backgroundColor: "#0E0E10",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  heroSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12.5,
    fontWeight: "700",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.6,
  },
  heroBottomRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  heroChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroChipText: {
    color: "#fff",
    fontSize: 12.5,
    fontWeight: "800",
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    paddingBottom: 20,
    gap: 12,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "android" ? 0.07 : 0.06,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    minHeight: 150,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  iconPill: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  value: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "900",
    color: "#0E0E10",
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
    color: "#6B6B70",
  },

  footerPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  footerPillText: {
    fontWeight: "900",
    fontSize: 12,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B6B70",
  },
});

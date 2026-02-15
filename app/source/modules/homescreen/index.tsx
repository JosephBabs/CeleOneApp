/* eslint-disable react/no-unstable-nested-components */
// Home.tsx — Premium redesign (same logic/structure, better UI)
// ✅ Keeps: tabs, search, tags, list rendering per category, likes, refresh, floating action
// ✅ Adds: premium header + quick chips, better tag badges, premium post cards, consistent spacing, empty state, better media overlays
// ✅ No animated gradient (as requested)
//
// NOTE: This file replaces your UI layer but preserves your data/logic.
// Keep your existing ./styles import? -> I intentionally DO NOT use your old styles to avoid conflicts.
// If you MUST keep './styles', tell me and I will adapt it to the new style tokens.

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import { FloatingAction } from "react-native-floating-action";
import { WebView } from "react-native-webview";
import { COLORS } from "../../../core/theme/colors";
import { d_assets } from "../../configs/assets";
import { auth, db } from "../auth/firebaseConfig";
import {
  collection,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  doc,
  query,
  getDocs,
} from "firebase/firestore";

const Home = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState("news");
  const [posts, setPosts] = useState<any[]>([]);
  const [commentCounts, setCommentCounts] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = auth.currentUser?.email === "bajos3d@gmail.com";

  const getEmptyIcon = (category: string) => {
    switch (category) {
      case "news":
        return "newspaper-outline";
      case "announcements":
        return "megaphone-outline";
      case "reforms":
        return "document-text-outline";
      case "decisions":
        return "checkmark-circle-outline";
      case "events":
        return "calendar-outline";
      default:
        return "document-outline";
    }
  };

  const getEmptyText = (category: string) => {
    switch (category) {
      case "news":
        return t("home.empty.news");
      case "announcements":
        return t("home.empty.announcements");
      case "reforms":
        return t("home.empty.reforms");
      case "decisions":
        return t("home.empty.decisions");
      case "events":
        return t("home.empty.events");
      default:
        return t("home.empty.default");
    }
  };

  const fetchCommentCounts = async (postsArr: any[]) => {
    const counts: { [key: string]: number } = {};
    for (const post of postsArr) {
      try {
        const commentsQuery = query(collection(db, "posts", post.id, "comments"));
        const commentsSnapshot = await getDocs(commentsQuery);

        let total = 0;
        for (const commentDoc of commentsSnapshot.docs) {
          total += 1;
          const repliesQuery = query(
            collection(db, "posts", post.id, "comments", commentDoc.id, "replies")
          );
          const repliesSnapshot = await getDocs(repliesQuery);
          total += repliesSnapshot.size;
        }
        counts[post.id] = total;
      } catch (error) {
        console.error("Error fetching comments for post:", post.id, error);
        counts[post.id] = 0;
      }
    }
    setCommentCounts(counts);
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "posts"),
      async (querySnapshot) => {
        const postsData = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPosts(postsData);
        await fetchCommentCounts(postsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to posts: ", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const postsQuery = query(collection(db, "posts"));
      const querySnapshot = await getDocs(postsQuery);
      const postsData = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(postsData);
      await fetchCommentCounts(postsData);
    } catch (error) {
      console.error("Error refreshing posts:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Floating action
  const actions = [
    {
      text: "Cèlè One Live",
      icon: <Icon name="play" size={20} color="#fff" />,
      name: "bt_live_tv",
      position: 1,
    },
    {
      text: "Alléluia FM",
      icon: <Icon name="radio" size={20} color="#fff" />,
      name: "bt_radio",
      position: 2,
    },
  ];

  const handlePress = (name?: string) => {
    switch (name) {
      case "bt_live_tv":
        navigation.navigate("TvPlayerScreen");
        break;
      case "bt_radio":
        navigation.navigate("RadioPlayerScreen");
        break;
      default:
        break;
    }
  };

  // Search/Tags logic (kept)
  const availableCategories = useMemo(() => [...new Set(posts.map((p) => p.category))], [posts]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t2) => t2 !== tag) : [...prev, tag]));
  };

  const handleSearchFocus = () => setIsSearching(true);
  const handleSearchBlur = () => {
    if (selectedTags.length === 0 && !searchText.trim()) setIsSearching(false);
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const clearSearch = () => {
    setSearchText("");
    setSelectedTags([]);
    setIsSearching(false);
  };

  const getFilteredPosts = () => {
    let filtered = posts;

    if (activeTab !== "all") {
      filtered = filtered.filter((p) => p.category === activeTab);
    }

    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((post) => {
        const searchableText = [
          post.title,
          post.content,
          post.text,
          post.summary,
          post.decisionTitle,
          post.decisionSummary,
          post.eventName,
          post.description,
          post.author,
          post.updatedBy,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(searchLower);
      });
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((post) => selectedTags.includes(post.category));
    }

    return filtered;
  };

  const filteredPosts = useMemo(getFilteredPosts, [posts, activeTab, searchText, selectedTags]);

  // Like logic (kept)
  const handleLike = async (post: any) => {
    const currentUserEmail = auth.currentUser?.email;
    if (!currentUserEmail) {
      Alert.alert("Error", "You must be logged in to like posts");
      return;
    }

    try {
      const postRef = doc(db, "posts", post.id);
      const likedBy = post.likedBy || [];
      const isLiked = likedBy.includes(currentUserEmail);

      if (isLiked) {
        await updateDoc(postRef, {
          likes: (post.likes || 1) - 1,
          likedBy: arrayRemove(currentUserEmail),
        });
      } else {
        await updateDoc(postRef, {
          likes: (post.likes || 0) + 1,
          likedBy: arrayUnion(currentUserEmail),
        });
      }
    } catch (error) {
      console.error("Error updating like:", error);
      Alert.alert("Error", "Failed to update like");
    }
  };

  const formatCategoryLabel = (cat: string) => {
    // If you already have translations for category labels, map here.
    // fallback: capitalize
    return (cat || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const renderPostImages = (images: any[]) => {
    if (!images || images.length === 0) return null;

    if (images.length === 1) {
      return <Image source={images[0]} style={ui.singleImage} />;
    }
    if (images.length === 2) {
      return (
        <View style={ui.twoImagesContainer}>
          <Image source={images[0]} style={ui.twoImage} />
          <Image source={images[1]} style={ui.twoImage} />
        </View>
      );
    }
    if (images.length > 2) {
      return (
        <View style={ui.gridContainer}>
          <Image source={images[0]} style={ui.gridImage} />
          <Image source={images[1]} style={ui.gridImage} />
          <View style={ui.moreOverlay}>
            <Text style={ui.moreText}>+{images.length - 2}</Text>
          </View>
        </View>
      );
    }
    return null;
  };

  const renderPostMedia = (post: any) => {
    if (post.video) {
      return (
        <TouchableOpacity
          style={{ position: "relative" }}
          onPress={() => navigation.navigate("PostDetail", { post })}
          activeOpacity={0.9}
        >
          <Image source={post.image || d_assets.images.postImg1} style={ui.singleImage} />
          <View style={ui.playOverlay}>
            <View style={ui.playButton}>
              <Icon name="play" size={22} color="#fff" />
            </View>
            <View style={ui.mediaBadge}>
              <Icon name="videocam" size={14} color="#fff" />
              <Text style={ui.mediaBadgeText}>Video</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Audio placeholder card (keep your player in PostDetail if you prefer)
    if (post.audio) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate("PostDetail", { post })}
          style={ui.audioCard}
        >
          <View style={ui.audioLeft}>
            <View style={ui.audioIcon}>
              <Icon name="musical-notes" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ui.audioTitle} numberOfLines={1}>
                {post.title || t("home.audioPost")}
              </Text>
              <Text style={ui.audioSub} numberOfLines={1}>
                {post.author || "—"}
              </Text>
            </View>
          </View>
          <View style={ui.audioRight}>
            <Icon name="play" size={18} color="#111" />
          </View>
        </TouchableOpacity>
      );
    }

    if (post.image) {
      if (typeof post.image === "string") {
        return (
          <TouchableOpacity onPress={() => navigation.navigate("PostDetail", { post })} activeOpacity={0.9}>
            <Image source={{ uri: post.image }} style={ui.singleImage} />
          </TouchableOpacity>
        );
      }
      if (Array.isArray(post.image) && post.image.length > 0) {
        return (
          <TouchableOpacity onPress={() => navigation.navigate("PostDetail", { post })} activeOpacity={0.95}>
            {renderPostImages(post.image)}
          </TouchableOpacity>
        );
      }
    }

    return null;
  };

  // ---------- Premium cards by category (same content, premium UI) ----------

  const HeaderMeta = ({ post }: any) => (
    <View style={ui.postHeader}>
      <View style={ui.postHeaderLeft}>
        <Image
          source={post.user?.profileImage || d_assets.images.appLogo}
          style={ui.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={ui.username} numberOfLines={1}>
            {post.author || "Unknown User"}
          </Text>
          <View style={ui.subRow}>
            <View style={ui.categoryChip}>
              <Text style={ui.categoryChipText}>{formatCategoryLabel(post.category)}</Text>
            </View>
            <Text style={ui.dot}>•</Text>
            <Text style={ui.timeText} numberOfLines={1}>
              {post.date || post.updatedOn || post.decisionDate || post.eventDate || "—"}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate("PostDetail", { post })} style={ui.moreBtn}>
        <Icon name="ellipsis-horizontal" size={18} color="#111" />
      </TouchableOpacity>
    </View>
  );

  const ActionsRow = ({ post }: any) => {
    const liked = post.likedBy?.includes(auth.currentUser?.email);
    return (
      <View style={ui.actionRow}>
        <TouchableOpacity style={ui.actionBtn} onPress={() => handleLike(post)}>
          <Icon name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#E74C3C" : "#333"} />
          <Text style={ui.actionText}>{post.likes || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={ui.actionBtn}
          onPress={() => navigation.navigate("PostDetail", { post })}
        >
          <Icon name="chatbubble-outline" size={20} color="#333" />
          <Text style={ui.actionText}>{commentCounts[post.id] || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={ui.actionBtn}
          onPress={() => navigation.navigate("PostDetail", { post })}
        >
          <Icon name="share-social-outline" size={20} color="#333" />
          <Text style={ui.actionText}>{post.shares || 0}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={ui.readBtn}
          onPress={() => navigation.navigate("PostDetail", { post })}
        >
          <Text style={ui.readBtnText}>{t("home.seeMore")}</Text>
          <Icon name="chevron-forward" size={16} color="#111" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderNewsPost = (post: any) => (
    <View style={ui.card}>
      <HeaderMeta post={post} />
      {renderPostMedia(post)}
      {!!(post.text || post.content) && (
        <Text style={ui.bodyText} numberOfLines={3}>
          {post.text || post.content}
        </Text>
      )}
      <ActionsRow post={post} />
    </View>
  );

  const renderAnnouncementPost = (post: any) => (
    <View style={[ui.card, ui.cardBlueTint]}>
      <HeaderMeta post={post} />
      <View style={ui.titleRow}>
        <Icon name="megaphone-outline" size={18} color={COLORS.light.primary} />
        <Text style={ui.titleText} numberOfLines={2}>
          {post.title || t("home.announcement")}
        </Text>
      </View>
      {renderPostMedia(post)}
      {!!post.content && (
        <Text style={ui.bodyText} numberOfLines={3}>
          {post.content}
        </Text>
      )}
      <ActionsRow post={post} />
    </View>
  );

  const renderReformPost = (post: any) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.45;
              color: #1a1a1a;
              margin: 0;
              padding: 10px;
              background: #fff7e6;
            }
            p { margin: 8px 0; }
            h3 { font-size: 16px; font-weight: 700; margin: 12px 0 6px 0; }
            blockquote { padding-left: 10px; margin: 10px 0; font-style: italic; color: #555; }
          </style>
        </head>
        <body>
          ${post.content || ""}
        </body>
      </html>
    `;

    return (
      <View style={[ui.card, ui.cardAmberTint]}>
        <HeaderMeta post={post} />
        <View style={ui.titleRow}>
          <Icon name="document-text-outline" size={18} color="#7A4D00" />
          <Text style={ui.titleText} numberOfLines={2}>
            {post.decisionTitle || post.title || t("home.reform")}
          </Text>
        </View>

        <View style={ui.webWrap}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: htmlContent }}
            style={{ height: 190, width: width - 40 }}
            scalesPageToFit={false}
            javaScriptEnabled={false}
            domStorageEnabled={false}
          />
        </View>

        <Text style={ui.miniMeta}>
          {t("home.updatedBy")}: {post.posterName || post.updatedBy || "—"}  •  {t("home.updatedOn")}:{" "}
          {post.updatedOn || post.date || "—"}
        </Text>

        <ActionsRow post={post} />
      </View>
    );
  };

  const renderDecisionPost = (post: any) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.45;
              color: #1a1a1a;
              margin: 0;
              padding: 10px;
              background: #b8e7d8;
            }
            p { margin: 8px 0; }
            h3 { font-size: 16px; font-weight: 700; margin: 12px 0 6px 0; }
            blockquote { border-left: 3px solid rgba(0,0,0,0.25); padding-left: 10px; margin: 10px 0; font-style: italic; color: #2d2d2d; }
          </style>
        </head>
        <body>
          ${post.content || ""}
        </body>
      </html>
    `;

    return (
      <View style={[ui.card, ui.cardMintTint]}>
        <HeaderMeta post={post} />
        <View style={ui.titleRow}>
          <Icon name="checkmark-circle-outline" size={18} color="#0C5B44" />
          <Text style={ui.titleText} numberOfLines={2}>
            {post.decisionTitle || post.title || t("home.decision")}
          </Text>
        </View>

        {!!post.decisionSummary && (
          <Text style={[ui.bodyText, { marginTop: 8 }]} numberOfLines={3}>
            {post.decisionSummary}
          </Text>
        )}

        <View style={ui.webWrap}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: htmlContent }}
            style={{ height: 190, width: width - 40 }}
            scalesPageToFit={false}
            javaScriptEnabled={false}
            domStorageEnabled={false}
          />
        </View>

        <ActionsRow post={post} />
      </View>
    );
  };

  const renderEventPost = (post: any) => (
    <View style={[ui.card, ui.cardSkyTint]}>
      <HeaderMeta post={post} />
      <View style={ui.titleRow}>
        <Icon name="calendar-outline" size={18} color={COLORS.light.primary} />
        <Text style={ui.titleText} numberOfLines={2}>
          {post.eventName || post.title || t("home.event")}
        </Text>
      </View>

      <View style={ui.eventMetaRow}>
        <View style={ui.eventMetaChip}>
          <Icon name="time-outline" size={14} color="#333" />
          <Text style={ui.eventMetaText}>{post.eventDate || "—"}</Text>
        </View>
        <View style={ui.eventMetaChip}>
          <Icon name="location-outline" size={14} color="#333" />
          <Text style={ui.eventMetaText}>{post.eventLocation || "—"}</Text>
        </View>
      </View>

      {renderPostMedia(post)}

      {!!post.description && (
        <Text style={ui.bodyText} numberOfLines={3}>
          {post.description}
        </Text>
      )}

      <ActionsRow post={post} />
    </View>
  );

  const renderPost = ({ item }: any) => {
    switch (item.category) {
      case "news":
        return renderNewsPost(item);
      case "announcements":
        return renderAnnouncementPost(item);
      case "reforms":
        return renderReformPost(item);
      case "decisions":
        return renderDecisionPost(item);
      case "events":
        return renderEventPost(item);
      default:
        return renderNewsPost(item);
    }
  };

  const tabs = [
    { key: "news", label: t("home.tabs.news"), icon: "newspaper-outline" },
    { key: "announcements", label: t("home.tabs.announcements"), icon: "megaphone-outline" },
    { key: "reforms", label: t("home.tabs.reforms"), icon: "document-text-outline" },
    { key: "decisions", label: t("home.tabs.decisions"), icon: "checkmark-circle-outline" },
    { key: "events", label: t("home.tabs.events"), icon: "calendar-outline" },
  ];

  if (loading) {
    return (
      <View style={ui.page}>
        <View style={ui.topBar}>
          <Image source={d_assets.images.appLogo} style={ui.topLogo} />
          <View style={{ flex: 1 }} />
          <ActivityIndicator color={COLORS.light.primary} />
        </View>
        <View style={ui.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
          <Text style={ui.loadingText}>{t("home.loading") || "Loading..."}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={ui.page}>
      {/* Premium Header */}
      <View style={ui.topBar}>
        <Image source={d_assets.images.appLogo} style={ui.topLogo} />

        <View style={ui.headerTitleWrap}>
          {/* <Text style={ui.headerHello}>{t("home.hello") || "Alleluia !"}</Text> */}
          {/* <Text style={ui.headerTitle}>{t("home.title") || t("home.explore") || "Explore"}</Text> */}
        </View>

        <View style={ui.headerIcons}>
          {isAdmin && (
            <TouchableOpacity onPress={() => navigation.navigate("AdminDashboard")} style={ui.headerIconBtn}>
              <Icon name="shield-checkmark" size={20} color="#111" />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => navigation.navigate("MediaStream")} style={ui.headerIconBtn}>
            <Icon name="film-outline" size={20} color="#111" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Notifications")} style={ui.headerIconBtn}>
            <Icon name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Settings")} style={ui.headerIconBtn}>
            <Icon name="settings-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={ui.searchWrap}>
        <View style={ui.searchBar}>
          <Icon name="search" size={18} color="#777" />
          <TextInput
            style={ui.searchInput}
            placeholder={t("home.searchPlaceholder")}
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {(searchText.length > 0 || selectedTags.length > 0) && (
            <TouchableOpacity onPress={clearSearch} style={ui.clearBtn}>
              <Icon name="close" size={18} color="#777" />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected tags chips */}
        {selectedTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.selectedChips}>
            {selectedTags.map((tag) => (
              <View key={tag} style={ui.selectedChip}>
                <Text style={ui.selectedChipText}>{formatCategoryLabel(tag)}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)} style={ui.selectedChipX}>
                  <Icon name="close" size={14} color={COLORS.light.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Tags filter visible when searching */}
        {isSearching && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.tagsRow}>
            {availableCategories.map((category) => {
              const selected = selectedTags.includes(category);
              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => toggleTag(category)}
                  style={[ui.tagChip, selected && ui.tagChipSelected]}
                >
                  <Text style={[ui.tagChipText, selected && ui.tagChipTextSelected]}>
                    {formatCategoryLabel(category)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Tabs */}
      <View style={ui.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.tabsRow}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[ui.tabPill, active && ui.tabPillActive]}
              >
                <Icon name={tab.icon as any} size={16} color={active ? "#fff" : "#333"} />
                <Text style={[ui.tabText, active && ui.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Posts */}
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.light.primary]}
            tintColor={COLORS.light.primary}
          />
        }
        ListEmptyComponent={
          <View style={ui.emptyWrap}>
            <View style={ui.emptyIcon}>
              <Icon name={getEmptyIcon(activeTab)} size={38} color={COLORS.light.primary} />
            </View>
            <Text style={ui.emptyTitle}>{t("home.emptyTitle") || "Nothing here yet"}</Text>
            <Text style={ui.emptyText}>{getEmptyText(activeTab)}</Text>
          </View>
        }
      />

      {/* Floating Action */}
      <View style={{ flex: 1 }}>
        <FloatingAction
          actions={actions}
          color={COLORS.light.primary}
          onPressItem={handlePress}
          animated
          showBackground={false}
          overlayColor="rgba(0,0,0,0.85)"
        />
      </View>
    </View>
  );
};

export default Home;

/* ---------------- PREMIUM UI STYLES ---------------- */

const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

  topBar: {
    paddingTop: Platform.select({ ios: 52, android: 14 }),
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
    backgroundColor: "#fff",
  },

  topLogo: { width: 44, height: 44, resizeMode: "contain", borderRadius: 14 },

  headerTitleWrap: { flex: 1 },
  headerHello: { fontSize: 12.5, color: "#666", fontWeight: "700" },
  headerTitle: { fontSize: 18, color: "#111", fontWeight: "900", marginTop: 2 },

  headerIcons: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fff",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
  },

  searchInput: { flex: 1, color: "#111", fontWeight: "700" },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedChips: { paddingTop: 10, paddingBottom: 2, gap: 8 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F2FBFB",
    borderWidth: 1,
    borderColor: "rgba(47,165,169,0.22)",
  },
  selectedChipText: { fontSize: 12.5, fontWeight: "900", color: "#111" },
  selectedChipX: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  tagsRow: { paddingTop: 10, gap: 8 },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F6F6F6",
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  tagChipSelected: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  tagChipText: { fontSize: 12.5, fontWeight: "900", color: "#111" },
  tagChipTextSelected: { color: "#fff" },

  tabsWrap: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
  },
  tabsRow: { gap: 8 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#EAE8C8",
  },
  tabPillActive: {
    backgroundColor: COLORS.light.primary,
  },
  tabText: { fontSize: 13, fontWeight: "900", color: "#111" },
  tabTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },

  cardBlueTint: { backgroundColor: "#F3F9FF" },
  cardAmberTint: { backgroundColor: "#FFF7E6" },
  cardMintTint: { backgroundColor: "#E9FBF3" },
  cardSkyTint: { backgroundColor: "#F0F7FF" },

  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  postHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#eee" },
  username: { fontSize: 14.5, fontWeight: "900", color: "#111" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  categoryChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#F6F6F6",
  },
  categoryChipText: { fontSize: 11.5, fontWeight: "900", color: "#111" },
  dot: { color: "#777", fontWeight: "900" },
  timeText: { fontSize: 12, color: "#666", fontWeight: "700" },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  titleText: { flex: 1, fontSize: 15.5, fontWeight: "900", color: "#111" },

  bodyText: { fontSize: 13.5, color: "#333", lineHeight: 20, marginTop: 10, fontWeight: "600" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 12.5, fontWeight: "900", color: "#111" },

  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F6F6F6",
  },
  readBtnText: { fontSize: 12.5, fontWeight: "900", color: "#111" },

  // Media
  singleImage: { width: "100%", height: 220, borderRadius: 16, backgroundColor: "#EDEDED" },

  twoImagesContainer: { flexDirection: "row", gap: 8 },
  twoImage: { flex: 1, height: 200, borderRadius: 16, backgroundColor: "#EDEDED" },

  gridContainer: { height: 220, flexDirection: "row", gap: 8 },
  gridImage: { flex: 1, borderRadius: 16, backgroundColor: "#EDEDED" },
  moreOverlay: {
    position: "absolute",
    right: 0,
    bottom: 0,
    top: 0,
    width: "48%",
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { color: "#fff", fontWeight: "900", fontSize: 18 },

  playOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mediaBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  audioCard: {
    width: "100%",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#F7F7F7",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  audioIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  audioTitle: { fontSize: 13.5, fontWeight: "900", color: "#111" },
  audioSub: { fontSize: 12, fontWeight: "700", color: "#666", marginTop: 2 },
  audioRight: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    alignItems: "center",
    justifyContent: "center",
  },

  webWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.07)",
    backgroundColor: "#fff",
  },

  miniMeta: { marginTop: 10, fontSize: 11.5, color: "#444", fontWeight: "800" },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 70,
    paddingHorizontal: 16,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#F2FBFB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(47,165,169,0.18)",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  emptyText: { marginTop: 6, fontSize: 13.5, color: "#666", textAlign: "center", lineHeight: 20 },

  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, fontWeight: "800", color: "#444" },
});

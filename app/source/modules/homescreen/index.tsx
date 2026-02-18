/* eslint-disable react/no-unstable-nested-components */
// Home.tsx — White hero + safe collapse (no animated height) + search expands more
// ✅ Keeps your current colors (HERO_BG #fff, icon gray, primary pills)
// ✅ Fix: search mode uses a bigger hero height so search + tags are fully visible
// ✅ Menu/tabs never disappear on scroll

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  StatusBar,
  Animated,
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

const HERO_BG = "#fff";
const HERO_TEXT = "rgba(6, 51, 37, 0.91)";
const HERO_ICON_BG = "rgba(219, 219, 219, 0.55)";
const HERO_RADIUS = 24;

// Hero sizing (base)
const HERO_EXPANDED = Platform.select({ ios: 285, android: 200 }) as number;
const HERO_COLLAPSED = Platform.select({ ios: 120, android: 125 }) as number;

// When search is active, make hero taller so search + tags can be visible
const HERO_SEARCH_EXPANDED = Platform.select({ ios: 380, android: 330 }) as number;

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

  // Hero controls
  const [forceHeroOpen, setForceHeroOpen] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const isAdmin = auth.currentUser?.email === "bajos3d@gmail.com";

  // ---- Animated collapse without animating height ----
  const scrollY = useRef(new Animated.Value(0)).current;

  // collapse distance depends on current expanded height (search vs normal)
  const expandedHeight = showSearchBar ? HERO_SEARCH_EXPANDED : HERO_EXPANDED;
  const collapseDist = expandedHeight - HERO_COLLAPSED;

  // 0..collapseDist (no negative)
  const clamped = Animated.diffClamp(scrollY, 0, collapseDist);

  // When forced open/search open => collapse = 0
  const collapse = useMemo(() => {
    if (forceHeroOpen || showSearchBar) return new Animated.Value(0);
    return clamped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceHeroOpen, showSearchBar, collapseDist]);

  // Move the "expandable content" up as we scroll
  const expandableTranslateY = Animated.multiply(collapse, -1);

  // Fade out extra content on collapse
  const expandableOpacity = collapse.interpolate({
    inputRange: [0, collapseDist * 0.6, collapseDist],
    outputRange: [1, 0.2, 0],
    extrapolate: "clamp",
  });

  // For compact mode (icons only tabs)
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const sub = scrollY.addListener(({ value }) => {
      if (forceHeroOpen || showSearchBar) {
        if (compact) setCompact(false);
        return;
      }
      const should = value > 70;
      if (should !== compact) setCompact(should);
    });
    return () => scrollY.removeListener(sub);
  }, [scrollY, compact, forceHeroOpen, showSearchBar]);

  // ---------- Helpers ----------
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

  // Search/Tags logic
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
    setShowSearchBar(false);
    setForceHeroOpen(false);
  };

  const getFilteredPosts = () => {
    let filtered = posts;

    if (activeTab !== "all") filtered = filtered.filter((p) => p.category === activeTab);

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

    if (selectedTags.length > 0) filtered = filtered.filter((post) => selectedTags.includes(post.category));

    return filtered;
  };

  const filteredPosts = useMemo(getFilteredPosts, [posts, activeTab, searchText, selectedTags]);

  // Like logic
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

  const formatCategoryLabel = (cat: string) =>
    (cat || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Media (kept)
  const renderPostImages = (images: any[]) => {
    if (!images || images.length === 0) return null;
    if (images.length === 1) return <Image source={images[0]} style={ui.singleImage} />;
    if (images.length === 2)
      return (
        <View style={ui.twoImagesContainer}>
          <Image source={images[0]} style={ui.twoImage} />
          <Image source={images[1]} style={ui.twoImage} />
        </View>
      );
    return (
      <View style={ui.gridContainer}>
        <Image source={images[0]} style={ui.gridImage} />
        <Image source={images[1]} style={ui.gridImage} />
        <View style={ui.moreOverlay}>
          <Text style={ui.moreText}>+{images.length - 2}</Text>
        </View>
      </View>
    );
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

  // ---------- Cards (kept) ----------
  const HeaderMeta = ({ post }: any) => (
    <View style={ui.postHeader}>
      <View style={ui.postHeaderLeft}>
        <Image source={post.user?.profileImage || d_assets.images.appLogo} style={ui.avatar} />
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

        <TouchableOpacity style={ui.actionBtn} onPress={() => navigation.navigate("PostDetail", { post })}>
          <Icon name="chatbubble-outline" size={20} color="#333" />
          <Text style={ui.actionText}>{commentCounts[post.id] || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={ui.actionBtn} onPress={() => navigation.navigate("PostDetail", { post })}>
          <Icon name="share-social-outline" size={20} color="#333" />
          <Text style={ui.actionText}>{post.shares || 0}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />
        <TouchableOpacity style={ui.readBtn} onPress={() => navigation.navigate("PostDetail", { post })}>
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
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.45;color:#1a1a1a;margin:0;padding:10px;background:#fff7e6}
        p{margin:8px 0} h3{font-size:16px;font-weight:700;margin:12px 0 6px 0}
        blockquote{padding-left:10px;margin:10px 0;font-style:italic;color:#555}
      </style></head><body>${post.content || ""}</body></html>
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
          {t("home.updatedBy")}: {post.posterName || post.updatedBy || "—"} • {t("home.updatedOn")}:{" "}
          {post.updatedOn || post.date || "—"}
        </Text>

        <ActionsRow post={post} />
      </View>
    );
  };

  const renderDecisionPost = (post: any) => {
    const htmlContent = `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.45;color:#1a1a1a;margin:0;padding:10px;background:#b8e7d8}
        p{margin:8px 0} h3{font-size:16px;font-weight:700;margin:12px 0 6px 0}
        blockquote{border-left:3px solid rgba(0,0,0,0.25);padding-left:10px;margin:10px 0;font-style:italic;color:#2d2d2d}
      </style></head><body>${post.content || ""}</body></html>
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

  // Hero actions
  const toggleSearchDrop = () => {
    const next = !showSearchBar;
    setShowSearchBar(next);
    setForceHeroOpen(next); // keeps open while searching
    setIsSearching(next || isSearching);
    if (next) setTimeout(() => searchRef.current?.focus(), 120);
    else if (selectedTags.length === 0 && !searchText.trim()) setIsSearching(false);
  };

  const manualExpandHero = () => setForceHeroOpen(true);

  // ---- Loading ----
  if (loading) {
    return (
      <View style={ui.page}>
        <View style={[hero.heroContainer, { height: HERO_COLLAPSED }]}>
          <View style={hero.heroPinnedTop}>
            <Image source={d_assets.images.appLogo} style={hero.heroIcon} />
            <View style={{ flex: 1 }} />
            <ActivityIndicator color={COLORS.light.primary} />
          </View>
        </View>

        <View style={ui.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
          <Text style={ui.loadingText}>{t("home.loading") || "Loading..."}</Text>
        </View>
      </View>
    );
  }

  // ---- UI pieces ----
  const PinnedTopRow = () => (
    <View style={hero.heroPinnedTop}>
      <View style={hero.heroTopLeft}>
        <View style={hero.heroIcon}>
          <Image source={d_assets.images.appLogo} style={{ width: 26, height: 26, resizeMode: "contain" }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={hero.heroTitle} numberOfLines={1}>
            { "Cèlè One"}
          </Text>
          {!compact && (
            <Text style={hero.heroSub} numberOfLines={1}>
              {t("home.explore") || "Cèlè One"}
            </Text>
          )}
        </View>
      </View>

      <View style={hero.heroTopRight}>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => navigation.navigate("AdminDashboard")}
            style={hero.heroIcon}
            activeOpacity={0.9}
          >
            <Icon name="shield-checkmark" size={18} color={HERO_TEXT} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.navigate("MediaStream")} style={hero.heroIcon} activeOpacity={0.9}>
          <Icon name="film-outline" size={18} color={HERO_TEXT} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("Notifications")}
          style={hero.heroIcon}
          activeOpacity={0.9}
        >
          <Icon name="notifications-outline" size={18} color={HERO_TEXT} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Settings")} style={hero.heroIcon} activeOpacity={0.9}>
          <Icon name="settings-outline" size={18} color={HERO_TEXT} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const ExpandableArea = () => (
    <Animated.View
      style={[
        hero.expandable,
        {
          transform: [{ translateY: expandableTranslateY }],
          opacity: expandableOpacity,
        },
      ]}
    >
      <View style={hero.yearRow}>
        <TouchableOpacity onPress={toggleSearchDrop} style={hero.heroIcon} activeOpacity={0.9}>
          <Icon name={showSearchBar ? "close" : "search"} size={18} color={HERO_TEXT} />
        </TouchableOpacity>

        <View style={hero.yearPill}>
          <Icon name="calendar-outline" size={16} color={HERO_TEXT} />
          <Text style={hero.yearText}>{new Date().getFullYear()}</Text>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={() => navigation.navigate("TvPlayerScreen")}
          style={hero.quickPill}
          activeOpacity={0.9}
        >
          <Icon name="play" size={16} color={HERO_TEXT} />
          <Text style={hero.quickText}>TV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("RadioPlayerScreen")}
          style={hero.quickPill}
          activeOpacity={0.9}
        >
          <Icon name="radio" size={16} color={HERO_TEXT} />
          <Text style={hero.quickText}>Radio</Text>
        </TouchableOpacity>
      </View>

      {showSearchBar && (
        <>
          <View style={hero.searchBar}>
            <Icon name="search" size={16} color={HERO_TEXT} />
            <TextInput
              ref={searchRef}
              style={hero.searchInput}
              placeholder={`${t("home.searchPlaceholder") || "Search"}…`}
              placeholderTextColor="rgba(6,51,37,0.55)"
              value={searchText}
              onChangeText={setSearchText}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            {(searchText.length > 0 || selectedTags.length > 0) && (
              <TouchableOpacity onPress={clearSearch} style={hero.clearBtn} activeOpacity={0.9}>
                <Icon name="close" size={18} color={HERO_TEXT} />
              </TouchableOpacity>
            )}
          </View>

          {selectedTags.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.selectedRow}>
              {selectedTags.map((tag) => (
                <View key={tag} style={hero.selectedChip}>
                  <Text style={hero.selectedChipText}>{formatCategoryLabel(tag)}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)} style={hero.selectedX} activeOpacity={0.9}>
                    <Icon name="close" size={14} color={HERO_TEXT} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {isSearching && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.tagsRow}>
              {availableCategories.map((category) => {
                const selected = selectedTags.includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    onPress={() => toggleTag(category)}
                    style={[hero.tagChip, selected && hero.tagChipSelected]}
                    activeOpacity={0.9}
                  >
                    <Text style={[hero.tagChipText, selected && hero.tagChipTextSelected]}>
                      {formatCategoryLabel(category)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </Animated.View>
  );

  const Tabs = () => {
    if (compact && !forceHeroOpen && !showSearchBar) {
      return (
        <View style={hero.compactTabs}>
          {tabs.map((tb) => {
            const active = activeTab === tb.key;
            return (
              <TouchableOpacity
                key={tb.key}
                onPress={() => setActiveTab(tb.key)}
                style={[hero.compactTabBtn, active && hero.compactTabBtnActive]}
                activeOpacity={0.9}
              >
                <Icon name={tb.icon as any} size={20} color={active ? "#fff" : "rgba(6,51,37,0.55)"} />
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.pillsRow}>
        {tabs.map((tb) => {
          const active = activeTab === tb.key;
          return (
            <TouchableOpacity
              key={tb.key}
              onPress={() => setActiveTab(tb.key)}
              style={[hero.pill, active && hero.pillActive]}
              activeOpacity={0.9}
            >
              <Icon name={tb.icon as any} size={16} color={active ? "#fff" : "rgba(2, 39, 27, 0.9)"} />
              <Text style={[hero.pillText, active && hero.pillTextActive]}>{tb.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // Decide hero container height
  const heroFixedHeight =
    forceHeroOpen || showSearchBar ? expandedHeight : compact ? HERO_COLLAPSED : expandedHeight;

  return (
    <View style={ui.page}>
      <StatusBar barStyle="dark-content" backgroundColor={HERO_BG} />

      {/* HERO */}
      <View style={[hero.heroContainer, { height: heroFixedHeight }]}>
        <PinnedTopRow />
        <View style={{ marginTop: 10 }}>
          <Tabs />
        </View>
        <ExpandableArea />
      </View>

      {/* FEED */}
      <Animated.FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: heroFixedHeight + 12,
          paddingHorizontal: 12,
          paddingBottom: 90,
        }}
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
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      />

      {!forceHeroOpen && !showSearchBar && compact && (
        <TouchableOpacity onPress={manualExpandHero} style={hero.expandBtn} activeOpacity={0.9}>
          <Icon name="chevron-down" size={18} color={HERO_TEXT} />
        </TouchableOpacity>
      )}

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

/* ---------------- HERO STYLES ---------------- */
const hero = StyleSheet.create({
  heroContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: HERO_BG,
    paddingTop: Platform.select({ ios: 54, android: 14 }),
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: "hidden",
    elevation: 4,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },

  heroPinnedTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  heroTopLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  heroTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: HERO_ICON_BG,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: { color: HERO_TEXT, fontSize: 20, fontWeight: "900" },
  heroSub: { marginTop: 4, color: "rgba(6, 51, 37, 0.65)", fontWeight: "800", fontSize: 12.5 },

  pillsRow: { gap: 10, paddingRight: 14 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(110, 197, 129, 0.55)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: COLORS.light.primary,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  pillText: { fontWeight: "900", color: "rgba(2, 44, 31, 0.7)", fontSize: 12 },
  pillTextActive: { color: "#fff" },

  compactTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 8,
    zIndex: 15,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  compactTabBtn: { flex: 1, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compactTabBtnActive: { backgroundColor: COLORS.light.primary },

  expandable: { marginTop: 12 },

  yearRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },

  yearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  yearText: { fontWeight: "900", color: HERO_TEXT },

  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  quickText: { fontWeight: "900", color: HERO_TEXT },

  searchBar: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  searchInput: { flex: 1, color: HERO_TEXT, fontWeight: "900" },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  selectedRow: { paddingTop: 10, gap: 10 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  selectedChipText: { fontWeight: "900", color: HERO_TEXT },
  selectedX: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  tagsRow: { paddingTop: 10, gap: 8 },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(245,245,245,1)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  tagChipSelected: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  tagChipText: { fontSize: 12.5, fontWeight: "900", color: "rgba(6,51,37,0.75)" },
  tagChipTextSelected: { color: "#fff" },

  expandBtn: {
    position: "absolute",
    right: 5,
    top: Platform.select({ ios: 64, android: 110 }),
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    // elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
});

/* ---------------- YOUR PREMIUM UI STYLES (UNCHANGED) ---------------- */
const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },

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

  eventMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  eventMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  eventMetaText: { fontWeight: "800", color: "#111", fontSize: 12 },

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

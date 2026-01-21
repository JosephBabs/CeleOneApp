import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  Alert,
  // StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useWindowDimensions } from 'react-native';
// import { Audio } from "expo-av";
import { FloatingAction } from 'react-native-floating-action';

import styles from './styles';
import { WebView } from 'react-native-webview';

import { COLORS } from '../../../core/theme/colors';
// import AudioPlayer from "./audioplayer";
// import RenderHTML from "react-native-render-html";
import React, { useState, useEffect } from 'react';
import { d_assets } from '../../configs/assets';
import { auth, db } from '../auth/firebaseConfig';
import {
  collection,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  doc,
  query,
  getDocs,
} from 'firebase/firestore';
// import AudioPlayer from "./audioplayer";

const Home = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // const isDark = false; // Replace with actual theme logic
  const [activeTab, setActiveTab] = useState('news');
  const [posts, setPosts] = useState<any[]>([]);
  const [commentCounts, setCommentCounts] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // const [sound, setSound] = useState<Audio.Sound | null>(null);
  const isAdmin = auth.currentUser?.email === 'bajos3d@gmail.com';

  const getEmptyIcon = (category: string) => {
    switch (category) {
      case 'news':
        return 'newspaper-outline';
      case 'announcements':
        return 'megaphone-outline';
      case 'reforms':
        return 'document-text-outline';
      case 'decisions':
        return 'checkmark-circle-outline';
      case 'events':
        return 'calendar-outline';
      default:
        return 'document-outline';
    }
  };

  const getEmptyText = (category: string) => {
    switch (category) {
      case 'news':
        return t('home.empty.news');
      case 'announcements':
        return t('home.empty.announcements');
      case 'reforms':
        return t('home.empty.reforms');
      case 'decisions':
        return t('home.empty.decisions');
      case 'events':
        return t('home.empty.events');
      default:
        return t('home.empty.default');
    }
  };

  const fetchCommentCounts = async (posts: any[]) => {
    const counts: { [key: string]: number } = {};

    for (const post of posts) {
      try {
        const commentsQuery = query(collection(db, 'posts', post.id, 'comments'));
        const commentsSnapshot = await getDocs(commentsQuery);

        let total = 0;
        for (const commentDoc of commentsSnapshot.docs) {
          total += 1; // the comment itself
          const repliesQuery = query(
            collection(db, 'posts', post.id, 'comments', commentDoc.id, 'replies')
          );
          const repliesSnapshot = await getDocs(repliesQuery);
          total += repliesSnapshot.size;
        }
        counts[post.id] = total;
      } catch (error) {
        console.error('Error fetching comments for post:', post.id, error);
        counts[post.id] = 0;
      }
    }

    setCommentCounts(counts);
  };

  useEffect(() => {
    // Set up real-time listener for posts collection
    const unsubscribe = onSnapshot(
      collection(db, 'posts'),
      async querySnapshot => {
        const postsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPosts(postsData);
        await fetchCommentCounts(postsData);
        setLoading(false);
      },
      error => {
        console.error('Error listening to posts: ', error);
        setLoading(false);
      },
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  const actions = [
    {
      text: 'Cèlè One Live',
      icon: <Icon name="play" size={20} color="#fff" />,
      name: 'bt_live_tv',
      position: 1,
    },
    {
      text: 'Alléluia FM',
      icon: <Icon name="radio" size={20} color="#fff" />,
      name: 'bt_radio',
      position: 2,
    },
  ];

  const handlePress = (name?: string) => {
    switch (name) {
      case 'bt_live_tv':
        // Navigate to Live TV
        navigation.navigate('TvPlayerScreen');
        break;
      case 'bt_radio':
        // Navigate to Radio
        navigation.navigate('RadioPlayerScreen');
        break;
      default:
        break;
    }
  };

  const renderPostImages = (images: any[]) => {
    if (!images || images.length === 0) return null;
    
    if (images.length === 1) {
      return <Image source={images[0]} style={styles.singleImage} />;
    }
    if (images.length === 2) {
      return (
        <View style={styles.twoImagesContainer}>
          <Image source={images[0]} style={styles.twoImage} />
          <Image source={images[1]} style={styles.twoImage} />
        </View>
      );
    }
    if (images.length > 2) {
      return (
        <View style={styles.gridContainer}>
          <Image source={images[0]} style={styles.gridImage} />
          <Image source={images[1]} style={styles.gridImage} />
          <View style={styles.moreOverlay}>
            <Text style={styles.moreText}>+{images.length - 2}</Text>
          </View>
        </View>
      );
    }
    return null;
  };

  const renderPostMedia = (post: any) => {
    // Handle single video
    if (post.video) {
      return (
        <TouchableOpacity
          style={{ position: 'relative' }}
          onPress={() => navigation.navigate('PostDetail', { post })}
        >
          <Image
            source={post.image || d_assets.images.postImg1}
            style={styles.singleImage} 
          />

          <View
            // eslint-disable-next-line react-native/no-inline-styles
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              height: 70,
              width: 70,
              transform: [{ translateX: -35 }, { translateY: -35 }],
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 35,
            }}
          >
            <Icon name="play" size={30} color={COLORS.white} />
          </View>
        </TouchableOpacity>
      );
    }

    // Handle audio
    if (post.audio) {
      console.log('post.audio:', post.audio, typeof post.audio);
      // return <AudioPlayer audioFileUri={post.audio} />;
    }

    // Handle single image (string) or array of images
    if (post.image) {
      // If image is a string (single image)
      if (typeof post.image === 'string') {
        return (
          <TouchableOpacity
            onPress={() => navigation.navigate('PostDetail', { post })}
          >
            <Image source={{ uri: post.image }} style={styles.singleImage} />
          </TouchableOpacity>
        );
      }
      // If image is an array (multiple images)
      if (Array.isArray(post.image) && post.image.length > 0) {
        return renderPostImages(post.image);
      }
    }
    
    return null;
  };

  // Render post for NEWS (standard post card)
  const renderNewsPost = (post: any) => (
    <View style={styles.postCard}>
      <View style={styles.profileRow}>
        <Image
          source={post.user?.profileImage || d_assets.images.appLogo}
          style={styles.avatar}
        />
        <Text style={styles.username}>{post.author || 'Unknown User'}</Text>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { post })}
      >
        {renderPostMedia(post)}
      </TouchableOpacity>


      <Text style={styles.postText} numberOfLines={3}>
        {post.text || post.content}
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { post })}
      >
        <Text style={styles.seeMore}>{t('home.seeMore')}</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleLike(post)}
        >
          <Icon
            name={
              post.likedBy?.includes(auth.currentUser?.email)
                ? 'heart'
                : 'heart-outline'
            }
            size={22}
            color={
              post.likedBy?.includes(auth.currentUser?.email)
                ? '#e74c3c'
                : '#444'
            }
          />
          <Text style={styles.actionText}>{post.likes || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PostDetail', { post })}
        >
          <Icon name="chatbubble-outline" size={22} color="#444" />
          <Text style={styles.actionText}>{commentCounts[post.id] || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="share-social-outline" size={22} color="#444" />
          <Text style={styles.actionText}>{post.shares}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render announcement post (different style)
  const renderAnnouncementPost = (post: any) => (
    <View style={[styles.postCard, { backgroundColor: "#e7f3ff" }]}>
      <Text style={[styles.titleSimple, { marginBottom: 6 }]}>
        {post.title}
      </Text>
      <Text style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>
        {post.date}
      </Text>
      {renderPostMedia(post)}
      <Text style={{ marginVertical: 10 }} numberOfLines={3}>
        {post.content}
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate("PostDetail", { post })}>
        <Text style={styles.seeMore}>{t("home.seeMore")}</Text>
      </TouchableOpacity>
      {post.audio && renderPostMedia(post)}
    </View>
  );

  // Render reform post
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
              line-height: 1.4;
              color: #333;
              margin: 0;
              padding: 05px;
            }
            p {
              margin: 8px 0;
              font-size: 14px;
            }
            h3 {
              font-size: 16px;
              font-weight: bold;
              margin: 12px 0 6px 0;
              color: #222;
            }
            div {
              font-weight: bold;
              color: #444;
              margin: 6px 0;
            }
            em, i {
              font-style: italic;
            }
            strong, b {
              font-weight: bold;
            }
            ul, ol {
              margin: 8px 0;
              padding-left: 20px;
            }
            li {
              margin: 4px 0;
            }
            blockquote {
              // border-left: 3px solid #ccc;
              padding-left: 10px;
              margin: 10px 0;
              font-style: italic;
              color: #666;
            }
          </style>
        </head>
        <body style="background-color: #fff7e6;">
          ${post.content}
        </body>
      </html>
    `;

    return (
      <View style={[styles.postCard, { backgroundColor: '#fff7e6' }]}>
        <Text style={[styles.titleSimple, { marginBottom: 6 }]}>
          {post.decisionTitle}
        </Text>
        <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
          {post.decisionTitle}
        </Text>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={{ height: 200, width: width - 40 }}
          scalesPageToFit={false}
          javaScriptEnabled={false}
          domStorageEnabled={false}
        />
        {/* <Text>{post.fullText}</Text> */}
        <Text style={{ fontSize: 10, marginTop: 8, color: '#555' }}>
          {t('home.updatedBy')}: {post.posterName} | {t('home.updatedOn')}:{' '}
          {post.updatedOn}
        </Text>
      </View>
    );
  };

  // Render decision post
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
              line-height: 1.4;
              color: #333;
              margin: 0;
              padding: 04px;
            }
            p {
              margin: 8px 0;
              font-size: 14px;
            }
            h3 {
              font-size: 16px;
              font-weight: bold;
              margin: 12px 0 6px 0;
              color: #222;
            }
            div {
              font-weight: bold;
              color: #444;
              margin: 6px 0;
            }
            em, i {
              font-style: italic;
            }
            strong, b {
              font-weight: bold;
            }
            ul, ol {
              margin: 8px 0;
              padding-left: 20px;
            }
            li {
              margin: 4px 0;
            }
            blockquote {
              border-left: 3px solid #ccc;
              padding-left: 10px;
              margin: 10px 0;
              font-style: italic;
              color: #666;
            }
          </style>
        </head>
        <body style="background-color: #b8e7d8ff;">
          ${post.content}
        </body>
      </html>
    `;

    return (
      <View style={[styles.postCard, { backgroundColor: '#b8e7d8ff' }]}>
        <Text style={[styles.titleSimple, { marginBottom: 6 }]}>
          {post.decisionTitle}
        </Text>
        <Text style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>
          {post.decisionDate}
        </Text>
        <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>
          {post.decisionSummary}
        </Text>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={{ height: 200, width: width - 40 }}
          scalesPageToFit={false}
          javaScriptEnabled={false}
          domStorageEnabled={false}
        />
        {/* <Text>{post.decisionDetails}</Text> */}
      </View>
    );
  };

  // Render event post
  const renderEventPost = (post: any) => {
    return (
      <View style={[styles.postCard, { backgroundColor: '#f0f7ff' }]}>
        <Text style={[styles.titleSimple, { marginBottom: 6 }]}>
          {post.eventName}
        </Text>
        <Text style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
          {post.eventDate} - {post.eventLocation}
        </Text>
        {renderPostMedia(post)}
        <Text style={{ marginVertical: 10 }} numberOfLines={3}>
        {post.description}
      </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PostDetail', { post })}
        >
          <Text style={styles.seeMore}>{t('home.seeMore')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Main render post switch by category
  const renderPost = ({ item }: any) => {
    switch (item.category) {
      case 'news':
        return renderNewsPost(item);
      case 'announcements':
        return renderAnnouncementPost(item);
      case 'reforms':
        return renderReformPost(item);
      case 'decisions':
        return renderDecisionPost(item);
      case 'events':
        return renderEventPost(item);
      default:
        return null;
    }
  };

  // Get all available categories from posts
  const availableCategories = [...new Set(posts.map(p => p.category))];

  // Filter posts based on search and tags
  const getFilteredPosts = () => {
    let filtered = posts;

    // Apply category filter (tabs)
    if (activeTab !== 'all') {
      filtered = filtered.filter(p => p.category === activeTab);
    }

    // Apply search text filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(post => {
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
          post.updatedBy
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(searchLower);
      });
    }

    // Apply tag filters
    if (selectedTags.length > 0) {
      filtered = filtered.filter(post => selectedTags.includes(post.category));
    }

    return filtered;
  };

  const filteredPosts = getFilteredPosts();

  // Handle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    setIsSearching(true);
  };

  // Handle search input blur
  const handleSearchBlur = () => {
    // Keep tags visible if there are selected tags or search text
    if (selectedTags.length === 0 && !searchText.trim()) {
      setIsSearching(false);
    }
  };

  // Remove tag from search input
  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  // Clear all search filters
  const clearSearch = () => {
    setSearchText('');
    setSelectedTags([]);
    setIsSearching(false);
  };

  // Handle like/dislike functionality
  const handleLike = async (post: any) => {
    const currentUserEmail = auth.currentUser?.email;
    if (!currentUserEmail) {
      Alert.alert('Error', 'You must be logged in to like posts');
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      const likedBy = post.likedBy || [];
      const isLiked = likedBy.includes(currentUserEmail);

      if (isLiked) {
        // Unlike the post
        await updateDoc(postRef, {
          likes: (post.likes || 1) - 1,
          likedBy: arrayRemove(currentUserEmail),
        });
      } else {
        // Like the post
        await updateDoc(postRef, {
          likes: (post.likes || 0) + 1,
          likedBy: arrayUnion(currentUserEmail),
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={styles.header1}>
        <Image source={d_assets.images.appLogo} style={styles.logo} />
        {/* <Text style={styles.titleSimple2}>{t("home.explore")}</Text> */}

        <View style={styles.headerIcons}>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminDashboard')}
              style={{ marginRight: 10 }}
            >
              <Icon name="shield-checkmark" size={24} color="#444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon
              name="notifications-outline"
              size={24}
              color="#444"
              style={styles.iconRight}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor="#888"
          value={searchText}
          onChangeText={setSearchText}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
        />
        {(searchText.length > 0 || selectedTags.length > 0) && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
            <Icon name="close" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected Tags as Badges */}
      {selectedTags.length > 0 && (
        <View style={styles.selectedTagsContainer}>
          {selectedTags.map(tag => (
            <View key={tag} style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{tag}</Text>
              <TouchableOpacity onPress={() => removeTag(tag)} style={styles.tagBadgeRemove}>
                <Icon name="close" size={14} color={COLORS.light.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Category Tags Filter */}
      {isSearching && (
        <View style={styles.tagsFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScroll}
          >
            {availableCategories.map(category => (
              <TouchableOpacity
                key={category}
                onPress={() => toggleTag(category)}
                style={[
                  styles.tagButton,
                  selectedTags.includes(category) && styles.tagButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.tagButtonText,
                    selectedTags.includes(category) && styles.tagButtonTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.divider} />
        </View>
      )}

      
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {[
            { key: 'news', label: t('home.tabs.news') },
            { key: 'announcements', label: t('home.tabs.announcements') },
            { key: 'reforms', label: t('home.tabs.reforms') },
            { key: 'decisions', label: t('home.tabs.decisions') },
            { key: 'events', label: t('home.tabs.events') },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Posts List */}
      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name={getEmptyIcon(activeTab)} size={80} color="#ccc" />
            <Text style={styles.emptyText}>{getEmptyText(activeTab)}</Text>
          </View>
        }
      />

      <View style={{ flex: 1 }}>
        <FloatingAction
          actions={actions}
          color="#008080"
          onPressItem={handlePress}
          // onPressItem={handlePress}
          animated={true}
          showBackground={false}
          overlayColor="rgba(0,0,0,0.9)"
        />
      </View>
    </View>
  );
};

export default Home;

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
} from 'firebase/firestore';
// import AudioPlayer from "./audioplayer";

const Home = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // const isDark = false; // Replace with actual theme logic
  const [activeTab, setActiveTab] = useState('news');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    // Set up real-time listener for posts collection
    const unsubscribe = onSnapshot(
      collection(db, 'posts'),
      querySnapshot => {
        const postsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPosts(postsData);
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
          <Text style={styles.actionText}>{post.comments}</Text>
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
  const renderReformPost = (post: any) => (
    <View style={[styles.postCard, { backgroundColor: '#fff7e6' }]}>
      <Text style={[styles.titleSimple, { marginBottom: 6 }]}>
        {post.title}
      </Text>
      <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>
        {post.summary}
      </Text>
      <WebView
        contentWidth={width}
        source={{ html: post.fullText }}
        tagsStyles={{
          p: { marginVertical: 6, fontSize: 14 },
          h3: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
          strong: { fontWeight: 'bold' },
          em: { fontStyle: 'italic' },
        }}
      />
      {/* <Text>{post.fullText}</Text> */}
      <Text style={{ fontSize: 10, marginTop: 8, color: '#555' }}>
        {t('home.updatedBy')}: {post.updatedBy} | {t('home.updatedOn')}:{' '}
        {post.updatedOn}
      </Text>
    </View>
  );

  // Render decision post
  const renderDecisionPost = (post: any) => (
    <View style={[styles.postCard, { backgroundColor: '#e6fff7' }]}>
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
        contentWidth={width}
        source={{ html: post.decisionDetails }}
        tagsStyles={{
          p: { marginVertical: 6, fontSize: 14 },
          h3: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
          strong: { fontWeight: 'bold' },
          em: { fontStyle: 'italic' },
        }}
      />
      {/* <Text>{post.decisionDetails}</Text> */}
    </View>
  );

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
        <Image source={post.bannerImage} style={styles.singleImage} />
        <WebView
          contentWidth={width}
          source={{ html: post.description }}
          tagsStyles={{
            p: { marginVertical: 6, fontSize: 14 },
            h3: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
            strong: { fontWeight: 'bold' },
            em: { fontStyle: 'italic' },
          }}
        />
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

  // Filter posts by selected tab/category
  const filteredPosts = posts.filter(p => p.category === activeTab);

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
        />
      </View>

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

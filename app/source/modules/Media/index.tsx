import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  Alert,
  Animated,
  Modal,
  ActivityIndicator,
  StatusBar,
  Platform,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
// import { BlurView } from '@react-native-community/blur';

import { COLORS } from '../../../core/theme/colors';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const { width, height } = Dimensions.get('window');
const ITEM_SPACING = 16;
const CAROUSEL_WIDTH = width * 0.72;

// ---------- helpers ----------
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const Media = ({ navigation }: any) => {
  // ---------- state ----------
  const [activeTab, setActiveTab] = useState<'Pour toi' | 'Musique' | 'Film/Série'>('Pour toi');

  const [activeBottomTab, setActiveBottomTab] = useState<'grouping' | 'favorites' | 'downloads' | 'library'>('grouping');
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  const [songs, setSongs] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);

  // Player modals
  const [musicModalVisible, setMusicModalVisible] = useState(false);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [videoInfoModalVisible, setVideoInfoModalVisible] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [videoFullscreenVisible, setVideoFullscreenVisible] = useState(false);

  // Fake playback states (UI-ready; connect to real player later)
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [songPosition, setSongPosition] = useState(45); // seconds
  const [songDuration, setSongDuration] = useState(200); // seconds

  // animations
  const tabOpacity = useRef(new Animated.Value(1)).current;

  // Blur/scale micro-interaction on video thumbnails
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressBlur = useRef(new Animated.Value(0)).current;

  // ---------- firestore fetch ----------
  useEffect(() => {
    const unsubscribeSongs = firestore()
      .collection('songs')
      .onSnapshot(snapshot => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setSongs(list);
        setLoading(false);
      });

    const unsubscribeVideos = firestore()
      .collection('videos')
      .onSnapshot(snapshot => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setVideos(list);
      });

    const fetchFavorites = async () => {
      try {
        const userId = auth().currentUser?.uid;
        if (!userId) return;

        const favoritesSnapshot = await firestore()
          .collection('users')
          .doc(userId)
          .collection('favorites')
          .get();

        setFavorites(favoritesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error('Error fetching favorites:', e);
      }
    };

    const fetchDownloads = async () => {
      try {
        const userId = auth().currentUser?.uid;
        if (!userId) return;

        const downloadsSnapshot = await firestore()
          .collection('users')
          .doc(userId)
          .collection('downloads')
          .get();

        setDownloads(downloadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error('Error fetching downloads:', e);
      }
    };

    const fetchPlaylists = async () => {
      try {
        const userId = auth().currentUser?.uid;
        if (!userId) return;

        const playlistsSnapshot = await firestore()
          .collection('users')
          .doc(userId)
          .collection('playlists')
          .get();

        setPlaylists(playlistsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error('Error fetching playlists:', e);
      }
    };

    fetchFavorites();
    fetchDownloads();
    fetchPlaylists();

    return () => {
      unsubscribeSongs();
      unsubscribeVideos();
    };
  }, []);

  // ---------- derived ----------
  const userName = useMemo(() => 'Joseph Babatunde', []);
  const greeting = useMemo(() => 'Alleluia !', []);

  // genres grouping from songs
  const genres = useMemo(() => [...new Set(songs.map(s => s.genre).filter(Boolean))], [songs]);
  const groupingData = useMemo(
    () =>
      genres.map((g, i) => ({
        id: g,
        title: g,
        image: require('../../../assets/images/posts/stream3.jpg'),
        colors: [
          ['rgba(46,204,113,0.85)', 'rgba(46,204,113,0.40)'],
          ['rgba(234,224,200,0.95)', 'rgba(210,200,180,0.55)'],
          ['rgba(120,120,120,0.90)', 'rgba(60,60,60,0.55)'],
          ['rgba(255,255,255,0.95)', 'rgba(200,200,200,0.55)'],
        ][i % 4],
      })),
    [genres],
  );

  // ---------- actions ----------
  const handleTabChange = (tab: any) => {
    Animated.timing(tabOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const openMusicPlayer = (song: any) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setSongPosition(45);
    setSongDuration(200);
    setMusicModalVisible(true);
  };

  const openVideoInfo = (video: any) => {
    setCurrentVideo(video);
    setVideoInfoModalVisible(true);
  };

  const openVideoFullscreen = () => {
    setVideoInfoModalVisible(false);
    setTimeout(() => setVideoFullscreenVisible(true), 120);
  };

  const showSongOptions = (item: any) => {
    Alert.alert('Song Options', `What would you like to do with "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add to Favorites', onPress: () => addToFavorites(item) },
      { text: 'Add to Playlist', onPress: () => addToPlaylist(item) },
      { text: 'Download', onPress: () => downloadSong(item) },
    ]);
  };

  const showVideoOptions = (item: any) => {
    Alert.alert('Video Options', `What would you like to do with "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add to Favorites', onPress: () => addToFavorites(item) },
      { text: 'Add to Playlist', onPress: () => addToPlaylist(item) },
      { text: 'Download', onPress: () => downloadVideo(item) },
    ]);
  };

  const addToFavorites = async (item: any) => {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;

      await firestore()
        .collection('users')
        .doc(userId)
        .collection('favorites')
        .add({ ...item, addedAt: firestore.FieldValue.serverTimestamp() });

      Alert.alert('Success', 'Added to favorites');
    } catch (e) {
      console.error('Error adding to favorites:', e);
      Alert.alert('Error', 'Failed to add to favorites');
    }
  };

  const addToPlaylist = (item: any) => {
    Alert.alert('Playlist', `Open your playlist picker for "${item.title}" here.`);
  };

  const downloadSong = (item: any) => {
    Alert.alert('Download', `Start downloading "${item.title}" here.`);
  };

  const downloadVideo = (item: any) => {
    Alert.alert('Download', `Start downloading "${item.title}" here.`);
  };

  // ---------- micro animations ----------
  const onVideoPressIn = () => {
    Animated.parallel([
      Animated.timing(pressScale, { toValue: 0.985, duration: 120, useNativeDriver: true }),
      Animated.timing(pressBlur, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };
  const onVideoPressOut = () => {
    Animated.parallel([
      Animated.timing(pressScale, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(pressBlur, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  // ---------- renderers ----------
  const renderHeroItem = ({ item }: any) => (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.heroCard}
      onPress={() => openVideoInfo(item)}
    >
      <Image source={{ uri: item.coverUrl }} style={styles.heroImage} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.heroGradient} />
      <View style={styles.heroMetaRow}>
        <View style={styles.heroPill}>
          <Ionicons name="play" size={14} color="#fff" />
          <Text style={styles.heroPillText}>{item.duration || '10:30'}</Text>
        </View>
        {item.isLive ? (
          <View style={[styles.heroPill, { backgroundColor: '#FF2D2D' }]}>
            <Text style={[styles.heroPillText, { fontWeight: '900' }]}>LIVE</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.heroTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.heroSub} numberOfLines={1}>
        {(item.channelName || item.category || 'Featured')} • {item.views || '0'} views
      </Text>
    </TouchableOpacity>
  );

  const renderSongItem = ({ item }: any) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.songRow}
      onPress={() => openMusicPlayer(item)}
    >
      <Image source={{ uri: item.coverUrl }} style={styles.songArt} />
      <View style={{ flex: 1 }}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {item.artist || 'Unknown Artist'}
        </Text>

        <View style={styles.songMicroRow}>
          <View style={styles.microPill}>
            <Ionicons name="musical-notes" size={12} color="#444" />
            <Text style={styles.microPillText}>{item.genre || 'Music'}</Text>
          </View>
          <Text style={styles.microDot}>•</Text>
          <Text style={styles.microInfo}>{item.plays || item.views || '0'} plays</Text>
        </View>
      </View>

      <View style={styles.rowActions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => openMusicPlayer(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={18} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={() => showSongOptions(item)}>
          <Ionicons name="ellipsis-vertical" size={18} color="#6A6A6A" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderVideoRow = ({ item }: any) => (
    <TouchableOpacity
      style={styles.videoRow}
      activeOpacity={0.92}
      onPress={() => openVideoInfo(item)}
      onPressIn={onVideoPressIn}
      onPressOut={onVideoPressOut}
    >
      <Animated.View style={[styles.videoThumbWrap, { transform: [{ scale: pressScale }] }]}>
        <Image source={{ uri: item.coverUrl }} style={styles.videoThumb} />

        {/* Blur overlay on press (animated opacity) */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: pressBlur }]}>
          {/* <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={12}
            reducedTransparencyFallbackColor="black"
          /> */}
          <View style={styles.blurHintCenter}>
            <View style={styles.blurHintChip}>
              <Ionicons name="play" size={14} color="#fff" />
              <Text style={styles.blurHintText}>Preview</Text>
            </View>
          </View>
        </Animated.View>

        {!item.isLive ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{item.duration || '10:30'}</Text>
          </View>
        ) : (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </Animated.View>

      <View style={styles.videoMeta}>
        <View style={styles.videoTitleRow}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <TouchableOpacity onPress={() => showVideoOptions(item)} style={styles.ghostBtnSm}>
            <Ionicons name="ellipsis-vertical" size={16} color="#6A6A6A" />
          </TouchableOpacity>
        </View>

        <Text style={styles.videoSub} numberOfLines={1}>
          {item.channelName || item.category || 'Channel'}
        </Text>

        <View style={styles.videoStatsRow}>
          <Text style={styles.videoStat}>{item.views || '0'} views</Text>
          <Text style={styles.videoDot}>•</Text>
          <Text style={styles.videoStat}>{item.uploadTime || 'Recently'}</Text>
        </View>

        <Text style={styles.videoDesc} numberOfLines={2}>
          {item.description || 'No description available.'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderGroupingItem = ({ item }: any) => (
    <TouchableOpacity activeOpacity={0.92} style={styles.genreCard} onPress={() => Alert.alert('Genre', item.title)}>
      <Image source={item.image} style={styles.genreBg} />
      <LinearGradient colors={item.colors} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.genreFade} />
      <Text style={styles.genreTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  // ---------- content ----------
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      );
    }

    if (activeTab === 'Pour toi') {
      return (
        <Animated.View style={{ opacity: tabOpacity }}>
          <Text style={styles.sectionTitle}>Featured</Text>
          <FlatList
            data={videos}
            renderItem={renderHeroItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CAROUSEL_WIDTH + ITEM_SPACING}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />

          <View style={{ height: 14 }} />

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Popular Songs</Text>
            <TouchableOpacity onPress={() => setActiveTab('Musique')}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={songs}
            renderItem={renderSongItem}
            scrollEnabled={false}
            keyExtractor={(it: any) => it.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          />
        </Animated.View>
      );
    }

    if (activeTab === 'Musique') {
      return (
        <Animated.View style={{ opacity: tabOpacity }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>All Songs</Text>
            <Text style={styles.sectionHint}>{songs.length} items</Text>
          </View>

          <FlatList
            data={songs}
            renderItem={renderSongItem}
            keyExtractor={(it: any) => it.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          />
        </Animated.View>
      );
    }

    return (
      <Animated.View style={{ opacity: tabOpacity }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>All Videos</Text>
          <Text style={styles.sectionHint}>{videos.length} items</Text>
        </View>

        <FlatList
          data={videos}
          renderItem={renderVideoRow}
          keyExtractor={(it: any) => it.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      </Animated.View>
    );
  };

  const renderBottomSheetContent = () => {
    const titleMap: any = {
      grouping: 'Browse Genres',
      favorites: 'Your Favorites',
      downloads: 'Your Downloads',
      library: 'Your Playlists',
    };

    return (
      <View style={{ paddingBottom: 10 }}>
        <View style={styles.sheetTopRow}>
          <Text style={styles.sheetTitle}>{titleMap[activeBottomTab]}</Text>
          <TouchableOpacity onPress={() => setBottomSheetVisible(false)} style={styles.sheetCloseBtn}>
            <Ionicons name="close" size={18} color="#111" />
          </TouchableOpacity>
        </View>

        {activeBottomTab === 'grouping' && (
          <FlatList
            data={groupingData}
            renderItem={renderGroupingItem}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        {activeBottomTab === 'favorites' && (
          favorites.length > 0 ? (
            <FlatList
              data={favorites}
              renderItem={renderSongItem}
              keyExtractor={(it: any) => it.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            />
          ) : (
            <Text style={styles.emptyText}>No favorites yet</Text>
          )
        )}

        {activeBottomTab === 'downloads' && (
          downloads.length > 0 ? (
            <FlatList
              data={downloads}
              renderItem={renderSongItem}
              keyExtractor={(it: any) => it.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            />
          ) : (
            <Text style={styles.emptyText}>No downloads yet</Text>
          )
        )}

        {activeBottomTab === 'library' && (
          playlists.length > 0 ? (
            <FlatList
              data={playlists}
              renderItem={renderSongItem}
              keyExtractor={(it: any) => it.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            />
          ) : (
            <Text style={styles.emptyText}>No playlists yet</Text>
          )
        )}
      </View>
    );
  };

  // ---------- main ----------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top Bar (same clean style like profile/settings) */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.avatarChip}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Settings')}
        >
          <Image
            source={require('../../../assets/images/appLogo.png')}
            style={styles.avatarChipImg}
          />
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.userText}>{userName}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => navigation.navigate('MediaStream')}
          >
            <Ionicons name="search-outline" size={20} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabsWrap}>
        {['Pour toi', 'Musique', 'Film/Série'].map(tab => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.9}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => handleTabChange(tab as any)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {renderContent()}
      </ScrollView>

      {/* Bottom Navigation (pill style) */}
      <View style={styles.bottomNav}>
        {[
          { key: 'grouping', icon: 'grid' as any, label: 'Genres' },
          { key: 'favorites', icon: 'heart' as any, label: 'Likes' },
          { key: 'downloads', icon: 'download' as any, label: 'Offline' },
          { key: 'library', icon: 'albums' as any, label: 'Library' },
        ].map(t => {
          const active = activeBottomTab === (t.key as any);
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              style={styles.bottomItem}
              onPress={() => {
                setActiveBottomTab(t.key as any);
                setBottomSheetVisible(true);
              }}
            >
              <View style={[styles.bottomIconWrap, active && { backgroundColor: 'rgba(46,204,113,0.14)' }]}>
                <Ionicons name={t.icon} size={20} color={active ? COLORS.light.primary : '#8A8A8A'} />
              </View>
              <Text style={[styles.bottomLabel, active && { color: COLORS.light.primary }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ---------- Music Player: FULL MODAL SCREEN (unique, white, premium) ---------- */}
      <Modal visible={musicModalVisible} animationType="slide" transparent>
        <View style={styles.fullModalBackdrop}>
          <View style={styles.fullModalSheet}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={() => setMusicModalVisible(false)} style={styles.modalHeaderBtn}>
                <Ionicons name="chevron-down" size={24} color="#111" />
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={styles.modalHeaderTitle}>Now Playing</Text>
                <Text style={styles.modalHeaderSub} numberOfLines={1}>
                  {currentSong?.genre || 'Music'}
                </Text>
              </View>

              <TouchableOpacity onPress={() => showSongOptions(currentSong)} style={styles.modalHeaderBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Hero Art */}
            <View style={styles.musicHeroWrap}>
              <Image source={{ uri: currentSong?.coverUrl }} style={styles.musicHeroArt} />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
                style={styles.musicHeroShade}
              />
            </View>

            {/* Info */}
            <View style={styles.musicInfoBlock}>
              <View style={{ flex: 1 }}>
                <Text style={styles.musicTitle} numberOfLines={1}>
                  {currentSong?.title || 'Unknown Title'}
                </Text>
                <Text style={styles.musicArtist} numberOfLines={1}>
                  {currentSong?.artist || 'Unknown Artist'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.likeBtn}
                onPress={() => currentSong && addToFavorites(currentSong)}
              >
                <Ionicons name="heart-outline" size={20} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Progress */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${clamp((songPosition / songDuration) * 100, 0, 100)}%` }]} />
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(songPosition)}</Text>
                <Text style={styles.timeText}>{formatTime(songDuration)}</Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.controlBtn} onPress={() => setIsMuted(m => !m)}>
                <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => Alert.alert('Queue', 'Open queue here.')}>
                <Ionicons name="list" size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => Alert.alert('Previous', 'Previous track')}>
                <Ionicons name="play-skip-back" size={26} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.playBigBtn}
                onPress={() => setIsPlaying(p => !p)}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => Alert.alert('Next', 'Next track')}>
                <Ionicons name="play-skip-forward" size={26} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => Alert.alert('Repeat', 'Repeat mode')}>
                <Ionicons name="repeat" size={22} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlBtn} onPress={() => Alert.alert('Download', 'Download song')}>
                <Ionicons name="download-outline" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {/* Bottom actions */}
            <View style={styles.musicBottomActions}>
              <TouchableOpacity
                style={[styles.actionPill, { backgroundColor: '#F2F3F5' }]}
                onPress={() => currentSong && showSongOptions(currentSong)}
              >
                <Ionicons name="options-outline" size={18} color="#111" />
                <Text style={styles.actionPillText}>Options</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionPill, { backgroundColor: 'rgba(46,204,113,0.14)', borderColor: 'rgba(46,204,113,0.35)', borderWidth: 1 }]}
                onPress={() => {
                  setMusicModalVisible(false);
                  navigation.navigate('Profile');
                }}
              >
                <Ionicons name="sparkles-outline" size={18} color={COLORS.light.primary} />
                <Text style={[styles.actionPillText, { color: COLORS.light.primary }]}>Go Premium</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- Video Info Modal (Netflix-like card, white) ---------- */}
      <Modal visible={videoInfoModalVisible} animationType="fade" transparent>
        <View style={styles.videoInfoBackdrop}>
          <View style={styles.videoInfoCard}>
            <TouchableOpacity
              style={styles.videoInfoClose}
              onPress={() => setVideoInfoModalVisible(false)}
            >
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>

            <View style={styles.videoInfoHero}>
              <Image source={{ uri: currentVideo?.coverUrl }} style={styles.videoInfoHeroImg} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.videoInfoHeroGrad} />

              <View style={styles.videoInfoHeroTop}>
                {currentVideo?.isLive ? (
                  <View style={[styles.heroPill, { backgroundColor: '#FF2D2D' }]}>
                    <Text style={[styles.heroPillText, { fontWeight: '900' }]}>LIVE</Text>
                  </View>
                ) : (
                  <View style={styles.heroPill}>
                    <Ionicons name="time-outline" size={14} color="#fff" />
                    <Text style={styles.heroPillText}>{currentVideo?.duration || '10:30'}</Text>
                  </View>
                )}
              </View>

              <View style={styles.videoInfoHeroBottom}>
                <Text style={styles.videoInfoTitle} numberOfLines={2}>
                  {currentVideo?.title || 'Untitled'}
                </Text>
                <Text style={styles.videoInfoSub} numberOfLines={1}>
                  {(currentVideo?.channelName || currentVideo?.category || 'Channel')} • {currentVideo?.views || '0'} views
                </Text>
              </View>
            </View>

            <View style={styles.videoInfoBody}>
              <Text style={styles.videoInfoDesc} numberOfLines={4}>
                {currentVideo?.description || 'No description available.'}
              </Text>

              <View style={styles.videoInfoBtns}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.9}
                  onPress={openVideoFullscreen}
                >
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Play</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => currentVideo && addToFavorites(currentVideo)}
                >
                  <Ionicons name="heart-outline" size={18} color="#111" />
                  <Text style={styles.secondaryBtnText}>Favorite</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => currentVideo && showVideoOptions(currentVideo)}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#111" />
                  <Text style={styles.secondaryBtnText}>More</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------- Video FULLSCREEN Player Modal (white, cinematic, unique) ---------- */}
      <Modal visible={videoFullscreenVisible} animationType="slide" transparent>
        <View style={styles.videoFullWrap}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* Top controls */}
          <View style={styles.videoFullTopBar}>
            <TouchableOpacity
              style={styles.videoFullTopBtn}
              onPress={() => setVideoFullscreenVisible(false)}
            >
              <Ionicons name="chevron-down" size={24} color="#111" />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={styles.videoFullTitle} numberOfLines={1}>
                {currentVideo?.title || 'Video'}
              </Text>
              <Text style={styles.videoFullSub} numberOfLines={1}>
                {(currentVideo?.channelName || currentVideo?.category || 'Channel')} • {currentVideo?.views || '0'} views
              </Text>
            </View>

            <TouchableOpacity style={styles.videoFullTopBtn} onPress={() => showVideoOptions(currentVideo)}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          {/* Video canvas placeholder (replace with your video player component later) */}
          <View style={styles.videoCanvas}>
            <Image source={{ uri: currentVideo?.coverUrl }} style={styles.videoCanvasImg} />

            {/* Glass overlay controls */}
            <View style={styles.videoControlsGlass}>
              <View style={styles.videoControlsRow}>
                <TouchableOpacity style={styles.videoControlBtn} onPress={() => setIsMuted(m => !m)}>
                  <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#111" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.videoPlayBig} onPress={() => setIsPlaying(p => !p)}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.videoControlBtn} onPress={() => Alert.alert('Full', 'Toggle fullscreen')}>
                  <Ionicons name="expand-outline" size={22} color="#111" />
                </TouchableOpacity>
              </View>

              <View style={styles.videoProgressWrap}>
                <View style={styles.videoProgressTrack}>
                  <View style={[styles.videoProgressFill, { width: '28%' }]} />
                </View>
                <View style={styles.videoTimeRow}>
                  <Text style={styles.videoTime}>0:22</Text>
                  <Text style={styles.videoTime}>{currentVideo?.duration || '10:30'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Details (white sheet) */}
          <View style={styles.videoFullDetails}>
            <View style={styles.videoFullActions}>
              <TouchableOpacity style={styles.videoActionChip} onPress={() => currentVideo && addToFavorites(currentVideo)}>
                <Ionicons name="heart-outline" size={18} color="#111" />
                <Text style={styles.videoActionText}>Like</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.videoActionChip} onPress={() => Alert.alert('Share', 'Share link here')}>
                <Ionicons name="share-social-outline" size={18} color="#111" />
                <Text style={styles.videoActionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.videoActionChip} onPress={() => currentVideo && downloadVideo(currentVideo)}>
                <Ionicons name="download-outline" size={18} color="#111" />
                <Text style={styles.videoActionText}>Download</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.videoActionChip} onPress={() => Alert.alert('Playlist', 'Add to playlist')}>
                <Ionicons name="add-circle-outline" size={18} color="#111" />
                <Text style={styles.videoActionText}>Playlist</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.videoFullDesc} numberOfLines={4}>
              {currentVideo?.description || 'No description available.'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ---------- Bottom Sheet Modal ---------- */}
      <Modal visible={bottomSheetVisible} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setBottomSheetVisible(false)} activeOpacity={1} />
          <View style={styles.sheetCard}>{renderBottomSheetContent()}</View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Media;

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // TopBar
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarChipImg: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  greetingText: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '700',
  },
  userText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '900',
    marginTop: 1,
  },
  topBarActions: { flexDirection: 'row', gap: 10 },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabsWrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
  },
  tabChipActive: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.35)',
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#444',
  },
  tabTextActive: {
    color: COLORS.light.primary,
  },

  // section titles
  sectionHeaderRow: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    fontSize: 20,
    color: '#111',
    fontWeight: '900',
  },
  sectionLink: {
    fontSize: 13.5,
    fontWeight: '900',
    color: COLORS.light.primary,
  },
  sectionHint: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#7A7A7A',
  },

  // loading
  loadingWrap: {
    paddingVertical: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero carousel (featured)
  heroCard: {
    width: CAROUSEL_WIDTH,
    height: 220,
    marginRight: ITEM_SPACING,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#EEE',
  },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    height: 120,
    width: '100%',
  },
  heroMetaRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 34,
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  heroSub: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // Song row
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  songArt: {
    width: 62,
    height: 62,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#EEE',
  },
  songTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#111',
  },
  songArtist: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: '#6B6B6B',
  },
  songMicroRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  microPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2F3F5',
  },
  microPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#444',
  },
  microDot: { color: '#A0A0A0', fontWeight: '900' },
  microInfo: { fontSize: 12, fontWeight: '800', color: '#7A7A7A' },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Video row
  videoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  videoThumbWrap: {
    width: width * 0.42,
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EAEAEA',
  },
  videoThumb: { width: '100%', height: '100%' },

  blurHintCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blurHintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  blurHintText: { color: '#fff', fontSize: 12.5, fontWeight: '900' },

  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: { color: '#fff', fontSize: 11.5, fontWeight: '900' },

  liveBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: '#FF2D2D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  liveText: { color: '#fff', fontSize: 11.5, fontWeight: '900' },

  videoMeta: { flex: 1, paddingTop: 2 },
  videoTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  videoTitle: { flex: 1, fontSize: 15.5, fontWeight: '900', color: '#111', lineHeight: 20 },
  ghostBtnSm: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoSub: { marginTop: 4, fontSize: 12.5, fontWeight: '800', color: '#6B6B6B' },
  videoStatsRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoStat: { fontSize: 12.5, fontWeight: '800', color: '#7A7A7A' },
  videoDot: { color: '#A0A0A0', fontWeight: '900' },
  videoDesc: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#6A6A6A', lineHeight: 18 },

  // Genres
  genreCard: {
    width: (width - 16 * 2 - 12) / 2,
    height: 120,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  genreBg: { width: '100%', height: '100%', opacity: 0.34 },
  genreFade: { position: 'absolute', bottom: 0, height: 60, width: '100%' },
  genreTitle: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },

  // Bottom nav
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  bottomItem: { alignItems: 'center', gap: 6 },
  bottomIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLabel: { fontSize: 11.5, fontWeight: '900', color: '#8A8A8A' },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: height * 0.78,
  },
  sheetTopRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: '#111' },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 30,
    color: '#7A7A7A',
    fontWeight: '800',
  },

  // Full modal base
  fullModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  fullModalSheet: {
    height: height * 0.92,
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: { fontSize: 14, fontWeight: '900', color: '#111' },
  modalHeaderSub: { fontSize: 12, fontWeight: '800', color: '#7A7A7A', marginTop: 2 },

  // Music player
  musicHeroWrap: {
    marginTop: 10,
    borderRadius: 26,
    overflow: 'hidden',
    height: height * 0.40,
    backgroundColor: '#EEE',
  },
  musicHeroArt: { width: '100%', height: '100%' },
  musicHeroShade: { position: 'absolute', bottom: 0, height: 160, width: '100%' },

  musicInfoBlock: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  musicTitle: { fontSize: 20, fontWeight: '900', color: '#111' },
  musicArtist: { marginTop: 5, fontSize: 14, fontWeight: '800', color: '#6B6B6B' },
  likeBtn: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressWrap: { marginTop: 16, paddingHorizontal: 4 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E6E7EA',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.light.primary,
  },
  timeRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: { fontSize: 12, fontWeight: '800', color: '#7A7A7A' },

  controlsRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  controlBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBigBtn: {
    width: 70,
    height: 70,
    borderRadius: 26,
    backgroundColor: COLORS.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
    }),
  },

  musicBottomActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  actionPill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionPillText: { fontSize: 13.5, fontWeight: '900', color: '#111' },

  // Video Info modal
  videoInfoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  videoInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
  },
  videoInfoClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfoHero: { height: height * 0.30, backgroundColor: '#EEE' },
  videoInfoHeroImg: { width: '100%', height: '100%' },
  videoInfoHeroGrad: { position: 'absolute', bottom: 0, height: 140, width: '100%' },
  videoInfoHeroTop: { position: 'absolute', top: 12, left: 12, right: 12 },
  videoInfoHeroBottom: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  videoInfoTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  videoInfoSub: { marginTop: 6, color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '800' },

  videoInfoBody: { padding: 16 },
  videoInfoDesc: { fontSize: 13.5, fontWeight: '700', color: '#5E5E5E', lineHeight: 19 },
  videoInfoBtns: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
    minWidth: 140,
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2F3F5',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    flex: 1,
    minWidth: 120,
  },
  secondaryBtnText: { color: '#111', fontWeight: '900', fontSize: 13.5 },

  // Video Fullscreen modal
  videoFullWrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  videoFullTopBar: {
    paddingTop: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoFullTopBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFullTitle: { fontSize: 15.5, fontWeight: '900', color: '#111' },
  videoFullSub: { marginTop: 3, fontSize: 12, fontWeight: '800', color: '#7A7A7A' },

  videoCanvas: {
    marginHorizontal: 12,
    borderRadius: 22,
    overflow: 'hidden',
    height: height * 0.42,
    backgroundColor: '#EEE',
  },
  videoCanvasImg: { width: '100%', height: '100%' },

  videoControlsGlass: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
    }),
  },
  videoControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBig: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: COLORS.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoProgressWrap: { marginTop: 10 },
  videoProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E6E7EA',
    overflow: 'hidden',
  },
  videoProgressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.light.primary,
  },
  videoTimeRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  videoTime: { fontSize: 12, fontWeight: '900', color: '#6F6F6F' },

  videoFullDetails: {
    marginTop: 12,
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 14,
  },
  videoFullActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  videoActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F2F3F5',
  },
  videoActionText: { fontSize: 13, fontWeight: '900', color: '#111' },
  videoFullDesc: { fontSize: 13.5, fontWeight: '700', color: '#5E5E5E', lineHeight: 19 },
});

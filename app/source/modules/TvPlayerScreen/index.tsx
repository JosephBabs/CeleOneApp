import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native'; // With this import
import { Video, ResizeMode } from 'react-native-video';
import * as ImagePicker from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { d_assets } from '../../configs/assets';

const TvPlayerScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const currentUser = auth.currentUser;
  const videoRef = useRef<Video>(null);

  // State variables
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allPodcasts, setAllPodcasts] = useState<any[]>([]);
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [showManageModal, setShowManageModal] = useState(false);
  const [streamLink, setStreamLink] = useState('');
  const [programTitle, setProgramTitle] = useState('');
  const [programImage, setProgramImage] = useState('');
  const [podcastTitle, setPodcastTitle] = useState('');
  const [podcastLink, setPodcastLink] = useState('');
  const [podcastImage, setPodcastImage] = useState('');

  // Video controls state
  const [showControls, setShowControls] = useState(false);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [screenHeight, setScreenHeight] = useState(
    Dimensions.get('window').height * 0.3,
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch channels
        const channelsRef = collection(db, 'channels');
        const channelsSnapshot = await getDocs(channelsRef);
        const channelsData = channelsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setChannels(channelsData);

        // Set default selections
        if (channelsData.length > 0) {
          setSelectedChannel(channelsData[0]);
        }

        // Fetch all programs and podcasts
        await fetchAllContent();
      } catch (error) {
        console.error('Error fetching initial data:', error);
        Alert.alert('Error', 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      fetchProgramsAndPodcasts();
    }
  }, [selectedChannel]);

  const fetchAllContent = async () => {
    try {
      // Fetch all programs across channels
      const allProgramsData: any[] = [];
      const allPodcastsData: any[] = [];

      for (const channel of channels) {
        const programsRef = collection(db, 'channels', channel.id, 'programs');
        const programsSnapshot = await getDocs(programsRef);
        const programsData = programsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        allProgramsData.push(...programsData);

        const podcastsRef = collection(db, 'channels', channel.id, 'podcasts');
        const podcastsSnapshot = await getDocs(podcastsRef);
        const podcastsData = podcastsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        allPodcastsData.push(...podcastsData);
      }

      setAllPrograms(allProgramsData);
      setAllPodcasts(allPodcastsData);

      // Extract unique categories
      const uniqueCategories = [
        ...new Set(
          [
            ...allProgramsData.map(p => p.category),
            ...allPodcastsData.map(p => p.category),
          ].filter(Boolean),
        ),
      ];
      setUniqueCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching all content:', error);
    }
  };

  const fetchProgramsAndPodcasts = async () => {
    if (!selectedChannel) return;

    try {
      // Fetch programs
      const programsRef = collection(
        db,
        'channels',
        selectedChannel.id,
        'programs',
      );
      const programsSnapshot = await getDocs(programsRef);
      const programsData = programsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch podcasts
      const podcastsRef = collection(
        db,
        'channels',
        selectedChannel.id,
        'podcasts',
      );
      const podcastsSnapshot = await getDocs(podcastsRef);
      const podcastsData = podcastsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSelectedChannel((prev: any) =>
        prev
          ? {
              ...prev,
              programs: programsData,
              podcasts: podcastsData,
            }
          : null,
      );
    } catch (error) {
      console.error('Error fetching programs and podcasts:', error);
    }
  };

  const handleManageChannel = () => {
    if (selectedChannel) {
      setStreamLink(selectedChannel.streamLink || '');
      setShowManageModal(true);
    }
  };

  const pickProgramImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission denied',
        'Sorry, we need camera roll permissions to make this work!',
      );
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setProgramImage(result.assets[0].uri);
    }
  };

  const pickPodcastImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission denied',
        'Sorry, we need camera roll permissions to make this work!',
      );
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setPodcastImage(result.assets[0].uri);
    }
  };

  const addProgram = async () => {
    if (!programTitle.trim()) {
      Alert.alert('Error', 'Please enter a program title');
      return;
    }

    try {
      const programsRef = collection(
        db,
        'channels',
        selectedChannel.id,
        'programs',
      );
      await addDoc(programsRef, {
        title: programTitle,
        thumbnail: programImage,
        date: new Date(),
        createdAt: new Date(),
      });
      setProgramTitle('');
      setProgramImage('');
      Alert.alert('Success', 'Program added successfully');
    } catch (error) {
      console.error('Error adding program:', error);
      Alert.alert('Error', 'Failed to add program');
    }
  };

  const addPodcast = async () => {
    if (!podcastTitle.trim()) {
      Alert.alert('Error', 'Please enter a podcast title');
      return;
    }

    if (!podcastLink.trim()) {
      Alert.alert('Error', 'Please enter a podcast link');
      return;
    }

    try {
      const podcastsRef = collection(
        db,
        'channels',
        selectedChannel.id,
        'podcasts',
      );
      await addDoc(podcastsRef, {
        title: podcastTitle,
        link: podcastLink,
        thumbnail: podcastImage,
        createdAt: new Date(),
      });
      setPodcastTitle('');
      setPodcastLink('');
      setPodcastImage('');
      Alert.alert('Success', 'Podcast added successfully');
    } catch (error) {
      console.error('Error adding podcast:', error);
      Alert.alert('Error', 'Failed to add podcast');
    }
  };

  const updateChannel = async () => {
    try {
      const channelRef = doc(db, 'channels', selectedChannel.id);
      await updateDoc(channelRef, {
        streamLink: streamLink,
        updatedAt: new Date(),
      });
      setShowManageModal(false);
      Alert.alert('Success', 'Channel updated successfully');
      // Refresh channels
      const updatedChannels = channels.map(channel =>
        channel.id === selectedChannel.id
          ? { ...channel, streamLink }
          : channel,
      );
      setChannels(updatedChannels);
      setSelectedChannel({ ...selectedChannel, streamLink });
    } catch (error) {
      console.error('Error updating channel:', error);
      Alert.alert('Error', 'Failed to update channel');
    }
  };

  // Video controls functions
  const showVideoControls = () => {
    setShowControls(true);

    // Clear any existing timeout
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }

    // Set new timeout to hide controls after 2 seconds
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 2000);

    setControlsTimeout(timeout);
  };

  const handleVideoFrameClick = () => {
    showVideoControls();
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
    showVideoControls();
  };

  const handleRewind = async () => {
    if (videoRef.current) {
      const status = await videoRef.current.getStatusAsync();
      const newPosition = Math.max(0, status.positionMillis - 10000); // 10 seconds in milliseconds
      await videoRef.current.setPositionAsync(newPosition);
      setCurrentTime(newPosition / 1000);
      setVideoProgress((newPosition / 1000 / videoDuration) * 100);
    }
    showVideoControls();
  };

  const handleForward = async () => {
    if (videoRef.current) {
      const status = await videoRef.current.getStatusAsync();
      const newPosition = Math.min(
        videoDuration * 1000,
        status.positionMillis + 10000,
      ); // 10 seconds in milliseconds
      await videoRef.current.setPositionAsync(newPosition);
      setCurrentTime(newPosition / 1000);
      setVideoProgress((newPosition / 1000 / videoDuration) * 100);
    }
    showVideoControls();
  };

  const handleProgressBarPress = async (event: any) => {
    if (videoRef.current) {
      const { locationX } = event.nativeEvent;
      const progressBarWidth = event.nativeEvent.target.offsetWidth;
      const newProgress = (locationX / progressBarWidth) * 100;
      const newTime = (newProgress / 100) * videoDuration;

      await videoRef.current.setPositionAsync(newTime * 1000); // Convert to milliseconds
      setVideoProgress(newProgress);
      setCurrentTime(newTime);
    }
    showVideoControls();
  };

  const handleReturn = () => {
    // Navigate back to previous screen
    navigation.goBack();
  };

  const handleFullscreen = () => {
    setIsFullScreen(!isFullScreen);
    showVideoControls();

    // Update screen height when toggling fullscreen
    setScreenHeight(
      isFullScreen
        ? Dimensions.get('window').height * 0.3
        : Dimensions.get('window').height,
    );

    // Show/hide status bar based on fullscreen state
    StatusBar.setHidden(!isFullScreen);
  };

  const handleVideoPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setVideoDuration(status.durationMillis / 1000); // Convert to seconds
      setCurrentTime(status.positionMillis / 1000); // Convert to seconds
      setVideoProgress((status.positionMillis / status.durationMillis) * 100);
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  const isLiveStream = !videoDuration || videoDuration === 0;

  const onLoad = data => {
    setVideoDuration(data.duration || 0);
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: '#fff' }}>Loading channels...</Text>
        </View>
      </SafeAreaView>
    );
  }

  
  
  // const onProgress = useCallback(
  //   data => {
  //     if (!isLiveStream) {
  //       setCurrentTime(data.currentTime);
  //       setVideoProgress((data.currentTime / videoDuration) * 100);
  //     }
  //   },
  //   [isLiveStream, videoDuration],
  // );
  

  return (
    <View style={styles.container}>
      {/* player screen */}
      <View style={[styles.playerScreen, { height: screenHeight }]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleVideoFrameClick}
          style={styles.videoContainer}
        >
          {selectedChannel?.streamLink ? (
            <Video
              source={{ uri: selectedChannel.streamLink, type: 'm3u8' }}
              style={styles.tvImage}
              resizeMode="contain"
              paused={!isPlaying}
              controls={true}
              repeat={false}
              bufferConfig={{
                minBufferMs: 2000,
                maxBufferMs: 8000,
                bufferForPlaybackMs: 1000,
                bufferForPlaybackAfterRebufferMs: 2000,
              }}
              automaticallyWaitsToMinimizeStalling={false}
              ignoreSilentSwitch="ignore"
              playInBackground={false}
              playWhenInactive={false}
              // onProgress={onProgress}
              // onBuffer={onBuffer}
              // onError={onError}
            />
          ) : (
            <View style={styles.noStreamContainer}>
              <Text style={styles.noStreamText}>
                Channel not currently streaming
              </Text>
            </View>
          )}

          {/* {isBuffering && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )} */}
          {/* Video Controls - Only show when showControls is true */}
          {showControls && (
            <View style={styles.videoControls}>
              {/* Top row: Return button and Live badge */}
              <View style={styles.controlsTopRow}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleReturn}
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                {selectedChannel?.streamLink && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>
                      {t('tvPlayer.liveBadge')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Middle row: Playback controls */}
              <View style={styles.controlsMiddleRow}>
                <TouchableOpacity
                  style={styles.playbackButton}
                  onPress={handleRewind}
                >
                  <Ionicons
                    name="return-up-back-outline"
                    size={28}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playbackButton}
                  onPress={togglePlayPause}
                >
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={32}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playbackButton}
                  onPress={handleForward}
                >
                  <Ionicons
                    name="return-up-forward-outline"
                    size={28}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>

              {/* Bottom row: Progress bar and fullscreen button */}
              <View style={styles.controlsBottomRow}>
                <TouchableOpacity
                  style={styles.progressBarContainer}
                  onPress={handleProgressBarPress}
                >
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${videoProgress}%` },
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                <View style={styles.timeAndFullscreenContainer}>
                  <Text style={styles.timeText}>
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </Text>

                  <TouchableOpacity
                    style={styles.fullscreenButton}
                    onPress={handleFullscreen}
                  >
                    <Ionicons
                      name={isFullScreen ? 'contract' : 'expand'}
                      size={24}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {!isLiveStream && (
        <View style={styles.controlsBottomRow}>
          <TouchableOpacity
            style={styles.progressBarContainer}
            onPress={handleProgressBarPress}
          >
            <View style={styles.progressBarBackground}>
              <View
                style={[styles.progressBarFill, { width: `${videoProgress}%` }]}
              />
            </View>
          </TouchableOpacity>

          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(videoDuration)}
          </Text>
        </View>
      )}

      {/* Content container - Only show when not in fullscreen mode */}
      {!isFullScreen && (
        <View style={styles.contentContainer}>
          <ScrollView style={styles.containerScroll}>
            <View style={styles.activeChannelSection}>
              <View style={styles.activeChannel}>
                <View style={styles.iconContainer}>
                  <Image
                    source={d_assets.images.appLogo}
                    style={styles.avatar}
                    defaultSource={d_assets.images.appLogo}
                  />
                </View>
                <Text style={styles.channelName}>
                  {selectedChannel?.name || t('tvPlayer.tvTitle')}
                </Text>
              </View>

              {selectedChannel?.ownerId === currentUser?.uid && (
                <TouchableOpacity
                  style={styles.myChannelButton}
                  onPress={handleManageChannel}
                >
                  <Text style={styles.myChannelText}>Edit Channel</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.title}>{t('tvPlayer.tvSubtitle')}</Text>
            <Text style={styles.subtitle}>
              {selectedChannel?.description || t('tvPlayer.tvSubtitle')}
            </Text>

            <View style={styles.channelDisplay}>
              <ScrollView
                style={styles.cardScroll}
                horizontal
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                {channels.map(channel => (
                  <TouchableOpacity
                    key={channel.id}
                    onPress={() => setSelectedChannel(channel)}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        selectedChannel?.id === channel.id &&
                          styles.channelButtonActive,
                      ]}
                    >
                      <View style={styles.iconContainer}>
                        <Image
                          source={d_assets.images.appLogo}
                          style={styles.avatar}
                          defaultSource={d_assets.images.appLogo}
                        />
                      </View>
                      <Text
                        style={[
                          styles.channelButtonText,
                          selectedChannel?.id === channel.id &&
                            styles.channelButtonTextActive,
                        ]}
                      >
                        {channel.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Programs Horizontal Scroll Card */}
            {selectedChannel?.programs &&
              selectedChannel.programs.length > 0 && (
                <View style={styles.horizontalCardContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Programs</Text>
                    <TouchableOpacity
                      onPress={() => {
                        /* Handle see all */
                      }}
                    >
                      <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalCardContent}
                  >
                    {selectedChannel.programs.map((program: any) => (
                      <TouchableOpacity
                        key={program.id}
                        style={styles.programCard}
                        onPress={() => {
                          /* Handle program press */
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              program.thumbnail ||
                              'https://via.placeholder.com/150',
                          }}
                          style={styles.programThumbnail}
                          resizeMode="cover"
                        />
                        <View style={styles.programInfo}>
                          <Text style={styles.programTitle} numberOfLines={2}>
                            {program.title}
                          </Text>
                          <Text style={styles.programCategory}>
                            {program.category || 'General'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

            {/* Podcasts Horizontal Scroll Card */}
            {selectedChannel?.podcasts &&
              selectedChannel.podcasts.length > 0 && (
                <View style={styles.horizontalCardContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Podcasts</Text>
                    <TouchableOpacity
                      onPress={() => {
                        /* Handle see all */
                      }}
                    >
                      <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalCardContent}
                  >
                    {selectedChannel.podcasts.map((podcast: any) => (
                      <TouchableOpacity
                        key={podcast.id}
                        style={styles.podcastCard}
                        onPress={() => {
                          /* Handle podcast press */
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              podcast.thumbnail ||
                              'https://via.placeholder.com/150',
                          }}
                          style={styles.podcastThumbnail}
                          resizeMode="cover"
                        />
                        <View style={styles.podcastInfo}>
                          <Text style={styles.podcastTitle} numberOfLines={2}>
                            {podcast.title || `Podcast ${podcast.id}`}
                          </Text>
                          <Text style={styles.podcastCategory}>
                            {podcast.category || 'General'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
          </ScrollView>
        </View>
      )}

      {/* Manage Channel Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showManageModal}
        onRequestClose={() => setShowManageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Channel</Text>
              <TouchableOpacity onPress={() => setShowManageModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Stream Link</Text>
              <TextInput
                style={styles.input}
                value={streamLink}
                onChangeText={setStreamLink}
                placeholder="Enter stream link"
              />

              <Text style={styles.label}>Program Title</Text>
              <TextInput
                style={styles.input}
                value={programTitle}
                onChangeText={setProgramTitle}
                placeholder="Enter program title"
              />

              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={pickProgramImage}
              >
                <Ionicons name="image" size={20} color="#2FA5A9" />
                <Text style={styles.imagePickerText}>
                  {programImage
                    ? 'Change Program Image'
                    : 'Select Program Image'}
                </Text>
              </TouchableOpacity>

              {programImage ? (
                <Image
                  source={{ uri: programImage }}
                  style={styles.selectedImage}
                />
              ) : null}

              <TouchableOpacity style={styles.button} onPress={addProgram}>
                <Text style={styles.buttonText}>Add Program</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Podcast Title</Text>
              <TextInput
                style={styles.input}
                value={podcastTitle}
                onChangeText={setPodcastTitle}
                placeholder="Enter podcast title"
              />

              <Text style={styles.label}>Podcast Link</Text>
              <TextInput
                style={styles.input}
                value={podcastLink}
                onChangeText={setPodcastLink}
                placeholder="Enter podcast link"
              />

              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={pickPodcastImage}
              >
                <Ionicons name="image" size={20} color="#2FA5A9" />
                <Text style={styles.imagePickerText}>
                  {podcastImage
                    ? 'Change Podcast Image'
                    : 'Select Podcast Image'}
                </Text>
              </TouchableOpacity>

              {podcastImage ? (
                <Image
                  source={{ uri: podcastImage }}
                  style={styles.selectedImage}
                />
              ) : null}

              <TouchableOpacity style={styles.button} onPress={addPodcast}>
                <Text style={styles.buttonText}>Add Podcast</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={updateChannel}>
                <Text style={styles.buttonText}>Update Channel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingEnd: 10,
    color: COLORS.dark.background,
    backgroundColor: COLORS.white,
    padding: 0,
  },
  tvImage: {
    width: '100%',
    height: '100%',
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  myChannelButton: {
    backgroundColor: '#2FA5A9',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  myChannelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  noStreamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noStreamText: {
    color: '#fff',
    fontSize: 16,
  },
  horizontalCardContainer: {
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#f1f1f1',
    borderRadius: 12,
    padding: 15,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  videoControls: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    height: '100%',
    zIndex: 9999,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  videoContainer: {
    height: '100%',
    width: '100%',
  },
  controlsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  playerScreen: {
    backgroundColor: '#000',
    zIndex: 1,
  },
  fullscreenButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  timeAndFullscreenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  controlsMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  controlsBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    padding: 12,
    marginHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    flex: 1,
    marginRight: 10,
    height: 4,
    justifyContent: 'center',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 80,
    textAlign: 'right',
  },
  liveBadge: {
    backgroundColor: '#790b14',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  videoControlButton: {
    backgroundColor: '#fff',
    borderRadius: 50,
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.light.primary,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.dark,
  },
  horizontalCardContent: {
    paddingRight: 10,
  },
  programCard: {
    width: 160,
    marginRight: 15,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    overflow: 'hidden',
  },
  programThumbnail: {
    width: '100%',
    height: 100,
    backgroundColor: '#333',
  },
  programInfo: {
    padding: 10,
  },
  programTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  programCategory: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  podcastCard: {
    width: 160,
    marginRight: 15,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    overflow: 'hidden',
  },
  podcastThumbnail: {
    width: '100%',
    height: 100,
    backgroundColor: '#c5c5c5',
    resizeMode: 'cover',
  },
  podcastInfo: {
    padding: 10,
  },
  podcastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  podcastCategory: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 0.4,
    marginVertical: 2,
    gap: 5,
  },
  cardScroll: {
    backgroundColor: '#fff',
    flex: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignContent: 'flex-start',
    gap: 10,
  },
  iconBox: {
    minWidth: 92,
    borderRadius: 25,
    backgroundColor: '#dddddd',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
    marginRight: 5,
  },
  channelButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '500',
    paddingRight: 8,
  },
  channelButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
    paddingRight: 8,
  },
  channelButtonActive: {
    backgroundColor: '#2FA5A9',
    minWidth: 92,
    borderRadius: 25,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: '#E6F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  channelDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
    alignItems: 'center',
  },
  activeChannel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeChannelSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  contentContainer: {
    backgroundColor: '#ffffff',
    height: '71%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 9999,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 17,
  },
  containerScroll: {
    alignContent: 'flex-start',
  },
  subtitle: {
    fontSize: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2FA5A9',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Image picker styles
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#2FA5A9',
    borderRadius: 5,
    marginTop: 5,
    marginBottom: 10,
  },
  imagePickerText: {
    marginLeft: 10,
    color: '#2FA5A9',
  },
  selectedImage: {
    width: '100%',
    height: 150,
    borderRadius: 5,
    marginBottom: 10,
  },
});

export default TvPlayerScreen;

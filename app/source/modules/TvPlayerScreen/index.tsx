import React, { useState, useEffect } from 'react';
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
} from 'react-native';
// import { Ionicons } from "@expo/vector-icons";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import styles from './TvScreenStyles';

import { COLORS } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';

const TvPlayerScreen = () => {
  const { t } = useTranslation();
  const currentUser = auth.currentUser;
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allPodcasts, setAllPodcasts] = useState<any[]>([]);
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [showManageModal, setShowManageModal] = useState(false);
  const [streamLink, setStreamLink] = useState('');
  const [programTitle, setProgramTitle] = useState('');
  const [podcastLink, setPodcastLink] = useState('');

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

  const togglePlayPause = () => setIsPlaying(!isPlaying);

  const handleManageChannel = () => {
    if (selectedChannel) {
      setStreamLink(selectedChannel.streamLink || '');
      setShowManageModal(true);
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
        date: new Date(),
        createdAt: new Date(),
      });
      setProgramTitle('');
      Alert.alert('Success', 'Program added successfully');
    } catch (error) {
      console.error('Error adding program:', error);
      Alert.alert('Error', 'Failed to add program');
    }
  };

  const addPodcast = async () => {
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
        link: podcastLink,
        createdAt: new Date(),
      });
      setPodcastLink('');
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

  return (


      


    <SafeAreaView style={styles.container}>


      {/* Content Sections */}
      <View style={styles.channelSelectorcard}>
        {/* Channel Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.channelSelector}
        >
          {channels.map(channel => (
            <TouchableOpacity
              key={channel.id}
              onPress={() => setSelectedChannel(channel)}
              style={[
                styles.channelButton,
                selectedChannel?.id === channel.id &&
                  styles.channelButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.channelButtonText,
                  selectedChannel?.id === channel.id &&
                    styles.channelButtonTextActive,
                ]}
              >
                {channel.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* TV Player */}
      <View style={styles.tvFrame}>
        {selectedChannel?.streamLink ? (
          <Image
            source={{ uri: selectedChannel.streamLink }}
            style={styles.tvImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noStreamContainer}>
            <Text style={styles.noStreamText}>
              Channel not currently streaming
            </Text>
          </View>
        )}
        {selectedChannel?.streamLink && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>{t('tvPlayer.liveBadge')}</Text>
          </View>
        )}
      </View>

      {/* Info Text */}
      <View style={styles.infoSection}>
        <Text style={styles.title}>
          {selectedChannel?.name || t('tvPlayer.tvTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {selectedChannel?.description || t('tvPlayer.tvSubtitle')}
        </Text>
        {selectedChannel?.ownerId === currentUser?.uid && (
          <TouchableOpacity
            style={styles.myChannelBtn}
            onPress={handleManageChannel}
          >
            <Text style={styles.myChannelText}>My Channel</Text>
          </TouchableOpacity>
        )}

        
      </View>

      {/* Controls */}
      {selectedChannel?.streamLink && (
        <View style={styles.controls}>
          <TouchableOpacity>
            <Ionicons name="play-back" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayPause}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={50}
              color={COLORS.light.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity>
            <Ionicons name="play-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      
      

      <ScrollView>
        {/* Program Categories */}
        {uniqueCategories.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryBar}
            >
              {uniqueCategories.map(category => (
                <TouchableOpacity
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={[
                    styles.categoryBadge,
                    activeCategory === category && styles.categoryBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryBadgeText,
                      activeCategory === category &&
                        styles.categoryBadgeTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Programs */}
        {allPrograms.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Programs</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={allPrograms.filter(
                program =>
                  !activeCategory || program.category === activeCategory,
              )}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.programCard}
                  onPress={() => {
                    /* Handle program press */
                  }}
                >
                  <Text style={styles.programTitle}>{item.title}</Text>
                  <Text style={styles.programDate}>
                    {item.date
                      ? new Date(item.date.seconds * 1000).toLocaleDateString()
                      : 'No date'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {/* Podcasts */}
        {allPodcasts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Podcasts</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={allPodcasts.filter(
                podcast =>
                  !activeCategory || podcast.category === activeCategory,
              )}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.podcastCard}
                  onPress={() => {
                    /* Handle podcast press */
                  }}
                >
                  <Ionicons
                    name="play-circle"
                    size={30}
                    color={COLORS.light.primary}
                  />
                  <Text style={styles.podcastText}>
                    {item.title || `Podcast ${item.id}`}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {/* Channel Programs */}
        {selectedChannel?.programs && selectedChannel.programs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Programs of the Day - {selectedChannel.name}
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={selectedChannel.programs}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.programCard}>
                  <Text style={styles.programTitle}>{item.title}</Text>
                  <Text style={styles.programDate}>
                    {new Date(item.date.seconds * 1000).toLocaleDateString()}
                  </Text>
                </View>
              )}
            />
          </>
        )}

        {/* Channel Podcasts */}
        {selectedChannel?.podcasts && selectedChannel.podcasts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Podcasts - {selectedChannel.name}
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={selectedChannel.podcasts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.podcastCard}
                  onPress={() => {
                    /* Open link */
                  }}
                >
                  <Ionicons
                    name="play-circle"
                    size={30}
                    color={COLORS.light.primary}
                  />
                  <Text style={styles.podcastText}>
                    {item.title || `Podcast ${item.id}`}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </ScrollView>

      {/* Manage Channel Modal */}
      <Modal visible={showManageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Channel</Text>

            <TextInput
              style={styles.input}
              placeholder="Stream Link"
              value={streamLink}
              onChangeText={setStreamLink}
            />

            <TextInput
              style={styles.input}
              placeholder="Add Program Title"
              value={programTitle}
              onChangeText={setProgramTitle}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addProgram}>
              <Text style={styles.addBtnText}>Add Program</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Add Podcast Link"
              value={podcastLink}
              onChangeText={setPodcastLink}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addPodcast}>
              <Text style={styles.addBtnText}>Add Podcast</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowManageModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={updateChannel}>
                <Text style={styles.applyText}>Update Channel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default TvPlayerScreen;

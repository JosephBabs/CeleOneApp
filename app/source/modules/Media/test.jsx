import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  Dimensions,
  TextInput,
  Animated,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../../../core/theme/colors';

const { width } = Dimensions.get('window');
const ITEM_SPACING = 20;
const CAROUSEL_WIDTH = width * 0.6;

const Media = () => {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState('Pour toi');
  const [activeBottomTab, setActiveBottomTab] = useState('grouping');
  const [modalVisible, setModalVisible] = useState(false);

  const tabAnimation = useRef(new Animated.Value(1)).current;

  /* ---------------- DATA ---------------- */

  const carouselData = [
    { id: '1', title: 'Popular Music', image: require('../../../assets/images/posts/stream3.jpg') },
    { id: '2', title: 'Trending Movies', image: require('../../../assets/images/posts/Stream4.jpg') },
    { id: '3', title: 'New Series', image: require('../../../assets/images/posts/stream5.jpg') },
    { id: '4', title: 'Live Events', image: require('../../../assets/images/posts/stream6.jpg') },
  ];

  const songsData = [
    { id: '1', title: 'Song One', artist: 'Artist One', image: require('../../../assets/images/posts/stream3.jpg') },
    { id: '2', title: 'Song Two', artist: 'Artist Two', image: require('../../../assets/images/posts/Stream4.jpg') },
    { id: '3', title: 'Song Three', artist: 'Artist Three', image: require('../../../assets/images/posts/stream5.jpg') },
  ];

  const groupingData = [
    {
      id: '1',
      title: 'Pop',
      image: require('../../../assets/images/posts/stream3.jpg'),
      colors: ['rgba(255,105,180,0.85)', 'rgba(255,182,193,0.6)'], // Pink
    },
    {
      id: '2',
      title: 'Rock',
      image: require('../../../assets/images/posts/Stream4.jpg'),
      colors: ['rgba(255,255,255,0.9)', 'rgba(200,200,200,0.6)'], // White
    },
    {
      id: '3',
      title: 'Jazz',
      image: require('../../../assets/images/posts/stream5.jpg'),
      colors: ['rgba(234,224,200,0.9)', 'rgba(210,200,180,0.6)'], // Pearl
    },
    {
      id: '4',
      title: 'Classical',
      image: require('../../../assets/images/posts/stream6.jpg'),
      colors: ['rgba(120,120,120,0.9)', 'rgba(60,60,60,0.6)'], // Gray
    },
  ];

  /* ---------------- STATE & Music player floating bar ---------------- */

  /* ---------------- ANIMATION ---------------- */

  const handleTabChange = (tab) => {
    Animated.timing(tabAnimation, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  /* ---------------- RENDERS ---------------- */

  const renderCarouselItem = ({ item }) => (
    <TouchableOpacity style={styles.carouselItem}>
      <Image source={item.image} style={styles.carouselImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.carouselOverlay}
      />
      <Text style={styles.carouselTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  const renderSongItem = ({ item }) => (
    <TouchableOpacity style={styles.songItem}>
      <Image source={item.image} style={styles.songImage} />
      <Text style={styles.songTitle}>{item.title}</Text>
      <Text style={styles.songArtist}>{item.artist}</Text>
    </TouchableOpacity>
  );

  const renderGroupingItem = ({ item }) => (
    <TouchableOpacity style={styles.groupingItem}>
      <Image source={item.image} style={styles.groupingImage} />

      <LinearGradient
        colors={item.colors}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)']}
        style={styles.groupingOverlay}
      />

      <Text style={styles.groupingTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

  /* ---------------- CONTENT ---------------- */

  const renderContent = () => (
    <Animated.View style={{ opacity: tabAnimation }}>
      <View style={styles.carouselWrapper}>
        <FlatList
          data={carouselData}
          renderItem={renderCarouselItem}
          horizontal
          snapToInterval={CAROUSEL_WIDTH + ITEM_SPACING}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10 }}
        />
      </View>

      <Text style={styles.sectionTitle}>Popular Songs</Text>
      <FlatList
        data={songsData}
        renderItem={renderSongItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 10 }}
      />
    </Animated.View>
  );

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.container}>
      {/* NAVBAR */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.logo}>MEDIA</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            placeholder="Search..."
            placeholderTextColor="#888"
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        {['Pour toi', 'Musique', 'Film/Série'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={styles.tabText}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView>{renderContent()}</ScrollView>

      {/* GROUPING */}
      <View style={{ padding: 10 }}>
        <Text style={styles.sectionTitle}>Browse Genres</Text>
        <FlatList
          data={groupingData}
          renderItem={renderGroupingItem}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
        />
      </View>

      {/* BOTTOM TAB */}
      <View style={styles.bottomTab}>
        {[
          { key: 'grouping', icon: 'grid' },
          { key: 'favorites', icon: 'heart' },
          { key: 'library', icon: 'albums' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => {
              setActiveBottomTab(tab.key);
              setModalVisible(true);
            }}
          >
            <Ionicons
              name={tab.icon}
              size={24}
              color={activeBottomTab === tab.key ? COLORS.light.primary : '#aaa'}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {activeBottomTab.toUpperCase()}
            </Text>

            <Text style={{ color: '#aaa', marginTop: 10 }}>
              Content for {activeBottomTab}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Media;

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070707' },

  navbar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  logo: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginLeft: 10 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131313',
    borderRadius: 20,
    paddingHorizontal: 10,
    marginLeft: 'auto',
  },

  searchInput: { color: '#fff', width: 120, marginLeft: 5 },

  tabs: { flexDirection: 'row', padding: 10 },

  tab: {
    backgroundColor: '#131313',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },

  tabActive: { backgroundColor: COLORS.light.primary },

  tabText: { color: '#fff', fontWeight: 'bold' },

  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 15,
  },

  carouselWrapper: { height: 220 },

  carouselItem: {
    width: CAROUSEL_WIDTH,
    height: 200,
    marginRight: ITEM_SPACING,
    borderRadius: 12,
    overflow: 'hidden',
  },

  carouselImage: { width: '100%', height: '100%' },

  carouselOverlay: {
    position: 'absolute',
    bottom: 0,
    height: 90,
    width: '100%',
  },

  carouselTitle: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    color: '#fff',
    fontWeight: 'bold',
  },

  songItem: { width: 120, marginRight: 15 },

  songImage: { width: '100%', height: 100, borderRadius: 10 },

  songTitle: { color: '#fff', fontWeight: 'bold', marginTop: 5 },

  songArtist: { color: '#aaa', fontSize: 12 },

  groupingItem: {
    width: (width - 30) / 2,
    height: 120,
    borderRadius: 14,
    marginBottom: 15,
    overflow: 'hidden',
  },

  groupingImage: {
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },

  groupingOverlay: {
    position: 'absolute',
    bottom: 0,
    height: 60,
    width: '100%',
  },

  groupingTitle: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    color: '#fff',
    fontWeight: 'bold',
  },

  bottomTab: {
    height: 60,
    backgroundColor: '#0f0f0f',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#131313',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 250,
  },

  closeBtn: {
    alignSelf: 'flex-end',
  },

  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

});

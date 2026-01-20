import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import styles from './RadioPlayerStyle';
import { d_assets } from '../../configs/assets';

const upcomingPrograms = [
  { id: '1', title: 'Compte rendu...', favs: '115K+', image: d_assets.images.postImg1 },
  { id: '2', title: 'Compte rendu...', favs: '115K+', image: d_assets.images.postImg2 },
  { id: '3', title: 'Compte rendu...', favs: '1.8K', image: d_assets.images.postImg },
];

const pastPrograms = [
  { id: '4', title: 'Thème de la semaine...', image: d_assets.images.postImg },
  { id: '5', title: 'Paroles de l\'évangile', image: d_assets.images.postImg2 },
];

const RadioPlayerScreen = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const togglePlay = () => setIsPlaying(!isPlaying);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stationMeta}>96.5 Mghz</Text>
        <Text style={styles.stationTitle}>Alléluia FM</Text>
        <Text style={styles.favText}>115K+ Programmes</Text>
        <TouchableOpacity style={styles.castIcon}>
          <Icon name="cast" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Current Program */}
      <View style={styles.nowPlayingCard}>
        <Image source={d_assets.images.appLogo} style={styles.avatar} />
        <View style={styles.playingText}>
          <Text style={styles.songTitle}>Culte dominicale 25/09</Text>
          <Text style={styles.nowPlayingLabel}>En directe</Text>
        </View>
        <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Host Section */}
      <View style={styles.hostRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={d_assets.images.appLogo} style={styles.hostAvatar} />
          <View>
            <Text style={styles.hostName}>Paroisse Mère - Porto-Novo</Text>
            <Text style={styles.hostedBy}>...</Text>
          </View>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>Live</Text>
        </View>
        <Text style={styles.listeners}>1.1K</Text>
      </View>

      {/* Upcoming Programs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Programmes suivants</Text>
        <Text style={styles.sectionLink}>Voir Tout</Text>
      </View>
      <FlatList
        data={upcomingPrograms}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={item.image} style={styles.cardImage} />
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>{item.favs} Fav</Text>
          </View>
        )}
      />

      {/* Past Programs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Podcasts</Text>
        <Text style={styles.sectionLink}>Voir Tout</Text>
      </View>
      <View style={styles.grid}>
        {pastPrograms.map((item) => (
          <View key={item.id} style={styles.gridItem}>
            <Image source={item.image} style={styles.gridImage} />
            <Text style={styles.gridTitle}>{item.title}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export default RadioPlayerScreen;

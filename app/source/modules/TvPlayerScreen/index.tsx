import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  FlatList,
} from "react-native";
// import { Ionicons } from "@expo/vector-icons";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import styles from "./TvScreenStyles";
import { d_assets } from "../../configs/assets";
import { COLORS } from "../../../core/theme/colors";

const TvPlayerScreen = () => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState(t("tvPlayer.tabs.debates"));

  const tabs = [t("tvPlayer.tabs.debates"), t("tvPlayer.tabs.sermons"), t("tvPlayer.tabs.news"), t("tvPlayer.tabs.concerts")];

  const previousVideos = [
    { id: "1", title: t("tvPlayer.previousVideos.sundayService"), thumbnail: d_assets.images.postImg1 },
    { id: "2", title: t("tvPlayer.previousVideos.spiritualDebate"), thumbnail: d_assets.images.postImg2 },
  ];

  const events = [
    { id: "1", title: t("tvPlayer.events.prayerVigil"), date: "12 Août 2025 - 20h00" },
    { id: "2", title: t("tvPlayer.events.pastoralConference"), date: "14 Août 2025 - 15h00" },
  ];

  const togglePlayPause = () => setIsPlaying(!isPlaying);

  return (
    <SafeAreaView style={styles.container}>
      {/* TV Player */}
      <View style={styles.tvFrame}>
        <Image
          source={d_assets.images.postImg}
          style={styles.tvImage}
          resizeMode="cover"
        />
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>{t("tvPlayer.liveBadge")}</Text>
        </View>
      </View>

      {/* Info Text */}
      <View style={styles.infoSection}>
        <Text style={styles.title}>{t("tvPlayer.tvTitle")}</Text>
        <Text style={styles.subtitle}>
          {t("tvPlayer.tvSubtitle")}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity>
          <Ionicons name="play-back" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={togglePlayPause}>
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={50}
            color={COLORS.light.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity>
          <Ionicons name="play-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      

      <ScrollView style={{ width: "100%" }}>


      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabButton,
              activeTab === tab && styles.tabButtonActive,
            ]}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab && styles.tabButtonTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
        {/* Previous Videos */}
        <Text style={styles.sectionTitle}>{t("tvPlayer.previousVideosTitle")}</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={previousVideos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.videoCard}>
              <Image
                source={item.thumbnail}
                style={styles.videoThumbnail}
                resizeMode="cover"
              />
              <Text style={styles.videoTitle}>{item.title}</Text>
            </View>
          )}
        />

        {/* Upcoming Events */}
        <Text style={styles.sectionTitle}>{t("tvPlayer.upcomingEventsTitle")}</Text>
        {events.map((event) => (
          <View key={event.id} style={styles.eventItem}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDate}>{event.date}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TvPlayerScreen;

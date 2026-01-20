import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";

interface RouteParams {
  language: string;
  hymnNumber: number;
}

export default function CantiqueDetails({ route, navigation }: any) {
  const { language, hymnNumber }: RouteParams = route.params;
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    setPlaying(!playing);
    // Here you would integrate audio playback logic
  };

  return (
    <View style={styles.container}>
      <View style={styless.header1}>
        <Image source={d_assets.images.appLogo} style={styless.logo} />
        <Text style={styles.headerTitle}>Hymn {hymnNumber}</Text>
        <View style={styless.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
            <Icon name="notifications-outline" size={24} color="#444" style={styless.iconRight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.hymnCard}>
          <View style={styles.hymnHeader}>
            <Text style={styles.hymnTitle}>Hymn {hymnNumber}</Text>
            <TouchableOpacity onPress={handlePlay}>
              <Icon
                name={playing ? "pause-circle" : "play-circle"}
                size={40}
                color={COLORS.light.primary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.hymnContent}>
            Full text content for Hymn {hymnNumber} in {language}. This is a placeholder text.
            In a real implementation, this would contain the actual hymn lyrics and verses.
            The content would be much longer with multiple verses, choruses, and stanzas.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.light.primary,
  },
  hymnCard: {
    backgroundColor: "#fff",
    elevation: 0.4,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 20,
    borderRadius: 8,
  },
  hymnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  hymnTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  hymnContent: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
});

import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, TextInput, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";

interface Group {
  start: number;
  end: number;
}

const groups: Group[] = [];
for (let i = 0; i < 11; i++) {
  const start = i * 40 + 1;
  const end = i === 10 ? 430 : (i + 1) * 40;
  groups.push({ start, end });
}

export default function CantiqueFrancais({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleGroupPress = (group: Group) => {
    navigation.navigate("CantiqueDetails", { language: "francais", start: group.start, end: group.end });
  };

  const filteredGroups = groups.filter(group =>
    `${group.start}-${group.end}`.includes(searchQuery) ||
    group.start.toString().includes(searchQuery) ||
    group.end.toString().includes(searchQuery)
  );

  return (
    <View style={styles.container}>
      <View style={styless.header1}>
        <Image source={d_assets.images.appLogo} style={styless.logo} />
        <View style={styles.searchContainer}>
          <Icon name="search-outline" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search hymns..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styless.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
            <Icon name="notifications-outline" size={24} color="#444" style={styless.iconRight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.title}>Cantique en Français</Text>
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => `${item.start}-${item.end}`}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => handleGroupPress(item)}>
            <Text style={styles.cardText}>{item.start}-{item.end}</Text>
            <Icon name="chevron-forward-outline" size={24} color="#aaa" style={{ marginLeft: "auto" }} />
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    paddingHorizontal: 10,
    marginHorizontal: 10,
  },
  searchIcon: { marginRight: 5 },
  searchInput: { flex: 1, height: 40 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    paddingStart: 20,
    color: COLORS.light.primary,
    backgroundColor: COLORS.white,
    padding: 10,
    elevation: 1,
  },
  card: {
    backgroundColor: "#fff",
    elevation: 0.4,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 20,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  cardText: {
    fontSize: 16,
    color: "#333",
  },
});

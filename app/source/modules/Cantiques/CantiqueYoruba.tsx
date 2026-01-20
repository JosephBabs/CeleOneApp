import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, ScrollView } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";

interface Group {
  start: number;
  end: number;
  hymns: number[];
  expanded: boolean;
}

const groups: Group[] = [];
for (let i = 0; i < 11; i++) {
  const start = i * 40 + 1;
  const end = i === 10 ? 430 : (i + 1) * 40;
  const hymns = [];
  for (let j = start; j <= end; j++) {
    hymns.push(j);
  }
  groups.push({ start, end, hymns, expanded: false });
}

export default function CantiqueYoruba({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupStates, setGroupStates] = useState(groups.map(() => false));

  const toggleGroup = (index: number) => {
    const newStates = [...groupStates];
    newStates[index] = !newStates[index];
    setGroupStates(newStates);
  };

  const handleHymnPress = (hymnNumber: number) => {
    navigation.navigate("CantiqueDetails", { language: "yoruba", hymnNumber });
  };

  const filteredGroups = groups.filter(group =>
    `${group.start}-${group.end}`.includes(searchQuery) ||
    group.start.toString().includes(searchQuery) ||
    group.end.toString().includes(searchQuery) ||
    group.hymns.some(h => h.toString().includes(searchQuery))
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
      <Text style={styles.title}>Cantique en Yoruba</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {filteredGroups.map((group, index) => (
          <View key={index} style={styles.groupContainer}>
            <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(index)}>
              <Text style={styles.groupText}>{group.start}-{group.end}</Text>
              <Icon name={groupStates[index] ? "chevron-up" : "chevron-down"} size={24} color="#333" />
            </TouchableOpacity>
            {groupStates[index] && (
              <FlatList
                data={group.hymns}
                keyExtractor={(item) => item.toString()}
                numColumns={8}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.hymnButton} onPress={() => handleHymnPress(item)}>
                    <Text style={styles.hymnText}>{item}</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.gridContainer}
              />
            )}
          </View>
        ))}
      </ScrollView>
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
  groupContainer: {
    marginVertical: 8,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  groupText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  gridContainer: {
    padding: 10,
  },
  hymnButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.light.primary,
    margin: 2,
    borderRadius: 4,
  },
  hymnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

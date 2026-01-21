import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, SectionList, TouchableOpacity, Image, TextInput } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../auth/firebaseConfig";

interface Group {
  start: number;
  end: number;
  hymns: any[];
}

export default function CantiqueGoun({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [cantiques, setCantiques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupStates, setGroupStates] = useState<boolean[]>([]);

  useEffect(() => {
    fetchCantiques();
  }, []);

  const fetchCantiques = async () => {
    try {
      const q = query(collection(db, "cantiques"), where("language", "==", "goun"));
      const querySnapshot = await getDocs(q);
      const cantiquesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCantiques(cantiquesData);
      setGroupStates(new Array(Math.ceil(cantiquesData.length / 42)).fill(false));
    } catch (error) {
      console.error("Error fetching cantiques:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleHymnPress = (cantique: any) => {
    navigation.navigate("CantiqueDetails", { cantique });
  };

  const filteredCantiques = cantiques.filter(cantique =>
    cantique.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cantique.hymnNumber?.toString().includes(searchQuery) ||
    cantique.musicalKey?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groups: Group[] = useMemo(() => {
    const groupsArray: Group[] = [];
    for (let i = 0; i < Math.ceil(filteredCantiques.length / 42); i++) {
      const start = i * 42 + 1;
      const end = Math.min((i + 1) * 42, filteredCantiques.length);
      const hymns = filteredCantiques.slice(i * 42, end);
      groupsArray.push({ start, end, hymns });
    }
    return groupsArray;
  }, [filteredCantiques]);

  const toggleGroup = (index: number) => {
    const newStates = [...groupStates];
    newStates[index] = !newStates[index];
    setGroupStates(newStates);
  };

  const sections = useMemo(() => {
    return groups.map((group, index) => ({
      title: `${group.start}-${group.end}`,
      data: groupStates[index] ? group.hymns : [],
      groupIndex: index,
      group,
    }));
  }, [groups, groupStates]);

  const renderCantiqueCard = ({ item }: any) => (
    <TouchableOpacity style={styles.cantiqueCard} onPress={() => handleHymnPress(item)}>
      <View style={styles.cantiqueHeader}>
        <Text style={styles.cantiqueTitle}>{item.title}</Text>
        <Text style={styles.cantiqueNumber}>#{item.hymnNumber}</Text>
      </View>
      <Text style={styles.cantiqueKey}>Key: {item.musicalKey || "Not specified"}</Text>
    </TouchableOpacity>
  );

  const renderHymnButton = (hymn: any, index: number) => (
    <TouchableOpacity key={index} style={styles.hymnButton} onPress={() => handleHymnPress(hymn)}>
      <Text style={styles.hymnText}>{hymn.hymnNumber}</Text>
    </TouchableOpacity>
  );

  if (loading) {
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
        <Text style={styles.title}>Cantique en Goun</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading hymns...</Text>
        </View>
      </View>
    );
  }

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
          <TouchableOpacity onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            <Icon name={viewMode === 'grid' ? "list-outline" : "grid-outline"} size={24} color="#444" style={styless.iconRight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
            <Icon name="notifications-outline" size={24} color="#444" style={styless.iconRight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.title}>Cantique en Goun</Text>

      {viewMode === 'list' ? (
        <FlatList
          data={filteredCantiques}
          keyExtractor={(item) => item.id}
          renderItem={renderCantiqueCard}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hymns found</Text>
            </View>
          }
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item}-${index}`}
          renderSectionHeader={({ section }) => (
            <View style={styles.groupContainer}>
              <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(section.groupIndex)}>
                <Text style={styles.groupText}>{section.title}</Text>
                <Icon name={groupStates[section.groupIndex] ? "chevron-up" : "chevron-down"} size={24} color="#333" />
              </TouchableOpacity>
              {section.data.length > 0 && (
                <View style={styles.gridContainer}>
                  {section.data.map((hymn, index) => renderHymnButton(hymn, index))}
                </View>
              )}
            </View>
          )}
          renderItem={() => null}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }}
        />
      )}
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
    // marginHorizontal: 20,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-around',
  },
  hymnButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderColor: COLORS.light.primary,
    borderWidth: 1,
    margin: 2,
    borderRadius: 4,
  },
  hymnText: {
    color: "#333131ff",
    fontSize: 14,
    fontWeight: "bold",
  },
  cantiqueCard: {
    padding: 16,
    marginVertical: 8,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cantiqueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cantiqueTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  cantiqueNumber: {
    fontSize: 16,
    color: COLORS.light.primary,
    fontWeight: "600",
  },
  cantiqueKey: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
});

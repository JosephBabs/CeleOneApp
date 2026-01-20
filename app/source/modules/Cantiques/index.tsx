import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable,Image, TouchableOpacity } from "react-native";
// import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../core/theme/colors";
import Icon from "react-native-vector-icons/Ionicons";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";
import { t } from "i18next";

const cantiqueKeys = [
  { key: "cantique_goun", label: t("cantiques.en_gou"), screen: "CantiqueGoun" },
  { key: "cantique_yoruba", label: t("cantiques.en_yo"), screen: "CantiqueYoruba" },
  { key: "cantique_anglais", label: t("cantiques.en_fr"), screen: "CantiqueAnglais" },
  { key: "cantique_francais", label: t("cantiques.en_fr"), screen: "CantiqueFrancais" },
];

export default function Cantiques({ navigation }: any) {
  const { t } = useTranslation();

  const handleOpenCantique = (screen: string) => {
    navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      <View style={styless.header1}>
        <Image
          source={d_assets.images.appLogo}
          style={styless.logo}
        />
        {/* <Text style={styles.titleSimple2}>{t("home.explore")}</Text> */}

        <View style={styless.headerIcons}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
          >
            <Icon
              name="notifications-outline"
              size={24}
              color="#444"
              style={styless.iconRight}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.title}>{t("cantiques.title")}</Text>

      <FlatList
        data={cantiqueKeys}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => handleOpenCantique(item.screen)}
          >
            <View style={styles.iconContainer}>
              <Icon name="musical-notes-outline" size={24} color={COLORS.light.primary} />
            </View>

            <Text style={styles.cardText}>{item.label}</Text>
            <Icon
              name="chevron-forward-outline"
              size={24}
              color="#aaa"
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    // marginVertical: 16,
    paddingStart: 20,
    color: COLORS.light.primary,
    backgroundColor: COLORS.white,
    padding: 10,
    elevation:1,
  },
  card: {
    backgroundColor: "#fff",
    elevation: 0.4,
    padding: 16,
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardText: {
    marginLeft: 12,
    fontSize: 16,
    color: "#333",
  },
});

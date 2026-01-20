import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Image, TouchableOpacity } from "react-native";
// import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Icon from "react-native-vector-icons/Ionicons";
import { COLORS } from "../../../core/theme/colors";
import styless from "../../../../styles";
import { d_assets } from "../../configs/assets";

// document keys
const documentKeys = [
  "doc_10_commandments",
  "doc_church_history",
  "doc_osh_offa",
  "doc_constitution",
  "doc_light_on_ecc",
  "doc_11_ordnances",
  "doc_4_sacraments",
  "doc_12_forbidden",
  "doc_institutions",
];

// Mapping from docKey to screen name
const docKeyToScreen = {
  "doc_10_commandments": "TenCommandments",
  "doc_church_history": "ChurchHistory",
  "doc_osh_offa": "OshOffa",
  "doc_constitution": "Constitution",
  "doc_light_on_ecc": "LightOnEcc",
  "doc_11_ordnances": "ElevenOrdinances",
  "doc_4_sacraments": "FourSacraments",
  "doc_12_forbidden": "TwelveForbidden",
  "doc_institutions": "Institutions",
};

export default function Screen({ navigation }: any) {
  const { t } = useTranslation();
  const handleOpenDocument = (key: string) => {
    const screenName = docKeyToScreen[key as keyof typeof docKeyToScreen];
    if (screenName) {
      navigation.navigate(screenName);
    }
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
      <Text style={styles.title}>{t("documents.title")}</Text>

      <FlatList
        data={documentKeys}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => handleOpenDocument(item)}
          >
            {/* <MaterialIcons name="description" size={24} color="#008080" /> */}
            <View style={styles.iconContainer}>
              <Icon
                name="document"
                size={24}
                color={COLORS.light.primary}
              />
            </View>

            <Text style={styles.cardText}>{t(item)}</Text>
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
    // textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    elevation: 0.4,
    padding: 16,
    marginVertical: 8,
    // borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 5,
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

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

// Screens
import SplashScreen from "../modules/splashscreen/SplashScreen";
import OnboardingScreen from "../modules/OnboardingScreen/OnboardingScreen";
import LoginScreen from "../modules/auth/login";
import SignupScreen from "../modules/auth/register";
import PostDetails from "../modules/PostDetail";
import BottomTabNavigator from "./bottom_navigation";
import Notifications from "../modules/Notifications";
import Settings from "../modules/settings";
import HomeScreen from "../modules/homescreen";
import Profile from "../modules/Profile";
import ChatRoom from "../modules/ChatRoom";
import GroupInfo from "../modules/GroupInfo";
import RadioPlayerScreen from "../modules/RadioPlayerScreen";
import TvPlayerScreen from "../modules/TvPlayerScreen";
import AdminDashboard from "../modules/Admin/AdminDashboard";
import AdminPosts from "../modules/Admin/AdminPosts";
import AdminUsers from "../modules/Admin/AdminUsers";
import AdminChatrooms from "../modules/Admin/AdminChatrooms";
import AdminPendingRequests from "../modules/Admin/AdminPendingRequests";
import AdminProfiles from "../modules/Admin/AdminProfiles";
import TenCommandments from "../modules/Documents/TenCommandments";
import ChurchHistory from "../modules/Documents/ChurchHistory";
import OshOffa from "../modules/Documents/OshOffa";
import Constitution from "../modules/Documents/Constitution";
import LightOnEcc from "../modules/Documents/LightOnEcc";
import ElevenOrdinances from "../modules/Documents/ElevenOrdinances";
import FourSacraments from "../modules/Documents/FourSacraments";
import TwelveForbidden from "../modules/Documents/TwelveForbidden";
import Institutions from "../modules/Documents/Institutions";
import CantiqueGoun from "../modules/Cantiques/CantiqueGoun";
import CantiqueYoruba from "../modules/Cantiques/CantiqueYoruba";
import CantiqueAnglais from "../modules/Cantiques/CantiqueAnglais";
import CantiqueFrancais from "../modules/Cantiques/CantiqueFrancais";
import CantiqueDetails from "../modules/Cantiques/CantiqueDetails";

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  HomeScreen: undefined;
  Profile: undefined;
  MainNav: undefined;
  PostDetail: undefined;
  Notifications: undefined;
  Settings: undefined;
  ChatRoom: undefined;
  GroupInfo: undefined;
  RadioPlayerScreen: undefined;
  TvPlayerScreen: undefined;
  AdminDashboard: undefined;
  AdminPosts: undefined;
  AdminUsers: undefined;
  AdminChatrooms: undefined;
  AdminPendingRequests: undefined;
  AdminProfiles: undefined;
  TenCommandments: undefined;
  ChurchHistory: undefined;
  OshOffa: undefined;
  Constitution: undefined;
  LightOnEcc: undefined;
  ElevenOrdinances: undefined;
  FourSacraments: undefined;
  TwelveForbidden: undefined;
  Institutions: undefined;
  CantiqueGoun: undefined;
  CantiqueYoruba: undefined;
  CantiqueAnglais: undefined;
  CantiqueFrancais: undefined;
  CantiqueDetails: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/* ---------------- LANGUAGE MODAL ---------------- */

const LanguageSelectModal = ({
  visible,
  onSelectLanguage,
}: {
  visible: boolean;
  onSelectLanguage: (lng: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContent}>
          <Text style={styles.title}>{t("settings.selectLanguage")}</Text>

          {["en", "fr", "yo", "gou", "es"].map(lng => (
            <Pressable
              key={lng}
              style={styles.languageItem}
              onPress={() => onSelectLanguage(lng)}
            >
              <Text style={styles.languageText}>
                {t(`lang.${lng}`)}
              </Text>
            </Pressable>
          ))}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

/* ---------------- APP NAVIGATOR ---------------- */

export default function AppNavigator() {
  const { i18n } = useTranslation();

  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [languageSet, setLanguageSet] = useState<boolean | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => {
    const init = async () => {
      const launched = await AsyncStorage.getItem("hasLaunched");
      const lang = await AsyncStorage.getItem("user-language");

      if (!launched) {
        setIsFirstLaunch(true);
        await AsyncStorage.setItem("hasLaunched", "true");
      } else {
        setIsFirstLaunch(false);
      }

      if (!lang) {
        setLanguageSet(false);
        setLanguageModalVisible(true);
      } else {
        await i18n.changeLanguage(lang);
        setLanguageSet(true);
      }
    };

    init();
  }, [i18n]);

  const handleSelectLanguage = async (lng: string) => {
    await AsyncStorage.setItem("user-language", lng);
    await i18n.changeLanguage(lng);
    setLanguageModalVisible(false);
    setLanguageSet(true);
  };

  if (isFirstLaunch === null || languageSet === null) {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <LanguageSelectModal
        visible={languageModalVisible}
        onSelectLanguage={handleSelectLanguage}
      />

      {!languageModalVisible && (
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Splash" component={SplashScreenWrapper} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="MainNav" component={BottomTabNavigator} />
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen name="HomeScreen" component={HomeScreen} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="PostDetail" component={PostDetails} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="ChatRoom" component={ChatRoom} />
            <Stack.Screen name="GroupInfo" component={GroupInfo} />
            <Stack.Screen name="RadioPlayerScreen" component={RadioPlayerScreen} />
            <Stack.Screen name="TvPlayerScreen" component={TvPlayerScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="AdminPosts" component={AdminPosts} />
            <Stack.Screen name="AdminUsers" component={AdminUsers} />
            <Stack.Screen name="AdminChatrooms" component={AdminChatrooms} />
            <Stack.Screen name="AdminPendingRequests" component={AdminPendingRequests} />
            <Stack.Screen name="TenCommandments" component={TenCommandments} />
            <Stack.Screen name="ChurchHistory" component={ChurchHistory} />
            <Stack.Screen name="OshOffa" component={OshOffa} />
            <Stack.Screen name="Constitution" component={Constitution} />
            <Stack.Screen name="LightOnEcc" component={LightOnEcc} />
            <Stack.Screen name="ElevenOrdinances" component={ElevenOrdinances} />
            <Stack.Screen name="FourSacraments" component={FourSacraments} />
            <Stack.Screen name="TwelveForbidden" component={TwelveForbidden} />
            <Stack.Screen name="Institutions" component={Institutions} />
            <Stack.Screen name="CantiqueGoun" component={CantiqueGoun} />
            <Stack.Screen name="CantiqueYoruba" component={CantiqueYoruba} />
            <Stack.Screen name="CantiqueAnglais" component={CantiqueAnglais} />
            <Stack.Screen name="CantiqueFrancais" component={CantiqueFrancais} />
            <Stack.Screen name="CantiqueDetails" component={CantiqueDetails} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaView>
  );
}

/* ---------------- SPLASH WRAPPER ---------------- */

const SplashScreenWrapper = ({ navigation }: any) => {
  useEffect(() => {
    const timer = setTimeout(async () => {
      const launched = await AsyncStorage.getItem("hasLaunched");
      const lang = await AsyncStorage.getItem("user-language");

      if (!lang) return;

      navigation.replace(launched ? "Login" : "Onboarding");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SplashScreen
      onLogin={() => navigation.navigate("Login")}
      onSignUp={() => navigation.navigate("Signup")}
      onGuest={() => navigation.replace("MainNav")}
    />
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  languageItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  languageText: {
    fontSize: 18,
    textAlign: "center",
  },
});

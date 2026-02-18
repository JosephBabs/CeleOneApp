import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ViewStyle,
  TextStyle, 
} from "react-native";

import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";

import HomeScreen from "../modules/homescreen";
import Jeunesse from "../modules/Jeunesse";
import Documents from "../modules/Documents";
import Messages from "../modules/Messages"; 
import Cantiques from "../modules/Cantiques";
import { COLORS, Colors } from "../../core/theme/colors";
import { useAppTheme } from "../../core/theme/ThemeContext";

import LinearGradient from 'react-native-linear-gradient';
import auth, { onAuthStateChanged } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import navigation from "./navigation";


// const uid = auth().currentUser?.uid;

// const userDoc = await firestore()
//   .collection("users")
//   .doc(uid!)
//   .get();

// const userProfile = userDoc.data();
// console.log("User Profile:", userProfile);



type TabRouteName =
  | "Home"
  | "Jeunesse"
  | "Documents"
  | "Messages"
  | "Cantiques";


  const Tab = createBottomTabNavigator();



const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { t } = useTranslation();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


 

  if (isKeyboardVisible) {
    return null; // Hide tab bar when keyboard is open
  }

  return (
    <View style={[styles.tabContainer]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        // Use t() to get translated label based on route.name
        const label = t(`bottomTabs.${route.name}`);
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const icons: Record<TabRouteName, string> = {
          Home: "home-outline",
          Jeunesse: "leaf-outline",
          Documents: "document-text-outline",
          Messages: "chatbubbles-outline",
          Cantiques: "musical-notes-outline",
        };

        const iconName = icons[route.name as TabRouteName];
        const isActive = isFocused;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[styles.tabButton, isActive && styles.middleButtonWrapper]}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.iconContainer,
                isActive ? styles.middleButton : undefined,
              ]}
            >
              <Icon
                name={iconName}
                size={isActive ? 30 : 24}
                color={isActive ? COLORS.light.background : "#888"}
              />
              {!isActive && (
                <Text style={[styles.label, isFocused && styles.activeLabel]}>
                  {label}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "static", bottom: 0 },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Documents" component={Documents} />
      <Tab.Screen name="Messages" component={Messages} />
      <Tab.Screen name="Cantiques" component={Cantiques} />
      <Tab.Screen name="Jeunesse" component={Jeunesse} />
    </Tab.Navigator>
  );
}



const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
    // marginBottom: 10,
    elevation: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 10,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 10,
    marginBottom: -20,
  } as ViewStyle,
  tabButton: {
    flex: 1,
    alignItems: "center",
  } as ViewStyle,
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  label: {
    fontSize: 12,
    marginTop: 2,
    color: "#888",
  } as TextStyle,
  activeLabel: {
    color: COLORS.light.primary,
    fontWeight: "600",
  } as TextStyle,
  middleButtonWrapper: {
    top: -32,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  } as ViewStyle,
  middleButton: {
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: COLORS.light.primary,
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,
});

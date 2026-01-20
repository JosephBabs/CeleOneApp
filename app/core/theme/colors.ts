import { Platform } from 'react-native';

const IOS_SYSTEM_COLORS = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(0, 0, 0)',
  light: {
    grey6: 'rgb(242, 242, 247)',
    grey5: 'rgb(230, 230, 235)',
    grey4: 'rgb(210, 210, 215)',
    grey3: 'rgb(199, 199, 204)',
    grey2: 'rgb(175, 176, 180)',
    grey: 'rgb(142, 142, 147)',
    background: 'rgb(242, 242, 247)',
    foreground: 'rgb(0, 0, 0)',
    root: 'rgb(255, 255, 255)',
    card: 'rgb(255, 255, 255)',
    destructive: 'rgb(255, 56, 43)',
    primary: '#2FA5A9',
  },
  dark: {
    grey6: 'rgb(21, 21, 24)',
    grey5: 'rgb(40, 40, 42)',
    grey4: 'rgb(55, 55, 57)',
    grey3: 'rgb(70, 70, 73)',
    grey2: 'rgb(99, 99, 102)',
    grey: 'rgb(142, 142, 147)',
    background: 'rgb(0, 0, 0)',
    foreground: 'rgb(255, 255, 255)',
    root: 'rgb(0, 0, 0)',
    card: 'rgb(21, 21, 24)',
    destructive: 'rgb(254, 67, 54)',
    primary: 'rgb(3, 133, 255)',
  },
} as const;

const ANDROID_COLORS = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(0, 0, 0)',
  light: {
    grey6: 'rgb(249, 249, 255)',
    grey5: 'rgb(215, 217, 228)',
    grey4: 'rgb(193, 198, 215)',
    grey3: 'rgb(113, 119, 134)',
    grey2: 'rgb(65, 71, 84)',
    grey: 'rgb(24, 28, 35)',
    background: 'rgb(249, 249, 255)',
    foreground: 'rgb(0, 0, 0)',
    root: 'rgb(255, 255, 255)',
    card: 'rgb(255, 255, 255)',
    destructive: 'rgb(186, 26, 26)',
    primary: '#2FA5A9',
  },
  dark: {
    grey6: 'rgb(16, 19, 27)',
    grey5: 'rgb(39, 42, 50)',
    grey4: 'rgb(49, 53, 61)',
    grey3: 'rgb(54, 57, 66)',
    grey2: 'rgb(139, 144, 160)',
    grey: 'rgb(193, 198, 215)',
    background: 'rgb(0, 0, 0)',
    foreground: 'rgb(255, 255, 255)',
    root: 'rgb(0, 0, 0)',
    card: 'rgb(16, 19, 27)',
    destructive: 'rgb(147, 0, 10)',
    primary: '#2FA5A9',
  },
} as const;

const BASE_COLORS = Platform.OS === 'ios' ? IOS_SYSTEM_COLORS : ANDROID_COLORS;
const CURRENT_THEME = 'light'; // Replace with dynamic dark/light logic if you have one
const COLORS = Platform.OS === 'ios' ? IOS_SYSTEM_COLORS : ANDROID_COLORS;

export { COLORS };
// Combine with previously referenced manual color tokens



export const Colors = {
  // Primary Branding
  primaryLight: "#63c7ca",
  primaryDark: "#1f7b7e",

  // Backgrounds
  lightBackground: "#FFFFFF",
  darkBackground: "#000000",
  lightSurface: "#F5F5F5",
  darkSurface: "#1C1C1E",

  // Text
  textLight: "#000000",
  textDark: "#FFFFFF",
  textMutedLight: "#555555",
  textMutedDark: "#AAAAAA",

  ...BASE_COLORS,
  ...BASE_COLORS[CURRENT_THEME],

  // Custom App-specific Keys
  darkButton: "#000000",
  danger: BASE_COLORS[CURRENT_THEME].destructive,

  // Optionally derived
  borderColor: BASE_COLORS[CURRENT_THEME].grey4,
  cardColor: BASE_COLORS[CURRENT_THEME].card,
  // Buttons
  lightButton: "#E0F7FA",
  buttonTextLight: "#FFFFFF",
  buttonTextDark: "#000000",

  // Inputs
  inputLight: "#F0F0F0",
  inputDark: "#2C2C2E",
  inputBorderLight: "#CCCCCC",
  inputBorderDark: "#444444",

  // Borders
  borderLight: "#E0E0E0",
  borderDark: "#303030",

  // Status
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
  info: "#2196F3",

  // Disabled
  disabledBackground: "#E0E0E0",
  disabledText: "#9E9E9E",

  // Tabs and Navigators
  tabBarActive: "#2FA5A9",
  tabBarInactive: "#A0A0A0",

  // Overlays & Modals
  overlay: "rgba(0, 0, 0, 0.5)",
};

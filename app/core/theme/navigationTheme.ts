// app/core/theme/navigationTheme.ts
import { DefaultTheme, DarkTheme } from "@react-navigation/native";

export const NAV_THEME = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: "#5A31F4",
      background: "#FFFFFF",
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: "#9B7BFF",
      background: "#000000",
    },
  },
};

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Colors } from "../../../../core/theme/colors";
import { useAppTheme } from "../../../../core/theme/ThemeContext";
import { d_assets } from "../../../configs/assets";
import Icon from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { auth } from "../firebaseConfig";

// For Google Sign-In
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { initFCM } from "../../../../../src/services/notifications";

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: "275960060318-t160nsbie7s4oinm9ok7efpp050iifq1.apps.googleusercontent.com", // From Firebase console
});

const LoginScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { mode } = useAppTheme();
  const isDark = mode === "dark";

  const textColor = isDark ? Colors.textDark : Colors.textLight;
  const inputBg = isDark ? Colors.inputDark : Colors.inputLight;

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ Email/password login
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("error.error"), t("error.fillAllFields") || "Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password.trim()
      );
      console.log("Logged in:", userCredential.user.uid);
      // 🔥 Register FCM token
    await initFCM(userCredential.user.uid)
      navigation.replace("MainNav");
    } catch (error: any) {
      console.error(error);
      let message = t("eroor.loginFailed") || "Login failed";

      switch (error.code) {
        case "auth/user-not-found":
          message = t("error.userNotFound") || "No user found with this email";
          break;
        case "auth/wrong-password":
          message = t("error.wrongPassword") || "Incorrect password";
          break;
        case "auth/invalid-email":
          message = t("error.invalidEmail") || "Invalid email address";
          break;
        case "auth/too-many-requests":
          message = t("error.tooManyRequests") || "Too many login attempts. Try again later.";
          break;
      }

      Alert.alert(t("error.error"), message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Password reset
  const handlePasswordReset = async () => {
    if (!email) {
      Alert.alert(t("error.error"), t("error.enterEmailReset") || "Enter your email to reset password");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      Alert.alert(
        t("success"),
        t("error.resetEmailSent") || "Password reset email sent! Check your inbox."
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert(t("error.error"), t("resetFailed") || "Failed to send reset email.");
    }
  };

  // ✅ Google login
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      // Prompt user to sign in with Google
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);

      console.log("Google logged in:", userCredential.user.uid);
        // 🔥 Register FCM token
    await initFCM(userCredential.user.uid); // <- call this AFTER login

      navigation.replace("MainNav");
    } catch (error: any) {
      console.error(error);
      Alert.alert(t("error.error"), t("error.googleLoginFailed") || "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#E0F7FA", "#FDFEFF"]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.innerContainer}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={d_assets.images.appLogo}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Form */}
          <View style={styles.inputDrawer}>
            <Text style={[styles.title, { color: textColor }]}>{t("login")}</Text>

            {/* Email */}
            <Text style={[styles.label, { color: textColor }]}>{t("email")}</Text>
            <View style={[styles.passwordContainer, { backgroundColor: inputBg }]}>
              <Icon name="mail-outline" size={20} color={textColor} />
              <TextInput
                placeholder={t("emailPlaceholder")}
                placeholderTextColor="#aaa"
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.passwordInput, { color: textColor }]}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password */}
            <Text style={[styles.label, { color: textColor }]}>{t("password")}</Text>
            <View style={[styles.passwordContainer, { backgroundColor: inputBg }]}>
              <Icon name="lock-closed-outline" size={20} color={textColor} />
              <TextInput
                placeholder={t("passwordPlaceholder")}
                placeholderTextColor="#aaa"
                secureTextEntry={!showPassword}
                style={[styles.passwordInput, { color: textColor }]}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? "eye-off" : "eye"} size={20} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              style={[styles.button, { backgroundColor: Colors.primary }]}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? t("loading") || "Loading..." : t("login")}
              </Text>
            </TouchableOpacity>

            {/* Password Reset */}
            <TouchableOpacity onPress={handlePasswordReset}>
              <Text style={[styles.link, { color: Colors.primary }]}>
                {t("forgotPassword") || "Forgot Password?"}
              </Text>
            </TouchableOpacity>

            {/* Google Login */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              style={[styles.button, { backgroundColor: "#DB4437" }]}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {t("loginWithGoogle") || "Login with Google"}
              </Text>
            </TouchableOpacity>

            {/* Sign up link */}
            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text style={[styles.link, { color: Colors.primary }]}>
                {t("noAccountSignUp") || "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { flex: 1, justifyContent: "flex-end" },
  logoContainer: { alignItems: "center", marginBottom: 50, padding: 20 },
  logo: { height: 140 },
  inputDrawer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  label: { fontSize: 14, marginBottom: 4, marginTop: 10 },
  passwordContainer: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, marginBottom: 16 },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  button: { padding: 16, borderRadius: 12, alignItems: "center", marginVertical: 12 },
  buttonText: { color: "#fff", fontSize: 16 },
  link: { textAlign: "center", marginTop: 10 },
});

export default LoginScreen;

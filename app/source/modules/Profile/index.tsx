// UpdateProfileScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";

import { auth, db } from "../auth/firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { updateEmail } from "firebase/auth";

import { useAppTheme } from "../../../core/theme/ThemeContext";
import { COLORS, Colors } from "../../../core/theme/colors";
import { d_assets } from "../../configs/assets";

import * as ImagePicker from "react-native-image-picker";

/**
 * ✅ Avatar upload:
 * - Pick image from gallery/camera
 * - Upload to your CDN API (no token) -> returns { url }
 * - Save url as photoURL in Firestore: user_data/{uid}
 *
 * IMPORTANT: set your upload endpoint below.
 */
const CDN_UPLOAD_ENDPOINT = "https://cdn.celeonetv.com/api/uploads/posts"; // change if your endpoint is /api/uploads/avatars

const UpdateProfileScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { mode } = useAppTheme();
  const isDark = mode === "dark";

  const textColor = isDark ? Colors.textDark : Colors.textLight;
  const inputBg = isDark ? Colors.inputDark : Colors.inputLight;
  const cardBg = isDark ? "rgba(243, 243, 243, 0.91)" : "#FFFFFF";
  const pageBg = isDark ? "#dadada" : "#F4F5F7";
  const muted = isDark ? "rgba(255,255,255,0.70)" : "#6B6B70";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    parish: "",
    phone: "",
    email: "",
    photoURL: "", // ✅ avatar url in firestore
  });

  const uid = auth.currentUser?.uid;

  const initials = useMemo(() => {
    const a = (form.firstName || "").trim().slice(0, 1).toUpperCase();
    const b = (form.lastName || "").trim().slice(0, 1).toUpperCase();
    return (a + b).trim() || "U";
  }, [form.firstName, form.lastName]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!uid) return;

        const userRef = doc(db, "user_data", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data: any = userSnap.data();
          setForm((prev) => ({
            ...prev,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            parish: data.parish || "",
            phone: data.phone || "",
            email: data.email || auth.currentUser?.email || "",
            photoURL: data.photoURL || data.avatarUrl || data.profilePicture || "",
          }));
        } else {
          // fallback
          setForm((prev) => ({
            ...prev,
            email: auth.currentUser?.email || "",
          }));
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [uid]);

  const handleInputChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const pickImage = async () => {
    Alert.alert(
      "Update Avatar",
      "Choose a source",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Camera",
          onPress: async () => {
            const res = await ImagePicker.launchCamera({
              mediaType: "photo",
              quality: 0.85,
              cameraType: "front",
              includeBase64: false,
              saveToPhotos: true,
            });
            await handlePickedAsset(res);
          },
        },
        {
          text: "Gallery",
          onPress: async () => {
            const res = await ImagePicker.launchImageLibrary({
              mediaType: "photo",
              quality: 0.85,
              selectionLimit: 1,
              includeBase64: false,
            });
            await handlePickedAsset(res);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handlePickedAsset = async (res: ImagePicker.ImagePickerResponse) => {
    try {
      if (res.didCancel) return;
      if (res.errorCode) {
        Alert.alert("Error", res.errorMessage || "Image picker error");
        return;
      }

      const asset = res.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Error", "No image selected");
        return;
      }

      await uploadAvatarToCDN(asset.uri, asset.type || "image/jpeg", asset.fileName || "avatar.jpg");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Failed to pick image");
    }
  };

  const uploadAvatarToCDN = async (uri: string, type: string, name: string) => {
    if (!uid) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", {
        uri,
        type,
        name,
      } as any);

      // ✅ No token (as requested)
      const r = await fetch(CDN_UPLOAD_ENDPOINT, {
        method: "POST",
        body: fd,
      });

      if (!r.ok) {
        const text = await r.text();
        console.log("Upload error response:", text);
        throw new Error(`Upload failed (${r.status})`);
      }

      const data = await r.json(); // expected { url: "https://cdn.../filename.jpg" }
      const url = data?.url;

      if (!url) throw new Error("CDN did not return a url");

      // Save in state immediately (nice UX)
      setForm((p) => ({ ...p, photoURL: url }));

      // Save to Firestore
      await updateDoc(doc(db, "user_data", uid), {
        photoURL: url,
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Avatar updated");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      Alert.alert(t("error.error"), t("error.fillAllFields") || "Please fill all fields");
      return;
    }

    setSaving(true);
    try {
      if (!uid || !auth.currentUser) return;

      const userRef = doc(db, "user_data", uid);

      // Update Firestore
      await updateDoc(userRef, {
        firstName: form.firstName,
        lastName: form.lastName,
        parish: form.parish,
        phone: form.phone,
        email: form.email,
        photoURL: form.photoURL || "",
        updatedAt: serverTimestamp(),
      });

      // Update email in Auth if changed
      if (form.email !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, form.email);
      }

      Alert.alert(t("success"), t("error.profileUpdated") || "Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      let message = t("error.updateFailed") || "Failed to update profile";
      if (error.code === "auth/requires-recent-login") {
        message = t("reauthRequired") || "Please log out and log back in before changing email";
      }
      Alert.alert(t("error.error"), message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: pageBg }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: pageBg }]}>
      <LinearGradient
        colors={isDark ? ["#e0e0e0", "#cacaca"] : [COLORS.light.primary, COLORS.light.primary]}
        style={styles.hero}
      >
        <SafeAreaView>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              {/* If you pass navigation prop, replace above with navigation.goBack() */}
              <Ionicons name="chevron-back" size={22} color="#0e0e0e" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{t("settings.updateProfile")}</Text>
              {/* <Text style={styles.heroSub}>{t("save") || "Update your personal info & avatar"}</Text> */}
            </View>

            <Image source={d_assets.images.appLogo} style={styles.logo} />
          </View>

          {/* Avatar Card */}
          <View style={[styles.avatarCard, { backgroundColor: "rgba(255, 255, 255, 0.95)" }]}>
            <View style={styles.avatarWrap}>
              {form.photoURL ? (
                <Image source={{ uri: form.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.initials}>{initials}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={pickImage}
                activeOpacity={0.9}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#111" />
                ) : (
                  <Ionicons name="camera" size={16} color="#111" />
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {form.firstName || "—"} {form.lastName || ""}
              </Text>
              <Text style={styles.avatarEmail} numberOfLines={1}>
                {form.email || "—"}
              </Text>
              <Text style={styles.avatarHint}>
                Tap the camera to upload a new profile picture
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Personal Information</Text>

            <Field
              label={t("firstname") || "First name"}
              value={form.firstName}
              onChangeText={(v) => handleInputChange("firstName", v)}
              placeholder={t("firstname") || "First name"}
              inputBg={inputBg}
              textColor={textColor}
              muted={muted}
              icon="person-outline"
            />

            <Field
              label={t("lastname") || "Last name"}
              value={form.lastName}
              onChangeText={(v) => handleInputChange("lastName", v)}
              placeholder={t("lastname") || "Last name"}
              inputBg={inputBg}
              textColor={textColor}
              muted={muted}
              icon="person-outline"
            />

            <Field
              label={t("parishName") || "Parish"}
              value={form.parish}
              onChangeText={(v) => handleInputChange("parish", v)}
              placeholder={t("parishName") || "Parish"}
              inputBg={inputBg}
              textColor={textColor}
              muted={muted}
              icon="location-outline"
            />

            <Field
              label={t("phone") || "Phone"}
              value={form.phone}
              onChangeText={(v) => handleInputChange("phone", v)}
              placeholder={t("phone") || "Phone"}
              inputBg={inputBg}
              textColor={textColor}
              muted={muted}
              icon="call-outline"
              keyboardType="phone-pad"
            />

            <Field
              label={t("email") || "Email"}
              value={form.email}
              onChangeText={(v) => handleInputChange("email", v)}
              placeholder={t("emailPlaceholder") || "Email"}
              inputBg={inputBg}
              textColor={textColor}
              muted={muted}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              onPress={handleSave}
              style={[styles.primaryBtn, { backgroundColor: Colors.primary }]}
              disabled={saving || uploading}
              activeOpacity={0.92}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.primaryText}>{t("save") || "Save"}</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.note, { color: muted }]}>
              If you changed email and get “requires recent login”, log out and log back in, then try again.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ================= UI PARTS ================= */
function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  inputBg: string;
  textColor: string;
  muted: string;
  icon: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.label, { color: props.muted }]}>{props.label}</Text>
      <View style={[styles.inputRow, { backgroundColor: props.inputBg }]}>
        <Ionicons name={props.icon as any} size={18} color={props.muted} />
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={props.muted}
          style={[styles.input, { color: props.textColor }]}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
        />
      </View>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  screen: { flex: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  hero: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.93)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  heroSub: { marginTop: 4, color: "rgba(22, 22, 22, 0.7)", fontWeight: "700", fontSize: 12.5 },
  logo: { height: 42, width: 42, resizeMode: "contain", 
    backgroundColor: "rgba(255, 255, 255, 0.93)", padding: 14, borderRadius: 20, },

  avatarCard: {
    marginTop: 10,
    borderRadius: 20,
    
    backgroundColor: "rgba(255, 255, 255, 0.93)",
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatarWrap: { width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#EEE" },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#1b1b1b", fontWeight: "900", fontSize: 18 },
  cameraBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarName: { color: "#0f0f0f", fontWeight: "900", fontSize: 15.5 },
  avatarEmail: { marginTop: 4, color: "rgba(49, 49, 49, 0.75)", fontWeight: "800", fontSize: 12.5 },
  avatarHint: { marginTop: 6, color: "rgba(32, 32, 32, 0.65)", fontWeight: "700", fontSize: 12 },

  card: {
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },

  sectionTitle: { fontSize: 15.5, fontWeight: "900" },

  label: { fontSize: 12, fontWeight: "900" },
  inputRow: {
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 14.5, fontWeight: "800" },

  primaryBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 14.5 },

  note: { marginTop: 12, fontSize: 12, fontWeight: "700", lineHeight: 17 },
});

export default UpdateProfileScreen;
